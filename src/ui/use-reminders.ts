import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import type { Ref } from 'vue';
import type { Emotion, EmotionEntry, Reminder, ReminderInput } from '../core/models';
import { createReminder, dateKey, dueReminders, firedKey, reminderMessage } from '../core/reminder';
import type { ReminderRepository } from '../ports/reminder-repository.port';
import type { Notifier, NotificationPermissionState } from '../ports/notifier.port';

const TICK_MS = 20_000;

/**
 * 每日提醒编排：
 * - 到点且当天未记录：已授权则发浏览器通知；无论授权与否，应用内待办条都会出现
 * - 通知权限被拒 / 用户没点通知：待办条作为兜底，当天有效
 * - 每个提醒每天只通知一次（fired 记录跨刷新保留），完成当天记录后所有提醒立即静默
 */
export function useReminders(
  entries: Ref<EmotionEntry[]>,
  reminderRepo: ReminderRepository,
  notifier: Notifier,
  goPlant: (emotion: Emotion) => void,
) {
  const reminders = ref<Reminder[]>(reminderRepo.loadReminders());
  const permission = ref<NotificationPermissionState>(notifier.permission());
  const now = ref(new Date());
  const fired = ref<Set<string>>(new Set(reminderRepo.loadFired()));

  let timer: number | undefined;

  function persistReminders() { reminderRepo.saveReminders(reminders.value); }
  function persistFired() {
    const today = dateKey();
    const keys = [...fired.value].filter((key) => key.startsWith(today));
    fired.value = new Set(keys);
    reminderRepo.saveFired(keys);
  }

  const recordedToday = computed(() => {
    const today = dateKey(now.value);
    return entries.value.some((entry) => entry.date === today);
  });

  /** 已到点且当天还没记录的提醒；这是通知与待办条共同的唯一数据来源。 */
  const pending = computed<Reminder[]>(() => dueReminders(reminders.value, entries.value, now.value, dateKey(now.value)));
  const pendingBanner = computed<Reminder | null>(() => {
    const list = pending.value;
    return list.length ? list.reduce((latest, item) => item.time > latest.time ? item : latest) : null;
  });

  function check() {
    now.value = new Date();
    const today = dateKey(now.value);
    persistFired();
    if (!pending.value.length) return;
    for (const reminder of pending.value) {
      const key = firedKey(reminder.id, today);
      if (fired.value.has(key)) continue;
      fired.value.add(key);
      persistFired();
      if (permission.value === 'granted') {
        const { title, body } = reminderMessage(reminder);
        notifier.notify({ title, body, tag: `reminder-${today}`, emotion: reminder.emotion }, () => goPlant(reminder.emotion));
      }
    }
  }

  function addReminder(input: ReminderInput) {
    const reminder = createReminder(input);
    reminders.value.push(reminder);
    persistReminders();
    // 新增时若时间点已过，只让待办条兜底，不补发一条"过去"的通知
    const today = dateKey();
    if (reminder.time <= `${String(now.value.getHours()).padStart(2, '0')}:${String(now.value.getMinutes()).padStart(2, '0')}`) {
      fired.value.add(firedKey(reminder.id, today));
      persistFired();
    }
    void ensurePermission();
    check();
  }

  function updateReminder(id: string, patch: Partial<Pick<Reminder, 'time' | 'emotion' | 'enabled'>>) {
    const reminder = reminders.value.find((item) => item.id === id);
    if (!reminder) return;
    Object.assign(reminder, patch);
    persistReminders();
    if (patch.enabled) void ensurePermission();
    check();
  }

  function removeReminder(id: string) {
    reminders.value = reminders.value.filter((item) => item.id !== id);
    persistReminders();
  }

  async function ensurePermission(): Promise<NotificationPermissionState> {
    if (permission.value === 'default') permission.value = await notifier.request();
    return permission.value;
  }

  function openPlantFromBanner() {
    if (pendingBanner.value) goPlant(pendingBanner.value.emotion);
  }

  onMounted(() => {
    check();
    timer = window.setInterval(check, TICK_MS);
    document.addEventListener('visibilitychange', check);
  });
  onBeforeUnmount(() => {
    if (timer) window.clearInterval(timer);
    document.removeEventListener('visibilitychange', check);
  });

  return { reminders, permission, recordedToday, pending, pendingBanner, addReminder, updateReminder, removeReminder, ensurePermission, openPlantFromBanner };
}
