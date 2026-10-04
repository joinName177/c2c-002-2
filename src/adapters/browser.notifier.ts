import type { Notifier, NotificationPermissionState, NotificationPayload } from '../ports/notifier.port';

export class BrowserNotifier implements Notifier {
  permission(): NotificationPermissionState {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
    return Notification.permission as NotificationPermissionState;
  }

  async request(): Promise<NotificationPermissionState> {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
    if (Notification.permission === 'granted' || Notification.permission === 'denied') return Notification.permission;
    try { return await Notification.requestPermission() as NotificationPermissionState; } catch { return Notification.permission as NotificationPermissionState; }
  }

  notify({ title, body, tag }: NotificationPayload, onClick: () => void): void {
    if (this.permission() !== 'granted') return;
    try {
      const notification = new Notification(title, { body, tag, lang: 'zh-CN' });
      notification.onclick = () => { window.focus(); onClick(); notification.close(); };
    } catch { /* 通知失败时静默：应用内待办条仍会兜底 */ }
  }
}
