/**
 * @goat/bridge-mock - Domain 14: Binary IPC Channels Handlers (4 Actions)
 */

import { mockState } from '../state/store.js';
import { BinaryPortPacketResult, BinaryPortReadResult } from '../types.js';
import { GoatBridgeError, BridgeErrorCodes } from '../errors.js';

export class BinaryHandlers {
  private static portCounter: number = 200;

  /**
   * Action 149: CREATE_BINARY_PORT
   */
  public static createPort(payload: any = {}): { portId: string; created: boolean } {
    const portId = payload.portId || `port_bin_${++this.portCounter}`;
    mockState.binaryPorts.set(portId, {
      queue: [],
      closed: false,
      currentSeq: 0,
    });
    return { portId, created: true };
  }

  /**
   * Action 150: POST_BINARY_MESSAGE
   */
  public static postMessage(payload: any = {}): BinaryPortPacketResult {
    const portId = payload.portId;
    if (!portId || !mockState.binaryPorts.has(portId)) {
      throw new GoatBridgeError(BridgeErrorCodes.PORT_NOT_FOUND, `Binary port not found: "${portId}"`);
    }

    const port = mockState.binaryPorts.get(portId)!;
    if (port.closed) {
      throw new GoatBridgeError(BridgeErrorCodes.PORT_NOT_FOUND, `Binary port is closed: "${portId}"`);
    }

    const dataBase64 = String(payload.dataBase64 || payload.data || '');
    const seq = ++port.currentSeq;
    const byteSize = (dataBase64.length * 3) / 4;

    port.queue.push({ dataBase64, seq });

    return {
      posted: true,
      portId,
      byteSize: Math.floor(byteSize),
      sequenceNumber: seq,
    };
  }

  /**
   * Action 151: READ_BINARY_MESSAGE
   */
  public static readMessage(payload: any = {}): BinaryPortReadResult {
    const portId = payload.portId;
    if (!portId || !mockState.binaryPorts.has(portId)) {
      throw new GoatBridgeError(BridgeErrorCodes.PORT_NOT_FOUND, `Binary port not found: "${portId}"`);
    }

    const port = mockState.binaryPorts.get(portId)!;
    if (port.queue.length === 0) {
      return { portId, dataBase64: null, byteSize: 0 };
    }

    const packet = port.queue.shift()!;
    const byteSize = Math.floor((packet.dataBase64.length * 3) / 4);

    return {
      portId,
      dataBase64: packet.dataBase64,
      byteSize,
    };
  }

  /**
   * Action 152: CLOSE_BINARY_PORT
   */
  public static closePort(payload: any = {}): { closed: boolean; portId: string } {
    const portId = payload.portId;
    if (portId && mockState.binaryPorts.has(portId)) {
      const port = mockState.binaryPorts.get(portId)!;
      port.closed = true;
      port.queue = [];
      mockState.binaryPorts.delete(portId);
      return { closed: true, portId };
    }
    return { closed: true, portId: portId || '' };
  }
}
