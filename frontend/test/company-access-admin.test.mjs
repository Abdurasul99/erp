import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function loadControl(t) {
  const vite = await createServer({
    root: frontendRoot,
    appType: 'custom',
    server: { middlewareMode: true },
  });
  t.after(() => vite.close());

  try {
    return (await vite.ssrLoadModule('/src/admin/CompanyAccessControl.jsx')).default;
  } catch {
    return undefined;
  }
}

test('enabled company offers a disable action with a warning', async (t) => {
  const CompanyAccessControl = await loadControl(t);
  assert.equal(typeof CompanyAccessControl, 'function');

  const html = renderToStaticMarkup(React.createElement(CompanyAccessControl, {
    enabled: true,
    busy: false,
    onToggle() {},
  }));

  assert.match(html, /Доступ разрешён/);
  assert.match(html, /Отключить компанию/);
  assert.match(html, /все текущие сессии/);
});

test('disabled company offers an enable action', async (t) => {
  const CompanyAccessControl = await loadControl(t);
  assert.equal(typeof CompanyAccessControl, 'function');

  const html = renderToStaticMarkup(React.createElement(CompanyAccessControl, {
    enabled: false,
    busy: false,
    onToggle() {},
  }));

  assert.match(html, /Доступ приостановлен/);
  assert.match(html, /Включить компанию/);
});
