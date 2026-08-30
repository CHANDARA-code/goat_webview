/**
 * @goat/compiler-taro - Network JSAPI Runtime Bridge
 * Implements Taro.request, downloadFile, uploadFile, and connectSocket.
 */

import { invokeBridgeCallback, bridge } from './bridge.js';
import {
  RequestOptions,
  RequestSuccessResult,
  DownloadFileOptions,
  DownloadFileSuccessResult,
  UploadFileOptions,
  UploadFileSuccessResult,
  ConnectSocketOptions,
  GeneralCallbackResult,
  SocketTask,
} from '../types.js';

/**
 * Taro.request -> API_REQUEST
 */
export async function request(options: RequestOptions): Promise<RequestSuccessResult> {
  if (!options || typeof options !== 'object' || !options.url) {
    const err = { errMsg: 'request:fail url is required', code: 'INVALID_ARGUMENT' };
    options?.fail?.(err);
    options?.complete?.(err);
    throw err;
  }

  const payload = {
    url: options.url,
    method: (options.method || 'GET').toUpperCase(),
    headers: options.header || {},
    body: options.data,
    data: options.data,
    timeoutMs: options.timeout,
    dataType: options.dataType || 'json',
    responseType: options.responseType || 'text',
  };

  return invokeBridgeCallback<RequestSuccessResult, RequestOptions>(
    'request',
    'API_REQUEST',
    payload,
    options,
    (res) => ({
      data: res?.data ?? res?.body ?? '',
      statusCode: res?.statusCode || res?.status || 200,
      header: res?.header || res?.headers || {},
      cookies: res?.cookies || [],
    }),
    (err) => err?.message || err?.errMsg || 'network request failed'
  );
}

/**
 * Taro.downloadFile -> DOWNLOAD_FILE
 */
export async function downloadFile(options: DownloadFileOptions): Promise<DownloadFileSuccessResult> {
  if (!options || !options.url) {
    const err = { errMsg: 'downloadFile:fail url is required', code: 'INVALID_ARGUMENT' };
    options?.fail?.(err);
    options?.complete?.(err);
    throw err;
  }

  const payload = {
    url: options.url,
    header: options.header || {},
    destPath: options.filePath,
    fileName: options.fileName,
    timeoutMs: options.timeout,
  };

  return invokeBridgeCallback<DownloadFileSuccessResult, DownloadFileOptions>(
    'downloadFile',
    'DOWNLOAD_FILE',
    payload,
    options,
    (res) => ({
      tempFilePath: res?.tempFilePath || res?.destPath || options.filePath || 'goat://tmp/download',
      statusCode: res?.statusCode || 200,
    }),
    (err) => err?.message || err?.errMsg || 'download failed'
  );
}

/**
 * Taro.uploadFile -> UPLOAD_FILE
 */
export async function uploadFile(options: UploadFileOptions): Promise<UploadFileSuccessResult> {
  if (!options || !options.url || !options.filePath || !options.name) {
    const err = { errMsg: 'uploadFile:fail url, filePath and name are required', code: 'INVALID_ARGUMENT' };
    options?.fail?.(err);
    options?.complete?.(err);
    throw err;
  }

  const payload = {
    url: options.url,
    filePath: options.filePath,
    name: options.name,
    header: options.header || {},
    formData: options.formData || {},
    timeoutMs: options.timeout,
  };

  return invokeBridgeCallback<UploadFileSuccessResult, UploadFileOptions>(
    'uploadFile',
    'UPLOAD_FILE',
    payload,
    options,
    (res) => ({
      data: typeof res?.data === 'string' ? res.data : JSON.stringify(res?.data || ''),
      statusCode: res?.statusCode || 200,
    }),
    (err) => err?.message || err?.errMsg || 'upload failed'
  );
}

/**
 * Taro.connectSocket -> WEBSOCKET_CONNECT
 */
export function connectSocket(options: ConnectSocketOptions): SocketTask {
  if (!options || !options.url) {
    const err = { errMsg: 'connectSocket:fail url is required', code: 'INVALID_ARGUMENT' };
    options?.fail?.(err);
    options?.complete?.(err);
  }

  const openCallbacks: Array<(res: { header: Record<string, string> }) => void> = [];
  const closeCallbacks: Array<(res: { code: number; reason: string }) => void> = [];
  const errorCallbacks: Array<(res: { errMsg: string }) => void> = [];
  const messageCallbacks: Array<(res: { data: string | ArrayBuffer }) => void> = [];

  let socketId: string = `socket_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

  // Initiate connection over bridge
  bridge
    .callNative('WEBSOCKET_CONNECT', {
      socketId,
      url: options.url,
      protocols: options.protocols,
      headers: options.header,
      tcpNoDelay: options.tcpNoDelay,
    })
    .then((res: any) => {
      if (res?.socketId) socketId = res.socketId;
      options?.success?.({ errMsg: 'connectSocket:ok' });
      options?.complete?.({ errMsg: 'connectSocket:ok' });
      openCallbacks.forEach((cb) => cb({ header: res?.header || {} }));
    })
    .catch((err: any) => {
      const errObj = { errMsg: `connectSocket:fail ${err?.message || 'connection failed'}` };
      options?.fail?.(errObj);
      options?.complete?.(errObj);
      errorCallbacks.forEach((cb) => cb(errObj));
    });

  const task: SocketTask = {
    send(sendOpts) {
      bridge
        .callNative('WEBSOCKET_SEND', { socketId, data: sendOpts.data })
        .then(() => {
          sendOpts.success?.({ errMsg: 'sendSocketMessage:ok' });
          sendOpts.complete?.({ errMsg: 'sendSocketMessage:ok' });
        })
        .catch((err: any) => {
          const errObj = { errMsg: `sendSocketMessage:fail ${err?.message || 'send error'}` };
          sendOpts.fail?.(errObj);
          sendOpts.complete?.(errObj);
        });
    },

    close(closeOpts = {}) {
      bridge
        .callNative('WEBSOCKET_CLOSE', { socketId, code: closeOpts.code, reason: closeOpts.reason })
        .then(() => {
          closeOpts.success?.({ errMsg: 'closeSocket:ok' });
          closeOpts.complete?.({ errMsg: 'closeSocket:ok' });
          closeCallbacks.forEach((cb) => cb({ code: closeOpts.code || 1000, reason: closeOpts.reason || 'closed' }));
        })
        .catch((err: any) => {
          const errObj = { errMsg: `closeSocket:fail ${err?.message || 'close error'}` };
          closeOpts.fail?.(errObj);
          closeOpts.complete?.(errObj);
        });
    },

    onOpen(callback) {
      openCallbacks.push(callback);
    },

    onClose(callback) {
      closeCallbacks.push(callback);
    },

    onError(callback) {
      errorCallbacks.push(callback);
    },

    onMessage(callback) {
      messageCallbacks.push(callback);
    },
  };

  return task;
}
