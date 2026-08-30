---
sidebar_position: 1
title: Bridge Protocol Overview
---

# Bridge Protocol Overview

The Goat WebView Bridge provides bidirectional, asynchronous, type-safe communication between Web JavaScript and native Host platforms (Android Kotlin, iOS Swift, React Native, Flutter).

## Protocol Specification

Every bridge request follows the standard JSON payload structure:

```json
{
  "id": "req_100234_xyz",
  "action": "STORAGE_SET",
  "payload": {
    "key": "user_theme",
    "value": "dark"
  }
}
```

Every response returns:

```json
{
  "id": "req_100234_xyz",
  "success": true,
  "data": {
    "saved": true
  },
  "error": null
}
```

## Binary Message Port (Zero-Copy Transfer)

For high-throughput binary payloads (camera frames, audio streams, sensor arrays), Goat WebView supports Binary Message Ports transferring raw `ArrayBuffer` objects without base64 or JSON serialization overhead.
