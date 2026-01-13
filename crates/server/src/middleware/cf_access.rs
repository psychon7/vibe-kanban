//! Cloudflare Access Zero Trust authentication middleware.
//!
//! This module handles authentication via Cloudflare Access JWT tokens.
//! When a request comes through Cloudflare Access, it includes a JWT assertion
//! in the `CF-Access-JWT-Assertion` header.

use axum::{
    body::Body,
    extract::State,
    http::{Request, StatusCode},
    middleware::Next,
    response::{IntoResponse, Response},
};
use chrono::{DateTime, TimeZone, Utc};
use db::models::{
    user::{UpsertUser, User},
    user_session::UserSession,
};
use deployment::Deployment;
use serde::{Deserialize, Serialize};
use thiserror::Error;
use tracing::warn;

use crate::DeploymentImpl;

/// Header name for CF Access JWT assertion
pub const CF_ACCESS_JWT_HEADER: &str = "CF-Access-JWT-Assertion";

/// Header name for CF Access client ID (service token auth)
pub const CF_ACCESS_CLIENT_ID_HEADER: &str = "CF-Access-Client-Id";

/// Header name for CF Access client secret (service token auth)
pub const CF_ACCESS_CLIENT_SECRET_HEADER: &str = "CF-Access-Client-Secret";

/// Claims from a Cloudflare Access JWT
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CfAccessClaims {
    /// Subject (user identifier from identity provider)
    pub sub: String,
    /// Email address
    pub email: String,
    /// Token type (usually "app")
    #[serde(rename = "type")]
    pub token_type: Option<String>,
    /// Issued at (Unix timestamp)
    pub iat: i64,
    /// Expiration time (Unix timestamp)
    pub exp: i64,
    /// Issuer (Cloudflare Access team domain)
    pub iss: Option<String>,
    /// Audience (Access Application ID)
    pub aud: Option<serde_json::Value>,
    /// User's name (if available)
    pub name: Option<String>,
    /// Identity nonce
    pub identity_nonce: Option<String>,
    /// Custom claims from identity provider
    #[serde(default)]
    pub custom: Option<serde_json::Value>,
}

/// Request context containing the authenticated user and session
#[derive(Debug, Clone)]
pub struct AuthContext {
    pub user: User,
    pub session: UserSession,
    pub claims: CfAccessClaims,
}

#[derive(Debug, Error)]
pub enum CfAccessError {
    #[error("Missing CF-Access-JWT-Assertion header")]
    MissingJwt,
    #[error("Invalid JWT format")]
    InvalidJwtFormat,
    #[error("JWT decode error: {0}")]
    JwtDecode(String),
    #[error("JWT expired")]
    JwtExpired,
    #[error("Database error: {0}")]
    Database(String),
    #[error("Invalid configuration: {0}")]
    Configuration(String),
}

impl CfAccessClaims {
    /// Decode JWT claims without verification (for local development)
    /// In production, you should verify the JWT signature against Cloudflare's public keys
    pub fn decode_unverified(token: &str) -> Result<Self, CfAccessError> {
        // JWT format: header.payload.signature
        let parts: Vec<&str> = token.split('.').collect();
        if parts.len() != 3 {
            return Err(CfAccessError::InvalidJwtFormat);
        }

        // Decode the payload (second part)
        let payload = base64_url_decode(parts[1])?;
        let claims: CfAccessClaims =
            serde_json::from_slice(&payload).map_err(|e| CfAccessError::JwtDecode(e.to_string()))?;

        // Check expiration
        let now = Utc::now().timestamp();
        if claims.exp < now {
            return Err(CfAccessError::JwtExpired);
        }

        Ok(claims)
    }

    /// Get expiration as DateTime
    pub fn expires_at(&self) -> DateTime<Utc> {
        Utc.timestamp_opt(self.exp, 0).unwrap()
    }

    /// Get issued at as DateTime
    pub fn issued_at(&self) -> DateTime<Utc> {
        Utc.timestamp_opt(self.iat, 0).unwrap()
    }

    /// Get display name (falls back to email prefix if name not available)
    pub fn display_name(&self) -> String {
        self.name
            .clone()
            .unwrap_or_else(|| self.email.split('@').next().unwrap_or("User").to_string())
    }
}

/// Decode base64url-encoded data
fn base64_url_decode(input: &str) -> Result<Vec<u8>, CfAccessError> {
    // Add padding if necessary
    let padding = match input.len() % 4 {
        2 => "==",
        3 => "=",
        _ => "",
    };
    let padded = format!("{}{}", input, padding);

    // Replace URL-safe characters
    let standard = padded.replace('-', "+").replace('_', "/");

    // Use a simple base64 decode
    base64_decode(&standard).map_err(|e| CfAccessError::JwtDecode(e.to_string()))
}

