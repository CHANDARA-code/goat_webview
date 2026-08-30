---
sidebar_position: 2
title: OpenTelemetry Distributed Tracing
---

# OpenTelemetry Distributed Tracing

Goat WebView features end-to-end distributed tracing compliant with W3C Trace Context specifications and the OpenTelemetry (OTel) standard.

## Features

- **W3C `traceparent` Generation**: Propagates trace context across web requests, native bridge calls, and backend microservices (`00-{traceId}-{spanId}-{flags}`).
- **Native Span Lifecycle**: Records detailed spans for Bridge invocations, WebView initializations, OTA patch applications, and asset loads.
- **OTLP JSON Export**: Exports trace batches via `exportOtlpJson()` directly to OpenTelemetry collectors (Jaeger, Datadog, Dynatrace).
