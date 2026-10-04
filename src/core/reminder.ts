import type { Emotion, EmotionEntry, Reminder, ReminderInput } from './models';
import { EMOTION_META } from './models';

export function dateKey(when: Date = new Date()): string { return when.toISOString().slice(0, 10); }
export function timeKey(when: Date): string { return `${String(when.getHours()).padStart(2, '0')}:${String(when.getMinutes()).padStart(2, '0')}`; }

export function hasRecordedOn(entries: Pick<EmotionEntry, 'date'>[], day = dateKey()): boolean {
  return entries.some((entry) => entry.date === day);
}

/** 当天尚未记录且提醒时间已到（含多个提醒同时到点）。已记录的当天返回空列表，不再反复提醒。 */
export function dueReminders(reminders: Reminder[], entries: EmotionEntry[], now: Date = new Date(), day = dateKey()): Reminder[] {
  if (hasRecordedOn(entries, day)) return [];
  return reminders.filter((reminder) => reminder.enabled && reminder.time <= timeKey(now));
}

export function createReminder(input: ReminderInput): Reminder {
  const time = /^\d{2}:\d{2}$/.test(input.time) ? input.time : '21:30';
  return { id: `reminder-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, time, emotion: input.emotion, enabled: input.enabled ?? true };
}

export function reminderMessage(reminder: Pick<Reminder, 'emotion'>): { title: string; body: string } {
  const meta = EMOTION_META[reminder.emotion as Emotion];
  return { title: '今天的情绪还没记录', body: `花一分钟，种下今天的${meta.plant}（${reminder.emotion}）。` };
}

/** 标记某提醒在某天已经弹过，避免刷新/重新打开后同一天重复通知。 */
export function firedKey(reminderId: string, day = dateKey()): string { return `${day}:${reminderId}`; }
