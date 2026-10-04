import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('admin dock permanently names every menu item', async (t) => {
  globalThis.localStorage = {
    getItem() { return null; },
    setItem() {},
    removeItem() {},
  };
  t.after(() => { delete globalThis.localStorage; });

  const vite = await createServer({
    root: frontendRoot,
    appType: 'custom',
    server: { middlewareMode: true },
  });
  t.after(() => vite.close());

  const { AdminDock, ADMIN_SECTIONS } = await vite.ssrLoadModule('/src/admin/AdminShell.jsx');
  assert.equal(typeof AdminDock, 'function');
  assert.equal(ADMIN_SECTIONS.length, 6);

  const html = renderToStaticMarkup(React.createElement(AdminDock, {
    activeSection: 'dashboard',
    navigate() {},
  }));

  for (const section of ADMIN_SECTIONS) {
    const visibleName = section.dockLabel || section.title;
    assert.match(html, new RegExp(`class="dock-label"[^>]*>${visibleName}<`));
  }
});
