use db::models::{
    permission::{self, Permission},
    role::{system_roles, Role},
    workspace_member::{CreateWorkspaceMember, WorkspaceMember, WorkspaceMemberWithRole},
    workspace_team::{CreateWorkspaceTeam, UpdateWorkspaceTeam, WorkspaceTeam},
};
use sqlx::SqlitePool;
use thiserror::Error;
use uuid::Uuid;

#[derive(Debug, Error)]
pub enum WorkspaceTeamServiceError {
    #[error(transparent)]
    Database(#[from] sqlx::Error),
    #[error("Workspace team not found")]
    TeamNotFound,
    #[error("Member not found")]
    MemberNotFound,
    #[error("Role not found")]
    RoleNotFound,
    #[error("User is already a member of this workspace team")]
    AlreadyMember,
    #[error("Cannot remove the last owner")]
    LastOwner,
    #[error("Cannot change role of the last owner")]
    LastOwnerRoleChange,
    #[error("User does not have permission: {0}")]
    PermissionDenied(String),
    #[error("Cannot delete system role")]
    SystemRoleDelete,
}

pub type Result<T> = std::result::Result<T, WorkspaceTeamServiceError>;

#[derive(Clone, Default)]
pub struct WorkspaceTeamService;

impl WorkspaceTeamService {
    pub fn new() -> Self {
        Self
    }

    // ==================== Workspace Team CRUD ====================

    /// List all workspace teams
    pub async fn list_teams(&self, pool: &SqlitePool) -> Result<Vec<WorkspaceTeam>> {
        Ok(WorkspaceTeam::find_all(pool).await?)
    }

    /// Get a workspace team by ID
    pub async fn get_team(&self, pool: &SqlitePool, team_id: Uuid) -> Result<WorkspaceTeam> {
        WorkspaceTeam::find_by_id(pool, team_id)
            .await?
            .ok_or(WorkspaceTeamServiceError::TeamNotFound)
    }

    /// Create a new workspace team with the creator as owner
    pub async fn create_team(
        &self,
        pool: &SqlitePool,
        data: CreateWorkspaceTeam,
        creator_user_id: &str,
    ) -> Result<WorkspaceTeam> {
        let team = WorkspaceTeam::create(pool, &data).await?;

        // Add creator as owner
        let member_data = CreateWorkspaceMember {
            user_id: creator_user_id.to_string(),
            role_id: system_roles::OWNER,
            invited_by: None,
        };
        WorkspaceMember::create(pool, team.id, &member_data).await?;

        Ok(team)
    }

    /// Update a workspace team
    pub async fn update_team(
        &self,
        pool: &SqlitePool,
        team_id: Uuid,
        data: UpdateWorkspaceTeam,
    ) -> Result<WorkspaceTeam> {
        // Verify team exists
        let _ = self.get_team(pool, team_id).await?;

        Ok(WorkspaceTeam::update(pool, team_id, &data).await?)
    }

    /// Delete a workspace team
    pub async fn delete_team(&self, pool: &SqlitePool, team_id: Uuid) -> Result<()> {
        let rows = WorkspaceTeam::delete(pool, team_id).await?;
        if rows == 0 {
            return Err(WorkspaceTeamServiceError::TeamNotFound);
        }
        Ok(())
    }

    /// Find all workspace teams a user belongs to
    pub async fn find_teams_for_user(
        &self,
        pool: &SqlitePool,
        user_id: &str,
    ) -> Result<Vec<WorkspaceTeam>> {
        Ok(WorkspaceTeam::find_by_user_id(pool, user_id).await?)
    }

    // ==================== Member Management ====================

    /// List all members of a workspace team
    pub async fn list_members(
        &self,
        pool: &SqlitePool,
        team_id: Uuid,
    ) -> Result<Vec<WorkspaceMemberWithRole>> {
        // Verify team exists
        let _ = self.get_team(pool, team_id).await?;

        Ok(WorkspaceMember::find_all_with_role_for_team(pool, team_id).await?)
    }

    /// Add a member to a workspace team
    pub async fn add_member(
        &self,
        pool: &SqlitePool,
        team_id: Uuid,
        user_id: &str,
        role_id: Uuid,
        invited_by: Option<&str>,
    ) -> Result<WorkspaceMember> {
        // Verify team exists
        let _ = self.get_team(pool, team_id).await?;

        // Verify role exists
        Role::find_by_id(pool, role_id)
            .await?
            .ok_or(WorkspaceTeamServiceError::RoleNotFound)?;

        // Check if user is already a member
        if WorkspaceMember::find_by_team_and_user(pool, team_id, user_id)
            .await?
            .is_some()
        {
            return Err(WorkspaceTeamServiceError::AlreadyMember);
        }

        let data = CreateWorkspaceMember {
            user_id: user_id.to_string(),
            role_id,
            invited_by: invited_by.map(String::from),
        };

        Ok(WorkspaceMember::create(pool, team_id, &data).await?)
    }

