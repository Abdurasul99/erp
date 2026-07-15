import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function renderStorefront(t) {
  const vite = await createServer({
    root: frontendRoot,
    appType: 'custom',
    server: { middlewareMode: true },
  });
  t.after(() => vite.close());

  let Storefront;
  try {
    ({ default: Storefront } = await vite.ssrLoadModule('/src/store/Storefront.jsx'));
  } catch (error) {
    assert.fail(`Storefront component is missing: ${error.message}`);
  }

  return renderToStaticMarkup(React.createElement(Storefront));
}

test('storefront renders the public brand landmark', async (t) => {
  const html = await renderStorefront(t);
  assert.match(html, /<main/);
  assert.match(html, /ART Store/);
  assert.match(html, /Смотреть коллекцию/);
});

test('storefront renders its commerce workspace', async (t) => {
  const html = await renderStorefront(t);
  const productCount = (html.match(/<article/g) || []).length;

  assert.match(html, /data-testid="store-collection"/);
  assert.match(html, /aria-label="Открыть корзину"/);
  assert.match(html, />Картины</);
  assert.ok(productCount >= 8, `Expected at least 8 product articles, got ${productCount}`);
});

test('storefront keeps the ERP brand invisible to customers', async (t) => {
  const html = await renderStorefront(t);

  assert.doesNotMatch(html, /Wave ERP/i);
});

test('storefront renders the Uzbek antiquities intro', async (t) => {
  const html = await renderStorefront(t);
  const artifactCount = (html.match(/store-intro-artifact/g) || []).length;

  assert.match(html, /data-testid="store-intro"/);
  assert.match(html, /aria-label="ART \* Store"/);
  assert.match(html, /Пропустить заставку/);
  assert.ok(artifactCount >= 3, `Expected at least 3 intro artifacts, got ${artifactCount}`);
});

test('storefront hero leads with Uzbek antiquities', async (t) => {
  const html = await renderStorefront(t);

  assert.match(html, /class="store-hero-brand"/);
  assert.match(html, /\/images\/store\/uzbek-antiquities-hero\.webp/);
});

test('storefront declares Framer Motion', () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(frontendRoot, 'package.json'), 'utf8'));

  assert.match(packageJson.dependencies['framer-motion'] || '', /^\^?12\./);
});

test('public storefront receives its own title and browser icon before React boots', () => {
  const indexHtml = fs.readFileSync(path.join(frontendRoot, 'index.html'), 'utf8');
  const bootstrapPosition = indexHtml.indexOf('const storefrontPath');
  const reactPosition = indexHtml.indexOf('/src/main.jsx');

  assert.match(indexHtml, /ART Store — современное искусство/);
  assert.match(indexHtml, /storefrontPath \? artStoreIcon : waveIcon/);
  assert.ok(bootstrapPosition >= 0 && bootstrapPosition < reactPosition);
});
