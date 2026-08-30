/**
 * @goat/compiler-uniapp Network JSAPI Shims
 */
import { callBridgeAction } from './bridge.js';
import type {
  DownloadFileOptions,
  DownloadFileSuccessResult,
  RequestOptions,
  RequestSuccessResult,
  UniError,
  UploadFileOptions,
  UploadFileSuccessResult,
} from '../types.js';

/**
 * uni.request
 */
export function request(options: RequestOptions): Promise<RequestSuccessResult> {
  if (!options || typeof options.url !== 'string' || !options.url) {
    const err: UniError = { errMsg: 'request:fail url must be a non-empty string' };
    options?.fail?.(err);
    options?.complete?.(err);
    return Promise.reject(err);
  }

  const method = (options.method || 'GET').toUpperCase();

  return callBridgeAction('API_REQUEST', {
    url: options.url,
    method,
    headers: options.header || {},
    body: typeof options.data === 'object' && !(options.data instanceof ArrayBuffer) ? JSON.stringify(options.data) : options.data,
    timeoutMs: options.timeout || 10000,
    responseType: options.responseType || 'text',
  })
    .then((nativeRes: any) => {
      const statusCode = nativeRes?.statusCode || nativeRes?.status || 200;
      let responseData = nativeRes?.data;

      if (options.dataType !== 'text' && typeof responseData === 'string') {
        try {
          responseData = JSON.parse(responseData);
        } catch {
          // Keep raw string
        }
      }

      const result: RequestSuccessResult = {
        data: responseData,
        statusCode,
        header: nativeRes?.header || nativeRes?.headers || {},
        cookies: nativeRes?.cookies || [],
        errMsg: 'request:ok',
      };

      options.success?.(result);
      options.complete?.(result);
      return result;
    })
    .catch((err: any) => {
      const error: UniError = {
        errMsg: err.errMsg || `request:fail ${err.message || 'network error'}`,
        code: err.code || 'NETWORK_ERROR',
        details: err,
      };
      options.fail?.(error);
      options.complete?.(error);
      return Promise.reject(error);
    });
}

/**
 * uni.downloadFile
 */
export function downloadFile(options: DownloadFileOptions): Promise<DownloadFileSuccessResult> {
  if (!options || typeof options.url !== 'string' || !options.url) {
    const err: UniError = { errMsg: 'downloadFile:fail url is required' };
    options?.fail?.(err);
    options?.complete?.(err);
    return Promise.reject(err);
  }

  return callBridgeAction('DOWNLOAD_FILE', {
    url: options.url,
    filePath: options.filePath,
    headers: options.header || {},
    timeoutMs: options.timeout || 30000,
  })
    .then((nativeRes: any) => {
      const result: DownloadFileSuccessResult = {
        tempFilePath: nativeRes?.savedPath || nativeRes?.tempFilePath || '/tmp/downloaded_file',
        statusCode: nativeRes?.statusCode || 200,
        errMsg: 'downloadFile:ok',
      };
      options.success?.(result);
      options.complete?.(result);
      return result;
    })
    .catch((err: any) => {
      const error: UniError = { errMsg: err.errMsg || `downloadFile:fail ${err.message || 'download error'}` };
      options.fail?.(error);
      options.complete?.(error);
      return Promise.reject(error);
    });
}

/**
 * uni.uploadFile
 */
export function uploadFile(options: UploadFileOptions): Promise<UploadFileSuccessResult> {
  if (!options || typeof options.url !== 'string' || !options.filePath || !options.name) {
    const err: UniError = { errMsg: 'uploadFile:fail url, filePath, and name are required' };
    options?.fail?.(err);
    options?.complete?.(err);
    return Promise.reject(err);
  }

  return callBridgeAction('UPLOAD_FILE', {
    url: options.url,
    filePath: options.filePath,
    name: options.name,
    formData: options.formData || {},
    headers: options.header || {},
    timeoutMs: options.timeout || 30000,
  })
    .then((nativeRes: any) => {
      const result: UploadFileSuccessResult = {
        data: typeof nativeRes?.data === 'string' ? nativeRes.data : JSON.stringify(nativeRes?.data || {}),
        statusCode: nativeRes?.statusCode || nativeRes?.status || 200,
        errMsg: 'uploadFile:ok',
      };
      options.success?.(result);
      options.complete?.(result);
      return result;
    })
    .catch((err: any) => {
      const error: UniError = { errMsg: err.errMsg || `uploadFile:fail ${err.message || 'upload error'}` };
      options.fail?.(error);
      options.complete?.(error);
      return Promise.reject(error);
    });
}
