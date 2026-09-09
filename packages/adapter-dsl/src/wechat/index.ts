import { dslBootstrapScript } from '../bootstrap';
import { DSL_ACTION_MAP } from '../actionMap';

/**
 * WeChat entry point. Re-exports the shared bootstrap and action table under this DSL's global.
 *
 * Separate entry points exist so a host linking only one DSL does not ship the others' aliases;
 * the shared parts are identical by design, since the surfaces overlap almost entirely.
 */
export const GLOBAL_NAME = 'wx' as const;
export { dslBootstrapScript, DSL_ACTION_MAP };
export { CapabilityRegistry, CAPABILITY_NOT_INSTALLED } from '../capabilities';
