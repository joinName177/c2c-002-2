import type { GardenRepository } from '../ports/garden-repository.port';
import type { GardenSnapshot, Reminder, ReminderTodo } from '../core/models';
import { sampleSnapshot } from '../core/garden-engine';
const KEY = 'c2c-002-emotion-garden';

/** 兼容旧版本快照：补齐提醒与待办字段 */
export function migrate(raw: Partial<GardenSnapshot>): GardenSnapshot {
  const reminders: Reminder[] = Array.isArray(raw.reminders) ? raw.reminders : [];
  const todos: ReminderTodo[] = Array.isArray(raw.todos) ? raw.todos : [];
  return {
    entries: Array.isArray(raw.entries) ? raw.entries : [],
    plants: Array.isArray(raw.plants) ? raw.plants : [],
    reminders,
    todos,
  };
}

export class LocalGardenRepository implements GardenRepository {
  load(): GardenSnapshot {
    try {
      const value = localStorage.getItem(KEY);
      if (value) {
        const snapshot = migrate(JSON.parse(value) as Partial<GardenSnapshot>);
        if (snapshot.entries.length) return snapshot;
      }
    } catch { /* use seed */ }
    return sampleSnapshot();
  }
  save(snapshot: GardenSnapshot) { localStorage.setItem(KEY, JSON.stringify(snapshot)); }
}
