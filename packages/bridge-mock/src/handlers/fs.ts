/**
 * @goat/bridge-mock - Domain 3: Sandboxed FileSystem & File Chooser Handlers (11 Actions)
 */

import { mockState } from '../state/store.js';
import { FileStatResult, FileChooserResult } from '../types.js';
import { GoatBridgeError, BridgeErrorCodes } from '../errors.js';

export class FileSystemHandlers {
  private static readonly MAX_FS_BYTES = 50 * 1024 * 1024; // 50MB quota

  private static normalizePath(rawPath: string): string {
    if (!rawPath || typeof rawPath !== 'string') {
      throw new GoatBridgeError(BridgeErrorCodes.INVALID_ARGUMENT, 'File path must be a non-empty string');
    }
    // Block path traversal
    if (rawPath.includes('..') || rawPath.includes('//')) {
      throw new GoatBridgeError(BridgeErrorCodes.SECURITY_VIOLATION, 'Path traversal detected in sandbox filesystem');
    }
    let p = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
    return p;
  }

  /**
   * Action 29: FS_WRITE_FILE
   */
  public static writeFile(payload: any = {}, callerAppId: string = mockState.defaultAppId): { saved: boolean; bytesWritten: number; filePath: string; appId: string } {
    const filePath = this.normalizePath(payload.filePath);
    const data = typeof payload.data === 'string' ? payload.data : '';
    const encoding = payload.encoding || 'utf8';
    const append = !!payload.append;
    const appId = payload.appId || callerAppId;

    const fs = mockState.getAppFs(appId);
    let finalData = data;
    if (append && fs.has(filePath)) {
      const existing = fs.get(filePath)!;
      if (!existing.isDir) {
        finalData = existing.data + data;
      }
    }

    // Check size
    const globalBuffer = typeof globalThis !== 'undefined' ? (globalThis as any).Buffer : undefined;
    const bytesWritten = globalBuffer ? globalBuffer.byteLength(finalData, encoding === 'base64' ? 'base64' : 'utf8') : finalData.length;

    // Check quota
    let totalBytes = 0;
    for (const [p, item] of fs.entries()) {
      if (p !== filePath && item.isFile) {
        totalBytes += item.data.length;
      }
    }
    if (totalBytes + bytesWritten > this.MAX_FS_BYTES) {
      throw new GoatBridgeError(
        BridgeErrorCodes.STORAGE_QUOTA_EXCEEDED,
        `FileSystem sandbox quota of 50MB exceeded for appId "${appId}"`
      );
    }

    fs.set(filePath, {
      data: finalData,
      isDir: false,
      isFile: true,
      lastModified: Date.now(),
    });

    return { saved: true, bytesWritten, filePath, appId };
  }

  /**
   * Action 30: FS_READ_FILE
   */
  public static readFile(payload: any = {}, callerAppId: string = mockState.defaultAppId): { data: string; encoding: string; filePath: string; appId: string } {
    const filePath = this.normalizePath(payload.filePath);
    const encoding = payload.encoding || 'utf8';
    const appId = payload.appId || callerAppId;

    const fs = mockState.getAppFs(appId);
    if (!fs.has(filePath)) {
      throw new GoatBridgeError(BridgeErrorCodes.INVALID_ARGUMENT, `File not found: "${filePath}"`);
    }

    const item = fs.get(filePath)!;
    if (item.isDir) {
      throw new GoatBridgeError(BridgeErrorCodes.INVALID_ARGUMENT, `Cannot read directory as file: "${filePath}"`);
    }

    return { data: item.data, encoding, filePath, appId };
  }

  /**
   * Action 31: FS_MKDIR
   */
  public static mkdir(payload: any = {}, callerAppId: string = mockState.defaultAppId): { created: boolean; dirPath: string; appId: string } {
    const dirPath = this.normalizePath(payload.dirPath || payload.dir);
    const appId = payload.appId || callerAppId;
    const fs = mockState.getAppFs(appId);

    fs.set(dirPath, {
      data: '',
      isDir: true,
      isFile: false,
      lastModified: Date.now(),
    });

    return { created: true, dirPath, appId };
  }

  /**
   * Action 32: FS_RMDIR
   */
  public static rmdir(payload: any = {}, callerAppId: string = mockState.defaultAppId): { removed: boolean; dirPath: string; appId: string } {
    const dirPath = this.normalizePath(payload.dirPath || payload.dir);
    const appId = payload.appId || callerAppId;
    const fs = mockState.getAppFs(appId);

    if (!fs.has(dirPath)) {
      throw new GoatBridgeError(BridgeErrorCodes.INVALID_ARGUMENT, `Directory not found: "${dirPath}"`);
    }

    fs.delete(dirPath);
    // Delete recursive children
    for (const k of Array.from(fs.keys())) {
      if (k.startsWith(dirPath + '/')) {
        fs.delete(k);
      }
    }

    return { removed: true, dirPath, appId };
  }

