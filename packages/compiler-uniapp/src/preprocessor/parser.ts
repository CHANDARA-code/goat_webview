/**
 * @goat/compiler-uniapp Conditional Preprocessor Expression Parser
 * Evaluates #ifdef, #ifndef, #endif expressions with stack-based nested condition support.
 */

export interface PreprocessorContext {
  targetPlatform: string;
  activeDefines: Set<string>;
  compatMode: boolean;
}

export function createPreprocessorContext(
  targetPlatform: string = 'GOAT',
  defines: Record<string, boolean> = {},
  compatMode: boolean = true
): PreprocessorContext {
  const activeDefines = new Set<string>();
  const normalizedTarget = targetPlatform.toUpperCase();

  activeDefines.add(normalizedTarget);

  // In Goat target, MP is always active (Goat mini-program environment)
  if (normalizedTarget === 'GOAT') {
    activeDefines.add('MP');
    if (compatMode) {
      // Compatibility mode allows MP-WEIXIN code to run seamlessly in Goat
      activeDefines.add('MP-WEIXIN');
    }
  }

  // Add custom defines
  for (const [key, value] of Object.entries(defines)) {
    if (value) {
      activeDefines.add(key.toUpperCase());
    } else {
      activeDefines.delete(key.toUpperCase());
    }
  }

  return {
    targetPlatform: normalizedTarget,
    activeDefines,
    compatMode,
  };
}

/**
 * Evaluates a conditional expression such as:
 * "MP-WEIXIN || MP-ALIPAY || GOAT" or "H5"
 */
export function evaluatePlatformExpression(
  expr: string,
  context: PreprocessorContext
): boolean {
  const trimmed = expr.trim();
  if (!trimmed) return false;

  // Split by logical OR (||)
  const tokens = trimmed.split('||').map((t) => t.trim().toUpperCase());

  for (const token of tokens) {
    if (context.activeDefines.has(token)) {
      return true;
    }
  }

  return false;
}

export class ConditionStack {
  private stack: Array<{ conditionMatched: boolean; isIfdef: boolean }> = [];

  push(conditionMatched: boolean, isIfdef: boolean): void {
    this.stack.push({ conditionMatched, isIfdef });
  }

  pop(): { conditionMatched: boolean; isIfdef: boolean } | undefined {
    return this.stack.pop();
  }

  get depth(): number {
    return this.stack.length;
  }

  /**
   * Returns true if all enclosing conditions in the stack evaluate to true.
   */
  isCurrentBlockIncluded(): boolean {
    for (const frame of this.stack) {
      if (!frame.conditionMatched) {
        return false;
      }
    }
    return true;
  }
}
