import test from 'node:test';
import assert from 'node:assert/strict';
import { GoatBridgeMock, BridgeErrorCodes } from '../src/index.js';

test('Domain 3: Sandboxed FileSystem & File Chooser', async (t) => {
  const bridge = new GoatBridgeMock({ appId: 'fs_test_app' });

  await t.test('FS_WRITE_FILE and FS_READ_FILE', async () => {
    const writeRes = await bridge.callNative('FS_WRITE_FILE', {
      filePath: '/logs/debug.txt',
      data: 'Execution started at 2026-08-26',
    });
    assert.equal(writeRes.saved, true);
    assert.equal(writeRes.bytesWritten > 0, true);

    const readRes = await bridge.callNative('FS_READ_FILE', {
      filePath: '/logs/debug.txt',
    });
    assert.equal(readRes.data, 'Execution started at 2026-08-26');
  });

  await t.test('FS_MKDIR, FS_LIST_DIR, FS_STAT, FS_EXISTS', async () => {
    await bridge.callNative('FS_MKDIR', { dirPath: '/cache/assets' });
    await bridge.callNative('FS_WRITE_FILE', { filePath: '/cache/assets/icon.png', data: 'mock_png_binary' });

    const existsRes = await bridge.callNative('FS_EXISTS', { filePath: '/cache/assets/icon.png' });
    assert.equal(existsRes.exists, true);

    const statRes = await bridge.callNative('FS_STAT', { filePath: '/cache/assets/icon.png' });
    assert.equal(statRes.isFile, true);
    assert.equal(statRes.isDirectory, false);
    assert.equal(statRes.size, 'mock_png_binary'.length);

    const listRes = await bridge.callNative('FS_LIST_DIR', { dirPath: '/cache/assets' });
    assert.equal(listRes.files.includes('icon.png'), true);
  });

  await t.test('FS_COPY_FILE and FS_UNLINK', async () => {
    await bridge.callNative('FS_WRITE_FILE', { filePath: '/src.txt', data: 'copy me' });
    const copyRes = await bridge.callNative('FS_COPY_FILE', { srcPath: '/src.txt', destPath: '/dst.txt' });
    assert.equal(copyRes.copied, true);

    const readDst = await bridge.callNative('FS_READ_FILE', { filePath: '/dst.txt' });
    assert.equal(readDst.data, 'copy me');

    const unlinkRes = await bridge.callNative('FS_UNLINK', { filePath: '/src.txt' });
    assert.equal(unlinkRes.deleted, true);

    const existsSrc = await bridge.callNative('FS_EXISTS', { filePath: '/src.txt' });
    assert.equal(existsSrc.exists, false);
  });

  await t.test('FS_RMDIR removes directory and children', async () => {
    await bridge.callNative('FS_MKDIR', { dirPath: '/temp_dir' });
    await bridge.callNative('FS_WRITE_FILE', { filePath: '/temp_dir/file.txt', data: 'temp' });

    const rmdirRes = await bridge.callNative('FS_RMDIR', { dirPath: '/temp_dir' });
    assert.equal(rmdirRes.removed, true);

    const existsDir = await bridge.callNative('FS_EXISTS', { filePath: '/temp_dir' });
    assert.equal(existsDir.exists, false);
  });

  await t.test('Path traversal attempts are rejected', async () => {
    await assert.rejects(
      () => bridge.callNative('FS_READ_FILE', { filePath: '/../../../etc/passwd' }),
      (err: any) => err.code === BridgeErrorCodes.SECURITY_VIOLATION
    );
  });

  await t.test('CHOOSE_FILES and CANCEL_FILE_CHOOSER', async () => {
    const chooseRes = await bridge.callNative('CHOOSE_FILES', { allowMultiple: true });
    assert.equal(chooseRes.isSuccess, true);
    assert.equal(chooseRes.selectedUris.length >= 1, true);

    const cancelRes = await bridge.callNative('CANCEL_FILE_CHOOSER');
    assert.equal(cancelRes.cancelled, true);
  });
});
