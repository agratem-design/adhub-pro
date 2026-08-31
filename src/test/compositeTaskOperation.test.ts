import { describe, expect, it } from 'vitest';
import {
  getCompositeTaskOperationKey,
  getCurrentOperationInstallationCost,
  getSharedOperationCostsForTask,
  normalizeCompositeTaskType,
  selectLatestOperationTasks,
} from '@/lib/compositeTaskOperation';

describe('composite task type normalization', () => {
  it('maps a normal installation task to an initial comprehensive task', () => {
    expect(normalizeCompositeTaskType('installation')).toBe('new_installation');
  });

  it('keeps an actual reinstallation classified as a reinstallation', () => {
    expect(normalizeCompositeTaskType('reinstallation')).toBe('reinstallation');
  });

  it('treats missing and legacy initial values as a new installation', () => {
    expect(normalizeCompositeTaskType(null)).toBe('new_installation');
    expect(normalizeCompositeTaskType('new_installation')).toBe('new_installation');
  });
});

describe('composite task operation identity', () => {
  it('keeps reinstallations from different contracts separate even in the same week', () => {
    const first = getCompositeTaskOperationKey({
      id: 'a', contract_id: 1295, task_type: 'reinstallation', reinstallationNumber: 1,
    });
    const second = getCompositeTaskOperationKey({
      id: 'b', contract_id: 1296, task_type: 'reinstallation', reinstallationNumber: 1,
    });

    expect(first).not.toBe(second);
  });

  it('keeps consecutive reinstallations for the same contract separate', () => {
    expect(getCompositeTaskOperationKey({
      contract_id: 1295, task_type: 'reinstallation', reinstallationNumber: 1,
    })).not.toBe(getCompositeTaskOperationKey({
      contract_id: 1295, task_type: 'reinstallation', reinstallationNumber: 2,
    }));
  });

  it('uses the exact installation task when an old reinstallation has no sequence', () => {
    expect(getCompositeTaskOperationKey({
      contract_id: 1295,
      task_type: 'reinstallation',
      installation_task_id: 'install-a',
    })).not.toBe(getCompositeTaskOperationKey({
      contract_id: 1295,
      task_type: 'reinstallation',
      installation_task_id: 'install-b',
    }));
  });

  it('selects only the latest operation for safe grouped invoicing', () => {
    const tasks = [
      { id: 'initial', contract_id: 1295, task_type: 'new_installation', created_at: '2026-01-01T10:00:00Z' },
      { id: 're-1-a', contract_id: 1295, task_type: 'reinstallation', reinstallationNumber: 1, created_at: '2026-02-01T10:00:00Z' },
      { id: 're-1-b', contract_id: 1295, task_type: 'reinstallation', reinstallationNumber: 1, created_at: '2026-02-01T10:05:00Z' },
      { id: 're-2', contract_id: 1295, task_type: 'reinstallation', reinstallationNumber: 2, created_at: '2026-03-01T10:00:00Z' },
    ];

    expect(selectLatestOperationTasks(tasks).map(task => task.id)).toEqual(['re-2']);
  });
});

describe('reinstallation invoice cost isolation', () => {
  it('does not repeat the original installation cost in a reinstallation invoice', () => {
    const item = {
      customer_original_install_cost: 800,
      customer_reinstall_cost: 250,
      customer_installation_cost: 250,
    };

    expect(getCurrentOperationInstallationCost(item, 'reinstallation')).toBe(250);
    expect(getCurrentOperationInstallationCost(item, 'new_installation')).toBe(250);
  });
});

describe('shared operation cost ownership', () => {
  const sharedCosts = {
    customerPrint: 240,
    companyPrint: 120,
    customerCutout: 80,
    companyCutout: 40,
    discount: 25,
  };

  it('stores shared print, cutout and discount costs on the primary team row only', () => {
    expect(getSharedOperationCostsForTask('team-primary', 'team-primary', sharedCosts)).toEqual(sharedCosts);
    expect(getSharedOperationCostsForTask('team-second', 'team-primary', sharedCosts)).toEqual({
      customerPrint: 0,
      companyPrint: 0,
      customerCutout: 0,
      companyCutout: 0,
      discount: 0,
    });
  });
});
