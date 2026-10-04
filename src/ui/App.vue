<script setup lang="ts">
import { computed, reactive, ref, onMounted, onBeforeUnmount } from 'vue';
import { LocalGardenRepository } from '../adapters/local-garden.repository';
import { BrowserNotificationAdapter } from '../adapters/browser-notification.adapter';
import { EMOTION_META, EMOTIONS, isValidTime, todayKey, type Emotion, type Reminder } from '../core/models';
import { annualReport, createEntry, sampleSnapshot, syncPlants } from '../core/garden-engine';
import { checkReminders, createReminder, pendingTodos, syncTodosForReminders } from '../core/reminder-engine';
import type { NotificationPermission } from '../ports/notification.port';

const repo = new LocalGardenRepository();
const notifier = new BrowserNotificationAdapter();
const state = reactive(repo.load());
const tab = ref<'花园' | '种植' | '时间轴' | '标本馆' | '年报' | '提醒'>('花园');
const tabs = ['花园', '种植', '时间轴', '标本馆', '年报', '提醒'] as const;
const selectedEmotion = ref<Emotion>('喜悦');
const plantingSource = ref<Emotion | null>(null);
const notice = ref('');
const reminderNotice = ref('');
const draft = reactive({ note: '', intensity: 3 });
const newReminder = reactive({ time: '21:30', emotion: '平静' as Emotion });
const notifyPermission = ref<NotificationPermission>(notifier.permission());
const report = computed(() => annualReport(state.entries));
const living = computed(() => state.plants.filter((plant) => plant.status === '繁茂'));
const specimens = computed(() => state.plants.filter((plant) => plant.status === '枯萎'));
const timeline = computed(() => [...state.entries].sort((a, b) => b.date.localeCompare(a.date)));
/** 当天有效待办：今天还没记录时才存在，按提醒时间排序 */
const todayTodos = computed(() => pendingTodos(state));
const primaryTodo = computed(() => todayTodos.value[0] ?? null);

function persist() { repo.save({ entries: state.entries, plants: state.plants, reminders: state.reminders, todos: state.todos }); }
function save() { state.plants = syncPlants(state.entries, state.plants); persist(); }

/** 上次巡检时刻，用于判断通知是否"正好到点"（晚打开应用只补待办、不补发通知） */
let lastTick = new Date();
function crossedDue(last: Date, now: Date, hhmm: string): boolean {
  const [h, m] = hhmm.split(':').map(Number);
  const due = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0);
  return due > last && due <= now;
}

function sweep(shouldNotify: boolean) {
  const now = new Date();
  const beforeIds = new Set(state.todos.map((todo) => todo.id));
  const result = checkReminders(state, now);
  state.todos = result.snapshot.todos;
  if (shouldNotify) {
    for (const { reminder } of result.due) {
      if (crossedDue(lastTick, now, reminder.time)) {
        notifier.notify({
          title: '该给今天的情绪浇浇水了 🌱',
          body: `现在 ${reminder.time}，花一分钟记录「${reminder.emotion}」，别让今天断签。`,
          tag: `emotion-reminder-${reminder.id}`,
          emotion: reminder.emotion,
          onClick: (emotion) => goPlant(emotion as Emotion),
        });
      }
    }
  }
  const changed = state.todos.length !== beforeIds.size || state.todos.some((todo) => !beforeIds.has(todo.id));
  if (changed) persist();
  lastTick.setTime(now.getTime());
}

let timer: number | undefined;
onMounted(() => {
  sweep(false); // 打开应用：过期提醒只补成当天待办，不补弹通知
  timer = window.setInterval(() => sweep(true), 20000);
});
onBeforeUnmount(() => { if (timer) window.clearInterval(timer); });

function goPlant(emotion: Emotion) {
  selectedEmotion.value = emotion;
  plantingSource.value = emotion;
  tab.value = '种植';
}

async function requestNotifyPermission() {
  notifyPermission.value = await notifier.request();
}

