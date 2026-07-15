import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, mergeConfig } from 'vite';

import baseConfig from './vite.config.js';

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const certificateDir = path.join(rootDir, '.cert');

export default mergeConfig(baseConfig, defineConfig({
  server: {
    host: '0.0.0.0',
    https: {
      key: fs.readFileSync(path.join(certificateDir, 'localhost-key.pem')),
      cert: fs.readFileSync(path.join(certificateDir, 'localhost-cert.pem')),
    },
  },
}));
