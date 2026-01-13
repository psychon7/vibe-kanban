-- Workspace Teams table
CREATE TABLE workspace_teams (
    id          BLOB PRIMARY KEY,
    name        TEXT NOT NULL,
    description TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now', 'subsec')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now', 'subsec'))
);

-- Roles table with predefined roles (Owner, Admin, Member, Viewer)
CREATE TABLE roles (
    id          BLOB PRIMARY KEY,
    name        TEXT NOT NULL UNIQUE,
    description TEXT,
    is_system   INTEGER NOT NULL DEFAULT 0, -- System roles cannot be deleted
    created_at  TEXT NOT NULL DEFAULT (datetime('now', 'subsec')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now', 'subsec'))
);

-- Permissions table with all permission keys
CREATE TABLE permissions (
    id          BLOB PRIMARY KEY,
    key         TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now', 'subsec'))
);

-- Role-Permission junction table
CREATE TABLE role_permissions (
    role_id       BLOB NOT NULL,
    permission_id BLOB NOT NULL,
    created_at    TEXT NOT NULL DEFAULT (datetime('now', 'subsec')),
    PRIMARY KEY (role_id, permission_id),
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
);

-- Workspace Members table (membership with role assignment)
CREATE TABLE workspace_members (
    id                BLOB PRIMARY KEY,
    workspace_team_id BLOB NOT NULL,
    user_id           TEXT NOT NULL, -- External user identifier
    role_id           BLOB NOT NULL,
    invited_by        TEXT, -- User ID of inviter
    joined_at         TEXT NOT NULL DEFAULT (datetime('now', 'subsec')),
    created_at        TEXT NOT NULL DEFAULT (datetime('now', 'subsec')),
    updated_at        TEXT NOT NULL DEFAULT (datetime('now', 'subsec')),
    UNIQUE (workspace_team_id, user_id),
    FOREIGN KEY (workspace_team_id) REFERENCES workspace_teams(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE RESTRICT
);

-- Create indexes for better query performance
CREATE INDEX idx_workspace_members_team ON workspace_members(workspace_team_id);
CREATE INDEX idx_workspace_members_user ON workspace_members(user_id);
CREATE INDEX idx_workspace_members_role ON workspace_members(role_id);
CREATE INDEX idx_role_permissions_role ON role_permissions(role_id);
CREATE INDEX idx_role_permissions_permission ON role_permissions(permission_id);

-- Seed default system roles
INSERT INTO roles (id, name, description, is_system) VALUES
    (X'00000000000000000000000000000001', 'Owner', 'Full access to workspace including deletion and ownership transfer', 1),
    (X'00000000000000000000000000000002', 'Admin', 'Administrative access to workspace settings and member management', 1),
    (X'00000000000000000000000000000003', 'Member', 'Standard access to create and manage tasks', 1),
    (X'00000000000000000000000000000004', 'Viewer', 'Read-only access to workspace', 1);

-- Seed permissions
INSERT INTO permissions (id, key, description) VALUES
    -- Workspace permissions
    (X'10000000000000000000000000000001', 'workspace.view', 'View workspace details'),
    (X'10000000000000000000000000000002', 'workspace.edit', 'Edit workspace settings'),
    (X'10000000000000000000000000000003', 'workspace.delete', 'Delete workspace'),
    (X'10000000000000000000000000000004', 'workspace.transfer', 'Transfer workspace ownership'),
    -- Member permissions
    (X'20000000000000000000000000000001', 'member.view', 'View workspace members'),
    (X'20000000000000000000000000000002', 'member.invite', 'Invite new members'),
    (X'20000000000000000000000000000003', 'member.remove', 'Remove members'),
    (X'20000000000000000000000000000004', 'member.role.assign', 'Assign roles to members'),
    -- Task permissions
    (X'30000000000000000000000000000001', 'task.view', 'View tasks'),
    (X'30000000000000000000000000000002', 'task.create', 'Create new tasks'),
    (X'30000000000000000000000000000003', 'task.edit', 'Edit tasks'),
    (X'30000000000000000000000000000004', 'task.delete', 'Delete tasks'),
    (X'30000000000000000000000000000005', 'task.assign', 'Assign tasks to members'),
    (X'30000000000000000000000000000006', 'task.status.change', 'Change task status'),
    -- Project permissions
    (X'40000000000000000000000000000001', 'project.view', 'View projects'),
    (X'40000000000000000000000000000002', 'project.create', 'Create new projects'),
    (X'40000000000000000000000000000003', 'project.edit', 'Edit projects'),
    (X'40000000000000000000000000000004', 'project.delete', 'Delete projects');

-- Assign permissions to Owner role (all permissions)
INSERT INTO role_permissions (role_id, permission_id)
SELECT X'00000000000000000000000000000001', id FROM permissions;

-- Assign permissions to Admin role (all except workspace.delete, workspace.transfer)
INSERT INTO role_permissions (role_id, permission_id)
SELECT X'00000000000000000000000000000002', id FROM permissions
WHERE key NOT IN ('workspace.delete', 'workspace.transfer');

-- Assign permissions to Member role
INSERT INTO role_permissions (role_id, permission_id)
SELECT X'00000000000000000000000000000003', id FROM permissions
WHERE key IN (
    'workspace.view',
    'member.view',
    'task.view', 'task.create', 'task.edit', 'task.status.change',
    'project.view'
);

-- Assign permissions to Viewer role (read-only)
INSERT INTO role_permissions (role_id, permission_id)
SELECT X'00000000000000000000000000000004', id FROM permissions
WHERE key IN ('workspace.view', 'member.view', 'task.view', 'project.view');
