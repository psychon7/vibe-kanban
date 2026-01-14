import { Hono } from 'hono';
import { requireAuth } from '../middleware';
import type { Env, Variables } from '../types/env';

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// All routes require authentication
app.use('*', requireAuth());

app.post('/local/register', async (c) => {
    // Provide connection info to the CLI
    return c.json({ 
        endpoint: `${c.req.url.replace('/register', '/ws')}`,
        message: "Use your existing auth token to connect via WebSocket"
    });
});

app.get('/local/ws', async (c) => {
    const upgradeHeader = c.req.header('Upgrade');
    if (!upgradeHeader || upgradeHeader !== 'websocket') {
        return c.text('Expected Upgrade: websocket', 426);
    }

    const userId = c.var.user?.id;
    if (!userId) return c.text('Unauthorized', 401);

    const id = c.env.LOCAL_AGENT_RELAY.idFromName(userId);
    const stub = c.env.LOCAL_AGENT_RELAY.get(id);

    return stub.fetch(c.req.raw);
});

app.post('/local/execute', async (c) => {
    const userId = c.var.user?.id;
    if (!userId) return c.text('Unauthorized', 401);

    const id = c.env.LOCAL_AGENT_RELAY.idFromName(userId);
    const stub = c.env.LOCAL_AGENT_RELAY.get(id);
    
    const doReq = new Request('http://do/execute', {
        method: 'POST',
        headers: c.req.raw.headers,
        body: c.req.raw.body 
    });

    return stub.fetch(doReq);
});

app.get('/local/status', async (c) => {
    const userId = c.var.user?.id;
    if (!userId) return c.text('Unauthorized', 401);

    const id = c.env.LOCAL_AGENT_RELAY.idFromName(userId);
    const stub = c.env.LOCAL_AGENT_RELAY.get(id);

    const doReq = new Request('http://do/status');
    return stub.fetch(doReq);
});

export default app;
