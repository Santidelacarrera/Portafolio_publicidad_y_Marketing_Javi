import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = join(root, "dist");
const pages = (await readdir(output)).filter((file) => file.endsWith(".html"));

for (const page of pages) {
  const html = await readFile(join(output, page), "utf8");
  for (const tag of html.match(/<script\b[^>]*>/gi) || []) {
    const source = tag.match(/\bsrc="([^"]+)"/i)?.[1];
    assert.ok(source?.startsWith("js/"), `${page}: script no local o inline`);
    assert.ok((await stat(join(output, source))).isFile(), `${page}: falta ${source}`);
  }
  assert.doesNotMatch(html, /\son[a-z]+\s*=/i, `${page}: manejador de eventos inline`);
  for (const source of html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+)"/gi)) {
    if (source[1].startsWith("https://")) continue;
    assert.ok((await stat(join(output, source[1]))).isFile(), `${page}: falta ${source[1]}`);
  }
}

const headers = await readFile(join(output, "_headers"), "utf8");
assert.doesNotMatch(headers, /unsafe-inline|cdn\.jsdelivr|cdn\.tailwindcss/);
const index = await readFile(join(output, "index.html"), "utf8");
assert.match(index, /data-netlify="true"/);
const main = await readFile(join(output, "js/main.js"), "utf8");
assert.doesNotMatch(main, /\.netlify\/functions\/contact/);
for (const name of ["README.md", "sql", "scripts", "node_modules", "package.json", ".git"]) {
  assert.ok(!(await readdir(output)).includes(name), `${name} no debe publicarse`);
}
console.log("Build y controles de publicación: OK");
