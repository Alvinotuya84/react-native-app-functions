import {
  AppFunctionError,
  registerAppFunctionHandler,
} from 'react-native-app-functions';
import type config from '../appfunctions.config';

/** Stand-in for the field-agent app's SQLite data (same records as the native handler). */
function todaysRecords() {
  const now = new Date();
  const today = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
  return [
    {
      id: 'rec-001',
      title: 'Inspect water pump, Site A',
      status: 'DONE',
      scheduledAt: `${today}T08:30`,
    },
    {
      id: 'rec-002',
      title: 'Meter reading, Block 4',
      status: 'IN_PROGRESS',
      scheduledAt: `${today}T11:00`,
    },
    {
      id: 'rec-003',
      title: 'Customer follow-up call',
      status: 'PENDING',
      scheduledAt: null,
    },
  ];
}

registerAppFunctionHandler<typeof config, 'findRecord'>(
  'findRecord',
  async ({ id }) => {
    // Test hooks for the Phase 3 on-device checks (docs/PLAN.md §7.4).
    if (id === 'test-timeout') {
      await new Promise<void>((resolve) => setTimeout(resolve, 30_000));
    }
    if (id === 'test-invalid') {
      return { id, title: 'Missing status' } as never;
    }

    const record = todaysRecords().find((r) => r.id === id);
    if (!record) {
      throw new AppFunctionError(
        'NOT_FOUND',
        `No record with id "${id}". Use listTodaysRecords to get valid ids.`
      );
    }
    return record;
  }
);
