use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, PgPool};
pub use utils::api::organizations::InvitationStatus;
use uuid::Uuid;

use super::{
    identity_errors::IdentityError,
    workspace_members::{MemberRole, add_member, assert_admin, is_member},
};

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct WorkspaceInvitation {
    pub id: Uuid,
    pub workspace_id: Uuid,
    pub invited_by_user_id: Option<Uuid>,
    pub email: String,
    pub role: MemberRole,
    pub status: InvitationStatus,
    pub token: String,
    pub expires_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

pub struct WorkspaceInvitationRepository<'a> {
    pool: &'a PgPool,
}

impl<'a> WorkspaceInvitationRepository<'a> {
    pub fn new(pool: &'a PgPool) -> Self {
        Self { pool }
    }

    pub async fn create_invitation(
        &self,
        workspace_id: Uuid,
        invited_by_user_id: Uuid,
        email: &str,
        role: MemberRole,
        expires_at: DateTime<Utc>,
        token: &str,
    ) -> Result<WorkspaceInvitation, IdentityError> {
        assert_admin(self.pool, workspace_id, invited_by_user_id).await?;

        let invitation: WorkspaceInvitation = sqlx::query_as(
            r#"
            INSERT INTO workspace_invitations (
                workspace_id, invited_by_user_id, email, role, token, expires_at
            )
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING
                id,
                workspace_id,
                invited_by_user_id,
                email,
                role,
                status,
                token,
                expires_at,
                created_at,
                updated_at
            "#,
        )
        .bind(workspace_id)
        .bind(invited_by_user_id)
        .bind(email)
        .bind(role)
        .bind(token)
        .bind(expires_at)
        .fetch_one(self.pool)
        .await
        .map_err(|e| {
            if let Some(db_err) = e.as_database_error()
                && db_err.is_unique_violation()
            {
                return IdentityError::InvitationError(
                    "A pending invitation already exists for this email".to_string(),
                );
            }
            IdentityError::from(e)
        })?;

        Ok(invitation)
    }

    pub async fn list_invitations(
        &self,
        workspace_id: Uuid,
        requesting_user_id: Uuid,
    ) -> Result<Vec<WorkspaceInvitation>, IdentityError> {
        assert_admin(self.pool, workspace_id, requesting_user_id).await?;

        let invitations: Vec<WorkspaceInvitation> = sqlx::query_as(
            r#"
            SELECT
                id,
                workspace_id,
                invited_by_user_id,
                email,
                role,
                status,
                token,
                expires_at,
                created_at,
                updated_at
            FROM workspace_invitations
            WHERE workspace_id = $1
            ORDER BY created_at DESC
            "#,
        )
        .bind(workspace_id)
        .fetch_all(self.pool)
        .await?;

        Ok(invitations)
    }

    pub async fn get_invitation_by_token(
        &self,
        token: &str,
    ) -> Result<WorkspaceInvitation, IdentityError> {
        let invitation: Option<WorkspaceInvitation> = sqlx::query_as(
            r#"
            SELECT
                id,
                workspace_id,
                invited_by_user_id,
                email,
                role,
                status,
                token,
                expires_at,
                created_at,
                updated_at
            FROM workspace_invitations
            WHERE token = $1
            "#,
        )
        .bind(token)
        .fetch_optional(self.pool)
        .await?;

        invitation.ok_or(IdentityError::NotFound)
    }

    pub async fn revoke_invitation(
        &self,
        workspace_id: Uuid,
        invitation_id: Uuid,
        requesting_user_id: Uuid,
    ) -> Result<(), IdentityError> {
        assert_admin(self.pool, workspace_id, requesting_user_id).await?;

        let result = sqlx::query(
            r#"
            DELETE FROM workspace_invitations
            WHERE id = $1 AND workspace_id = $2
            "#,
        )
        .bind(invitation_id)
        .bind(workspace_id)
        .execute(self.pool)
        .await?;

        if result.rows_affected() == 0 {
            return Err(IdentityError::NotFound);
        }

        Ok(())
    }

    pub async fn accept_invitation(
        &self,
        token: &str,
        user_id: Uuid,
    ) -> Result<(Uuid, MemberRole), IdentityError> {
        let mut tx = self.pool.begin().await?;

        let invitation: Option<WorkspaceInvitation> = sqlx::query_as(
            r#"
            SELECT
                id,
                workspace_id,
                invited_by_user_id,
                email,
                role,
                status,
                token,
                expires_at,
                created_at,
                updated_at
            FROM workspace_invitations
            WHERE token = $1 AND status = 'pending'
            FOR UPDATE
            "#,
        )
        .bind(token)
        .fetch_optional(&mut *tx)
        .await?;

        let invitation = invitation.ok_or_else(|| {
            IdentityError::InvitationError("Invitation not found or already used".to_string())
        })?;

        if invitation.expires_at < Utc::now() {
            sqlx::query(
                r#"
                UPDATE workspace_invitations
                SET status = 'expired'
                WHERE id = $1
                "#,
            )
            .bind(invitation.id)
            .execute(&mut *tx)
            .await?;

            tx.commit().await?;
            return Err(IdentityError::InvitationError(
                "Invitation has expired".to_string(),
            ));
        }

        if is_member(&mut *tx, invitation.workspace_id, user_id).await? {
            tx.rollback().await?;
            return Err(IdentityError::InvitationError(
                "You are already a member of this workspace".to_string(),
            ));
        }

        add_member(
            &mut *tx,
            invitation.workspace_id,
            user_id,
            invitation.role,
        )
        .await?;

        sqlx::query(
            r#"
            UPDATE workspace_invitations
            SET status = 'accepted'
            WHERE id = $1
            "#,
        )
        .bind(invitation.id)
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;

        Ok((invitation.workspace_id, invitation.role))
    }
}
