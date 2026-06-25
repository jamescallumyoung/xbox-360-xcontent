import * as esbuild from 'esbuild'
import { cp, copyFile } from 'fs/promises'

const dev = process.argv.includes('--dev')

const ctx = await esbuild.context({
  entryPoints: ['src/index.ts'],
  bundle: true,
  outfile: 'dist/app.js',
  format: 'esm',
  target: 'es2022',
  sourcemap: true,
})

await cp('public', 'dist', { recursive: true })
await copyFile('index.html', 'dist/index.html')

if (dev) {
  await ctx.watch()
  const { port } = await ctx.serve({ servedir: 'dist', port: 3000 })
  console.log(`dev server running at http://localhost:${port}`)
} else {
  await ctx.rebuild()
  await ctx.dispose()
}
