/**
 * @goat/bridge-mock - Domain 10: Contacts & Social Sharing Handlers (5 Actions)
 */

import { mockState } from '../state/store.js';
import { ContactResult, ShareSheetResult } from '../types.js';
import { GoatBridgeError, BridgeErrorCodes } from '../errors.js';

export class ContactsHandlers {
  /**
   * Action 112 / 113: CHOOSE_CONTACT / PICK_CONTACTS
   */
  public static chooseContact(): ContactResult {
    if (!mockState.permissions.get('CONTACTS')) {
      throw new GoatBridgeError(BridgeErrorCodes.PERMISSION_DENIED, 'Contacts permission denied');
    }
    const list = mockState.contacts;
    if (list.length === 0) {
      return {
        name: 'Jane Doe',
        phoneNumber: '+1 (555) 123-4567',
        email: 'jane@example.com',
      };
    }
    return { ...list[0] };
  }

  /**
   * Action 114: GET_CONTACTS_COUNT
   */
  public static getContactsCount(): { count: number } {
    if (!mockState.permissions.get('CONTACTS')) {
      throw new GoatBridgeError(BridgeErrorCodes.PERMISSION_DENIED, 'Contacts permission denied');
    }
    return { count: mockState.contacts.length };
  }

  /**
   * Action 115: SHARE_SHEET
   */
  public static shareSheet(payload: any = {}): ShareSheetResult {
    return {
      shared: true,
      activityType: 'com.apple.UIKit.activity.PostToTwitter',
    };
  }

  /**
   * Action 116: SHARE_TO_STORY
   */
  public static shareToStory(payload: any = {}): { shared: boolean } {
    const mediaPath = payload.mediaPath;
    if (!mediaPath) {
      throw new GoatBridgeError(BridgeErrorCodes.INVALID_ARGUMENT, 'Missing mediaPath for shareToStory');
    }
    return { shared: true };
  }
}
