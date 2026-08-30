/**
 * @goat/compiler-uniapp JSONC (JSON with comments) parser
 * Safely strips single-line and multi-line comments while preserving string literals and quotes.
 */

export function stripJsonComments(jsonString: string): string {
  let insideString = false;
  let stringQuote = '';
  let isEscaped = false;
  let insideSingleLineComment = false;
  let insideMultiLineComment = false;
  let result = '';

  const len = jsonString.length;
  for (let i = 0; i < len; i++) {
    const char = jsonString[i];
    const nextChar = i + 1 < len ? jsonString[i + 1] : '';

    if (insideSingleLineComment) {
      if (char === '\n' || char === '\r') {
        insideSingleLineComment = false;
        result += char;
      }
      continue;
    }

    if (insideMultiLineComment) {
      if (char === '*' && nextChar === '/') {
        insideMultiLineComment = false;
        i++; // skip '/'
      } else if (char === '\n' || char === '\r') {
        result += char; // preserve line breaks
      }
      continue;
    }

    if (insideString) {
      result += char;
      if (isEscaped) {
        isEscaped = false;
      } else if (char === '\\') {
        isEscaped = true;
      } else if (char === stringQuote) {
        insideString = false;
      }
      continue;
    }

    // Check for comment starts
    if (char === '"' || char === "'") {
      insideString = true;
      stringQuote = char;
      result += char;
      continue;
    }

    if (char === '/' && nextChar === '/') {
      insideSingleLineComment = true;
      i++; // skip second '/'
      continue;
    }

    if (char === '/' && nextChar === '*') {
      insideMultiLineComment = true;
      i++; // skip '*'
      continue;
    }

    result += char;
  }

  // Strip trailing commas before } or ]
  return result.replace(/,\s*([}\]])/g, '$1');
}

export function parseJsonc<T = unknown>(jsonContent: string): T {
  const stripped = stripJsonComments(jsonContent);
  return JSON.parse(stripped) as T;
}
