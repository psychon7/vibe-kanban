use sqlx::{Executor, PgPool, Postgres};
pub use utils::api::organizations::MemberRole;
pub use utils::api::workspaces::WorkspacePermission;
use uuid::Uuid;

use super::identity_errors::IdentityError;

pub async fn add_member<'a, E>(
    executor: E,
    workspace_id: Uuid,
    user_id: Uuid,
    role: MemberRole,
) -> Result<(), sqlx::Error>
where
    E: Executor<'a, Database = Postgres>,
{
    sqlx::query(
        r#"
        INSERT INTO workspace_member_metadata (workspace_id, user_id, role)
        VALUES ($1, $2, $3)
        ON CONFLICT (workspace_id, user_id) DO UPDATE
        SET role = EXCLUDED.role
        "#,
    )
    .bind(workspace_id)
    .bind(user_id)
    .bind(role)
    .execute(executor)
    .await?;

    Ok(())
}

pub async fn check_user_role(
    pool: &PgPool,
    workspace_id: Uuid,
    user_id: Uuid,
) -> Result<Option<MemberRole>, IdentityError> {
    let result: Option<MemberRole> = sqlx::query_scalar(
        r#"
        SELECT role
        FROM workspace_member_metadata
        WHERE workspace_id = $1 AND user_id = $2
        "#,
    )
    .bind(workspace_id)
    .bind(user_id)
    .fetch_optional(pool)
    .await?;

    Ok(result)
}

pub async fn is_member<'a, E>(
    executor: E,
    workspace_id: Uuid,
    user_id: Uuid,
) -> Result<bool, IdentityError>
where
    E: Executor<'a, Database = Postgres>,
{
    let exists: bool = sqlx::query_scalar(
        r#"
        SELECT EXISTS(
            SELECT 1
            FROM workspace_member_metadata
            WHERE workspace_id = $1 AND user_id = $2
        )
        "#,
    )
    .bind(workspace_id)
    .bind(user_id)
    .fetch_one(executor)
    .await?;

    Ok(exists)
}

pub async fn assert_membership(
    pool: &PgPool,
    workspace_id: Uuid,
    user_id: Uuid,
) -> Result<(), IdentityError> {
    let exists = is_member(pool, workspace_id, user_id).await?;

    if exists {
        Ok(())
    } else {
        Err(IdentityError::NotFound)
    }
}

pub async fn assert_admin(
    pool: &PgPool,
    workspace_id: Uuid,
    user_id: Uuid,
) -> Result<(), IdentityError> {
    let role = check_user_role(pool, workspace_id, user_id).await?;
    match role {
        Some(MemberRole::Admin) => Ok(()),
        _ => Err(IdentityError::PermissionDenied),
    }
}

pub async fn has_permission(
    pool: &PgPool,
    workspace_id: Uuid,
    user_id: Uuid,
    permission: WorkspacePermission,
) -> Result<bool, IdentityError> {
    // Admins have all permissions
    let role = check_user_role(pool, workspace_id, user_id).await?;
    if let Some(MemberRole::Admin) = role {
        return Ok(true);
    }

    // Check explicit permissions
    let permission_str = match permission {
        WorkspacePermission::MemberInvite => "member.invite",
        WorkspacePermission::MemberRemove => "member.remove",
        WorkspacePermission::MemberRoleChange => "member.role.change",
    };

    let result: bool = sqlx::query_scalar(
        r#"
        SELECT EXISTS(
            SELECT 1
            FROM workspace_member_metadata
            WHERE workspace_id = $1
              AND user_id = $2
              AND $3 = ANY(permissions)
        )
        "#,
    )
    .bind(workspace_id)
    .bind(user_id)
    .bind(permission_str)
    .fetch_one(pool)
    .await?;

    Ok(result)
}

pub async fn assert_permission(
    pool: &PgPool,
    workspace_id: Uuid,
    user_id: Uuid,
    permission: WorkspacePermission,
) -> Result<(), IdentityError> {
    if has_permission(pool, workspace_id, user_id, permission).await? {
        Ok(())
    } else {
        Err(IdentityError::PermissionDenied)
    }
}
