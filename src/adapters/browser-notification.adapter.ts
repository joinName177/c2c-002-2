import type { NotificationPermission, NotificationPort, ReminderNotification } from '../ports/notification.port';

export class BrowserNotificationAdapter implements NotificationPort {
  get supported(): boolean { return typeof window !== 'undefined' && 'Notification' in window; }

  permission(): NotificationPermission {
    if (!this.supported) return 'unsupported';
    return Notification.permission as NotificationPermission;
  }

  async request(): Promise<NotificationPermission> {
    if (!this.supported) return 'unsupported';
    const result = await Notification.requestPermission();
    return result as NotificationPermission;
  }

  notify({ title, body, emotion, tag, onClick }: ReminderNotification): void {
    if (!this.supported || Notification.permission !== 'granted') return;
    const notification = new Notification(title, {
      body,
      tag: tag ?? `emotion-reminder-${emotion}`,
      icon: undefined,
    });
    notification.onclick = () => {
      window.focus();
      onClick(emotion);
      notification.close();
    };
  }
}