/// Simple base64 decode implementation
fn base64_decode(input: &str) -> Result<Vec<u8>, String> {
    const ALPHABET: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

    let mut output = Vec::new();
    let mut buffer = 0u32;
    let mut bits = 0u32;

    for c in input.chars() {
        if c == '=' {
            break;
        }

        let value = ALPHABET.iter().position(|&b| b == c as u8).ok_or_else(|| {
            format!("Invalid base64 character: {}", c)
        })? as u32;

        buffer = (buffer << 6) | value;
        bits += 6;

        if bits >= 8 {
            bits -= 8;
            output.push((buffer >> bits) as u8);
            buffer &= (1 << bits) - 1;
        }
    }

    Ok(output)
}

/// Middleware that requires Cloudflare Access authentication.
/// Extracts user from CF-Access-JWT-Assertion header, syncs user to database,
/// creates/updates session, and adds AuthContext to request extensions.
pub async fn require_cf_access_auth(
    State(deployment): State<DeploymentImpl>,
    mut req: Request<Body>,
    next: Next,
) -> Response {
    // Extract JWT from header
    let jwt = match req.headers().get(CF_ACCESS_JWT_HEADER) {
        Some(value) => match value.to_str() {
            Ok(s) => s.to_string(),
            Err(_) => {
                warn!("Invalid CF-Access-JWT-Assertion header encoding");
                return StatusCode::UNAUTHORIZED.into_response();
            }
        },
        None => {
            warn!("Missing CF-Access-JWT-Assertion header");
            return StatusCode::UNAUTHORIZED.into_response();
        }
    };

    // Decode and validate claims
    let claims = match CfAccessClaims::decode_unverified(&jwt) {
        Ok(claims) => claims,
        Err(CfAccessError::JwtExpired) => {
            warn!("CF Access JWT expired");
            return StatusCode::UNAUTHORIZED.into_response();
        }
        Err(e) => {
            warn!(?e, "Failed to decode CF Access JWT");
            return StatusCode::UNAUTHORIZED.into_response();
        }
    };

    let pool = &deployment.db().pool;

    // Sync user from CF Access identity
    let user_data = UpsertUser {
        email: claims.email.clone(),
        name: claims.display_name(),
        avatar_url: None,
        cf_access_id: Some(claims.sub.clone()),
    };

    let user = match User::upsert(pool, &user_data).await {
        Ok(user) => user,
        Err(e) => {
            warn!(?e, "Failed to upsert user from CF Access");
            return StatusCode::INTERNAL_SERVER_ERROR.into_response();
        }
    };

    // Create or update session
    let session = match UserSession::create(pool, user.id, Some(&claims.sub), None).await {
        Ok(session) => session,
        Err(e) => {
            warn!(?e, "Failed to create session");
            return StatusCode::INTERNAL_SERVER_ERROR.into_response();
        }
    };

    // Add auth context to request extensions
    req.extensions_mut().insert(AuthContext {
        user,
        session,
        claims,
    });

    next.run(req).await
}

/// Optional middleware that extracts CF Access auth if present but doesn't require it.
/// Useful for routes that work with or without authentication.
pub async fn optional_cf_access_auth(
    State(deployment): State<DeploymentImpl>,
    mut req: Request<Body>,
    next: Next,
) -> Response {
    // Try to extract JWT from header
    if let Some(jwt_header) = req.headers().get(CF_ACCESS_JWT_HEADER) {
        if let Ok(jwt) = jwt_header.to_str() {
            if let Ok(claims) = CfAccessClaims::decode_unverified(jwt) {
                let pool = &deployment.db().pool;

                // Sync user from CF Access identity
                let user_data = UpsertUser {
                    email: claims.email.clone(),
                    name: claims.display_name(),
                    avatar_url: None,
                    cf_access_id: Some(claims.sub.clone()),
                };

                if let Ok(user) = User::upsert(pool, &user_data).await {
                    if let Ok(session) =
                        UserSession::create(pool, user.id, Some(&claims.sub), None).await
                    {
                        req.extensions_mut().insert(AuthContext {
                            user,
                            session,
                            claims,
                        });
                    }
                }
            }
        }
    }

    next.run(req).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_base64_url_decode() {
        // Test basic decoding
        let encoded = "SGVsbG8gV29ybGQ"; // "Hello World"
        let decoded = base64_url_decode(encoded).unwrap();
        assert_eq!(String::from_utf8(decoded).unwrap(), "Hello World");
    }

    #[test]
    fn test_claims_display_name() {
        let claims = CfAccessClaims {
            sub: "user123".to_string(),
            email: "test@example.com".to_string(),
            token_type: None,
            iat: 0,
            exp: i64::MAX,
            iss: None,
            aud: None,
            name: None,
            identity_nonce: None,
            custom: None,
        };

        // Without name, should use email prefix
        assert_eq!(claims.display_name(), "test");

        // With name, should use name
        let claims_with_name = CfAccessClaims {
            name: Some("John Doe".to_string()),
            ..claims
        };
        assert_eq!(claims_with_name.display_name(), "John Doe");
    }
}
