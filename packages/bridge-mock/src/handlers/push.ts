/**
 * @goat/bridge-mock - Domain 11: Push Notifications Handlers (9 Actions)
 */

import { mockState } from '../state/store.js';
import { PushTokenResult, PushPermissionResult } from '../types.js';
import { GoatBridgeError, BridgeErrorCodes } from '../errors.js';

export class PushHandlers {
  /**
   * Action 117 / 118: PUSH_GET_TOKEN / GET_PUSH_TOKEN
   */
  public static getPushToken(payload: any = {}, callerAppId: string = mockState.defaultAppId): PushTokenResult {
    const appId = payload.appId || callerAppId;
    return {
      token: mockState.pushToken,
      appId,
    };
  }

  /**
   * Action 119: PUSH_REQUEST_PERMISSION
   */
  public static requestPermission(): PushPermissionResult {
    mockState.permissions.set('NOTIFICATION', true);
    return { granted: true };
  }

  /**
   * Action 120: PUSH_SET_BADGE
   */
  public static setBadge(payload: any = {}): { updated: boolean; count: number } {
    const count = typeof payload.count === 'number' ? Math.max(0, payload.count) : 0;
    mockState.badgeCount = count;
    return { updated: true, count };
  }

  /**
   * Action 121: PUSH_SHOW_NOTIFICATION
   */
  public static showNotification(payload: any = {}): { shown: boolean; title: string } {
    const title = payload.title || 'Notification';
    const content = payload.content || '';
    const channelId = payload.channelId;

    mockState.pendingNotifications.push({ title, content, channelId, data: payload.data });
    return { shown: true, title };
  }

  /**
   * Action 122: SUBSCRIBE_PUSH_TOPIC
   */
  public static subscribeTopic(payload: any = {}): { subscribed: boolean; topic: string } {
    const topic = payload.topic;
    if (!topic) {
      throw new GoatBridgeError(BridgeErrorCodes.INVALID_ARGUMENT, 'Missing required "topic"');
    }
    mockState.pushTopics.add(topic);
    return { subscribed: true, topic };
  }

  /**
   * Action 123: UNSUBSCRIBE_PUSH_TOPIC
   */
  public static unsubscribeTopic(payload: any = {}): { unsubscribed: boolean; topic: string } {
    const topic = payload.topic;
    if (!topic) {
      throw new GoatBridgeError(BridgeErrorCodes.INVALID_ARGUMENT, 'Missing required "topic"');
    }
    mockState.pushTopics.delete(topic);
    return { unsubscribed: true, topic };
  }

  /**
   * Action 124: GET_PENDING_NOTIFICATIONS
   */
  public static getPending(): { count: number; notifications: any[] } {
    return {
      count: mockState.pendingNotifications.length,
      notifications: [...mockState.pendingNotifications],
    };
  }

  /**
   * Action 125: CLEAR_NOTIFICATIONS
   */
  public static clear(): { cleared: boolean } {
    mockState.pendingNotifications = [];
    return { cleared: true };
  }
}
