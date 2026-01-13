use axum::{
    Json, Router,
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{delete, get, patch, post},
};
use chrono::{DateTime, Duration, Utc};
use sqlx::{FromRow, PgPool};
use utils::api::{
    organizations::MemberRole,
    workspaces::{
        AcceptWorkspaceInvitationResponse, GetWorkspaceInvitationResponse,
        InviteWorkspaceMemberRequest, InviteWorkspaceMemberResponse,
        ListWorkspaceInvitationsResponse, ListWorkspaceMembersResponse,
        RevokeWorkspaceInvitationRequest, UpdateWorkspaceMemberRoleRequest,
        UpdateWorkspaceMemberRoleResponse, WorkspaceInvitation as ApiWorkspaceInvitation,
        WorkspaceMemberWithProfile, WorkspacePermission,
    },
};
use uuid::Uuid;

use super::error::{ErrorResponse, membership_error};
use crate::{
    AppState,
    auth::RequestContext,
    db::{
        identity_errors::IdentityError,
        workspace_invitations::WorkspaceInvitationRepository,
        workspace_members::{self, assert_permission},
    },
};

pub fn public_router() -> Router<AppState> {
    Router::new().route("/workspace-invitations/{token}", get(get_invitation))
}

pub fn protected_router() -> Router<AppState> {
    Router::new()
        .route("/workspaces/{id}/members/invite", post(invite_member))
        .route("/workspaces/{id}/members", get(list_members))
        .route(
            "/workspaces/{id}/members/{user_id}",
            delete(remove_member),
        )
        .route(
            "/workspaces/{id}/members/{user_id}/role",
            patch(update_member_role),
        )
        .route(
            "/workspaces/{id}/invitations",
            get(list_invitations),
        )
        .route(
            "/workspaces/{id}/invitations/revoke",
            post(revoke_invitation),
        )
        .route(
            "/workspace-invitations/{token}/accept",
            post(accept_invitation),
        )
}

fn to_api_invitation(inv: crate::db::workspace_invitations::WorkspaceInvitation) -> ApiWorkspaceInvitation {
    ApiWorkspaceInvitation {
        id: inv.id,
        workspace_id: inv.workspace_id,
        invited_by_user_id: inv.invited_by_user_id,
        email: inv.email,
        role: inv.role,
        status: inv.status,
        token: inv.token,
        created_at: inv.created_at,
        expires_at: inv.expires_at,
    }
}

pub async fn invite_member(
    State(state): State<AppState>,
    axum::extract::Extension(ctx): axum::extract::Extension<RequestContext>,
    Path(workspace_id): Path<Uuid>,
    Json(payload): Json<InviteWorkspaceMemberRequest>,
) -> Result<impl IntoResponse, ErrorResponse> {
    let user = ctx.user;
    let invitation_repo = WorkspaceInvitationRepository::new(&state.pool);

    // Check permission: member.invite
    assert_permission(
        &state.pool,
        workspace_id,
        user.id,
        WorkspacePermission::MemberInvite,
    )
    .await
    .map_err(|e| membership_error(e, "Permission denied: member.invite required"))?;

    let token = Uuid::new_v4().to_string();
    let expires_at = Utc::now() + Duration::days(7);

    let invitation = invitation_repo
        .create_invitation(
            workspace_id,
            user.id,
            &payload.email,
            payload.role,
            expires_at,
            &token,
        )
        .await
        .map_err(|e| match e {
            IdentityError::PermissionDenied => {
                ErrorResponse::new(StatusCode::FORBIDDEN, "Admin access required")
            }
            IdentityError::InvitationError(msg) => ErrorResponse::new(StatusCode::BAD_REQUEST, msg),
            _ => ErrorResponse::new(StatusCode::INTERNAL_SERVER_ERROR, "Database error"),
        })?;

    // Send invitation email
    let accept_url = format!(
        "{}/workspace-invitations/{}/accept",
        state.server_public_base_url, token
    );
    state
        .mailer
        .send_workspace_invitation(
            workspace_id,
            &payload.email,
            &accept_url,
            payload.role,
            user.username.as_deref(),
        )
        .await;

    Ok((
        StatusCode::CREATED,
        Json(InviteWorkspaceMemberResponse {
            invitation: to_api_invitation(invitation),
        }),
    ))
}

