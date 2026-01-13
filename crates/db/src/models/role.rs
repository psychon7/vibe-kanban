use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, SqlitePool};
use ts_rs::TS;
use uuid::Uuid;

/// Well-known role IDs for system roles
pub mod system_roles {
    use uuid::Uuid;

    pub const OWNER: Uuid = Uuid::from_u128(0x00000000_0000_0000_0000_000000000001);
    pub const ADMIN: Uuid = Uuid::from_u128(0x00000000_0000_0000_0000_000000000002);
    pub const MEMBER: Uuid = Uuid::from_u128(0x00000000_0000_0000_0000_000000000003);
    pub const VIEWER: Uuid = Uuid::from_u128(0x00000000_0000_0000_0000_000000000004);
}

#[derive(Debug, Clone, FromRow, Serialize, Deserialize, TS)]
pub struct Role {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub is_system: bool,
    #[ts(type = "Date")]
    pub created_at: DateTime<Utc>,
    #[ts(type = "Date")]
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Deserialize, TS)]
pub struct CreateRole {
    pub name: String,
    pub description: Option<String>,
}

#[derive(Debug, Clone, Deserialize, TS)]
pub struct UpdateRole {
    pub name: Option<String>,
    pub description: Option<String>,
}

impl Role {
    pub async fn find_all(pool: &SqlitePool) -> Result<Vec<Self>, sqlx::Error> {
        sqlx::query_as!(
            Role,
            r#"SELECT id as "id!: Uuid",
                      name,
                      description,
                      is_system as "is_system!: bool",
                      created_at as "created_at!: DateTime<Utc>",
                      updated_at as "updated_at!: DateTime<Utc>"
               FROM roles
               ORDER BY is_system DESC, name ASC"#
        )
        .fetch_all(pool)
        .await
    }

    pub async fn find_by_id(pool: &SqlitePool, id: Uuid) -> Result<Option<Self>, sqlx::Error> {
        sqlx::query_as!(
            Role,
            r#"SELECT id as "id!: Uuid",
                      name,
                      description,
                      is_system as "is_system!: bool",
                      created_at as "created_at!: DateTime<Utc>",
                      updated_at as "updated_at!: DateTime<Utc>"
               FROM roles
               WHERE id = $1"#,
            id
        )
        .fetch_optional(pool)
        .await
    }

    pub async fn find_by_name(pool: &SqlitePool, name: &str) -> Result<Option<Self>, sqlx::Error> {
        sqlx::query_as!(
            Role,
            r#"SELECT id as "id!: Uuid",
                      name,
                      description,
                      is_system as "is_system!: bool",
                      created_at as "created_at!: DateTime<Utc>",
                      updated_at as "updated_at!: DateTime<Utc>"
               FROM roles
               WHERE name = $1"#,
            name
        )
        .fetch_optional(pool)
        .await
    }

    pub async fn create(pool: &SqlitePool, data: &CreateRole) -> Result<Self, sqlx::Error> {
        let id = Uuid::new_v4();
        sqlx::query_as!(
            Role,
            r#"INSERT INTO roles (id, name, description, is_system)
               VALUES ($1, $2, $3, 0)
               RETURNING id as "id!: Uuid",
                         name,
                         description,
                         is_system as "is_system!: bool",
                         created_at as "created_at!: DateTime<Utc>",
                         updated_at as "updated_at!: DateTime<Utc>""#,
            id,
            data.name,
            data.description
        )
        .fetch_one(pool)
        .await
    }

    pub async fn update(
        pool: &SqlitePool,
        id: Uuid,
        data: &UpdateRole,
    ) -> Result<Self, sqlx::Error> {
        let existing = Self::find_by_id(pool, id)
            .await?
            .ok_or(sqlx::Error::RowNotFound)?;

        let name = data.name.clone().unwrap_or(existing.name);
        let description = data.description.clone().or(existing.description);

        sqlx::query_as!(
            Role,
            r#"UPDATE roles
               SET name = $2, description = $3, updated_at = datetime('now', 'subsec')
               WHERE id = $1
               RETURNING id as "id!: Uuid",
                         name,
                         description,
                         is_system as "is_system!: bool",
                         created_at as "created_at!: DateTime<Utc>",
                         updated_at as "updated_at!: DateTime<Utc>""#,
            id,
            name,
            description
        )
        .fetch_one(pool)
        .await
    }

    /// Delete a role - only non-system roles can be deleted
    pub async fn delete(pool: &SqlitePool, id: Uuid) -> Result<u64, sqlx::Error> {
        let result = sqlx::query!(
            "DELETE FROM roles WHERE id = $1 AND is_system = 0",
            id
        )
        .execute(pool)
        .await?;
        Ok(result.rows_affected())
    }

    /// Get all permissions for a role
    pub async fn get_permissions(pool: &SqlitePool, role_id: Uuid) -> Result<Vec<String>, sqlx::Error> {
        let records = sqlx::query!(
            r#"SELECT p.key
               FROM permissions p
               INNER JOIN role_permissions rp ON p.id = rp.permission_id
               WHERE rp.role_id = $1
               ORDER BY p.key"#,
            role_id
        )
        .fetch_all(pool)
        .await?;

        Ok(records.into_iter().map(|r| r.key).collect())
    }

    /// Check if a role has a specific permission
    pub async fn has_permission(
        pool: &SqlitePool,
        role_id: Uuid,
        permission_key: &str,
    ) -> Result<bool, sqlx::Error> {
        let result = sqlx::query!(
            r#"SELECT EXISTS(
                SELECT 1
                FROM role_permissions rp
                INNER JOIN permissions p ON rp.permission_id = p.id
                WHERE rp.role_id = $1 AND p.key = $2
            ) as "exists!: bool""#,
            role_id,
            permission_key
        )
        .fetch_one(pool)
        .await?;

        Ok(result.exists)
    }
}
