import type { Reminder } from '../core/models';

/** 提醒设置持久化；fired 记录「某提醒某天已弹过」，用于跨刷新防重复，随日期自动清理。 */
export interface ReminderRepository {
  loadReminders(): Reminder[];
  saveReminders(reminders: Reminder[]): void;
  loadFired(): string[];
  saveFired(keys: string[]): void;
}
