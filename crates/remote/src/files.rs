use std::time::Duration;

use aws_credential_types::Credentials;
use aws_sdk_s3::{
    Client,
    config::{Builder as S3ConfigBuilder, IdentityCache},
    presigning::PresigningConfig,
};
use chrono::{DateTime, Utc};
use secrecy::ExposeSecret;
use uuid::Uuid;

use crate::config::FilesR2Config;

/// Allowed MIME types for avatar uploads
pub const ALLOWED_AVATAR_TYPES: &[&str] = &["image/jpeg", "image/png", "image/gif", "image/webp"];

/// Maximum file size for avatars (5MB default, configurable via env)
pub const DEFAULT_MAX_AVATAR_SIZE: u64 = 5 * 1024 * 1024;

#[derive(Clone)]
pub struct FilesService {
    client: Client,
    bucket: String,
    public_url: String,
    presign_expiry: Duration,
    max_file_size: u64,
}

#[derive(Debug)]
pub struct PresignedUpload {
    pub upload_url: String,
    pub object_key: String,
    pub public_url: String,
    pub expires_at: DateTime<Utc>,
}

#[derive(Debug)]
pub struct FileInfo {
    pub key: String,
    pub public_url: String,
    pub size: Option<i64>,
    pub last_modified: Option<DateTime<Utc>>,
}

#[derive(Debug, thiserror::Error)]
pub enum FilesError {
    #[error("presign config error: {0}")]
    PresignConfig(String),
    #[error("presign error: {0}")]
    Presign(String),
    #[error("file type not allowed: {0}")]
    InvalidFileType(String),
    #[error("file size exceeds maximum allowed: {0} bytes (max: {1} bytes)")]
    FileTooLarge(u64, u64),
    #[error("delete error: {0}")]
    Delete(String),
    #[error("list error: {0}")]
    List(String),
}

impl FilesService {
    pub fn new(config: &FilesR2Config) -> Self {
        let credentials = Credentials::new(
            &config.access_key_id,
            config.secret_access_key.expose_secret(),
            None,
            None,
            "r2-files-static",
        );

        let s3_config = S3ConfigBuilder::new()
            .region(aws_sdk_s3::config::Region::new("auto"))
            .endpoint_url(&config.endpoint)
            .credentials_provider(credentials)
            .force_path_style(true)
            .stalled_stream_protection(
                aws_sdk_s3::config::StalledStreamProtectionConfig::disabled(),
            )
            .identity_cache(IdentityCache::no_cache())
            .build();

        let client = Client::from_conf(s3_config);

        Self {
            client,
            bucket: config.bucket.clone(),
            public_url: config.public_url.trim_end_matches('/').to_string(),
            presign_expiry: Duration::from_secs(config.presign_expiry_secs),
            max_file_size: config.max_file_size_bytes,
        }
    }

    /// Validate file type for avatar uploads
    pub fn validate_avatar_type(content_type: &str) -> Result<(), FilesError> {
        if !ALLOWED_AVATAR_TYPES.contains(&content_type) {
            return Err(FilesError::InvalidFileType(format!(
                "{} (allowed: {})",
                content_type,
                ALLOWED_AVATAR_TYPES.join(", ")
            )));
        }
        Ok(())
    }

    /// Validate file size
    pub fn validate_file_size(&self, size: u64) -> Result<(), FilesError> {
        if size > self.max_file_size {
            return Err(FilesError::FileTooLarge(size, self.max_file_size));
        }
        Ok(())
    }

    /// Get the maximum allowed file size
    pub fn max_file_size(&self) -> u64 {
        self.max_file_size
    }

