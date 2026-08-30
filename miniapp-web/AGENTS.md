# miniapp-web — agent instructions

## Web UI is Ant Design

**All UI in `miniapp-web/` is built with [Ant Design](https://ant.design) (`antd` v5).**
When you build or change a screen, dialog, form, list, menu, feedback toast, etc.,
reach for an `antd` component first. Use Tailwind utility classes only for
layout/spacing/positioning *around* antd components, not to re-style them.

- Import named components from the package root so tree-shaking works:
  `import { Button, Card } from 'antd'` — never `import * as antd`.
- Icons: `@ant-design/icons` (named imports). Existing screens still use
  `lucide-react`; leave those alone, but write new code with antd icons.
- Do **not** add another `ConfigProvider`. The app is already wrapped by
  `src/providers/AntdProvider.tsx` (theme tokens + light/dark algorithm).
- Dark mode is driven by `isDarkMode` in `src/App.tsx` → `AntdProvider`.
  Don't hardcode hex colors; use theme tokens (`theme.useToken()`) or
  component props so light/dark both work.
- For `message` / `notification` / `modal`, use the hook form
  `const { message } = App.useApp()` (import `App` from `antd`). The static
  `message.*` imports have no theme context here.
- Reference implementation: `src/components/antd/AntdShowcase.tsx`
  (open the running app at `#/ui`).

### Do not

- Do not bulk-rewrite the existing sub-apps (`ecommerce`, `iot`,
  `fieldservice`, `vault`, `diagnostics`) into antd unless explicitly asked —
  they are Tailwind + custom glass CSS and stay that way until migrated on purpose.
- Do not pull in a second component library (MUI, Chakra, shadcn, …).

## Ant Design MCP server

`.mcp.json` at the repo root registers the **`antd`** MCP server
(`npx @ant-design/cli mcp`). Use its tools instead of guessing at APIs:

| Tool | Use for |
| --- | --- |
| `antd_list` | discover which component to use |
| `antd_info` | a component's props / types / defaults |
| `antd_doc` | full component documentation |
| `antd_demo` | runnable example source |
| `antd_token` | design-token names and values |
| `antd_semantic` | class names / style hooks for a component |
| `antd_changelog` | API changes between versions |

Keep the `--version` pin in `.mcp.json` in sync with the `antd` version in
`miniapp-web/package.json` whenever antd is upgraded.

## Bundle-size note

antd adds ~150 KB gzip to the mini-app bundle (its own `antd-*.js` chunk). This
does not affect the bridge-SDK size gate (`dist/miniapp-bridge.min.js`), which is
built separately from `src/miniapp-bridge.ts`. Still, prefer a few well-chosen
components over broad imports, and lazy-load heavy screens where it matters.
