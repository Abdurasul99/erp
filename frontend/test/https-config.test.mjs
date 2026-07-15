import test from 'node:test';
import assert from 'node:assert/strict';

import httpsConfig from '../vite.https.config.mjs';
import packageJson from '../package.json' with { type: 'json' };

test('development server exposes the app over HTTPS', () => {
  assert.equal(httpsConfig.server?.host, '0.0.0.0');
  assert.ok(httpsConfig.server?.https?.key, 'Expected a local HTTPS private key');
  assert.ok(httpsConfig.server?.https?.cert, 'Expected a local HTTPS certificate');
  assert.match(packageJson.scripts['dev:https'], /vite\.https\.config\.mjs/);
});
