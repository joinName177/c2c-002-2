import type { ReminderRepository } from '../ports/reminder-repository.port';
import type { Reminder } from '../core/models';

const REMINDERS_KEY = 'c2c-002-emotion-garden-reminders';
const FIRED_KEY = 'c2c-002-emotion-garden-reminders-fired';

function isReminder(value: unknown): value is Reminder {
  const item = value as Partial<Reminder> | null;
  return !!item && typeof item.id === 'string' && typeof item.time === 'string' && typeof item.enabled === 'boolean'
    && (item.emotion === '愤怒' || item.emotion === '平静' || item.emotion === '喜悦' || item.emotion === '忧伤' || item.emotion === '焦虑');
}

export class LocalReminderRepository implements ReminderRepository {
  loadReminders(): Reminder[] {
    try {
      const value = localStorage.getItem(REMINDERS_KEY);
      if (value) {
        const parsed = JSON.parse(value) as unknown;
        if (Array.isArray(parsed)) return parsed.filter(isReminder);
      }
    } catch { /* fall through */ }
    return [];
  }

  saveReminders(reminders: Reminder[]): void {
    localStorage.setItem(REMINDERS_KEY, JSON.stringify(reminders));
  }

  loadFired(): string[] {
    try {
      const value = localStorage.getItem(FIRED_KEY);
      if (value) {
        const parsed = JSON.parse(value) as unknown;
        if (Array.isArray(parsed)) return parsed.filter((item): item is string => typeof item === 'string');
      }
    } catch { /* fall through */ }
    return [];
  }

  saveFired(keys: string[]): void {
    localStorage.setItem(FIRED_KEY, JSON.stringify(keys));
  }
}
