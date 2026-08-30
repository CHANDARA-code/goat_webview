import type { GoatCapabilityPlugin } from 'react-native-goat-webview';
import { goatCapabilityRegistry } from 'react-native-goat-webview';

export const mediaCapabilityPlugin: GoatCapabilityPlugin = {
  namespace: 'media',
  supportedActions: [
    'CHOOSE_IMAGE',
    'PREVIEW_IMAGE',
    'GET_IMAGE_INFO',
    'SAVE_IMAGE_TO_PHOTOS_ALBUM',
    'CHOOSE_VIDEO',
    'SAVE_VIDEO_TO_PHOTOS_ALBUM',
    'START_RECORD',
    'STOP_RECORD',
    'PLAY_VOICE',
    'PAUSE_VOICE',
    'STOP_VOICE',
  ],
  handleAction: async (action: string, payload: any) => {
    switch (action) {
      case 'CHOOSE_IMAGE':
        const count = payload?.count ?? 9;
        return {
          tempFilePaths: Array.from({ length: count }, (_, i) => `file:///data/media/img_${i}.jpg`),
          tempFiles: Array.from({ length: count }, (_, i) => ({
            path: `file:///data/media/img_${i}.jpg`,
            size: 204800,
          })),
        };
      case 'PREVIEW_IMAGE':
        return { previewed: true, current: payload?.current ?? '' };
      case 'GET_IMAGE_INFO':
        return {
          width: 1920,
          height: 1080,
          path: payload?.src ?? 'file:///data/media/sample.jpg',
          orientation: 'up',
          type: 'jpeg',
        };
      case 'CHOOSE_VIDEO':
        return {
          tempFilePath: 'file:///data/media/vid_001.mp4',
          duration: 15.4,
          size: 5242880,
          height: 1080,
          width: 1920,
        };
      case 'START_RECORD':
        return { recording: true, tempFilePath: 'file:///data/audio/rec_temp.m4a' };
      case 'STOP_RECORD':
        return { tempFilePath: 'file:///data/audio/rec_final.m4a', duration: 8.2 };
      default:
        return { success: true, action };
    }
  },
};

export function registerMediaCapability(): void {
  goatCapabilityRegistry.registerPlugin(mediaCapabilityPlugin);
}

export default mediaCapabilityPlugin;
