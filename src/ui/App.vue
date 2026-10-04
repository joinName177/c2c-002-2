<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { LocalGardenRepository } from '../adapters/local-garden.repository';
import { LocalReminderRepository } from '../adapters/local-reminder.repository';
import { BrowserNotifier } from '../adapters/browser.notifier';
import { EMOTION_META, EMOTIONS, type Emotion } from '../core/models';
import { annualReport, createEntry, sampleSnapshot, syncPlants } from '../core/garden-engine';
import { useReminders } from './use-reminders';

const repo = new LocalGardenRepository();
const state = reactive(repo.load());
const tab = ref<'花园' | '种植' | '时间轴' | '标本馆' | '年报' | '提醒'>('花园');
const selectedEmotion = ref<Emotion>('喜悦');
const notice = ref('');
const draft = reactive({ note: '', intensity: 3 });
const report = computed(() => annualReport(state.entries));
const living = computed(() => state.plants.filter((plant) => plant.status === '繁茂'));
const specimens = computed(() => state.plants.filter((plant) => plant.status === '枯萎'));
const timeline = computed(() => [...state.entries].sort((a, b) => b.date.localeCompare(a.date)));
function save() { state.plants = syncPlants(state.entries, state.plants); repo.save({ entries: state.entries, plants: state.plants }); }
function plant() { state.entries.unshift(createEntry(selectedEmotion.value, draft.note, draft.intensity)); draft.note = ''; save(); notice.value = `${EMOTION_META[selectedEmotion.value].plant} 已经种下`; tab.value = '花园'; }
function reset() { const fresh = sampleSnapshot(); state.entries = fresh.entries; state.plants = fresh.plants; save(); notice.value = '已恢复初始示例花园'; }

const reminderDraft = reactive({ time: '21:30', emotion: '平静' as Emotion });
function goPlant(emotion: Emotion) { selectedEmotion.value = emotion; draft.note = ''; tab.value = '种植'; }
const {
  reminders, permission, recordedToday, pendingBanner,
  addReminder, updateReminder, removeReminder, ensurePermission, openPlantFromBanner,
} = useReminders(computed(() => state.entries), new LocalReminderRepository(), new BrowserNotifier(), goPlant);
</script>

