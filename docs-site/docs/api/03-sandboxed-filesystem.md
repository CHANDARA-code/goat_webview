---
sidebar_position: 4
title: Domain 3 - Sandboxed FileSystem & Chooser
description: Complete API reference for Sandboxed FileSystem & Chooser (11 actions).
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Domain 3: Sandboxed FileSystem & Chooser

Sandboxed file I/O operations inside app-isolated directory (/sandbox/data/`{appId}`/) with path-traversal guards and native file choosers.

**Total Actions in Domain:** `11 actions`

---

## Action Summary

| # | Action String | Permission | Inputs | Returns |
| :--- | :--- | :--- | :--- | :--- |
| 1 | [`FS_WRITE_FILE`](#fs-write-file) | `none` | `filePath`, `data`, `encoding`, `append`, `appId` | `FsWriteResult` |
| 2 | [`FS_READ_FILE`](#fs-read-file) | `none` | `filePath`, `encoding`, `appId` | `FsReadResult` |
| 3 | [`FS_MKDIR`](#fs-mkdir) | `none` | `dirPath`, `recursive`, `appId` | `FsMkdirResult` |
| 4 | [`FS_RMDIR`](#fs-rmdir) | `none` | `dirPath`, `recursive` | `FsRmdirResult` |
| 5 | [`FS_UNLINK`](#fs-unlink) | `none` | `filePath` | `FsUnlinkResult` |
| 6 | [`FS_LIST_DIR`](#fs-list-dir) | `none` | `dirPath` | `FsListDirResult` |
| 7 | [`FS_STAT`](#fs-stat) | `none` | `filePath` | `FsStatResult` |
| 8 | [`FS_COPY_FILE`](#fs-copy-file) | `none` | `srcPath`, `destPath` | `FsCopyResult` |
| 9 | [`FS_EXISTS`](#fs-exists) | `none` | `filePath` | `FsExistsResult` |
| 10 | [`CHOOSE_FILES`](#choose-files) | `none` | `mimeTypes`, `multiple` | `FileChooserResult` |
| 11 | [`CANCEL_FILE_CHOOSER`](#cancel-file-chooser) | `none` | `{}` | `CancelFileChooserResult` |

---

## Action Specifications

---

### 1. `FS_WRITE_FILE` {#fs-write-file}

Writes binary or text data into sandboxed file system partition (/sandbox/data/`{appId}`/) with 50 MB total quota enforcement.

**Purpose & Context:** Enables offline document storage, image caching, and structured JSON database file persistence.

#### Platform Support Matrix
`Android: [Supported]` `iOS: [Supported]` `React Native: [Supported]` `Flutter: [Supported]` `Web Mock: [Supported]`

#### Aliases & Method Signatures
- **Canonical Action String:** `FS_WRITE_FILE`
- **Supported Aliases:** `writeFile`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** [Supported] **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `filePath` | `string` | **Yes** | - | Relative path within app sandbox directory. |
| `data` | `string` | **Yes** | - | Content to write (UTF-8 string or Base64 encoded). |
| `encoding` | `"utf8" \| "base64"` | No | `"utf8"` | Content encoding. |
| `append` | `boolean` | No | `false` | If true, appends to existing file. |
| `appId` | `string` | No | - | Calling appId partition. |


#### Return Value
- **Schema Type:** `FsWriteResult`
- **Description:** Total number of bytes written and confirmation of atomic file commit.

```json title="Return Payload Shape"
{
  "saved": "boolean",
  "bytesWritten": "number",
  "filePath": "string",
  "appId": "string"
}
```

#### Error Codes & Troubleshooting
| Error Code | Meaning | Troubleshooting |
| :--- | :--- | :--- |
| `INVALID_ARGUMENT` | Missing filePath or data. | Pass a valid relative path and non-empty data. |
| `SECURITY_VIOLATION` | Path traversal attempt (e.g. "../") detected and rejected. | Use clean relative paths without .. or absolute root prefixes. |
| `STORAGE_QUOTA_EXCEEDED` | App sandbox storage exceeded 50 MB quota limit. | Delete temporary files using FS_UNLINK. |


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
await goatBridge.callNative('FS_WRITE_FILE', {
  filePath: 'logs/session.txt',
  data: 'Session initialized at 2026-08-27',
  encoding: 'utf8'
});
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
val sandboxDir = File(context.filesDir, "sandbox/$appId")
val targetFile = File(sandboxDir, sanitizedPath)
targetFile.parentFile?.mkdirs()
targetFile.writeText(data)
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
let sandboxUrl = getSandboxUrl(for: appId).appendingPathComponent(sanitizedPath)
try data.write(to: sandboxUrl, atomically: true, encoding: .utf8)
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
await goatController.callNativeAction('FS_WRITE_FILE', {
  'filePath': 'logs/session.txt',
  'data': 'Session initialized',
});
```

  </TabItem>
</Tabs>


---

### 2. `FS_READ_FILE` {#fs-read-file}

Reads data from sandboxed file partition with automatic UTF-8 or Base64 decoding.

**Purpose & Context:** Recovers saved local files, configuration caches, and media buffers.

#### Platform Support Matrix
`Android: [Supported]` `iOS: [Supported]` `React Native: [Supported]` `Flutter: [Supported]` `Web Mock: [Supported]`

#### Aliases & Method Signatures
- **Canonical Action String:** `FS_READ_FILE`
- **Supported Aliases:** `readFile`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** [Supported] **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `filePath` | `string` | **Yes** | - | Relative path within app sandbox directory. |
| `encoding` | `"utf8" \| "base64"` | No | `"utf8"` | Desired output format. |
| `appId` | `string` | No | - | Calling appId partition. |


#### Return Value
- **Schema Type:** `FsReadResult`
- **Description:** File contents decoded in the requested format.

```json title="Return Payload Shape"
{
  "data": "string",
  "encoding": "string",
  "filePath": "string",
  "appId": "string"
}
```

#### Error Codes & Troubleshooting
| Error Code | Meaning | Troubleshooting |
| :--- | :--- | :--- |
| `INVALID_ARGUMENT` | File does not exist or filePath was omitted. | Verify file exists using FS_EXISTS before reading. |
| `SECURITY_VIOLATION` | Path traversal attempt blocked. | Specify paths within sandbox root. |


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
const { data } = await goatBridge.callNative('FS_READ_FILE', {
  filePath: 'logs/session.txt',
  encoding: 'utf8'
});
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
val content = targetFile.readText()
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
let content = try String(contentsOf: sandboxUrl, encoding: .utf8)
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
final res = await goatController.callNativeAction('FS_READ_FILE', {
  'filePath': 'logs/session.txt',
});
```

  </TabItem>
</Tabs>


---

### 3. `FS_MKDIR` {#fs-mkdir}

Creates a new directory inside the calling mini-app sandboxed filesystem.

**Purpose & Context:** Organizes cached assets into hierarchical folders (e.g., "images/", "documents/").

#### Platform Support Matrix
`Android: [Supported]` `iOS: [Supported]` `React Native: [Supported]` `Flutter: [Supported]` `Web Mock: [Supported]`

#### Aliases & Method Signatures
- **Canonical Action String:** `FS_MKDIR`
- **Supported Aliases:** `mkdir`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** [Supported] **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `dirPath` | `string` | **Yes** | - | Relative directory path to create. |
| `recursive` | `boolean` | No | `true` | If true, creates missing intermediate directories. |
| `appId` | `string` | No | - | Calling appId. |


#### Return Value
- **Schema Type:** `FsMkdirResult`
- **Description:** Indicates directory creation success.

```json title="Return Payload Shape"
{
  "created": "boolean",
  "dirPath": "string",
  "appId": "string"
}
```

#### Error Codes & Troubleshooting
| Error Code | Meaning | Troubleshooting |
| :--- | :--- | :--- |
| `INVALID_ARGUMENT` | Directory path missing or already exists as a file. | Check dirPath. |


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
await goatBridge.callNative('FS_MKDIR', { dirPath: 'cache/images', recursive: true });
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
targetDir.mkdirs()
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
try FileManager.default.createDirectory(at: sandboxUrl, withIntermediateDirectories: true)
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
await goatController.callNativeAction('FS_MKDIR', {'dirPath': 'cache/images'});
```

  </TabItem>
</Tabs>


---

### 4. `FS_RMDIR` {#fs-rmdir}

Removes a directory from the calling mini-app sandbox.

**Purpose & Context:** Deletes empty or populated folder trees.

#### Platform Support Matrix
`Android: [Supported]` `iOS: [Supported]` `React Native: [Supported]` `Flutter: [Supported]` `Web Mock: [Supported]`

#### Aliases & Method Signatures
- **Canonical Action String:** `FS_RMDIR`
- **Supported Aliases:** `rmdir`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** [Supported] **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `dirPath` | `string` | **Yes** | - | Relative directory path. |
| `recursive` | `boolean` | No | `false` | True to delete directory and all children. |


#### Return Value
- **Schema Type:** `FsRmdirResult`
- **Description:** Status of directory deletion.

```json title="Return Payload Shape"
{
  "removed": "boolean",
  "dirPath": "string",
  "appId": "string"
}
```

#### Error Codes & Troubleshooting
| Error Code | Meaning | Troubleshooting |
| :--- | :--- | :--- |
| `INVALID_ARGUMENT` | Directory does not exist or is not empty without recursive flag. | Set recursive: true to delete non-empty folders. |


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
await goatBridge.callNative('FS_RMDIR', { dirPath: 'cache/images', recursive: true });
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
targetDir.deleteRecursively()
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
try FileManager.default.removeItem(at: sandboxUrl)
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
await goatController.callNativeAction('FS_RMDIR', {'dirPath': 'cache/images', 'recursive': true});
```

  </TabItem>
</Tabs>


---

### 5. `FS_UNLINK` {#fs-unlink}

Deletes a single file from the calling mini-app sandbox partition.

**Purpose & Context:** Removes temporary files or expired downloads.

#### Platform Support Matrix
`Android: [Supported]` `iOS: [Supported]` `React Native: [Supported]` `Flutter: [Supported]` `Web Mock: [Supported]`

#### Aliases & Method Signatures
- **Canonical Action String:** `FS_UNLINK`
- **Supported Aliases:** `unlink`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** [Supported] **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `filePath` | `string` | **Yes** | - | Relative path to file. |


#### Return Value
- **Schema Type:** `FsUnlinkResult`
- **Description:** Confirmation that the file was deleted.

```json title="Return Payload Shape"
{
  "deleted": "boolean",
  "filePath": "string",
  "appId": "string"
}
```

#### Error Codes & Troubleshooting
| Error Code | Meaning | Troubleshooting |
| :--- | :--- | :--- |
| `INVALID_ARGUMENT` | File does not exist. | Ensure filePath is correct. |


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
await goatBridge.callNative('FS_UNLINK', { filePath: 'notes/sample.txt' });
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
targetFile.delete()
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
try FileManager.default.removeItem(at: sandboxUrl)
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
await goatController.callNativeAction('FS_UNLINK', {'filePath': 'notes/sample.txt'});
```

  </TabItem>
</Tabs>


---

### 6. `FS_LIST_DIR` {#fs-list-dir}

Lists all file and directory entries inside the specified sandbox path.

**Purpose & Context:** Enables building file browsers and listing available cached downloads.

#### Platform Support Matrix
`Android: [Supported]` `iOS: [Supported]` `React Native: [Supported]` `Flutter: [Supported]` `Web Mock: [Supported]`

#### Aliases & Method Signatures
- **Canonical Action String:** `FS_LIST_DIR`
- **Supported Aliases:** `listDir`, `readDir`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** [Supported] **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `dirPath` | `string` | No | `""` | Relative path to directory (default: sandbox root). |


#### Return Value
- **Schema Type:** `FsListDirResult`
- **Description:** Array of entry names.

```json title="Return Payload Shape"
{
  "files": "string[]",
  "dirPath": "string",
  "appId": "string"
}
```

#### Error Codes & Troubleshooting
| Error Code | Meaning | Troubleshooting |
| :--- | :--- | :--- |
| `INVALID_ARGUMENT` | Path is not a directory or does not exist. | Pass a valid directory path. |


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
const { files } = await goatBridge.callNative('FS_LIST_DIR', { dirPath: 'cache' });
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
val entries = targetDir.list() ?: emptyArray()
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
let entries = try FileManager.default.contentsOfDirectory(atPath: sandboxUrl.path)
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
final res = await goatController.callNativeAction('FS_LIST_DIR', {'dirPath': 'cache'});
```

  </TabItem>
</Tabs>


---

### 7. `FS_STAT` {#fs-stat}

Queries file metadata (size, last modified epoch, file vs directory type).

**Purpose & Context:** Inspects file sizes and timestamps before uploading or reading.

#### Platform Support Matrix
`Android: [Supported]` `iOS: [Supported]` `React Native: [Supported]` `Flutter: [Supported]` `Web Mock: [Supported]`

#### Aliases & Method Signatures
- **Canonical Action String:** `FS_STAT`
- **Supported Aliases:** `stat`, `getFileInfo`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** [Supported] **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `filePath` | `string` | **Yes** | - | Relative path to file or directory. |


#### Return Value
- **Schema Type:** `FsStatResult`
- **Description:** File size in bytes, timestamps, and attributes.

```json title="Return Payload Shape"
{
  "size": "number",
  "isFile": "boolean",
  "isDirectory": "boolean",
  "lastModified": "number",
  "name": "string"
}
```

#### Error Codes & Troubleshooting
| Error Code | Meaning | Troubleshooting |
| :--- | :--- | :--- |
| `INVALID_ARGUMENT` | File not found. | Ensure target path exists. |


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
const stat = await goatBridge.callNative('FS_STAT', { filePath: 'notes/sample.txt' });
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
val size = targetFile.length()
val lastModified = targetFile.lastModified()
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
let attrs = try FileManager.default.attributesOfItem(atPath: sandboxUrl.path)
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
final res = await goatController.callNativeAction('FS_STAT', {'filePath': 'notes/sample.txt'});
```

  </TabItem>
</Tabs>


---

### 8. `FS_COPY_FILE` {#fs-copy-file}

Copies a file from source path to destination path inside the sandbox boundary.

**Purpose & Context:** Duplicates templates, backups, and creates snapshot files.

#### Platform Support Matrix
`Android: [Supported]` `iOS: [Supported]` `React Native: [Supported]` `Flutter: [Supported]` `Web Mock: [Supported]`

#### Aliases & Method Signatures
- **Canonical Action String:** `FS_COPY_FILE`
- **Supported Aliases:** `copyFile`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** [Supported] **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `srcPath` | `string` | **Yes** | - | Source relative path. |
| `destPath` | `string` | **Yes** | - | Destination relative path. |


#### Return Value
- **Schema Type:** `FsCopyResult`
- **Description:** Status of file copy.

```json title="Return Payload Shape"
{
  "copied": "boolean",
  "srcPath": "string",
  "destPath": "string",
  "appId": "string"
}
```

#### Error Codes & Troubleshooting
| Error Code | Meaning | Troubleshooting |
| :--- | :--- | :--- |
| `INVALID_ARGUMENT` | Source file does not exist. | Verify srcPath. |


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
await goatBridge.callNative('FS_COPY_FILE', {
  srcPath: 'notes/sample.txt',
  destPath: 'notes/sample_backup.txt'
});
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
srcFile.copyTo(destFile, overwrite = true)
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
try FileManager.default.copyItem(at: srcUrl, to: destUrl)
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
await goatController.callNativeAction('FS_COPY_FILE', {
  'srcPath': 'notes/sample.txt',
  'destPath': 'notes/sample_backup.txt',
});
```

  </TabItem>
</Tabs>


---

### 9. `FS_EXISTS` {#fs-exists}

Tests whether a specific file or folder path exists in the sandbox.

**Purpose & Context:** Avoids throwing errors by checking path existence before reading or writing.

#### Platform Support Matrix
`Android: [Supported]` `iOS: [Supported]` `React Native: [Supported]` `Flutter: [Supported]` `Web Mock: [Supported]`

#### Aliases & Method Signatures
- **Canonical Action String:** `FS_EXISTS`
- **Supported Aliases:** `exists`, `access`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** [Supported] **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `filePath` | `string` | **Yes** | - | Path to check. |


#### Return Value
- **Schema Type:** `FsExistsResult`
- **Description:** True if path exists on disk.

```json title="Return Payload Shape"
{
  "exists": "boolean",
  "filePath": "string",
  "appId": "string"
}
```

#### Error Codes & Troubleshooting
_This action executes without throwing domain-specific error codes._


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
const { exists } = await goatBridge.callNative('FS_EXISTS', { filePath: 'notes/sample.txt' });
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
val exists = targetFile.exists()
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
let exists = FileManager.default.fileExists(atPath: sandboxUrl.path)
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
final res = await goatController.callNativeAction('FS_EXISTS', {'filePath': 'notes/sample.txt'});
```

  </TabItem>
</Tabs>


---

### 10. `CHOOSE_FILES` {#choose-files}

Opens native system file picker sheet for selecting external documents (PDF, CSV, audio, images).

**Purpose & Context:** Allows users to upload external files into the mini-app with privacy sandboxing.

#### Platform Support Matrix
`Android: [Supported]` `iOS: [Supported]` `React Native: [Supported]` `Flutter: [Supported]` `Web Mock: [Supported]`

#### Aliases & Method Signatures
- **Canonical Action String:** `CHOOSE_FILES`
- **Supported Aliases:** `chooseFiles`, `chooseFile`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** [Supported] **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `mimeTypes` | `string[]` | No | - | Allowed MIME types filter (e.g. ["application/pdf", "image/*"]). |
| `multiple` | `boolean` | No | `false` | Allow selecting multiple files. |


#### Return Value
- **Schema Type:** `FileChooserResult`
- **Description:** Array of sandboxed content URIs ready for upload or reading.

```json title="Return Payload Shape"
{
  "isSuccess": "boolean",
  "selectedUris": "string[]",
  "totalFiles": "number",
  "wasCancelled": "boolean"
}
```

#### Error Codes & Troubleshooting
_This action executes without throwing domain-specific error codes._


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
const { selectedUris } = await goatBridge.callNative('CHOOSE_FILES', {
  mimeTypes: ['application/pdf', 'image/png'],
  multiple: true
});
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
// Launch ActivityResultContracts.OpenMultipleDocuments()
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
// UIDocumentPickerViewController
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
final res = await goatController.callNativeAction('CHOOSE_FILES', {
  'mimeTypes': ['application/pdf'],
});
```

  </TabItem>
</Tabs>


---

### 11. `CANCEL_FILE_CHOOSER` {#cancel-file-chooser}

Dismisses an active native file picker dialog programmatically.

**Purpose & Context:** Closes file chooser when modal expires or operation is cancelled.

#### Platform Support Matrix
`Android: [Supported]` `iOS: [Supported]` `React Native: [Supported]` `Flutter: [Supported]` `Web Mock: [Supported]`

#### Aliases & Method Signatures
- **Canonical Action String:** `CANCEL_FILE_CHOOSER`
- **Supported Aliases:** `cancelFileChooser`, `saveFile`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** [Supported] **No Gesture Required**

#### Input Parameters
_No input parameters required (`{}`)._


#### Return Value
- **Schema Type:** `CancelFileChooserResult`
- **Description:** Status of file chooser dismissal.

```json title="Return Payload Shape"
{
  "cancelled": "boolean",
  "isFileChooserActive": "boolean"
}
```

#### Error Codes & Troubleshooting
_This action executes without throwing domain-specific error codes._


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
await goatBridge.callNative('CANCEL_FILE_CHOOSER', {});
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
activeFileChooserDialog?.dismiss()
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
documentPicker?.dismiss(animated: true)
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
await goatController.callNativeAction('CANCEL_FILE_CHOOSER', {});
```

  </TabItem>
</Tabs>

