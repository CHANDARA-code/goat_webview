/**
 * @goat/bridge-mock - Domain 9: Media & Audio Handlers (7 Actions)
 */

import { mockState } from '../state/store.js';
import { scannerModal } from '../ui/scanner-modal.js';
import {
  ScanCodeResult,
  ChooseMediaResult,
  AudioStateResult,
} from '../types.js';
import { GoatBridgeError, BridgeErrorCodes } from '../errors.js';

export class MediaHandlers {
  /**
   * Action 105: SCAN_CODE
   */
  public static scanCode(payload: any = {}): Promise<ScanCodeResult> {
    if (!mockState.permissions.get('CAMERA')) {
      throw new GoatBridgeError(BridgeErrorCodes.PERMISSION_DENIED, 'Camera permission denied');
    }
    if (!mockState.isUserGestureFresh(10000)) {
      throw new GoatBridgeError(
        BridgeErrorCodes.GESTURE_REQUIRED,
        'Camera scanning requires recent user interaction (<10s)'
      );
    }
    return scannerModal.prompt(payload);
  }

  /**
   * Action 106: CHOOSE_MEDIA
   */
  public static chooseMedia(payload: any = {}): ChooseMediaResult {
    if (!mockState.permissions.get('CAMERA')) {
      throw new GoatBridgeError(BridgeErrorCodes.PERMISSION_DENIED, 'Camera/Media permission denied');
    }

    const count = typeof payload.count === 'number' ? Math.min(mockState.media.length, payload.count) : 2;
    return {
      tempFiles: mockState.media.slice(0, count),
      type: payload.mediaType && payload.mediaType.includes('video') ? 'video' : 'image',
    };
  }

  /**
   * Action 107: PREVIEW_IMAGE
   */
  public static previewImage(payload: any = {}): { previewed: boolean; count: number } {
    const urls = Array.isArray(payload.urls) ? payload.urls : [];
    if (urls.length === 0) {
      throw new GoatBridgeError(BridgeErrorCodes.INVALID_ARGUMENT, 'Missing image urls for previewImage');
    }
    return { previewed: true, count: urls.length };
  }

  /**
   * Action 108: AUDIO_PLAY
   */
  public static audioPlay(payload: any = {}): AudioStateResult {
    const src = payload.src || 'https://goat.dev/audio/sample.mp3';
    mockState.audio = {
      status: 'playing',
      src,
      currentTime: payload.startTime || 0,
      duration: 180,
    };
    return { ...mockState.audio };
  }

  /**
   * Action 109: AUDIO_PAUSE
   */
  public static audioPause(): AudioStateResult {
    mockState.audio.status = 'paused';
    return { ...mockState.audio };
  }

  /**
   * Action 110: AUDIO_STOP
   */
  public static audioStop(): AudioStateResult {
    mockState.audio.status = 'stopped';
    mockState.audio.currentTime = 0;
    return { ...mockState.audio };
  }

  /**
   * Action 111: AUDIO_SEEK
   */
  public static audioSeek(payload: any = {}): AudioStateResult {
    const position = typeof payload.position === 'number' ? payload.position : 0;
    mockState.audio.currentTime = position;
    mockState.audio.status = 'seeked';
    return { ...mockState.audio };
  }
}
