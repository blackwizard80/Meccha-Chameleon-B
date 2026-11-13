import { mkdir, writeFile } from 'node:fs/promises';
import { build } from 'esbuild';

const nodeDir = 'public/nodejs';
await mkdir(nodeDir, { recursive: true });

await build({
  entryPoints: ['server.ts'],
  outfile: `${nodeDir}/server.cjs`,
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node18',
  external: ['vite'],
  logLevel: 'info',
});

await writeFile(
  `${nodeDir}/package.json`,
  JSON.stringify(
    {
      name: 'meccha-chameleon-lan-server',
      version: '1.0.0',
      private: true,
      main: 'index.js',
    },
    null,
    2,
  ) + '\n',
);

await writeFile(
  `${nodeDir}/index.js`,
  [
    "process.env.MOBILE_LAN_SERVER = '1';",
    "process.env.NODE_ENV = 'production';",
    "process.env.PORT = process.env.PORT || '3000';",
    "require('./server.cjs');",
    '',
  ].join('\n'),
);

console.log('Embedded LAN server prepared in public/nodejs.');