#[derive(Debug, FromRow)]
struct MemberRow {
    workspace_id: Uuid,
    user_id: Uuid,
    role: MemberRole,
    joined_at: DateTime<Utc>,
    first_name: Option<String>,
    last_name: Option<String>,
    username: Option<String>,
    email: Option<String>,
    avatar_url: Option<String>,
}

pub async fn list_members(
    State(state): State<AppState>,
    axum::extract::Extension(ctx): axum::extract::Extension<RequestContext>,
    Path(workspace_id): Path<Uuid>,
) -> Result<impl IntoResponse, ErrorResponse> {
    let user = ctx.user;
    ensure_member_access(&state.pool, workspace_id, user.id).await?;

    let rows: Vec<MemberRow> = sqlx::query_as(
        r#"
        SELECT
            wmm.workspace_id,
            wmm.user_id,
            wmm.role,
            wmm.joined_at,
            u.first_name,
            u.last_name,
            u.username,
            u.email,
            oa.avatar_url
        FROM workspace_member_metadata wmm
        INNER JOIN users u ON wmm.user_id = u.id
        LEFT JOIN LATERAL (
            SELECT avatar_url
            FROM oauth_accounts
            WHERE user_id = wmm.user_id
            ORDER BY created_at ASC
            LIMIT 1
        ) oa ON true
        WHERE wmm.workspace_id = $1
        ORDER BY wmm.joined_at ASC
        "#,
    )
    .bind(workspace_id)
    .fetch_all(&state.pool)
    .await
    .map_err(|_| ErrorResponse::new(StatusCode::INTERNAL_SERVER_ERROR, "Database error"))?;

    let members: Vec<WorkspaceMemberWithProfile> = rows
        .into_iter()
        .map(|row| WorkspaceMemberWithProfile {
            workspace_id: row.workspace_id,
            user_id: row.user_id,
            role: row.role,
            permissions: vec![], // Permissions loaded separately if needed
            joined_at: row.joined_at,
            first_name: row.first_name,
            last_name: row.last_name,
            username: row.username,
            email: row.email,
            avatar_url: row.avatar_url,
        })
        .collect();

    Ok(Json(ListWorkspaceMembersResponse { members }))
}

pub async fn remove_member(
    State(state): State<AppState>,
    axum::extract::Extension(ctx): axum::extract::Extension<RequestContext>,
    Path((workspace_id, user_id)): Path<(Uuid, Uuid)>,
) -> Result<impl IntoResponse, ErrorResponse> {
    let user = ctx.user;
    if user.id == user_id {
        return Err(ErrorResponse::new(
            StatusCode::BAD_REQUEST,
            "Cannot remove yourself",
        ));
    }

    // Check permission: member.remove
    assert_permission(
        &state.pool,
        workspace_id,
        user.id,
        WorkspacePermission::MemberRemove,
    )
    .await
    .map_err(|e| membership_error(e, "Permission denied: member.remove required"))?;

    let mut tx = state
        .pool
        .begin()
        .await
        .map_err(|_| ErrorResponse::new(StatusCode::INTERNAL_SERVER_ERROR, "Database error"))?;

    let target_role: Option<MemberRole> = sqlx::query_scalar(
        r#"
        SELECT role
        FROM workspace_member_metadata
        WHERE workspace_id = $1 AND user_id = $2
        FOR UPDATE
        "#,
    )
    .bind(workspace_id)
    .bind(user_id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|_| ErrorResponse::new(StatusCode::INTERNAL_SERVER_ERROR, "Database error"))?;

    let target_role = target_role
        .ok_or_else(|| ErrorResponse::new(StatusCode::NOT_FOUND, "Member not found"))?;

    if target_role == MemberRole::Admin {
        let admin_ids: Vec<Uuid> = sqlx::query_scalar(
            r#"
            SELECT user_id
            FROM workspace_member_metadata
            WHERE workspace_id = $1 AND role = 'admin'
            FOR UPDATE
            "#,
        )
        .bind(workspace_id)
        .fetch_all(&mut *tx)
        .await
        .map_err(|_| ErrorResponse::new(StatusCode::INTERNAL_SERVER_ERROR, "Database error"))?;

        if admin_ids.len() == 1 && admin_ids[0] == user_id {
            return Err(ErrorResponse::new(
                StatusCode::CONFLICT,
                "Cannot remove the last admin",
            ));
        }
    }

    sqlx::query(
        r#"
        DELETE FROM workspace_member_metadata
        WHERE workspace_id = $1 AND user_id = $2
        "#,
    )
    .bind(workspace_id)
    .bind(user_id)
    .execute(&mut *tx)
    .await
    .map_err(|_| ErrorResponse::new(StatusCode::INTERNAL_SERVER_ERROR, "Database error"))?;

    tx.commit()
        .await
        .map_err(|_| ErrorResponse::new(StatusCode::INTERNAL_SERVER_ERROR, "Database error"))?;

    Ok(StatusCode::NO_CONTENT)
}