  /**
   * Action 33: FS_UNLINK
   */
  public static unlink(payload: any = {}, callerAppId: string = mockState.defaultAppId): { deleted: boolean; filePath: string; appId: string } {
    const filePath = this.normalizePath(payload.filePath || payload.path);
    const appId = payload.appId || callerAppId;
    const fs = mockState.getAppFs(appId);

    if (!fs.has(filePath)) {
      throw new GoatBridgeError(BridgeErrorCodes.INVALID_ARGUMENT, `File not found: "${filePath}"`);
    }

    fs.delete(filePath);
    return { deleted: true, filePath, appId };
  }

  /**
   * Action 34: FS_LIST_DIR
   */
  public static listDir(payload: any = {}, callerAppId: string = mockState.defaultAppId): { files: string[]; dirPath: string; appId: string } {
    const dirPath = this.normalizePath(payload.dirPath || payload.dir || '/');
    const appId = payload.appId || callerAppId;
    const fs = mockState.getAppFs(appId);

    const files: string[] = [];
    const prefix = dirPath.endsWith('/') ? dirPath : `${dirPath}/`;

    for (const [p, item] of fs.entries()) {
      if (p !== dirPath && p.startsWith(prefix)) {
        const sub = p.substring(prefix.length);
        if (!sub.includes('/')) {
          files.push(item.isDir ? `${sub}/` : sub);
        }
      }
    }

    return { files, dirPath, appId };
  }

  /**
   * Action 35: FS_STAT
   */
  public static stat(payload: any = {}, callerAppId: string = mockState.defaultAppId): FileStatResult {
    const filePath = this.normalizePath(payload.filePath || payload.path);
    const appId = payload.appId || callerAppId;
    const fs = mockState.getAppFs(appId);

    if (!fs.has(filePath)) {
      throw new GoatBridgeError(BridgeErrorCodes.INVALID_ARGUMENT, `File not found: "${filePath}"`);
    }

    const item = fs.get(filePath)!;
    const parts = filePath.split('/');
    const name = parts[parts.length - 1] || 'root';

    return {
      size: item.data.length,
      isFile: item.isFile,
      isDirectory: item.isDir,
      lastModified: item.lastModified,
      name,
    };
  }

  /**
   * Action 36: FS_COPY_FILE
   */
  public static copyFile(payload: any = {}, callerAppId: string = mockState.defaultAppId): { copied: boolean; srcPath: string; destPath: string; appId: string } {
    const srcPath = this.normalizePath(payload.srcPath || payload.src);
    const destPath = this.normalizePath(payload.destPath || payload.dst || payload.dest);
    const appId = payload.appId || callerAppId;
    const fs = mockState.getAppFs(appId);

    if (!fs.has(srcPath)) {
      throw new GoatBridgeError(BridgeErrorCodes.INVALID_ARGUMENT, `Source file not found: "${srcPath}"`);
    }

    const srcItem = fs.get(srcPath)!;
    fs.set(destPath, {
      data: srcItem.data,
      isDir: srcItem.isDir,
      isFile: srcItem.isFile,
      lastModified: Date.now(),
    });

    return { copied: true, srcPath, destPath, appId };
  }

  /**
   * Action 37: FS_EXISTS
   */
  public static exists(payload: any = {}, callerAppId: string = mockState.defaultAppId): { exists: boolean; filePath: string; appId: string } {
    const filePath = this.normalizePath(payload.filePath || payload.path);
    const appId = payload.appId || callerAppId;
    const fs = mockState.getAppFs(appId);

    const exists = fs.has(filePath);
    return { exists, filePath, appId };
  }

  /**
   * Action 38: CHOOSE_FILES
   */
  public static chooseFiles(payload: any = {}): Promise<FileChooserResult> {
    return Promise.resolve({
      isSuccess: true,
      selectedUris: [
        'goat://cache/files/invoice_august_2026.pdf',
        'goat://cache/files/receipt_9921.jpg',
      ],
      totalFiles: 2,
      wasCancelled: false,
    });
  }

  /**
   * Action 39: CANCEL_FILE_CHOOSER
   */
  public static cancelFileChooser(): { cancelled: boolean; isFileChooserActive: boolean } {
    return { cancelled: true, isFileChooserActive: false };
  }
}
