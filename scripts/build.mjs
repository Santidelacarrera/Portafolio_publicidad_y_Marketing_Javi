import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import postcss from "postcss";
import tailwindcss from "@tailwindcss/postcss";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = resolve(root, "dist");
if (dirname(output) !== root || basename(output) !== "dist") throw new Error("Directorio de salida no válido");

await rm(output, { recursive: true, force: true });
await mkdir(join(output, "css"), { recursive: true });
await mkdir(join(output, "js"), { recursive: true });

for (const file of [
  "_headers", "admin.html", "cookies.html", "index.html", "login.html",
  "privacidad.html", "reembolsos.html", "robots.txt", "sitemap.xml", "terminos.html",
  "css/styles.css", "css/admin.css", "js/admin.js", "js/auth.js", "js/config.js",
  "js/login.js", "js/main.js", "js/supabaseClient.js",
]) {
  await copyFile(join(root, file), join(output, file));
}

const css = await readFile(join(root, "css/admin-tailwind.css"), "utf8");
const result = await postcss([tailwindcss()])
  .process(css, { from: join(root, "css/admin-tailwind.css"), to: join(output, "css/admin-tailwind.css") });
await writeFile(join(output, "css/admin-tailwind.css"), result.css);

await build({
  entryPoints: {
    "supabase-bundle": join(root, "js/supabase-entry.js"),
    "tus-bundle": join(root, "js/tus-entry.js"),
  },
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "es2020",
  minify: true,
  outdir: join(output, "js"),
  logLevel: "info",
});
