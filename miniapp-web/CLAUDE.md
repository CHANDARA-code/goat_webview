# miniapp-web

**All UI in this package is built with Ant Design (`antd` v5).** Build new screens,
dialogs, forms, and components from `antd` primitives; use Tailwind only for layout
and spacing around them. The app is already wrapped by
`src/providers/AntdProvider.tsx` (theme + light/dark) — do not add another
`ConfigProvider`. Use `const { message } = App.useApp()` for feedback, and
`@ant-design/icons` for new icons. Reference: `src/components/antd/AntdShowcase.tsx`
(`#/ui` in the running app).

Look up component APIs, props, tokens, and demos with the **`antd` MCP server**
registered in `../.mcp.json` (`antd_list`, `antd_info`, `antd_doc`, `antd_demo`,
`antd_token`, …) rather than guessing.

Do not bulk-migrate the existing Tailwind sub-apps (`ecommerce`, `iot`,
`fieldservice`, `vault`, `diagnostics`) to antd unless explicitly asked, and do
not add a second component library.

See `AGENTS.md` in this directory for the full guidance.
