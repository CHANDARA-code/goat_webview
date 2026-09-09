import { BRIDGE_SHIM_SCRIPT } from './bridgeShim';

const FULL_DOCUMENT_WRAPPER = (body: string) => `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <script>${BRIDGE_SHIM_SCRIPT}</script>
  </head>
  <body>
    ${body}
  </body>
</html>`;

/**
 * Wraps the developer's mini-app source with the bridge shim so `window.goatBridge` exists
 * before any of their own `<script>` tags run. If the source already looks like a full HTML
 * document (has a `<head>` tag), the shim is inserted right after it opens; otherwise the
 * source is treated as body content and wrapped in a minimal document.
 */
export function buildSrcDoc(userCode: string): string {
  const headMatch = userCode.match(/<head[^>]*>/i);
  if (headMatch) {
    const insertAt = headMatch.index! + headMatch[0].length;
    return (
      userCode.slice(0, insertAt) +
      `\n    <script>${BRIDGE_SHIM_SCRIPT}</script>\n` +
      userCode.slice(insertAt)
    );
  }
  return FULL_DOCUMENT_WRAPPER(userCode);
}
