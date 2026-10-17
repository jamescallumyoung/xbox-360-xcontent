// Builds Loadout into dist/: the bundled app.js, plus index.html and public/.
//   node build.mjs          build once
//   node build.mjs --dev    rebuild on change, and serve on http://localhost:3000
import * as esbuild from 'esbuild';
import { cp, mkdir, rm } from 'node:fs/promises';

const dev = process.argv.includes('--dev');
// Paths are relative to this package, wherever the script is run from.
process.chdir(import.meta.dirname);

// Static files are copied once: in --dev, restart after changing index.html,
// public/ or tokens.css. esbuild rebuilds app.js on every change.

await rm('dist', { recursive: true, force: true });
await mkdir('dist');
await cp('public', 'dist', { recursive: true });
await cp('index.html', 'dist/index.html');
await cp('src/styles/tokens.css', 'dist/tokens.css');

const context = await esbuild.context({
  entryPoints: ['src/main.ts'],
  bundle: true,
  outfile: 'dist/app.js',
  format: 'esm',
  target: 'es2024',
  minify: !dev,
  // Source maps in development only: they aren't deployed.
  sourcemap: dev,
  logLevel: 'warning',
});

if (dev) {
  await context.watch();
  const { port } = await context.serve({ servedir: 'dist', port: 3000 });
  console.log(`Loadout: http://localhost:${String(port)}`);
} else {
  await context.rebuild();
  await context.dispose();
}
