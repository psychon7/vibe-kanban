-- ============================================================================
-- Seed Default Roles and Permissions
-- Created: 2026-01-13
-- ============================================================================

-- ============================================================================
-- Global Roles (workspace_team_id = NULL)
-- ============================================================================
INSERT OR IGNORE INTO roles (id, workspace_team_id, name, is_default) VALUES
    ('role-owner', NULL, 'Owner', 0),
    ('role-admin', NULL, 'Admin', 0),
    ('role-member', NULL, 'Member', 1),
    ('role-viewer', NULL, 'Viewer', 0);

-- ============================================================================
-- Permissions
-- ============================================================================
INSERT OR IGNORE INTO permissions (id, key, description) VALUES
    -- Workspace Management
    ('perm-ws-delete', 'workspace.delete', 'Delete team workspace'),
    ('perm-ws-settings', 'workspace.settings', 'Modify workspace settings'),
    
    -- Member Management
    ('perm-mem-invite', 'member.invite', 'Invite new members'),
    ('perm-mem-remove', 'member.remove', 'Remove members'),
    ('perm-mem-role', 'member.role.change', 'Change member roles'),
    
    -- Project Management
    ('perm-proj-create', 'project.create', 'Create projects'),
    ('perm-proj-delete', 'project.delete', 'Delete projects'),
    ('perm-proj-edit', 'project.edit', 'Edit project settings'),
    
    -- Task Management
    ('perm-task-create', 'task.create', 'Create tasks'),
    ('perm-task-assign', 'task.assign', 'Assign tasks to members'),
    ('perm-task-edit', 'task.edit', 'Edit task details'),
    ('perm-task-delete', 'task.delete', 'Delete tasks'),
    ('perm-task-private', 'task.view.private', 'View private tasks'),
    
    -- Attempt Management
    ('perm-attempt-run', 'attempt.run', 'Run agent attempts'),
    ('perm-attempt-approve', 'attempt.approve', 'Approve attempt results'),
    
    -- Prompt Enhancement
    ('perm-prompt-enhance', 'prompt.enhance', 'Use prompt enhancement'),
    ('perm-prompt-template', 'prompt.template.create', 'Create prompt templates'),
    ('perm-prompt-settings', 'prompt.settings.edit', 'Edit prompt settings');

-- ============================================================================
-- Owner Role Permissions (all permissions)
-- ============================================================================
INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT 'role-owner', id FROM permissions;

-- ============================================================================
-- Admin Role Permissions (all except workspace.delete)
-- ============================================================================
INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT 'role-admin', id FROM permissions WHERE key != 'workspace.delete';

-- ============================================================================
-- Member Role Permissions
-- ============================================================================
INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT 'role-member', id FROM permissions
WHERE key IN (
    'project.create',
    'task.create',
    'task.edit',
    'task.assign',
    'attempt.run',
    'attempt.approve',
    'prompt.enhance'
);

-- ============================================================================
-- Viewer Role has no write permissions (read-only by default)
-- ============================================================================
-- Viewer has implicit read access, no INSERT needed

-- ============================================================================
-- Default Global Prompt Templates
-- ============================================================================
INSERT OR IGNORE INTO prompt_templates (id, workspace_team_id, name, description, template_text, category, is_global, usage_count) VALUES
    ('tpl-bug-fix', NULL, 'Bug Fix', 'Standard bug fix template with context', 
     'Fix the following bug:\n\n**Issue:** {{issue_description}}\n\n**Expected behavior:** {{expected_behavior}}\n\n**Actual behavior:** {{actual_behavior}}\n\n**Steps to reproduce:**\n{{steps_to_reproduce}}\n\n**Additional context:**\n{{context}}',
     'bug-fix', 1, 0),
    
    ('tpl-feature', NULL, 'New Feature', 'Template for implementing new features',
     'Implement the following feature:\n\n**Feature:** {{feature_name}}\n\n**Description:** {{description}}\n\n**Acceptance criteria:**\n{{acceptance_criteria}}\n\n**Technical considerations:**\n{{technical_notes}}',
     'feature', 1, 0),
    
    ('tpl-refactor', NULL, 'Code Refactor', 'Template for code refactoring tasks',
     'Refactor the following code:\n\n**Target:** {{target_code_location}}\n\n**Goal:** {{refactoring_goal}}\n\n**Constraints:**\n- Maintain existing functionality\n- Keep tests passing\n{{additional_constraints}}\n\n**Approach:** {{suggested_approach}}',
     'refactor', 1, 0),
    
    ('tpl-test', NULL, 'Write Tests', 'Template for writing tests',
     'Write tests for:\n\n**Target:** {{target_code}}\n\n**Test types needed:**\n{{test_types}}\n\n**Edge cases to cover:**\n{{edge_cases}}\n\n**Mocking requirements:**\n{{mocking_notes}}',
     'test', 1, 0),
    
    ('tpl-docs', NULL, 'Documentation', 'Template for documentation tasks',
     'Write documentation for:\n\n**Subject:** {{subject}}\n\n**Audience:** {{audience}}\n\n**Documentation type:** {{doc_type}}\n\n**Key points to cover:**\n{{key_points}}\n\n**Examples needed:**\n{{examples}}',
     'docs', 1, 0);
