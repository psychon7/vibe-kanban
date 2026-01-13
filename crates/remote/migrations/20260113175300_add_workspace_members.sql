-- Workspace member roles (reusing the existing member_role type)

-- Workspace permissions enum
CREATE TYPE workspace_permission AS ENUM (
    'member.invite',
    'member.remove',
    'member.role.change'
);

-- Workspace member metadata table
CREATE TABLE workspace_member_metadata (
    workspace_id UUID NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role member_role NOT NULL DEFAULT 'member',
    permissions workspace_permission[] NOT NULL DEFAULT '{}',
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (workspace_id, user_id)
);

CREATE INDEX idx_workspace_member_user ON workspace_member_metadata(user_id);
CREATE INDEX idx_workspace_member_workspace ON workspace_member_metadata(workspace_id);

-- Workspace invitations table
CREATE TABLE workspace_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL,
    invited_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    email TEXT NOT NULL,
    role member_role NOT NULL DEFAULT 'member',
    status invitation_status NOT NULL DEFAULT 'pending',
    token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(workspace_id, email, status) 
);

CREATE INDEX idx_workspace_invitation_workspace ON workspace_invitations(workspace_id);
CREATE INDEX idx_workspace_invitation_token ON workspace_invitations(token);
CREATE INDEX idx_workspace_invitation_email ON workspace_invitations(email);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_workspace_member_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER workspace_member_metadata_updated_at
    BEFORE UPDATE ON workspace_member_metadata
    FOR EACH ROW
    EXECUTE FUNCTION update_workspace_member_updated_at();

CREATE TRIGGER workspace_invitations_updated_at
    BEFORE UPDATE ON workspace_invitations
    FOR EACH ROW
    EXECUTE FUNCTION update_workspace_member_updated_at();
