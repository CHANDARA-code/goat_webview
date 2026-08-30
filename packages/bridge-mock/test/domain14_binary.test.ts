import test from 'node:test';
import assert from 'node:assert/strict';
import { GoatBridgeMock } from '../src/index.js';

test('Domain 14: Binary IPC Channels', async (t) => {
  const bridge = new GoatBridgeMock();

  await t.test('Binary sub-channel lifecycle: CREATE_BINARY_PORT, POST, READ, CLOSE', async () => {
    // 1. Create port
    const portRes = await bridge.callNative('CREATE_BINARY_PORT', { portId: 'audio_stream_port_1' });
    assert.equal(portRes.created, true);
    assert.equal(portRes.portId, 'audio_stream_port_1');

    // 2. Post packet
    const base64Data = 'SGVsbG8gR29hdCBCaW5hcnkgSVBD';
    const postRes1 = await bridge.callNative('POST_BINARY_MESSAGE', {
      portId: 'audio_stream_port_1',
      dataBase64: base64Data,
    });
    assert.equal(postRes1.posted, true);
    assert.equal(postRes1.sequenceNumber, 1);
    assert.equal(postRes1.byteSize > 0, true);

    const postRes2 = await bridge.callNative('POST_BINARY_MESSAGE', {
      portId: 'audio_stream_port_1',
      dataBase64: 'UGFja2V0IDI=',
    });
    assert.equal(postRes2.sequenceNumber, 2);

    // 3. Read packets
    const read1 = await bridge.callNative('READ_BINARY_MESSAGE', { portId: 'audio_stream_port_1' });
    assert.equal(read1.dataBase64, base64Data);

    const read2 = await bridge.callNative('READ_BINARY_MESSAGE', { portId: 'audio_stream_port_1' });
    assert.equal(read2.dataBase64, 'UGFja2V0IDI=');

    const readEmpty = await bridge.callNative('READ_BINARY_MESSAGE', { portId: 'audio_stream_port_1' });
    assert.equal(readEmpty.dataBase64, null);

    // 4. Close port
    const closeRes = await bridge.callNative('CLOSE_BINARY_PORT', { portId: 'audio_stream_port_1' });
    assert.equal(closeRes.closed, true);
  });
});
