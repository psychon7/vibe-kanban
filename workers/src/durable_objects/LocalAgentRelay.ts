import { DurableObject } from 'cloudflare:workers';
import type { Env } from '../types/env';

export class LocalAgentRelay extends DurableObject {
  private sessions: Set<WebSocket> = new Set();
  private lastHeartbeat: number = 0;
  public env: Env;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.env = env;
    
    // Recover state from storage if needed in the future
    // this.ctx.blockConcurrencyWhile(async () => { ... });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // WebSocket connection endpoint
    if (url.pathname.endsWith('/ws')) {
      if (request.headers.get('Upgrade') !== 'websocket') {
        return new Response('Expected Upgrade: websocket', { status: 426 });
      }

      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);

      this.handleSession(server);

      return new Response(null, {
        status: 101,
        webSocket: client,
      });
    }
    
    // Command execution endpoint (internal API -> DO)
    if (url.pathname.endsWith('/execute')) {
      if (request.method !== 'POST') {
        return new Response('Method not allowed', { status: 405 });
      }
      
      try {
        const payload = await request.json();
        
        if (this.sessions.size === 0) {
            return new Response('No local agent connected', { status: 503 });
        }

        // Broadcast execute command to all connected local agents (usually just one)
        this.broadcast(JSON.stringify({ 
            type: 'EXECUTE', 
            payload 
        }));
        
        return new Response(JSON.stringify({ status: 'queued' }), { 
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: 'Invalid request' }), { status: 400 });
      }
    }

    // Status endpoint
    if (url.pathname.endsWith('/status')) {
         const isConnected = this.sessions.size > 0;
         // Check if heartbeat is recent (e.g., within 30 seconds)
         const isLive = isConnected && (Date.now() - this.lastHeartbeat < 30000);

         return new Response(JSON.stringify({ 
             connected: isConnected,
             isLive, 
             lastHeartbeat: this.lastHeartbeat,
             sessions: this.sessions.size 
         }), { 
             headers: { 'Content-Type': 'application/json' } 
         });
    }

    return new Response('Not found', { status: 404 });
  }

  handleSession(webSocket: WebSocket) {
    this.sessions.add(webSocket);
    webSocket.accept();
    this.lastHeartbeat = Date.now();

    webSocket.addEventListener('message', async (event) => {
      try {
        const data = JSON.parse(event.data as string);
        
        if (data.type === 'HEARTBEAT') {
            this.lastHeartbeat = Date.now();
            webSocket.send(JSON.stringify({ type: 'HEARTBEAT_ACK' }));
        }
        
        // Handle log streaming or task updates from local agent
        // For now, we might just log them or forward them if we had a way to push to frontend (another WS?)
        // In this architecture, the Frontend polls or connects to DO? 
        // For simplicity, Frontend polls status, or we rely on DB updates from local agent (if local agent calls API).
        // But the prompt says "Logs streamed back to web".
        // This implies the Web Dashboard is also connected to this DO or getting updates somehow.
        // For MVP, let's assume local agent updates status via API or this WS is just for control.
        
      } catch (err) {
        // Ignore malformed messages
      }
    });

    webSocket.addEventListener('close', () => {
      this.sessions.delete(webSocket);
    });
    
    webSocket.addEventListener('error', () => {
        this.sessions.delete(webSocket);
    });
  }
  
  broadcast(message: string) {
      this.sessions.forEach(session => {
          try {
              session.send(message);
          } catch (e) {
              this.sessions.delete(session);
          }
      });
  }
}
