/**
 * @goat/devtools - Monaco Hover Provider
 * Renders rich Markdown documentation when hovering over GoatBridge actions.
 */

import { ACTION_CATALOG } from './completionProvider.ts';

export function registerGoatBridgeHoverProvider(monaco: any): any {
  if (!monaco?.languages?.registerHoverProvider) return null;
  const actionMap = new Map(ACTION_CATALOG.map((item) => [item.action, item]));

  return monaco.languages.registerHoverProvider(['typescript', 'javascript'], {
    provideHover: (model: any, position: any) => {
      const word = model.getWordAtPosition(position);
      if (!word) return null;

      const metadata = actionMap.get(word.word as any);
      if (!metadata) return null;

      const permBadge =
        metadata.permissions && metadata.permissions.length > 0
          ? `\n\n🔒 **Permissions Required**: \`${metadata.permissions.join('`, `')}\``
          : '';

      const contents = [
        { value: `### 🐐 GoatBridge Action: \`${metadata.action}\`` },
        { value: `📁 **Domain**: *${metadata.domain}*${permBadge}` },
        { value: metadata.description },
        {
          value: `\`\`\`typescript\n${metadata.signature}\n\`\`\`\n\n**Example Usage:**\n\`\`\`typescript\n${metadata.snippet}\n\`\`\``,
        },
      ];

      return {
        range: new monaco.Range(
          position.lineNumber,
          word.startColumn,
          position.lineNumber,
          word.endColumn
        ),
        contents,
      };
    },
  });
}
