import type { Emotion, GardenSnapshot, Reminder, ReminderTodo } from './models';
import { isValidTime, todayKey } from './models';

/** 今日是否已记录：多个提醒与待办共用的总闸门 */
export function hasEntryForDate(entries: GardenSnapshot['entries'], date = todayKey()): boolean {
  return entries.some((entry) => entry.date === date);
}

/** 当天仍有效的待办：日期必须是今天，且今天还没有任何记录 */
export function pendingTodos(snapshot: GardenSnapshot, now = new Date()): ReminderTodo[] {
  const today = todayKey(now);
  if (hasEntryForDate(snapshot.entries, today)) return [];
  return snapshot.todos
    .filter((todo) => todo.date === today)
    .sort((a, b) => a.time.localeCompare(b.time));
}

/** 只保留今天的待办，跨天自动失效 */
export function pruneTodos(todos: ReminderTodo[], now = new Date()): ReminderTodo[] {
  const today = todayKey(now);
  return todos.filter((todo) => todo.date === today);
}

export function createReminder(time: string, emotion: Emotion): Reminder {
  return { id: `reminder-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, time, emotion, enabled: true };
}

export interface ReminderDue { reminder: Reminder; todo: ReminderTodo; }

/**
 * 提醒引擎：返回到点且需要处理的提醒。
 * 一致性规则全部在这里裁决：
 * - 启用 + 时间已到（含应用晚打开时补触发）
 * - 今日尚未记录（已记录则一律不再提醒）
 * - 当天只触发一次（用待办是否已存在做幂等去重）
 * 每次调用都会顺手写入当天待办并清除过期待办，调用方负责持久化返回的 snapshot。
 */
export function checkReminders(snapshot: GardenSnapshot, now = new Date()): { snapshot: GardenSnapshot; due: ReminderDue[] } {
  const today = todayKey(now);
  const current = `${`${now.getHours()}`.padStart(2, '0')}:${`${now.getMinutes()}`.padStart(2, '0')}`;
  const todos = pruneTodos(snapshot.todos, now);
  const alreadyDone = hasEntryForDate(snapshot.entries, today);
  const due: ReminderDue[] = [];

  if (!alreadyDone) {
    for (const reminder of snapshot.reminders) {
      if (!reminder.enabled || !isValidTime(reminder.time) || reminder.time > current) continue;
      let todo = todos.find((item) => item.reminderId === reminder.id && item.date === today);
      if (!todo) {
        todo = {
          id: `todo-${reminder.id}-${today}`,
          reminderId: reminder.id,
          date: today,
          time: reminder.time,
          emotion: reminder.emotion,
        };
        todos.push(todo);
      }
      due.push({ reminder, todo });
    }
  }

  todos.sort((a, b) => a.time.localeCompare(b.time));
  return { snapshot: { ...snapshot, todos }, due };
}

/**
 * 保存提醒设置时同步待办，保证"多个提醒设置 ↔ 当天待办 ↔ 是否已记录"一致：
 * - 禁用 / 删除：移除它今天的待办
 * - 已记录当天：不产生任何待办
 * - 已到点且启用：保留 / 补建今天的待办
 * - 未到点：不提前产生待办
 */
export function syncTodosForReminders(snapshot: GardenSnapshot, now = new Date()): ReminderTodo[] {
  const today = todayKey(now);
  const current = `${`${now.getHours()}`.padStart(2, '0')}:${`${now.getMinutes()}`.padStart(2, '0')}`;
  if (hasEntryForDate(snapshot.entries, today)) return [];
  const live = new Map(snapshot.reminders.filter((r) => r.enabled && isValidTime(r.time) && r.time <= current).map((r) => [r.id, r]));
  const kept = pruneTodos(snapshot.todos, now).filter((todo) => live.has(todo.reminderId));
  for (const reminder of live.values()) {
    if (!kept.some((todo) => todo.reminderId === reminder.id)) {
      kept.push({ id: `todo-${reminder.id}-${today}`, reminderId: reminder.id, date: today, time: reminder.time, emotion: reminder.emotion });
    }
    const todo = kept.find((item) => item.reminderId === reminder.id);
    if (todo) { todo.time = reminder.time; todo.emotion = reminder.emotion; }
  }
  return kept.sort((a, b) => a.time.localeCompare(b.time));
}
