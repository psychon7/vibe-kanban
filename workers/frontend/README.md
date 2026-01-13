# Vibe Kanban Frontend

React + TypeScript + Vite frontend for the Vibe Kanban application.

## Features

- 🔐 **Authentication**: Login/Signup with session-based auth
- 🏢 **Workspaces**: Multi-workspace support with switching
- 📋 **Projects**: Kanban board with task management
- 👥 **Team Management**: Invite and manage members
- 🤖 **AI Enhancement**: Prompt enhancement for tasks
- 📝 **Templates**: Reusable prompt templates
- ⚙️ **Settings**: AI settings and audit log viewer

## Getting Started

### Development

```bash
# Install dependencies
npm install

# Start development server (with API proxy)
npm run dev
```

The dev server runs at `http://localhost:5173` and proxies `/api` requests to the Workers backend at `http://localhost:8787`.

### Building

```bash
npm run build
```

### Deployment

#### Prerequisites

1. Install Wrangler CLI: `npm install -g wrangler`
2. Login to Cloudflare: `wrangler login`

#### Deploy to Cloudflare Pages

```bash
# Preview deployment (staging)
npm run deploy:preview

# Production deployment
npm run deploy:production
```

#### Manual deployment

```bash
# Build
npm run build

# Deploy to Pages
wrangler pages deploy dist --project-name=vibe-kanban
```

## Project Structure

```
src/
├── api/
│   └── client.ts          # API client with all endpoints
├── components/
│   ├── Layout.tsx         # Main layout with navigation
│   ├── members/           # Team member components
│   ├── prompts/           # AI enhancement components
│   ├── tasks/             # Task/Kanban components
│   └── workspace/         # Workspace switcher
├── contexts/
│   ├── AuthContext.tsx    # Auth state management
│   └── WorkspaceContext.tsx
├── pages/
│   ├── auth/              # Login/Signup pages
│   ├── projects/          # Project board
│   ├── settings/          # Settings pages
│   └── DashboardPage.tsx  # Main dashboard
├── App.tsx                # Routes and providers
└── main.tsx               # Entry point
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_URL` | Backend API URL | `http://localhost:8787` |

## Tech Stack

- **Framework**: React 19 with TypeScript
- **Routing**: React Router v7
- **Styling**: Tailwind CSS v4
- **Build**: Vite
- **Hosting**: Cloudflare Pages
