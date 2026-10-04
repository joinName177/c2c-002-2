export type Emotion = '愤怒' | '平静' | '喜悦' | '忧伤' | '焦虑';
export type GrowthStage = '种子' | '发芽' | '开花' | '结果';

export interface EmotionEntry { id: string; date: string; emotion: Emotion; note: string; intensity: number; }
export interface Plant { id: string; emotion: Emotion; plantedAt: string; lastWatered: string; streak: number; stage: GrowthStage; status: '繁茂' | '枯萎'; entryIds: string[]; }
/** 每日提醒：可配置提醒时间与偏好情绪，支持多条 */
export interface Reminder { id: string; time: string; emotion: Emotion; enabled: boolean; }
/** 当天有效的待办（通知被拒绝 / 未点开时的兜底入口） */
export interface ReminderTodo { id: string; reminderId: string; date: string; time: string; emotion: Emotion; }
export interface GardenSnapshot {
  entries: EmotionEntry[];
  plants: Plant[];
  reminders: Reminder[];
  todos: ReminderTodo[];
}

export const EMOTIONS: Emotion[] = ['愤怒', '平静', '喜悦', '忧伤', '焦虑'];
export const EMOTION_META: Record<Emotion, { plant: string; symbol: string; color: string; hint: string }> = {
  愤怒: { plant: '刺刺多肉', symbol: '♠', color: '#ef7c65', hint: '有刺，但也在保护你' },
  平静: { plant: '静谧绿萝', symbol: '⌁', color: '#5cbf9b', hint: '让呼吸慢下来' },
  喜悦: { plant: '小太阳', symbol: '✺', color: '#e8b84e', hint: '把好心情分享出去' },
  忧伤: { plant: '雾紫薰衣草', symbol: '✿', color: '#9c84c7', hint: '悲伤也有它的香气' },
  焦虑: { plant: '害羞含羞草', symbol: '❋', color: '#d991ae', hint: '温柔地靠近当下' },
};

/** 本地日期 YYYY-MM-DD，与 entry.date 口径保持一致 */
export function todayKey(now = new Date()): string {
  const y = now.getFullYear();
  const m = `${now.getMonth() + 1}`.padStart(2, '0');
  const d = `${now.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** HH:MM 格式校验（00:00 - 23:59） */
export function isValidTime(value: string): boolean { return /^([01]\d|2[0-3]):[0-5]\d$/.test(value); }
