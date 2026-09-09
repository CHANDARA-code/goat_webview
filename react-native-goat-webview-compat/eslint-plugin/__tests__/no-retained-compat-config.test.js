const { RuleTester } = require('eslint');
const rule = require('../rules/no-retained-compat-config');

const ruleTester = new RuleTester({
  parser: require.resolve('@typescript-eslint/parser'),
  parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
});

ruleTester.run('no-retained-compat-config', rule, {
  valid: [
    // The intended shape: built inline inside a component, handed straight to <WebView>.
    `function Screen() {
       const props: WebViewProps = { source: { uri: 'https://x' } };
       return props;
     }`,
    // A non-config module constant must not be flagged.
    `const TIMEOUT: number = 30;`,
    // Unrelated factory call.
    `const x = computeSomethingElse();`,
    // useRef of something unrelated.
    `function C() { const r = useRef(null); return r; }`,
  ],
  invalid: [
    {
      // Module scope: outlives every render.
      code: `const settings: WebViewProps = { source: { uri: 'https://x' } };`,
      errors: 1,
    },
    {
      code: `const src: WebViewSource = { uri: 'https://x' };`,
      errors: 1,
    },
    {
      // Retained via the documented factory, regardless of annotation.
      code: `const cached = toCreationProps({}, undefined);`,
      errors: 1,
    },
    {
      // useRef survives re-renders, which is the whole problem.
      code: `function C() { const r = useRef<WebViewProps>(null); return r; }`,
      errors: 1,
    },
    {
      code: `class Screen { private cfg: CreationProps = null; }`,
      errors: 1,
    },
  ],
});

console.log('no-retained-compat-config: all RuleTester cases passed');
