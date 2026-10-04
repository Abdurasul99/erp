import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
// Supplied by the existing Vite React plugin; no new runtime dependency.
const { parse } = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const globals = new Set(`window document navigator localStorage sessionStorage console fetch
URL URLSearchParams FormData Blob File FileReader Image Audio AbortController Headers Response
Request TextDecoder TextEncoder Event CustomEvent ResizeObserver IntersectionObserver MutationObserver
setTimeout clearTimeout setInterval clearInterval requestAnimationFrame cancelAnimationFrame
alert confirm prompt performance crypto atob btoa Intl JSON Math Date Number String Boolean Object
Array Set Map WeakMap Promise RegExp Error TypeError parseFloat parseInt isNaN isFinite Infinity
NaN undefined globalThis arguments encodeURIComponent decodeURIComponent encodeURI decodeURI
structuredClone`.split(/\s+/));

test('frontend modules have no unbound runtime identifiers', () => {
  const missing = [];
  const root = fileURLToPath(new URL('../src', import.meta.url));
  function scan(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) { scan(file); continue; }
      if (!/\.(?:js|jsx|mjs)$/.test(file)) continue;
      const ast = parse(fs.readFileSync(file, 'utf8'), { sourceType: 'module', plugins: ['jsx'] });
      traverse(ast, {
        ReferencedIdentifier(ref) {
          if (!globals.has(ref.node.name) && !ref.scope.hasBinding(ref.node.name)) {
            missing.push(`${path.relative(root, file)}:${ref.node.loc.start.line}: ${ref.node.name}`);
          }
        },
      });
    }
  }
  scan(root);
  assert.deepEqual(missing, [], `Unbound identifiers can crash screens after data loads:\n${missing.join('\n')}`);
});