function syncReminderEdit(reminder: Reminder) {
  if (!isValidTime(reminder.time)) reminder.time = '21:00';
  state.todos = syncTodosForReminders(state);
  persist();
}
function toggleReminder(reminder: Reminder) {
  reminder.enabled = !reminder.enabled;
  state.todos = syncTodosForReminders(state);
  persist();
}
function removeReminder(id: string) {
  state.reminders = state.reminders.filter((item) => item.id !== id);
  state.todos = syncTodosForReminders(state);
  persist();
}
function addReminder() {
  if (!isValidTime(newReminder.time)) { reminderNotice.value = '提醒时间格式应为 HH:MM'; return; }
  state.reminders.push(createReminder(newReminder.time, newReminder.emotion));
  state.todos = syncTodosForReminders(state);
  persist();
  reminderNotice.value = '已添加每日提醒';
}

function plant() {
  state.entries.unshift(createEntry(selectedEmotion.value, draft.note, draft.intensity));
  // 完成记录：今天的待办全部消失，闸门由"今日已有记录"接管，提醒不再反复打扰
  state.todos = state.todos.filter((todo) => todo.date !== todayKey());
  draft.note = '';
  plantingSource.value = null;
  save();
  notice.value = `${EMOTION_META[selectedEmotion.value].plant} 已经种下`;
  tab.value = '花园';
}
function reset() { const fresh = sampleSnapshot(); state.entries = fresh.entries; state.plants = fresh.plants; state.reminders = fresh.reminders; state.todos = fresh.todos; save(); notice.value = '已恢复初始示例花园'; }
</script>

