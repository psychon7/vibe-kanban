use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::Type;
use ts_rs::TS;
use uuid::Uuid;

use super::organizations::{InvitationStatus, MemberRole};

/// Workspace-level permissions for fine-grained access control
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type, TS)]
#[serde(rename_all = "snake_case")]
#[sqlx(type_name = "workspace_permission", rename_all = "snake_case")]
#[ts(export)]
#[ts(use_ts_enum)]
pub enum WorkspacePermission {
    #[serde(rename = "member.invite")]
    #[sqlx(rename = "member.invite")]
    MemberInvite,
    #[serde(rename = "member.remove")]
    #[sqlx(rename = "member.remove")]
    MemberRemove,
    #[serde(rename = "member.role.change")]
    #[sqlx(rename = "member.role.change")]
    MemberRoleChange,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct WorkspaceMember {
    pub workspace_id: Uuid,
    pub user_id: Uuid,
    pub role: MemberRole,
    pub permissions: Vec<WorkspacePermission>,
    pub joined_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct WorkspaceMemberWithProfile {
    pub workspace_id: Uuid,
    pub user_id: Uuid,
    pub role: MemberRole,
    pub permissions: Vec<WorkspacePermission>,
    pub joined_at: DateTime<Utc>,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub username: Option<String>,
    pub email: Option<String>,
    pub avatar_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct ListWorkspaceMembersResponse {
    pub members: Vec<WorkspaceMemberWithProfile>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct WorkspaceInvitation {
    pub id: Uuid,
    pub workspace_id: Uuid,
    pub invited_by_user_id: Option<Uuid>,
    pub email: String,
    pub role: MemberRole,
    pub status: InvitationStatus,
    pub token: String,
    pub created_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct InviteWorkspaceMemberRequest {
    pub email: String,
    pub role: MemberRole,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct InviteWorkspaceMemberResponse {
    pub invitation: WorkspaceInvitation,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct UpdateWorkspaceMemberRoleRequest {
    pub role: MemberRole,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct UpdateWorkspaceMemberRoleResponse {
    pub user_id: Uuid,
    pub role: MemberRole,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct GetWorkspaceInvitationResponse {
    pub id: Uuid,
    pub workspace_id: Uuid,
    pub role: MemberRole,
    pub expires_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct AcceptWorkspaceInvitationResponse {
    pub workspace_id: Uuid,
    pub role: MemberRole,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
pub struct RevokeWorkspaceInvitationRequest {
    pub invitation_id: Uuid,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct ListWorkspaceInvitationsResponse {
    pub invitations: Vec<WorkspaceInvitation>,
}
