/**
 * @goat/compiler-uniapp Source Code Masking Engine
 * Replaces excluded lines with blank lines/whitespace to maintain 1:1 SourceMap fidelity.
 */
import {
  ConditionStack,
  createPreprocessorContext,
  evaluatePlatformExpression,
  type PreprocessorContext,
} from './parser.js';
import type { PreprocessorOptions, PreprocessorResult } from '../types.js';

// Regex patterns to detect directive markers
const IFDEF_REGEX = /(?:\/\/|\/\*|<!--)\s*#ifdef\s+([A-Za-z0-9_| -]+?)(?:\s*\*\/|\s*-->|$)/i;
const IFNDEF_REGEX = /(?:\/\/|\/\*|<!--)\s*#ifndef\s+([A-Za-z0-9_| -]+?)(?:\s*\*\/|\s*-->|$)/i;
const ENDIF_REGEX = /(?:\/\/|\/\*|<!--)\s*#endif(?:\s*\*\/|\s*-->|$)/i;

export function preprocessSourceCode(
  sourceCode: string,
  options: PreprocessorOptions = {}
): PreprocessorResult {
  const context = createPreprocessorContext(
    options.targetPlatform || 'GOAT',
    options.defines || {},
    options.compatMode ?? true
  );

  const preserveLines = options.preserveLines ?? true;
  const lines = sourceCode.split(/\r?\n/);
  const resultLines: string[] = [];
  const stack = new ConditionStack();

  let removedLineCount = 0;
  let modified = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Check #ifdef
    const ifdefMatch = trimmed.match(IFDEF_REGEX);
    if (ifdefMatch) {
      const expr = ifdefMatch[1];
      const matched = evaluatePlatformExpression(expr, context);
      stack.push(matched, true);
      modified = true;
      // Replace directive line with blank line or empty comment to keep line count
      resultLines.push(preserveLines ? '' : '');
      continue;
    }

    // Check #ifndef
    const ifndefMatch = trimmed.match(IFNDEF_REGEX);
    if (ifndefMatch) {
      const expr = ifndefMatch[1];
      const matched = !evaluatePlatformExpression(expr, context);
      stack.push(matched, false);
      modified = true;
      resultLines.push(preserveLines ? '' : '');
      continue;
    }

    // Check #endif
    const endifMatch = trimmed.match(ENDIF_REGEX);
    if (endifMatch) {
      if (stack.depth > 0) {
        stack.pop();
      }
      modified = true;
      resultLines.push(preserveLines ? '' : '');
      continue;
    }

    // Regular line: check if currently included
    const isIncluded = stack.isCurrentBlockIncluded();

    if (isIncluded) {
      resultLines.push(line);
    } else {
      modified = true;
      removedLineCount++;
      // If preserving lines, replace line with empty line (preserving line number)
      resultLines.push(preserveLines ? '' : '');
    }
  }

  return {
    code: resultLines.join('\n'),
    removedLineCount,
    modified,
  };
}
