import { randomUUID } from 'node:crypto';

// In-memory notification log. Mirrors the notification_log table in migrations/.
export function createStore() {
  const rows = new Map();
  return {
    insert(row) {
      const id = `ntf_${randomUUID().slice(0, 8)}`;
      const record = { id, createdAt: new Date().toISOString(), ...row };
      rows.set(id, record);
      return record;
    },
    get(id) { return rows.get(id) ?? null; },
    update(id, patch) {
      const row = rows.get(id);
      if (!row) return null;
      Object.assign(row, patch);
      return row;
    },
  };
}
