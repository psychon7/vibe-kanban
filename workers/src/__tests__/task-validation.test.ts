import { describe, it, expect } from 'vitest';

describe('Task Validation', () => {
  type TaskStatus = 'todo' | 'in_progress' | 'in_review' | 'done';
  type TaskPriority = 'low' | 'medium' | 'high' | 'critical';
  type TaskVisibility = 'workspace' | 'private' | 'restricted';

  const VALID_STATUSES: TaskStatus[] = ['todo', 'in_progress', 'in_review', 'done'];
  const VALID_PRIORITIES: TaskPriority[] = ['low', 'medium', 'high', 'critical'];
  const VALID_VISIBILITIES: TaskVisibility[] = ['workspace', 'private', 'restricted'];

  const isValidStatus = (status: string): status is TaskStatus => {
    return VALID_STATUSES.includes(status as TaskStatus);
  };

  const isValidPriority = (priority: string): priority is TaskPriority => {
    return VALID_PRIORITIES.includes(priority as TaskPriority);
  };

  const isValidVisibility = (visibility: string): visibility is TaskVisibility => {
    return VALID_VISIBILITIES.includes(visibility as TaskVisibility);
  };

  describe('Status validation', () => {
    it('accepts valid statuses', () => {
      VALID_STATUSES.forEach(status => {
        expect(isValidStatus(status)).toBe(true);
      });
    });

    it('rejects invalid statuses', () => {
      expect(isValidStatus('invalid')).toBe(false);
      expect(isValidStatus('')).toBe(false);
      expect(isValidStatus('pending')).toBe(false);
    });
  });

  describe('Priority validation', () => {
    it('accepts valid priorities', () => {
      VALID_PRIORITIES.forEach(priority => {
        expect(isValidPriority(priority)).toBe(true);
      });
    });

    it('rejects invalid priorities', () => {
      expect(isValidPriority('invalid')).toBe(false);
      expect(isValidPriority('urgent')).toBe(false);
      expect(isValidPriority('')).toBe(false);
    });
  });

  describe('Visibility validation', () => {
    it('accepts valid visibilities', () => {
      VALID_VISIBILITIES.forEach(visibility => {
        expect(isValidVisibility(visibility)).toBe(true);
      });
    });

    it('rejects invalid visibilities', () => {
      expect(isValidVisibility('invalid')).toBe(false);
      expect(isValidVisibility('public')).toBe(false);
      expect(isValidVisibility('')).toBe(false);
    });
  });
});

describe('Task Title Validation', () => {
  const isValidTitle = (title: string): boolean => {
    return title.trim().length >= 1 && title.length <= 500;
  };

  it('accepts valid titles', () => {
    expect(isValidTitle('Fix bug')).toBe(true);
    expect(isValidTitle('A')).toBe(true);
    expect(isValidTitle('a'.repeat(500))).toBe(true);
  });

  it('rejects invalid titles', () => {
    expect(isValidTitle('')).toBe(false);
    expect(isValidTitle('   ')).toBe(false);
    expect(isValidTitle('a'.repeat(501))).toBe(false);
  });
});

describe('Task Due Date Validation', () => {
  const isValidDueDate = (dateStr: string | undefined): boolean => {
    if (!dateStr) return true; // Optional field
    const date = new Date(dateStr);
    return !isNaN(date.getTime());
  };

  it('accepts valid due dates', () => {
    expect(isValidDueDate('2025-12-31')).toBe(true);
    expect(isValidDueDate('2025-01-01T00:00:00Z')).toBe(true);
    expect(isValidDueDate(undefined)).toBe(true);
  });

  it('rejects invalid due dates', () => {
    expect(isValidDueDate('not-a-date')).toBe(false);
    expect(isValidDueDate('invalid')).toBe(false);
  });
});

describe('UUID Validation', () => {
  const isValidUUID = (id: string): boolean => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id);
  };

  it('accepts valid UUIDs', () => {
    expect(isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    expect(isValidUUID('6ba7b810-9dad-11d1-80b4-00c04fd430c8')).toBe(true);
  });

  it('rejects invalid UUIDs', () => {
    expect(isValidUUID('')).toBe(false);
    expect(isValidUUID('not-a-uuid')).toBe(false);
    expect(isValidUUID('550e8400-e29b-41d4-a716-44665544000')).toBe(false); // too short
    expect(isValidUUID('550e8400e29b41d4a716446655440000')).toBe(false); // no hyphens
  });
});
