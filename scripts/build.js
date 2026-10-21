import { mkdir, copyFile, cp, rm } from 'node:fs/promises';

const dist = new URL('../dist/', import.meta.url);
await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
for (const file of ['index.html', 'style.css', 'favicon.svg']) {
  await copyFile(new URL(`../${file}`, import.meta.url), new URL(file, dist));
}
await cp(new URL('../src/', import.meta.url), new URL('src/', dist), { recursive: true });
console.log('Built static site in dist/');
