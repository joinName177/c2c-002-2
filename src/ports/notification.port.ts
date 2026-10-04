export type NotificationPermission = 'granted' | 'denied' | 'default' | 'unsupported';

export interface ReminderNotification {
  title: string;
  body: string;
  emotion: string;
  /** Notification.tag：同标签通知只保留最新一条，避免重复堆叠 */
  tag?: string;
  /** 点击通知时回调：跳到种植页并预选情绪 */
  onClick: (emotion: string) => void;
}

export interface NotificationPort {
  permission(): NotificationPermission;
  request(): Promise<NotificationPermission>;
  notify(payload: ReminderNotification): void;
}
