/**
 * A feature module is a frozen DSL-method -> engine-action table plus the metadata needed to
 * report honestly on what it can and cannot do.
 *
 * `unbacked` exists because several DSL methods have no engine action behind them. Listing them
 * here — rather than omitting them — is what lets `canIUse` answer correctly and lets a call fail
 * with a diagnosable reason instead of appearing to succeed.
 *
 * `platformOnly` covers the third case: a method whose action dispatches on one platform but not
 * the other. It is neither backed nor unbacked, and collapsing it into either one hides a real
 * portability hole. `canIUse` still resolves these at runtime against the engine on the device
 * actually running, so this table is the build-time record that keeps the two in agreement.
 */
export type Platform = 'android' | 'ios';

export interface FeatureModule {
  readonly name: string;
  readonly actions: Readonly<Record<string, string>>;
  readonly unbacked: Readonly<Record<string, string>>;
  readonly platformOnly: Readonly<Record<string, Platform>>;
}

export function defineFeature(
  name: string,
  actions: Record<string, string>,
  unbacked: Record<string, string> = {},
  platformOnly: Record<string, Platform> = {}
): FeatureModule {
  return Object.freeze({
    name,
    actions: Object.freeze({ ...actions }),
    unbacked: Object.freeze({ ...unbacked }),
    platformOnly: Object.freeze({ ...platformOnly }),
  });
}