<template>
  <div class="garden-app">
    <button v-if="pendingBanner" class="reminder-todo" type="button" :style="{ '--todo-color': EMOTION_META[pendingBanner.emotion].color }" @click="openPlantFromBanner">
      <span class="todo-bell">{{ EMOTION_META[pendingBanner.emotion].symbol }}</span>
      <span class="todo-text"><b>今天还没记录情绪</b><small>{{ pendingBanner.time }} 的提醒 · 点一下，直接种下今天的{{ EMOTION_META[pendingBanner.emotion].plant }}（{{ pendingBanner.emotion }}）</small></span>
      <span class="todo-cta">去记录 →</span>
    </button>
    <header class="garden-topbar"><div class="garden-brand"><span class="garden-mark">✿</span><div><span class="eyebrow">THE INNER GARDEN / 02</span><h1>情绪植物园</h1></div></div><div class="garden-top-actions"><span class="weather">{{ recordedToday ? '今日已记录' : '今日花园' }} · {{ living.length }} 株在生长</span><button class="quiet-button" type="button" @click="reset">重置演示</button></div></header>
    <main class="garden-wrap"><section class="garden-hero"><div><span class="eyebrow green-text">DAILY EMOTION CULTIVATION</span><h2>给情绪一块<br /><i>可以生长的土壤。</i></h2><p>你不需要每天都阳光明媚，只需要为此刻诚实地浇一次水。</p></div><div class="garden-stats"><div><strong>{{ report.active }}</strong><span>活跃日</span></div><div><strong>{{ report.lushness }}<small>%</small></strong><span>花园繁茂度</span></div><div><strong>{{ state.entries.length }}</strong><span>情绪标本</span></div></div></section>
      <nav class="garden-tabs"><button v-for="item in ['花园', '种植', '时间轴', '标本馆', '年报', '提醒']" :key="item" type="button" :class="{ active: tab === item }" @click="tab = item as typeof tab">{{ item }}</button></nav>
      <section v-if="tab === '花园'" class="garden-board"><div class="board-heading"><div><span class="eyebrow">YOUR EMOTIONAL BIOME</span><h3>正在生长的情绪</h3></div><span class="season-label">秋季 · 第 40 周</span></div><div class="plant-grid"><article v-for="plant in living" :key="plant.id" class="plant-card" :style="{ '--plant-color': EMOTION_META[plant.emotion].color }"><div class="plant-card-top"><span class="plant-status">正在生长</span><span>{{ plant.streak }} 天连续</span></div><div class="plant-illustration"><span class="plant-glow"></span><strong>{{ EMOTION_META[plant.emotion].symbol }}</strong><i v-for="n in Math.min(plant.streak + 1, 5)" :key="n" :style="{ '--n': n }">●</i></div><div class="plant-info"><span class="plant-emotion">{{ plant.emotion }}</span><h4>{{ EMOTION_META[plant.emotion].plant }}</h4><p>{{ EMOTION_META[plant.emotion].hint }}</p><div class="growth-track"><span :style="{ width: `${Math.min(100, Math.max(12, plant.streak / 14 * 100))}%` }"></span></div><small>{{ plant.stage }} · 下一阶段还需 {{ Math.max(0, 3 - plant.streak) }} 天</small></div></article><button class="add-plant-card" type="button" @click="tab = '种植'"><span>＋</span><strong>种下一颗新情绪</strong><small>每天记录，植物就会长大</small></button></div></section>
      <section v-else-if="tab === '种植'" class="planting-layout"><article class="plant-form"><div class="board-heading"><div><span class="eyebrow">PLANT A FEELING</span><h3>今天的你，是什么天气？</h3></div></div><div class="emotion-picker"><button v-for="emotion in EMOTIONS" :key="emotion" type="button" :class="{ selected: selectedEmotion === emotion }" :style="{ '--emotion-color': EMOTION_META[emotion].color }" @click="selectedEmotion = emotion"><span>{{ EMOTION_META[emotion].symbol }}</span><b>{{ emotion }}</b><small>{{ EMOTION_META[emotion].plant }}</small></button></div><label>给这颗情绪留一句话<textarea v-model="draft.note" rows="5" placeholder="它今天为什么来到这里？"></textarea></label><label>情绪强度 <output>{{ draft.intensity }} / 5</output><input v-model.number="draft.intensity" type="range" min="1" max="5" /></label><button class="plant-button" type="button" @click="plant">种下这颗情绪 ✦</button><p class="notice">{{ notice }}</p></article><aside class="plant-preview" :style="{ '--preview-color': EMOTION_META[selectedEmotion].color }"><span class="eyebrow">PREVIEW / {{ selectedEmotion }}</span><div class="preview-plant">{{ EMOTION_META[selectedEmotion].symbol }}</div><h3>{{ EMOTION_META[selectedEmotion].plant }}</h3><p>今天种下，连续记录 3 天后发芽，7 天后开花，14 天后结果。</p></aside></section>
      <section v-else-if="tab === '时间轴'" class="timeline-section"><div class="board-heading"><div><span class="eyebrow">GROWTH TIMELINE</span><h3>每一天，都留下了一片叶子</h3></div></div><div class="timeline"><div v-for="(entry, index) in timeline" :key="entry.id" class="timeline-item"><div class="timeline-date"><strong>{{ new Date(`${entry.date}T00:00:00`).getDate() }}</strong><span>{{ new Date(`${entry.date}T00:00:00`).toLocaleDateString('zh-CN', { month: 'short' }) }}</span></div><div class="timeline-dot" :style="{ background: EMOTION_META[entry.emotion].color }"></div><div class="timeline-content"><div><span class="timeline-emotion" :style="{ color: EMOTION_META[entry.emotion].color }">{{ EMOTION_META[entry.emotion].symbol }} {{ entry.emotion }}</span><span class="intensity">强度 {{ entry.intensity }}/5</span></div><p>{{ entry.note }}</p><small>{{ EMOTION_META[entry.emotion].plant }} · 第 {{ index + 1 }} 片叶子</small></div></div></div></section>
      <section v-else-if="tab === '标本馆'" class="specimen-section"><div class="board-heading"><div><span class="eyebrow">SPECIMEN ARCHIVE</span><h3>枯萎不是消失，是被好好保存</h3></div></div><div v-if="specimens.length" class="specimen-grid"><div v-for="plant in specimens" :key="plant.id" class="specimen-card"><div class="pressed-flower">{{ EMOTION_META[plant.emotion].symbol }}</div><div><span>{{ plant.emotion }} · {{ EMOTION_META[plant.emotion].plant }}</span><strong>生长了 {{ plant.entryIds.length }} 天</strong><small>最后浇水：{{ plant.lastWatered }}</small></div></div></div><div v-else class="empty-state">你的标本馆还是空的。持续记录，等一朵花完成它的季节。</div></section>
      <section v-else-if="tab === '提醒'" class="reminder-section">
        <div class="board-heading"><div><span class="eyebrow">DAILY REMINDER</span><h3>睡前也别忘了今天的植物</h3></div><span class="season-label">{{ recordedToday ? '今天已经记录 · 不会再提醒' : '今天还没记录' }}</span></div>

        <div class="permission-note" :class="permission">
          <template v-if="permission === 'granted'"><b>🔔 浏览器通知已开启</b><small>到点会弹出系统通知；通知没点也没关系，回到应用顶部会有待办条。</small></template>
          <template v-else-if="permission === 'denied'"><b>🔕 通知权限已被拒绝</b><small>浏览器通知无法弹出，但提醒到点后，进入应用顶部会出现当天待办条。也可以在浏览器站点设置里重新允许通知。</small></template>
          <template v-else-if="permission === 'unsupported'"><b>🔕 当前浏览器不支持系统通知</b><small>提醒到点后，进入应用顶部会出现当天待办条。</small></template>
          <template v-else><b>🔔 开启浏览器通知</b><small>添加提醒时会请求权限；到点直接收到系统通知，点击通知即可记录。</small><button type="button" @click="ensurePermission">开启通知</button></template>
        </div>

        <ul v-if="reminders.length" class="reminder-list">
          <li v-for="reminder in reminders" :key="reminder.id" class="reminder-row" :class="{ off: !reminder.enabled }">
            <input class="reminder-time" type="time" :value="reminder.time" @change="updateReminder(reminder.id, { time: ($event.target as HTMLInputElement).value || reminder.time })" />
            <div class="reminder-emotions">
              <button v-for="emotion in EMOTIONS" :key="emotion" type="button" :class="{ selected: reminder.emotion === emotion }" :style="{ '--emotion-color': EMOTION_META[emotion].color }" :title="EMOTION_META[emotion].plant" @click="updateReminder(reminder.id, { emotion })">{{ EMOTION_META[emotion].symbol }}</button>
            </div>
            <label class="reminder-switch"><input type="checkbox" :checked="reminder.enabled" @change="updateReminder(reminder.id, { enabled: ($event.target as HTMLInputElement).checked })" /><span>{{ reminder.enabled ? '已开启' : '已关闭' }}</span></label>
            <button class="reminder-delete" type="button" @click="removeReminder(reminder.id)">删除</button>
          </li>
        </ul>
        <div v-else class="reminder-empty">还没有提醒。添加一个，别让今天的植物等太久。</div>

        <div class="reminder-add">
          <span class="eyebrow">NEW REMINDER</span>
          <div class="reminder-add-row">
            <input v-model="reminderDraft.time" type="time" />
            <div class="reminder-emotions">
              <button v-for="emotion in EMOTIONS" :key="emotion" type="button" :class="{ selected: reminderDraft.emotion === emotion }" :style="{ '--emotion-color': EMOTION_META[emotion].color }" :title="EMOTION_META[emotion].plant" @click="reminderDraft.emotion = emotion">{{ EMOTION_META[emotion].symbol }}</button>
            </div>
            <button class="plant-button" type="button" @click="addReminder({ time: reminderDraft.time, emotion: reminderDraft.emotion })">添加提醒</button>
          </div>
          <small class="reminder-add-hint">每天到点提醒一次；当天完成记录后通知和待办条都会消失，第二天自动恢复。</small>
        </div>
      </section>
      <section v-else class="report-section"><div class="report-heading"><span class="eyebrow">EMOTIONAL ECOLOGY REPORT · 2026</span><h3>你的情绪生态年报</h3><p>这一年，你和自己的内在天气相处得怎么样？</p></div><div class="report-grid"><div class="report-score"><span>花园繁茂度</span><strong>{{ report.lushness }}<small>/ 100</small></strong><div class="report-progress"><i :style="{ width: `${report.lushness}%` }"></i></div><p>每一次诚实的记录，都会让生态系统更完整。</p></div><div class="top-emotion"><span>最常出现的物种</span><div><strong :style="{ color: EMOTION_META[report.top.emotion].color }">{{ EMOTION_META[report.top.emotion].symbol }}</strong><h4>{{ report.top.emotion }}</h4></div><p>{{ report.top.count }} 次记录 · 是你今年最熟悉的一种天气</p></div><div class="count-chart"><span>情绪物种分布</span><div v-for="item in report.counts" :key="item.emotion" class="count-row"><b>{{ item.emotion }}</b><div><i :style="{ width: `${Math.max(5, item.count / Math.max(report.top.count, 1) * 100)}%`, background: EMOTION_META[item.emotion].color }"></i></div><small>{{ item.count }}</small></div></div></div></section>
    </main>
  </div>
</template>