pub async fn update_member_role(
    State(state): State<AppState>,
    axum::extract::Extension(ctx): axum::extract::Extension<RequestContext>,
    Path((workspace_id, user_id)): Path<(Uuid, Uuid)>,
    Json(payload): Json<UpdateWorkspaceMemberRoleRequest>,
) -> Result<impl IntoResponse, ErrorResponse> {
    let user = ctx.user;
    if user.id == user_id && payload.role == MemberRole::Member {
        return Err(ErrorResponse::new(
            StatusCode::BAD_REQUEST,
            "Cannot demote yourself",
        ));
    }

    // Check permission: member.role.change
    assert_permission(
        &state.pool,
        workspace_id,
        user.id,
        WorkspacePermission::MemberRoleChange,
    )
    .await
    .map_err(|e| membership_error(e, "Permission denied: member.role.change required"))?;

    let mut tx = state
        .pool
        .begin()
        .await
        .map_err(|_| ErrorResponse::new(StatusCode::INTERNAL_SERVER_ERROR, "Database error"))?;

    let target_role: Option<MemberRole> = sqlx::query_scalar(
        r#"
        SELECT role
        FROM workspace_member_metadata
        WHERE workspace_id = $1 AND user_id = $2
        FOR UPDATE
        "#,
    )
    .bind(workspace_id)
    .bind(user_id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|_| ErrorResponse::new(StatusCode::INTERNAL_SERVER_ERROR, "Database error"))?;

    let target_role = target_role
        .ok_or_else(|| ErrorResponse::new(StatusCode::NOT_FOUND, "Member not found"))?;

    if target_role == payload.role {
        return Ok(Json(UpdateWorkspaceMemberRoleResponse {
            user_id,
            role: payload.role,
        }));
    }

    if target_role == MemberRole::Admin && payload.role == MemberRole::Member {
        let admin_ids: Vec<Uuid> = sqlx::query_scalar(
            r#"
            SELECT user_id
            FROM workspace_member_metadata
            WHERE workspace_id = $1 AND role = 'admin'
            FOR UPDATE
            "#,
        )
        .bind(workspace_id)
        .fetch_all(&mut *tx)
        .await
        .map_err(|_| ErrorResponse::new(StatusCode::INTERNAL_SERVER_ERROR, "Database error"))?;

        if admin_ids.len() == 1 && admin_ids[0] == user_id {
            return Err(ErrorResponse::new(
                StatusCode::CONFLICT,
                "Cannot demote the last admin",
            ));
        }
    }

    sqlx::query(
        r#"
        UPDATE workspace_member_metadata
        SET role = $3
        WHERE workspace_id = $1 AND user_id = $2
        "#,
    )
    .bind(workspace_id)
    .bind(user_id)
    .bind(payload.role)
    .execute(&mut *tx)
    .await
    .map_err(|_| ErrorResponse::new(StatusCode::INTERNAL_SERVER_ERROR, "Database error"))?;

    tx.commit()
        .await
        .map_err(|_| ErrorResponse::new(StatusCode::INTERNAL_SERVER_ERROR, "Database error"))?;

    Ok(Json(UpdateWorkspaceMemberRoleResponse {
        user_id,
        role: payload.role,
    }))
}

