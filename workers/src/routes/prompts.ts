import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import type { Env, Variables } from '../types/env';
import { requireAuth, workspaceContext } from '../middleware/auth';
import { requirePermission, requireMembership, Permissions } from '../middleware/permissions';
import { ApiError, ErrorCodes } from '../middleware/error-handler';

export const promptsRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

// All prompt routes require authentication
promptsRoutes.use('*', requireAuth());

// Schemas
const enhancePromptSchema = z.object({
  prompt: z.string().min(1).max(10000),
  task_id: z.string().uuid().optional(),
  style: z.enum(['minimal', 'balanced', 'comprehensive']).default('balanced'),
  include_context: z.boolean().default(true),
});

const templateSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  description: z.string().max(500).trim().optional(),
  template_text: z.string().min(1).max(10000),
  category: z.enum(['bug-fix', 'feature', 'refactor', 'docs', 'test', 'other']).optional(),
});

const renderTemplateSchema = z.object({
  variables: z.record(z.string()),
});

// === Prompt Enhancement ===

// POST /api/v1/prompts/enhance - Enhance a prompt with AI
promptsRoutes.post('/enhance',
  workspaceContext(),
  requireMembership(),
  requirePermission(Permissions.PROMPT_ENHANCE),
  zValidator('json', enhancePromptSchema),
  async (c) => {
    const workspaceId = c.get('workspaceId')!;
    const user = c.get('user')!;
    const { prompt, task_id, style, include_context } = c.req.valid('json');

    // Get workspace prompt settings
    const settings = await c.env.DB.prepare(
      'SELECT * FROM prompt_enhancement_settings WHERE workspace_team_id = ?'
    ).bind(workspaceId).first();

    const enhancementStyle = settings?.enhancement_style || style;

    // Build system prompt based on style
    let systemPrompt = 'You are an expert prompt engineer. Improve the following prompt to be clearer, more specific, and more effective.';
    
    if (enhancementStyle === 'minimal') {
      systemPrompt += ' Make minimal changes - only fix obvious issues and add essential clarity.';
    } else if (enhancementStyle === 'comprehensive') {
      systemPrompt += ' Provide a comprehensive enhancement with detailed instructions, edge cases, and clear structure.';
    } else {
      systemPrompt += ' Provide a balanced enhancement that improves clarity without over-engineering.';
    }

    systemPrompt += ' Return ONLY the enhanced prompt, no explanations.';

    // Score original prompt
    const originalScore = scorePrompt(prompt);

    try {
      // Call AI Gateway - using text generation model
      const response = await c.env.AI.run('@cf/meta/llama-2-7b-chat-int8' as any, {
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
        max_tokens: 2000,
      });

      const enhancedPrompt = (response as { response: string }).response || prompt;
      const enhancedScore = scorePrompt(enhancedPrompt);

      // Store enhancement record
      const enhancementId = crypto.randomUUID();
      await c.env.DB.prepare(`
        INSERT INTO prompt_enhancements (
          id, task_id, original_prompt, enhanced_prompt, enhancement_model,
          techniques_applied, original_score, enhanced_score, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).bind(
        enhancementId,
        task_id || null,
        prompt,
        enhancedPrompt,
        'llama-3.1-8b-instruct',
        enhancementStyle,
        originalScore,
        enhancedScore
      ).run();

      return c.json({
        enhancement: {
          id: enhancementId,
          originalPrompt: prompt,
          enhancedPrompt,
          originalScore,
          enhancedScore,
          improvement: enhancedScore - originalScore,
          model: 'llama-2-7b-chat-int8',
          style: enhancementStyle,
        },
      });
    } catch (error) {
      throw new ApiError(
        ErrorCodes.AI_SERVICE_ERROR,
        'Failed to enhance prompt',
        500,
        { error: String(error) }
      );
    }
  }
);

// POST /api/v1/prompts/score - Score prompt quality
promptsRoutes.post('/score', async (c) => {
  const body = await c.req.json<{ prompt: string }>();
  
  if (!body.prompt) {
    throw new ApiError(ErrorCodes.VALIDATION_ERROR, 'Prompt is required', 400);
  }

  const score = scorePrompt(body.prompt);
  const feedback = getPromptFeedback(body.prompt);

  return c.json({
    score,
    maxScore: 100,
    feedback,
  });
});

// POST /api/v1/prompts/enhance/:id/feedback - Accept/reject enhanced prompt
promptsRoutes.post('/enhance/:enhancementId/feedback', async (c) => {
  const enhancementId = c.req.param('enhancementId');
  const body = await c.req.json<{ accepted: boolean; edited?: boolean; final_prompt?: string }>();

  const enhancement = await c.env.DB.prepare(
    'SELECT id FROM prompt_enhancements WHERE id = ?'
  ).bind(enhancementId).first();

  if (!enhancement) {
    throw new ApiError(ErrorCodes.NOT_FOUND, 'Enhancement not found', 404);
  }

  await c.env.DB.prepare(`
    UPDATE prompt_enhancements 
    SET user_accepted = ?, user_edited = ?, final_prompt = ?
    WHERE id = ?
  `).bind(
    body.accepted ? 1 : 0,
    body.edited ? 1 : 0,
    body.final_prompt || null,
    enhancementId
  ).run();

  return c.json({ message: 'Feedback recorded successfully' });
});

// === Prompt Templates ===

// GET /api/v1/prompts/templates - List prompt templates
promptsRoutes.get('/templates', workspaceContext(), async (c) => {
  const workspaceId = c.get('workspaceId');
  const category = c.req.query('category');

  let query = `
    SELECT 
      id, name, description, template_text, category, is_global, usage_count,
      created_by, created_at, updated_at
    FROM prompt_templates
    WHERE (is_global = 1 OR workspace_team_id = ?)
  `;
  const params: unknown[] = [workspaceId || null];

  if (category) {
    query += ' AND category = ?';
    params.push(category);
  }

  query += ' ORDER BY is_global DESC, usage_count DESC, name ASC';

  const templates = await c.env.DB.prepare(query).bind(...params).all();

  return c.json({
    templates: templates.results,
    count: templates.results?.length || 0,
  });
});

// POST /api/v1/prompts/templates - Create prompt template
promptsRoutes.post('/templates',
  workspaceContext(),
  requireMembership(),
  requirePermission(Permissions.PROMPT_TEMPLATE_CREATE),
  zValidator('json', templateSchema),
  async (c) => {
    const workspaceId = c.get('workspaceId')!;
    const user = c.get('user')!;
    const { name, description, template_text, category } = c.req.valid('json');

    const templateId = crypto.randomUUID();

    await c.env.DB.prepare(`
      INSERT INTO prompt_templates (
        id, workspace_team_id, name, description, template_text, category,
        is_global, usage_count, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, datetime('now'), datetime('now'))
    `).bind(
      templateId,
      workspaceId,
      name,
      description || null,
      template_text,
      category || null,
      user.id
    ).run();

    return c.json({
      template: {
        id: templateId,
        name,
        description,
        templateText: template_text,
        category,
        isGlobal: false,
        usageCount: 0,
        createdBy: user.id,
      },
    }, 201);
  }
);

// GET /api/v1/prompts/templates/:templateId - Get template by ID
promptsRoutes.get('/templates/:templateId', async (c) => {
  const templateId = c.req.param('templateId');

  const template = await c.env.DB.prepare(`
    SELECT 
      pt.*,
      u.name as created_by_name
    FROM prompt_templates pt
    LEFT JOIN users u ON pt.created_by = u.id
    WHERE pt.id = ?
  `).bind(templateId).first();

  if (!template) {
    throw new ApiError(ErrorCodes.NOT_FOUND, 'Template not found', 404);
  }

  // Extract placeholders from template
  const placeholders = extractPlaceholders(template.template_text as string);

  return c.json({
    template: {
      ...template,
      placeholders,
    },
  });
});

// POST /api/v1/prompts/templates/:templateId/render - Render template with variables
promptsRoutes.post('/templates/:templateId/render',
  zValidator('json', renderTemplateSchema),
  async (c) => {
    const templateId = c.req.param('templateId');
    const { variables } = c.req.valid('json');

    const template = await c.env.DB.prepare(
      'SELECT id, template_text FROM prompt_templates WHERE id = ?'
    ).bind(templateId).first<{ id: string; template_text: string }>();

    if (!template) {
      throw new ApiError(ErrorCodes.NOT_FOUND, 'Template not found', 404);
    }

    // Render template
    let renderedText = template.template_text;
    for (const [key, value] of Object.entries(variables)) {
      renderedText = renderedText.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }

    // Increment usage count
    await c.env.DB.prepare(
      'UPDATE prompt_templates SET usage_count = usage_count + 1 WHERE id = ?'
    ).bind(templateId).run();

    // Check for missing placeholders
    const missingPlaceholders = extractPlaceholders(renderedText);

    return c.json({
      rendered: renderedText,
      missingPlaceholders,
      complete: missingPlaceholders.length === 0,
    });
  }
);

// PATCH /api/v1/prompts/templates/:templateId - Update template
promptsRoutes.patch('/templates/:templateId',
  workspaceContext(),
  requireMembership(),
  requirePermission(Permissions.PROMPT_TEMPLATE_CREATE),
  zValidator('json', templateSchema.partial()),
  async (c) => {
    const workspaceId = c.get('workspaceId')!;
    const user = c.get('user')!;
    const templateId = c.req.param('templateId');
    const updates = c.req.valid('json');

    // Verify ownership
    const template = await c.env.DB.prepare(
      'SELECT id, created_by, is_global FROM prompt_templates WHERE id = ? AND workspace_team_id = ?'
    ).bind(templateId, workspaceId).first<{ id: string; created_by: string; is_global: number }>();

    if (!template) {
      throw new ApiError(ErrorCodes.NOT_FOUND, 'Template not found', 404);
    }

    if (template.is_global) {
      throw new ApiError(ErrorCodes.AUTH_004, 'Cannot modify global templates', 403);
    }

    if (template.created_by !== user.id) {
      throw new ApiError(ErrorCodes.AUTH_004, 'Only the creator can modify this template', 403);
    }

    const setClauses: string[] = ["updated_at = datetime('now')"];
    const values: unknown[] = [];

    if (updates.name !== undefined) {
      setClauses.push('name = ?');
      values.push(updates.name);
    }
    if (updates.description !== undefined) {
      setClauses.push('description = ?');
      values.push(updates.description);
    }
    if (updates.template_text !== undefined) {
      setClauses.push('template_text = ?');
      values.push(updates.template_text);
    }
    if (updates.category !== undefined) {
      setClauses.push('category = ?');
      values.push(updates.category);
    }

    values.push(templateId);

    await c.env.DB.prepare(`
      UPDATE prompt_templates SET ${setClauses.join(', ')} WHERE id = ?
    `).bind(...values).run();

    const updatedTemplate = await c.env.DB.prepare(
      'SELECT * FROM prompt_templates WHERE id = ?'
    ).bind(templateId).first();

    return c.json({ template: updatedTemplate });
  }
);

// DELETE /api/v1/prompts/templates/:templateId - Delete template
promptsRoutes.delete('/templates/:templateId',
  workspaceContext(),
  requireMembership(),
  requirePermission(Permissions.PROMPT_TEMPLATE_CREATE),
  async (c) => {
    const workspaceId = c.get('workspaceId')!;
    const user = c.get('user')!;
    const templateId = c.req.param('templateId');

    const template = await c.env.DB.prepare(
      'SELECT id, created_by, is_global FROM prompt_templates WHERE id = ? AND workspace_team_id = ?'
    ).bind(templateId, workspaceId).first<{ id: string; created_by: string; is_global: number }>();

    if (!template) {
      throw new ApiError(ErrorCodes.NOT_FOUND, 'Template not found', 404);
    }

    if (template.is_global) {
      throw new ApiError(ErrorCodes.AUTH_004, 'Cannot delete global templates', 403);
    }

    if (template.created_by !== user.id) {
      throw new ApiError(ErrorCodes.AUTH_004, 'Only the creator can delete this template', 403);
    }

    await c.env.DB.prepare('DELETE FROM prompt_templates WHERE id = ?').bind(templateId).run();

    return c.json({ message: 'Template deleted successfully' });
  }
);

// === Usage Statistics ===

// GET /api/v1/prompts/usage - Get prompt enhancement usage
promptsRoutes.get('/usage', workspaceContext(), requireMembership(), async (c) => {
  const workspaceId = c.get('workspaceId')!;

  // Get enhancement stats
  const stats = await c.env.DB.prepare(`
    SELECT 
      COUNT(*) as total_enhancements,
      SUM(CASE WHEN user_accepted = 1 THEN 1 ELSE 0 END) as accepted,
      SUM(CASE WHEN user_accepted = 0 THEN 1 ELSE 0 END) as rejected,
      AVG(enhanced_score - original_score) as avg_improvement
    FROM prompt_enhancements pe
    JOIN tasks t ON pe.task_id = t.id
    JOIN projects p ON t.project_id = p.id
    WHERE p.workspace_team_id = ?
  `).bind(workspaceId).first();

  // Get template usage
  const templateStats = await c.env.DB.prepare(`
    SELECT 
      SUM(usage_count) as total_template_uses,
      COUNT(*) as template_count
    FROM prompt_templates
    WHERE workspace_team_id = ?
  `).bind(workspaceId).first();

  return c.json({
    usage: {
      enhancements: {
        total: stats?.total_enhancements || 0,
        accepted: stats?.accepted || 0,
        rejected: stats?.rejected || 0,
        avgImprovement: Math.round((stats?.avg_improvement as number) || 0),
      },
      templates: {
        count: templateStats?.template_count || 0,
        totalUses: templateStats?.total_template_uses || 0,
      },
    },
  });
});

// === Helper Functions ===

function scorePrompt(prompt: string): number {
  let score = 0;
  const maxScore = 100;

  // Length check (10-2000 chars is good)
  const length = prompt.length;
  if (length >= 50 && length <= 2000) score += 20;
  else if (length >= 20 && length <= 5000) score += 10;

  // Has clear structure (numbered lists, bullet points, headers)
  if (/\d+\.|[-*•]|\n#{1,3}\s/.test(prompt)) score += 15;

  // Has specific technical terms
  if (/function|class|method|api|database|component|module|test|error|bug/i.test(prompt)) score += 10;

  // Has context about what/why/how
  if (/\b(implement|create|fix|add|update|refactor|should|must|need)\b/i.test(prompt)) score += 10;

  // Has acceptance criteria or expected behavior
  if (/\b(expected|should|must|return|output|result)\b/i.test(prompt)) score += 10;

  // Has constraints or requirements
  if (/\b(constraint|requirement|limit|maximum|minimum|only|must not)\b/i.test(prompt)) score += 10;

  // Has examples
  if (/\b(example|e\.g\.|for instance|such as)\b/i.test(prompt)) score += 10;

  // Penalize vague language
  if (/\b(stuff|things|etc|somehow|maybe|kind of)\b/i.test(prompt)) score -= 10;

  // Bonus for code blocks
  if (/```[\s\S]*```/.test(prompt)) score += 5;

  return Math.max(0, Math.min(maxScore, score));
}

function getPromptFeedback(prompt: string): string[] {
  const feedback: string[] = [];

  if (prompt.length < 50) {
    feedback.push('Prompt is very short. Consider adding more context and details.');
  }
  if (prompt.length > 5000) {
    feedback.push('Prompt is very long. Consider breaking it into smaller tasks.');
  }
  if (!/\d+\.|[-*•]/.test(prompt)) {
    feedback.push('Consider using bullet points or numbered lists for clarity.');
  }
  if (!/\b(should|must|expected|return)\b/i.test(prompt)) {
    feedback.push('Add expected behavior or acceptance criteria.');
  }
  if (/\b(stuff|things|etc)\b/i.test(prompt)) {
    feedback.push('Replace vague terms with specific descriptions.');
  }
  if (!/\b(example|e\.g\.)\b/i.test(prompt)) {
    feedback.push('Consider adding examples to illustrate requirements.');
  }

  if (feedback.length === 0) {
    feedback.push('Good prompt! Well-structured with clear requirements.');
  }

  return feedback;
}

function extractPlaceholders(text: string): string[] {
  const matches = text.match(/{{([^}]+)}}/g);
  if (!matches) return [];
  return [...new Set(matches.map(m => m.slice(2, -2)))];
}