    /// Update a member's role
    pub async fn update_member_role(
        &self,
        pool: &SqlitePool,
        team_id: Uuid,
        member_user_id: &str,
        new_role_id: Uuid,
    ) -> Result<WorkspaceMember> {
        let member = WorkspaceMember::find_by_team_and_user(pool, team_id, member_user_id)
            .await?
            .ok_or(WorkspaceTeamServiceError::MemberNotFound)?;

        // Verify new role exists
        Role::find_by_id(pool, new_role_id)
            .await?
            .ok_or(WorkspaceTeamServiceError::RoleNotFound)?;

        // If changing from owner role, verify it's not the last owner
        if member.role_id == system_roles::OWNER && new_role_id != system_roles::OWNER {
            let owner_count =
                WorkspaceMember::count_by_role(pool, team_id, system_roles::OWNER).await?;
            if owner_count <= 1 {
                return Err(WorkspaceTeamServiceError::LastOwnerRoleChange);
            }
        }

        Ok(WorkspaceMember::update_role(pool, member.id, new_role_id).await?)
    }

    /// Remove a member from a workspace team
    pub async fn remove_member(
        &self,
        pool: &SqlitePool,
        team_id: Uuid,
        member_user_id: &str,
    ) -> Result<()> {
        let member = WorkspaceMember::find_by_team_and_user(pool, team_id, member_user_id)
            .await?
            .ok_or(WorkspaceTeamServiceError::MemberNotFound)?;

        // If removing an owner, verify it's not the last owner
        if member.role_id == system_roles::OWNER {
            let owner_count =
                WorkspaceMember::count_by_role(pool, team_id, system_roles::OWNER).await?;
            if owner_count <= 1 {
                return Err(WorkspaceTeamServiceError::LastOwner);
            }
        }

        WorkspaceMember::delete(pool, member.id).await?;
        Ok(())
    }

    /// Get member's role in a team
    pub async fn get_member_role(
        &self,
        pool: &SqlitePool,
        team_id: Uuid,
        user_id: &str,
    ) -> Result<Option<Role>> {
        Ok(WorkspaceMember::get_role(pool, team_id, user_id).await?)
    }

    // ==================== Permission Checks ====================

    /// Check if a user has a specific permission in a workspace team
    pub async fn has_permission(
        &self,
        pool: &SqlitePool,
        team_id: Uuid,
        user_id: &str,
        permission_key: &str,
    ) -> Result<bool> {
        Ok(WorkspaceMember::has_permission(pool, team_id, user_id, permission_key).await?)
    }

    /// Get all permissions for a user in a workspace team
    pub async fn get_user_permissions(
        &self,
        pool: &SqlitePool,
        team_id: Uuid,
        user_id: &str,
    ) -> Result<Vec<String>> {
        Ok(WorkspaceMember::get_permissions(pool, team_id, user_id).await?)
    }

    /// Require a permission, returning an error if not granted
    pub async fn require_permission(
        &self,
        pool: &SqlitePool,
        team_id: Uuid,
        user_id: &str,
        permission_key: &str,
    ) -> Result<()> {
        if !self
            .has_permission(pool, team_id, user_id, permission_key)
            .await?
        {
            return Err(WorkspaceTeamServiceError::PermissionDenied(
                permission_key.to_string(),
            ));
        }
        Ok(())
    }

    // ==================== Role Management ====================

    /// List all roles
    pub async fn list_roles(&self, pool: &SqlitePool) -> Result<Vec<Role>> {
        Ok(Role::find_all(pool).await?)
    }

    /// Get a role by ID
    pub async fn get_role(&self, pool: &SqlitePool, role_id: Uuid) -> Result<Role> {
        Role::find_by_id(pool, role_id)
            .await?
            .ok_or(WorkspaceTeamServiceError::RoleNotFound)
    }

    /// Get permissions for a role
    pub async fn get_role_permissions(
        &self,
        pool: &SqlitePool,
        role_id: Uuid,
    ) -> Result<Vec<String>> {
        // Verify role exists
        let _ = self.get_role(pool, role_id).await?;

        Ok(Role::get_permissions(pool, role_id).await?)
    }

    // ==================== Permission Listing ====================

    /// List all available permissions
    pub async fn list_permissions(&self, pool: &SqlitePool) -> Result<Vec<Permission>> {
        Ok(Permission::find_all(pool).await?)
    }

    /// List permissions by category prefix (e.g., "workspace.", "task.")
    pub async fn list_permissions_by_category(
        &self,
        pool: &SqlitePool,
        prefix: &str,
    ) -> Result<Vec<Permission>> {
        Ok(Permission::find_by_prefix(pool, prefix).await?)
    }
}

/// Re-export permission keys for easy access
pub use permission::keys as permission_keys;
