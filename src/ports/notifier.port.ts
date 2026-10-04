import type { Emotion } from '../core/models';

export type NotificationPermissionState = 'default' | 'granted' | 'denied' | 'unsupported';

export interface NotificationPayload {
  title: string;
  body: string;
  tag: string;
  emotion: Emotion;
}

export interface Notifier {
  permission(): NotificationPermissionState;
  request(): Promise<NotificationPermissionState>;
  notify(payload: NotificationPayload, onClick: () => void): void;
}
