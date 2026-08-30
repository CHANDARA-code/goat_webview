import test from 'node:test';
import assert from 'node:assert/strict';
import { GoatBridgeMock, mockState } from '../src/index.js';

test('Domain 9: Media & Audio', async (t) => {
  const bridge = new GoatBridgeMock();

  await t.test('SCAN_CODE returns configured mock barcode / QR payload', async () => {
    const scanRes = await bridge.callNative('SCAN_CODE');
    assert.equal(scanRes.result, 'https://goat.dev/pay?inv=99281');
    assert.equal(scanRes.scanType, 'QR_CODE');
  });

  await t.test('CHOOSE_MEDIA returns simulated media files', async () => {
    const mediaRes = await bridge.callNative('CHOOSE_MEDIA', { count: 1 });
    assert.equal(mediaRes.tempFiles.length, 1);
    assert.equal(mediaRes.tempFiles[0].fileType, 'image');
  });

  await t.test('PREVIEW_IMAGE simulates full-screen image previewer', async () => {
    const previewRes = await bridge.callNative('PREVIEW_IMAGE', {
      urls: ['https://cdn.goat.dev/img1.jpg', 'https://cdn.goat.dev/img2.jpg'],
    });
    assert.equal(previewRes.previewed, true);
    assert.equal(previewRes.count, 2);
  });

  await t.test('Audio player: AUDIO_PLAY / PAUSE / SEEK / STOP', async () => {
    const playRes = await bridge.callNative('AUDIO_PLAY', { src: 'https://goat.dev/audio/track.mp3' });
    assert.equal(playRes.status, 'playing');
    assert.equal(mockState.audio.status, 'playing');

    const pauseRes = await bridge.callNative('AUDIO_PAUSE');
    assert.equal(pauseRes.status, 'paused');

    const seekRes = await bridge.callNative('AUDIO_SEEK', { position: 45 });
    assert.equal(seekRes.status, 'seeked');
    assert.equal(mockState.audio.currentTime, 45);

    const stopRes = await bridge.callNative('AUDIO_STOP');
    assert.equal(stopRes.status, 'stopped');
    assert.equal(mockState.audio.currentTime, 0);
  });
});