    /// Create a presigned URL for avatar upload
    pub async fn create_avatar_upload_url(
        &self,
        user_id: Uuid,
        content_type: &str,
        content_length: Option<u64>,
    ) -> Result<PresignedUpload, FilesError> {
        // Validate content type
        Self::validate_avatar_type(content_type)?;

        // Validate content length if provided
        if let Some(size) = content_length {
            self.validate_file_size(size)?;
        }

        // Generate unique filename with extension based on content type
        let extension = match content_type {
            "image/jpeg" => "jpg",
            "image/png" => "png",
            "image/gif" => "gif",
            "image/webp" => "webp",
            _ => "bin",
        };

        let file_id = Uuid::new_v4();
        let object_key = format!("avatars/{user_id}/{file_id}.{extension}");

        let presigning_config = PresigningConfig::builder()
            .expires_in(self.presign_expiry)
            .build()
            .map_err(|e| FilesError::PresignConfig(e.to_string()))?;

        let request = self
            .client
            .put_object()
            .bucket(&self.bucket)
            .key(&object_key)
            .content_type(content_type);

        let presigned = request
            .presigned(presigning_config)
            .await
            .map_err(|e| FilesError::Presign(e.to_string()))?;

        let expires_at = Utc::now()
            + chrono::Duration::from_std(self.presign_expiry)
                .unwrap_or(chrono::Duration::minutes(5));

        let public_url = format!("{}/{}", self.public_url, object_key);

        Ok(PresignedUpload {
            upload_url: presigned.uri().to_string(),
            object_key,
            public_url,
            expires_at,
        })
    }

    /// Delete a file from R2
    pub async fn delete_file(&self, object_key: &str) -> Result<(), FilesError> {
        self.client
            .delete_object()
            .bucket(&self.bucket)
            .key(object_key)
            .send()
            .await
            .map_err(|e| FilesError::Delete(e.to_string()))?;

        Ok(())
    }

    /// Delete all files in a user's avatar folder
    pub async fn delete_user_avatars(&self, user_id: Uuid) -> Result<u32, FilesError> {
        let prefix = format!("avatars/{user_id}/");
        let mut deleted_count = 0u32;

        let mut continuation_token: Option<String> = None;

        loop {
            let mut request = self
                .client
                .list_objects_v2()
                .bucket(&self.bucket)
                .prefix(&prefix);

            if let Some(token) = continuation_token {
                request = request.continuation_token(token);
            }

            let response = request
                .send()
                .await
                .map_err(|e| FilesError::List(e.to_string()))?;

            if let Some(contents) = response.contents {
                for object in contents {
                    if let Some(key) = object.key {
                        self.delete_file(&key).await?;
                        deleted_count += 1;
                    }
                }
            }

            if response.is_truncated == Some(true) {
                continuation_token = response.next_continuation_token;
            } else {
                break;
            }
        }

        Ok(deleted_count)
    }

    /// List files for a user
    pub async fn list_user_avatars(&self, user_id: Uuid) -> Result<Vec<FileInfo>, FilesError> {
        let prefix = format!("avatars/{user_id}/");
        let mut files = Vec::new();

        let mut continuation_token: Option<String> = None;

        loop {
            let mut request = self
                .client
                .list_objects_v2()
                .bucket(&self.bucket)
                .prefix(&prefix);

            if let Some(token) = continuation_token {
                request = request.continuation_token(token);
            }

            let response = request
                .send()
                .await
                .map_err(|e| FilesError::List(e.to_string()))?;

            if let Some(contents) = response.contents {
                for object in contents {
                    if let Some(key) = object.key {
                        let public_url = format!("{}/{}", self.public_url, key);
                        let last_modified = object
                            .last_modified
                            .and_then(|dt| DateTime::from_timestamp(dt.secs(), dt.subsec_nanos()));

                        files.push(FileInfo {
                            key,
                            public_url,
                            size: object.size,
                            last_modified,
                        });
                    }
                }
            }

            if response.is_truncated == Some(true) {
                continuation_token = response.next_continuation_token;
            } else {
                break;
            }
        }

        Ok(files)
    }

    /// Get the public URL for an object key
    pub fn get_public_url(&self, object_key: &str) -> String {
        format!("{}/{}", self.public_url, object_key)
    }

    /// Extract the object key from a public URL
    pub fn extract_object_key(&self, public_url: &str) -> Option<String> {
        public_url
            .strip_prefix(&self.public_url)
            .map(|s| s.trim_start_matches('/').to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_avatar_type() {
        assert!(FilesService::validate_avatar_type("image/jpeg").is_ok());
        assert!(FilesService::validate_avatar_type("image/png").is_ok());
        assert!(FilesService::validate_avatar_type("image/gif").is_ok());
        assert!(FilesService::validate_avatar_type("image/webp").is_ok());
        assert!(FilesService::validate_avatar_type("application/pdf").is_err());
        assert!(FilesService::validate_avatar_type("text/plain").is_err());
    }
}
