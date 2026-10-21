import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const css = await readFile(new URL('../style.css', import.meta.url), 'utf8');

test('footer links use lowercase labels and the correct profiles', () => {
  assert.match(html, /href="https:\/\/www.linkedin.com\/in\/viljamimerilainen\/"[^>]*>linkedin<\/a>/);
  assert.match(html, /href="https:\/\/github.com\/vibe-viljami"[^>]*>github<\/a>/);
  assert.match(html, /<footer class="social-links" aria-label="Find me online">/);
  assert.equal((html.match(/rel="noopener noreferrer"/g) || []).length, 2);
});

test('links have typewriter typography, touch targets and keyboard focus', () => {
  assert.match(css, /\.social-links\s*\{[^}]*font-family: "Courier New", Courier, monospace;/s);
  assert.match(css, /\.social-links a\s*\{[^}]*min-height: 44px;/s);
  assert.match(css, /\.social-links a:focus-visible/);
});

test('a still monogram and reduced-motion mode are available', () => {
  assert.match(html, /class="fallback" aria-hidden="true">V/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(html, /<canvas id="ink" aria-hidden="true">/);
});

test('the monogram and social links are the only visible content', () => {
  assert.doesNotMatch(html, /class="signature"|class="invitation"|id="hint"/);
});