<template>
  <div class="garden-app">
    <header class="garden-topbar"><div class="garden-brand"><span class="garden-mark">✿</span><div><span class="eyebrow">THE INNER GARDEN / 02</span><h1>情绪植物园</h1></div></div><div class="garden-top-actions"><span class="weather">今日花园 · {{ living.length }} 株在生长</span><button class="quiet-button" type="button" @click="reset">重置演示</button></div></header>
    <main class="garden-wrap"><section class="garden-hero"><div><span class="eyebrow green-text">DAILY EMOTION CULTIVATION</span><h2>给情绪一块<br /><i>可以生长的土壤。</i></h2><p>你不需要每天都阳光明媚，只需要为此刻诚实地浇一次水。</p></div><div class="garden-stats"><div><strong>{{ report.active }}</strong><span>活跃日</span></div><div><strong>{{ report.lushness }}<small>%</small></strong><span>花园繁茂度</span></div><div><strong>{{ state.entries.length }}</strong><span>情绪标本</span></div></div></section>
      <nav class="garden-tabs"><button v-for="item in tabs" :key="item" type="button" :class="{ active: tab === item }" @click="tab = item">{{ item }}</button></nav>
      <button v-if="primaryTodo" class="todo-banner" type="button" :style="{ '--todo-color': EMOTION_META[primaryTodo.emotion].color }" @click="goPlant(primaryTodo.emotion)"><span class="todo-icon">{{ EMOTION_META[primaryTodo.emotion].symbol }}</span><span class="todo-text"><b>今日待办 · {{ primaryTodo.time }} 的提醒还没完成</b><small>今天还没有记录情绪，去种下一株「{{ primaryTodo.emotion }} · {{ EMOTION_META[primaryTodo.emotion].plant }}」吧<template v-if="todayTodos.length > 1">（另有 {{ todayTodos.length - 1 }} 条提醒待完成）</template></small></span><span class="todo-go">去记录 →</span></button>
      <section v-if="tab === '花园'" class="garden-board"><div class="board-heading"><div><span class="eyebrow">YOUR EMOTIONAL BIOME</span><h3>正在生长的情绪</h3></div><span class="season-label">秋季 · 第 40 周</span></div><div class="plant-grid"><article v-for="plant in living" :key="plant.id" class="plant-card" :style="{ '--plant-color': EMOTION_META[plant.emotion].color }"><div class="plant-card-top"><span class="plant-status">正在生长</span><span>{{ plant.streak }} 天连续</span></div><div class="plant-illustration"><span class="plant-glow"></span><strong>{{ EMOTION_META[plant.emotion].symbol }}</strong><i v-for="n in Math.min(plant.streak + 1, 5)" :key="n" :style="{ '--n': n }">●</i></div><div class="plant-info"><span class="plant-emotion">{{ plant.emotion }}</span><h4>{{ EMOTION_META[plant.emotion].plant }}</h4><p>{{ EMOTION_META[plant.emotion].hint }}</p><div class="growth-track"><span :style="{ width: `${Math.min(100, Math.max(12, plant.streak / 14 * 100))}%` }"></span></div><small>{{ plant.stage }} · 下一阶段还需 {{ Math.max(0, 3 - plant.streak) }} 天</small></div></article><button class="add-plant-card" type="button" @click="goPlant(selectedEmotion)"><span>＋</span><strong>种下一颗新情绪</strong><small>每天记录，植物就会长大</small></button></div></section>
      <section v-else-if="tab === '种植'" class="planting-layout"><article class="plant-form"><div class="board-heading"><div><span class="eyebrow">PLANT A FEELING</span><h3>今天的你，是什么天气？</h3></div></div><p v-if="plantingSource" class="planting-source">来自每日提醒 · 已为你预选「{{ plantingSource }}」，也可以换成此刻真实的心情</p><div class="emotion-picker"><button v-for="emotion in EMOTIONS" :key="emotion" type="button" :class="{ selected: selectedEmotion === emotion }" :style="{ '--emotion-color': EMOTION_META[emotion].color }" @click="selectedEmotion = emotion"><span>{{ EMOTION_META[emotion].symbol }}</span><b>{{ emotion }}</b><small>{{ EMOTION_META[emotion].plant }}</small></button></div><label>给这颗情绪留一句话<textarea v-model="draft.note" rows="5" placeholder="它今天为什么来到这里？"></textarea></label><label>情绪强度 <output>{{ draft.intensity }} / 5</output><input v-model.number="draft.intensity" type="range" min="1" max="5" /></label><button class="plant-button" type="button" @click="plant">种下这颗情绪 ✦</button><p class="notice">{{ notice }}</p></article><aside class="plant-preview" :style="{ '--preview-color': EMOTION_META[selectedEmotion].color }"><span class="eyebrow">PREVIEW / {{ selectedEmotion }}</span><div class="preview-plant">{{ EMOTION_META[selectedEmotion].symbol }}</div><h3>{{ EMOTION_META[selectedEmotion].plant }}</h3><p>今天种下，连续记录 3 天后发芽，7 天后开花，14 天后结果。</p></aside></section>
      <section v-else-if="tab === '时间轴'" class="timeline-section"><div class="board-heading"><div><span class="eyebrow">GROWTH TIMELINE</span><h3>每一天，都留下了一片叶子</h3></div></div><div class="timeline"><div v-for="(entry, index) in timeline" :key="entry.id" class="timeline-item"><div class="timeline-date"><strong>{{ new Date(`${entry.date}T00:00:00`).getDate() }}</strong><span>{{ new Date(`${entry.date}T00:00:00`).toLocaleDateString('zh-CN', { month: 'short' }) }}</span></div><div class="timeline-dot" :style="{ background: EMOTION_META[entry.emotion].color }"></div><div class="timeline-content"><div><span class="timeline-emotion" :style="{ color: EMOTION_META[entry.emotion].color }">{{ EMOTION_META[entry.emotion].symbol }} {{ entry.emotion }}</span><span class="intensity">强度 {{ entry.intensity }}/5</span></div><p>{{ entry.note }}</p><small>{{ EMOTION_META[entry.emotion].plant }} · 第 {{ index + 1 }} 片叶子</small></div></div></div></section>
      <section v-else-if="tab === '标本馆'" class="specimen-section"><div class="board-heading"><div><span class="eyebrow">SPECIMEN ARCHIVE</span><h3>枯萎不是消失，是被好好保存</h3></div></div><div v-if="specimens.length" class="specimen-grid"><div v-for="plant in specimens" :key="plant.id" class="specimen-card"><div class="pressed-flower">{{ EMOTION_META[plant.emotion].symbol }}</div><div><span>{{ plant.emotion }} · {{ EMOTION_META[plant.emotion].plant }}</span><strong>生长了 {{ plant.entryIds.length }} 天</strong><small>最后浇水：{{ plant.lastWatered }}</small></div></div></div><div v-else class="empty-state">你的标本馆还是空的。持续记录，等一朵花完成它的季节。</div></section>
      <section v-else-if="tab === '提醒'" class="reminder-section">
        <div class="board-heading"><div><span class="eyebrow">DAILY REMINDERS</span><h3>每日提醒，别让今天断签</h3></div></div>
        <div class="notify-card" :class="notifyPermission"><div><b>浏览器通知</b><p v-if="notifyPermission === 'granted'">已开启。到点会通过浏览器通知提醒你；即使没点开通知，花园顶部也会保留一条当天待办。</p><p v-else-if="notifyPermission === 'denied'">通知权限已被浏览器拒绝。提醒到点后，会在花园顶部出现一条当天有效的待办，点一下就能去记录。</p><p v-else-if="notifyPermission === 'unsupported'">当前浏览器不支持系统通知，提醒会以花园顶部待办的方式呈现。</p><p v-else>开启后到点收到浏览器通知；没点开也没关系，花园顶部会有当天待办兜底。</p></div><button v-if="notifyPermission === 'default'" class="plant-button inline" type="button" @click="requestNotifyPermission">开启通知</button><span v-else class="notify-state" :class="notifyPermission">{{ notifyPermission === 'granted' ? '通知已开启' : notifyPermission === 'denied' ? '通知被拒绝' : '不支持通知' }}</span></div>
        <div class="reminder-list"><div v-for="reminder in state.reminders" :key="reminder.id" class="reminder-row"><input v-model="reminder.time" type="time" @change="syncReminderEdit(reminder)" /><select v-model="reminder.emotion" @change="syncReminderEdit(reminder)"><option v-for="emotion in EMOTIONS" :key="emotion" :value="emotion">{{ EMOTION_META[emotion].symbol }} {{ emotion }} · {{ EMOTION_META[emotion].plant }}</option></select><label class="reminder-switch"><input type="checkbox" :checked="reminder.enabled" @change="toggleReminder(reminder)" /><span>{{ reminder.enabled ? '启用中' : '已停用' }}</span></label><button class="quiet-button danger" type="button" @click="removeReminder(reminder.id)">删除</button></div><div v-if="!state.reminders.length" class="empty-state compact">还没有提醒，在下面添加一条吧。</div></div>
        <div class="reminder-add"><span class="eyebrow">新增一条每日提醒</span><div class="reminder-row"><input v-model="newReminder.time" type="time" /><select v-model="newReminder.emotion"><option v-for="emotion in EMOTIONS" :key="emotion" :value="emotion">{{ EMOTION_META[emotion].symbol }} {{ emotion }} · {{ EMOTION_META[emotion].plant }}</option></select><button class="plant-button inline" type="button" @click="addReminder">添加提醒</button></div><p class="notice">{{ reminderNotice }}</p></div>
        <ul class="reminder-tips"><li>每条提醒每天到点触发一次；当天完成任意一次记录后，所有通知与待办都会安静下来，不再反复提醒。</li><li>通知被拒绝或没点开时，花园顶部出现当天待办，点击直接跳到种植页并预选好偏好情绪。</li><li>多条提醒与"今天是否已记录"始终保持一致；待办只在当天有效，隔天自动作废。</li></ul>
      </section>
      <section v-else class="report-section"><div class="report-heading"><span class="eyebrow">EMOTIONAL ECOLOGY REPORT · 2026</span><h3>你的情绪生态年报</h3><p>这一年，你和自己的内在天气相处得怎么样？</p></div><div class="report-grid"><div class="report-score"><span>花园繁茂度</span><strong>{{ report.lushness }}<small>/ 100</small></strong><div class="report-progress"><i :style="{ width: `${report.lushness}%` }"></i></div><p>每一次诚实的记录，都会让生态系统更完整。</p></div><div class="top-emotion"><span>最常出现的物种</span><div><strong :style="{ color: EMOTION_META[report.top.emotion].color }">{{ EMOTION_META[report.top.emotion].symbol }}</strong><h4>{{ report.top.emotion }}</h4></div><p>{{ report.top.count }} 次记录 · 是你今年最熟悉的一种天气</p></div><div class="count-chart"><span>情绪物种分布</span><div v-for="item in report.counts" :key="item.emotion" class="count-row"><b>{{ item.emotion }}</b><div><i :style="{ width: `${Math.max(5, item.count / Math.max(report.top.count, 1) * 100)}%`, background: EMOTION_META[item.emotion].color }"></i></div><small>{{ item.count }}</small></div></div></div></section>
    </main>
  </div>
</template>