pub async fn list_invitations(
    State(state): State<AppState>,
    axum::extract::Extension(ctx): axum::extract::Extension<RequestContext>,
    Path(workspace_id): Path<Uuid>,
) -> Result<impl IntoResponse, ErrorResponse> {
    let user = ctx.user;
    let invitation_repo = WorkspaceInvitationRepository::new(&state.pool);

    workspace_members::assert_admin(&state.pool, workspace_id, user.id)
        .await
        .map_err(|e| membership_error(e, "Admin access required"))?;

    let invitations = invitation_repo
        .list_invitations(workspace_id, user.id)
        .await
        .map_err(|e| match e {
            IdentityError::PermissionDenied => {
                ErrorResponse::new(StatusCode::FORBIDDEN, "Admin access required")
            }
            IdentityError::InvitationError(msg) => ErrorResponse::new(StatusCode::BAD_REQUEST, msg),
            _ => ErrorResponse::new(StatusCode::INTERNAL_SERVER_ERROR, "Database error"),
        })?;

    Ok(Json(ListWorkspaceInvitationsResponse {
        invitations: invitations.into_iter().map(to_api_invitation).collect(),
    }))
}

pub async fn get_invitation(
    State(state): State<AppState>,
    Path(token): Path<String>,
) -> Result<impl IntoResponse, ErrorResponse> {
    let invitation_repo = WorkspaceInvitationRepository::new(&state.pool);

    let invitation = invitation_repo
        .get_invitation_by_token(&token)
        .await
        .map_err(|_| ErrorResponse::new(StatusCode::NOT_FOUND, "Invitation not found"))?;

    Ok(Json(GetWorkspaceInvitationResponse {
        id: invitation.id,
        workspace_id: invitation.workspace_id,
        role: invitation.role,
        expires_at: invitation.expires_at,
    }))
}

pub async fn revoke_invitation(
    State(state): State<AppState>,
    axum::extract::Extension(ctx): axum::extract::Extension<RequestContext>,
    Path(workspace_id): Path<Uuid>,
    Json(payload): Json<RevokeWorkspaceInvitationRequest>,
) -> Result<impl IntoResponse, ErrorResponse> {
    let user = ctx.user;
    let invitation_repo = WorkspaceInvitationRepository::new(&state.pool);

    workspace_members::assert_admin(&state.pool, workspace_id, user.id)
        .await
        .map_err(|e| membership_error(e, "Admin access required"))?;

    invitation_repo
        .revoke_invitation(workspace_id, payload.invitation_id, user.id)
        .await
        .map_err(|e| match e {
            IdentityError::PermissionDenied => {
                ErrorResponse::new(StatusCode::FORBIDDEN, "Admin access required")
            }
            IdentityError::NotFound => {
                ErrorResponse::new(StatusCode::NOT_FOUND, "Invitation not found")
            }
            _ => ErrorResponse::new(StatusCode::INTERNAL_SERVER_ERROR, "Database error"),
        })?;

    Ok(StatusCode::NO_CONTENT)
}

pub async fn accept_invitation(
    State(state): State<AppState>,
    axum::extract::Extension(ctx): axum::extract::Extension<RequestContext>,
    Path(token): Path<String>,
) -> Result<impl IntoResponse, ErrorResponse> {
    let user = ctx.user;
    let invitation_repo = WorkspaceInvitationRepository::new(&state.pool);

    let (workspace_id, role) = invitation_repo
        .accept_invitation(&token, user.id)
        .await
        .map_err(|e| match e {
            IdentityError::InvitationError(msg) => ErrorResponse::new(StatusCode::BAD_REQUEST, msg),
            IdentityError::NotFound => {
                ErrorResponse::new(StatusCode::NOT_FOUND, "Invitation not found")
            }
            _ => ErrorResponse::new(StatusCode::INTERNAL_SERVER_ERROR, "Database error"),
        })?;

    Ok(Json(AcceptWorkspaceInvitationResponse { workspace_id, role }))
}

pub(crate) async fn ensure_member_access(
    pool: &PgPool,
    workspace_id: Uuid,
    user_id: Uuid,
) -> Result<(), ErrorResponse> {
    workspace_members::assert_membership(pool, workspace_id, user_id)
        .await
        .map_err(|err| membership_error(err, "Not a member of workspace"))
}
