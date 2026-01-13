import { z } from 'zod';

// Task schemas
export const createTaskSchema = z.object({
  project_id: z.string().uuid('Invalid project ID'),
  title: z
    .string()
    .min(1, 'Title is required')
    .max(500, 'Title must be at most 500 characters')
    .trim(),
  description: z
    .string()
    .max(10000, 'Description must be at most 10000 characters')
    .trim()
    .optional(),
  priority: z
    .enum(['low', 'medium', 'high', 'urgent'])
    .default('medium'),
  visibility: z
    .enum(['workspace', 'private', 'restricted'])
    .default('workspace'),
  due_date: z
    .string()
    .datetime()
    .optional(),
  assigned_to_user_id: z
    .string()
    .uuid('Invalid user ID')
    .optional(),
});

export const updateTaskSchema = z.object({
  title: z
    .string()
    .min(1, 'Title is required')
    .max(500, 'Title must be at most 500 characters')
    .trim()
    .optional(),
  description: z
    .string()
    .max(10000, 'Description must be at most 10000 characters')
    .trim()
    .nullable()
    .optional(),
  status: z
    .enum(['todo', 'inprogress', 'inreview', 'done', 'cancelled'])
    .optional(),
  priority: z
    .enum(['low', 'medium', 'high', 'urgent'])
    .optional(),
  visibility: z
    .enum(['workspace', 'private', 'restricted'])
    .optional(),
  due_date: z
    .string()
    .datetime()
    .nullable()
    .optional(),
});

export const assignTaskSchema = z.object({
  user_id: z
    .string()
    .uuid('Invalid user ID')
    .nullable(),
});

export const taskFiltersSchema = z.object({
  project_id: z.string().uuid().optional(),
  status: z.enum(['todo', 'inprogress', 'inreview', 'done', 'cancelled']).optional(),
  assigned_to: z.string().uuid().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type AssignTaskInput = z.infer<typeof assignTaskSchema>;
export type TaskFilters = z.infer<typeof taskFiltersSchema>;
