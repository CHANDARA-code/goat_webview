---
sidebar_position: 2
title: Anti-Abuse Guardrails
---

# Anti-Abuse Guardrails

To protect end-users from malicious or rogue mini-app behavior, Goat WebView enforces automatic runtime anti-abuse protections:

## 1. User Gesture Freshness Gate

Privileged actions (such as `BIOMETRIC_AUTH`, `GET_LOCATION`, `MAKE_PHONE_CALL`, `SEND_SMS`, `SHARE_SHEET`, `OPEN_INVOICE`, `WEB3_SIGN_TRANSACTION`) require a verified user touch or tap event within a sliding 10-second freshness window.

If an action is initiated programmatically in the background without user interaction, the bridge rejects the request with `GESTURE_REQUIRED`.

## 2. Repeated Dialog Cooldown

To prevent dialog loops and denial-of-service annoyance attacks (e.g. repeated `SHOW_MODAL` or `SHOW_ACTION_SHEET`), the engine blocks requests exceeding 3 dialogs within 3 seconds, returning `DIALOG_COOLDOWN_ACTIVE`.

## 3. External Link Warning Dialog

When a mini-app navigates to an external or untrusted URL, Goat WebView intercepts the navigation and presents a clear confirmation modal detailing the destination domain, with an optional per-session "Don't ask again" opt-out.
