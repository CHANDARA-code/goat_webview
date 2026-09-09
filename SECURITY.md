# Security Policy

Goat WebView executes untrusted third-party mini-app code inside a host application, so
sandbox-escape, bridge-authorization and SSRF issues are treated as high severity.

## Reporting a vulnerability

**Do not open a public issue for a security vulnerability.**

Report it through GitHub's private advisory flow:
**Security → Report a vulnerability** on this repository.

Please include:

- affected platform(s) and version or commit
- a minimal reproduction — ideally a failing test or a mini-app payload
- the impact you believe it has (what an attacker gains)
- any suggested remediation

## What to expect

| Stage | Target |
| :--- | :--- |
| Acknowledgement | 3 working days |
| Initial assessment and severity | 10 working days |
| Fix or documented mitigation | depends on severity, communicated in the assessment |

We will credit reporters in the release notes unless you ask us not to.

## Supported versions

`1.0.0-alpha.2` is a **pre-release**. It has not been through an external security audit, and its
API may change before 1.0.0. Do not deploy it to production without your own review.

## Known limitations in the current release

These are documented rather than hidden — please do not report them as new findings:

- **The bundled Stripe, Alipay and PayPay server drivers are reference simulations.** They mint
  local tokens and make no real PSP network call. Only the Bakong KHQR driver produces genuine
  EMVCo output. See [`payment-gate-way-arch.md`](./payment-gate-way-arch.md) §5.
- **DNS-rebinding is mitigated, not eliminated.** Outbound bridge requests validate the resolved
  address before connecting *and* re-check the address actually connected to, rejecting the response
  before it reaches the mini-app. A rebind can still cause a request to be issued.
- **The payment proxy base URL defaults to `http://127.0.0.1:3001`** and has no override from an
  auto-registering host.

## Scope

In scope: the engine, the native bridge, the asset/scheme handlers, the OTA pipeline and the
payment proxy in this repository.

Out of scope: the reference/demo apps under `*/example/`, the docs site, and vulnerabilities that
require a malicious *host application* — the host is inside the trust boundary by design.
