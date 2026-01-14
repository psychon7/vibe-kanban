use anyhow::{self, Error as AnyhowError};
use axum::http::HeaderValue;
use clap::{Parser, Subcommand};
use deployment::{Deployment, DeploymentError};
use futures_util::{SinkExt, StreamExt};
use server::{DeploymentImpl, routes};
use services::services::container::ContainerService;
use sqlx::Error as SqlxError;
use strip_ansi_escapes::strip;
use thiserror::Error;
use tokio_tungstenite::{connect_async, tungstenite::{protocol::Message, client::IntoClientRequest}};
use tracing_subscriber::{EnvFilter, prelude::*};
use utils::{
    assets::asset_dir,
    browser::open_browser,
    port_file::write_port_file,
    sentry::{self as sentry_utils, SentrySource, sentry_layer},
};

#[derive(Debug, Error)]
pub enum VibeKanbanError {
    #[error(transparent)]
    Io(#[from] std::io::Error),
    #[error(transparent)]
    Sqlx(#[from] SqlxError),
    #[error(transparent)]
    Deployment(#[from] DeploymentError),
    #[error(transparent)]
    Other(#[from] AnyhowError),
}

#[derive(Parser)]
#[command(author, version, about, long_about = None)]
struct Cli {
    #[command(subcommand)]
    command: Option<Commands>,
}

#[derive(Subcommand)]
enum Commands {
    /// Start the server (default)
    Server,
    /// Connect to the remote dashboard
    Connect {
        /// Connection token
        #[arg(short, long, env = "VIBE_TOKEN")]
        token: String,
        
        /// Remote API URL (WebSocket endpoint)
        #[arg(long, default_value = "wss://vibe-kanban.pages.dev/api/v1/agents/local/ws")]
        url: String,
    },
}

#[tokio::main]
async fn main() -> Result<(), VibeKanbanError> {
    // Install rustls crypto provider before any TLS operations
    rustls::crypto::aws_lc_rs::default_provider()
        .install_default()
        .expect("Failed to install rustls crypto provider");

    sentry_utils::init_once(SentrySource::Backend);

    let log_level = std::env::var("RUST_LOG").unwrap_or_else(|_| "info".to_string());
    let filter_string = format!(
        "warn,server={level},services={level},db={level},executors={level},deployment={level},local_deployment={level},utils={level}",
        level = log_level
    );
    let env_filter = EnvFilter::try_new(filter_string).expect("Failed to create tracing filter");
    tracing_subscriber::registry()
        .with(tracing_subscriber::fmt::layer().with_filter(env_filter))
        .with(sentry_layer())
        .init();

    // Create asset directory if it doesn't exist
    if !asset_dir().exists() {
        std::fs::create_dir_all(asset_dir())?;
    }

    let cli = Cli::parse();

    match cli.command.unwrap_or(Commands::Server) {
        Commands::Server => run_server().await,
        Commands::Connect { token, url } => run_connect(token, url).await,
    }
}

async fn run_server() -> Result<(), VibeKanbanError> {
    let deployment = DeploymentImpl::new().await?;
    deployment.update_sentry_scope().await?;
    deployment
        .container()
        .cleanup_orphan_executions()
        .await
        .map_err(DeploymentError::from)?;
    deployment
        .container()
        .backfill_before_head_commits()
        .await
        .map_err(DeploymentError::from)?;
    deployment
        .container()
        .backfill_repo_names()
        .await
        .map_err(DeploymentError::from)?;
    deployment.spawn_pr_monitor_service().await;
    deployment
        .track_if_analytics_allowed("session_start", serde_json::json!({}))
        .await;
    // Pre-warm file search cache for most active projects
    let deployment_for_cache = deployment.clone();
    tokio::spawn(async move {
        if let Err(e) = deployment_for_cache
            .file_search_cache()
            .warm_most_active(&deployment_for_cache.db().pool, 3)
            .await
        {
            tracing::warn!("Failed to warm file search cache: {}", e);
        }
    });

    // Verify shared tasks in background
    let deployment_for_verification = deployment.clone();
    tokio::spawn(async move {
        if let Some(publisher) = deployment_for_verification.container().share_publisher()
            && let Err(e) = publisher.cleanup_shared_tasks().await
        {
            tracing::warn!("Failed to verify shared tasks: {}", e);
        }
    });

    let app_router = routes::router(deployment.clone());

    let port = std::env::var("BACKEND_PORT")
        .or_else(|_| std::env::var("PORT"))
        .ok()
        .and_then(|s| {
            // remove any ANSI codes, then turn into String
            let cleaned =
                String::from_utf8(strip(s.as_bytes())).expect("UTF-8 after stripping ANSI");
            cleaned.trim().parse::<u16>().ok()
        })
        .unwrap_or_else(|| {
            tracing::info!("No PORT environment variable set, using port 0 for auto-assignment");
            0
        }); // Use 0 to find free port if no specific port provided

    let host = std::env::var("HOST").unwrap_or_else(|_| "127.0.0.1".to_string());
    let listener = tokio::net::TcpListener::bind(format!("{host}:{port}")).await?;
    let actual_port = listener.local_addr()?.port(); // get → 53427 (example)

    // Write port file for discovery if prod, warn on fail
    if let Err(e) = write_port_file(actual_port).await {
        tracing::warn!("Failed to write port file: {}", e);
    }

    tracing::info!("Server running on http://{host}:{actual_port}");

    if !cfg!(debug_assertions) {
        tracing::info!("Opening browser...");
        tokio::spawn(async move {
            if let Err(e) = open_browser(&format!("http://127.0.0.1:{actual_port}")).await {
                tracing::warn!(
                    "Failed to open browser automatically: {}. Please open http://127.0.0.1:{} manually.",
                    e,
                    actual_port
                );
            }
        });
    }

    axum::serve(listener, app_router)
        .with_graceful_shutdown(shutdown_signal())
        .await?;

    perform_cleanup_actions(&deployment).await;

    Ok(())
}

async fn run_connect(token: String, url: String) -> Result<(), VibeKanbanError> {
    tracing::info!("Initializing local agent environment...");
    let _deployment = DeploymentImpl::new().await?;
    
    tracing::info!("Connecting to {}...", url);

    // Construct the request with Authorization header
    let mut request = url.into_client_request()
        .map_err(|e| VibeKanbanError::Other(anyhow::anyhow!(e)))?;
    
    request.headers_mut().insert(
        "Authorization", 
        HeaderValue::from_str(&format!("Bearer {}", token))
            .map_err(|e| VibeKanbanError::Other(anyhow::anyhow!(e)))?
    );

    let (ws_stream, _) = connect_async(request).await
        .map_err(|e| VibeKanbanError::Other(anyhow::anyhow!("Failed to connect: {}", e)))?;
    
    tracing::info!("Connected to remote dashboard");
    let (mut write, mut read) = ws_stream.split();

    // Send initial heartbeat
    write.send(Message::Text(serde_json::json!({ "type": "HEARTBEAT" }).to_string()))
        .await
        .map_err(|e| VibeKanbanError::Other(anyhow::anyhow!(e)))?;

    // Heartbeat loop
    let mut interval = tokio::time::interval(std::time::Duration::from_secs(15));

    loop {
        tokio::select! {
            _ = interval.tick() => {
                 write.send(Message::Text(serde_json::json!({ "type": "HEARTBEAT" }).to_string()))
                    .await
                    .map_err(|e| VibeKanbanError::Other(anyhow::anyhow!(e)))?;
            }
            Some(message) = read.next() => {
                match message {
                    Ok(msg) => {
                        if let Message::Text(text) = msg {
                            tracing::debug!("Received: {}", text);
                            if let Ok(data) = serde_json::from_str::<serde_json::Value>(&text) {
                                if data["type"] == "EXECUTE" {
                                    tracing::info!("Received execution task: {:?}", data["payload"]);
                                    
                                    // Ack reception
                                    write.send(Message::Text(serde_json::json!({ 
                                        "type": "EXECUTION_STARTED",
                                        "taskId": data["payload"]["taskId"]
                                    }).to_string())).await.ok();
                                    
                                    // TODO: Implement actual execution logic calling executors
                                    // For now we log it.
                                    // We would use deployment.container().create_execution(...)
                                }
                            }
                        }
                    }
                    Err(e) => {
                        tracing::error!("WebSocket error: {}", e);
                        break;
                    }
                }
            }
        }
    }

    Ok(())
}

pub async fn shutdown_signal() {
    // Always wait for Ctrl+C
    let ctrl_c = async {
        if let Err(e) = tokio::signal::ctrl_c().await {
            tracing::error!("Failed to install Ctrl+C handler: {e}");
        }
    };

    #[cfg(unix)]
    {
        use tokio::signal::unix::{SignalKind, signal};

        // Try to install SIGTERM handler, but don't panic if it fails
        let terminate = async {
            if let Ok(mut sigterm) = signal(SignalKind::terminate()) {
                sigterm.recv().await;
            } else {
                tracing::error!("Failed to install SIGTERM handler");
                // Fallback: never resolves
                std::future::pending::<()>().await;
            }
        };

        tokio::select! {
            _ = ctrl_c => {},
            _ = terminate => {},
        }
    }

    #[cfg(not(unix))]
    {
        // Only ctrl_c is available, so just await it
        ctrl_c.await;
    }
}

pub async fn perform_cleanup_actions(deployment: &DeploymentImpl) {
    deployment
        .container()
        .kill_all_running_processes()
        .await
        .expect("Failed to cleanly kill running execution processes");
}