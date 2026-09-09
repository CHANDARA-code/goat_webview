import { defineFeature } from "../types";

export const mediaFeature = defineFeature(
  "media",
  {
    playAudio: "AUDIO_PLAY",
    pauseAudio: "AUDIO_PAUSE",
    stopAudio: "AUDIO_STOP",
    seekAudio: "AUDIO_SEEK",
    startRecord: "AUDIO_RECORD_START",
    stopRecord: "AUDIO_RECORD_STOP",
    chooseMedia: "CHOOSE_MEDIA",
    chooseImage: "CHOOSE_MEDIA",
    previewImage: "PREVIEW_IMAGE",
    saveImageToPhotosAlbum: "SAVE_IMAGE_TO_ALBUM",
    recordVideo: "RECORD_VIDEO",
  },
  {
    createInnerAudioContext: "CREATE_INNER_AUDIO_CONTEXT",
    getBackgroundAudioManager: "GET_BACKGROUND_AUDIO_MANAGER",
  },
);
export default mediaFeature;
