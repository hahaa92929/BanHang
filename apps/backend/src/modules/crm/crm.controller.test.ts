import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CrmController } from './crm.controller';

test('CrmController forwards CRM customer actions', () => {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  const service = {
    listCustomers: (...args: unknown[]) => {
      calls.push({ method: 'listCustomers', args });
      return { total: 1, data: [] };
    },
    exportCustomers: (...args: unknown[]) => {
      calls.push({ method: 'exportCustomers', args });
      return { total: 1, data: [] };
    },
    detail: (...args: unknown[]) => {
      calls.push({ method: 'detail', args });
      return { id: 'u-1' };
    },
    addNote: (...args: unknown[]) => {
      calls.push({ method: 'addNote', args });
      return { id: 'cn-1' };
    },
    deleteNote: (...args: unknown[]) => {
      calls.push({ method: 'deleteNote', args });
      return { success: true };
    },
    addTag: (...args: unknown[]) => {
      calls.push({ method: 'addTag', args });
      return { id: 'ct-1' };
    },
    removeTag: (...args: unknown[]) => {
      calls.push({ method: 'removeTag', args });
      return { success: true };
    },
  };
  const controller = new CrmController(service as never);
  const query = { q: 'vip', segment: 'vip', page: 1, limit: 10 } as any;
  const noteBody = { title: 'Priority', content: 'Call customer tomorrow.', isPinned: true } as any;
  const tagBody = { name: 'VIP Watch', color: '#D97706' } as any;
  const request = { user: { sub: 'u-admin' } } as any;

  assert.deepEqual(controller.list(query), { total: 1, data: [] });
  assert.deepEqual(controller.export(query), { total: 1, data: [] });
  assert.deepEqual(controller.detail('u-1'), { id: 'u-1' });
  assert.deepEqual(controller.createNote(request, 'u-1', noteBody), { id: 'cn-1' });
  assert.deepEqual(controller.deleteNote('u-1', 'cn-1'), { success: true });
  assert.deepEqual(controller.createTag('u-1', tagBody), { id: 'ct-1' });
  assert.deepEqual(controller.removeTag('u-1', 'ct-1'), { success: true });

  assert.deepEqual(calls, [
    { method: 'listCustomers', args: [query] },
    { method: 'exportCustomers', args: [query] },
    { method: 'detail', args: ['u-1'] },
    { method: 'addNote', args: ['u-admin', 'u-1', noteBody] },
    { method: 'deleteNote', args: ['u-1', 'cn-1'] },
    { method: 'addTag', args: ['u-1', tagBody] },
    { method: 'removeTag', args: ['u-1', 'ct-1'] },
  ]);
});
