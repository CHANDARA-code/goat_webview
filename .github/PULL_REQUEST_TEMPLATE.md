## What does this change?

<!-- One or two sentences. Link the issue: Closes #123 -->

## Why?

<!-- The problem this solves. If it fixes a bug, describe how it failed. -->

## How was it verified?

<!-- Paste the actual command and its output. "Tests pass" is not evidence. -->

```
$ bash scripts/verify-all.sh
```

- [ ] New tests cover nominal, boundary **and** error paths
- [ ] A regression test was confirmed to **fail against the pre-fix code** (for bug fixes)
- [ ] `bash scripts/verify-all.sh` exits 0 locally
- [ ] Lint passes for every platform this touches

## Platforms affected

- [ ] Android  - [ ] iOS  - [ ] React Native  - [ ] Flutter  - [ ] Web SDK  - [ ] Server  - [ ] Docs only

## Checklist

- [ ] Follows the standards in [`CONTRIBUTING.md`](../CONTRIBUTING.md) (SOLID, OWASP MASVS v2.0)
- [ ] WebKit/WebView calls stay on the Main/UI thread; disk and network I/O on IO dispatchers
- [ ] No new public API break, or the break is called out explicitly below
- [ ] Docs updated if behaviour or a public API changed
- [ ] Commits follow Conventional Commits

## Breaking changes / migration notes

<!-- "None" is a valid answer. -->
