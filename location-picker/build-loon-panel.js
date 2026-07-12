#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const SOURCE = path.join(ROOT, "loon-panel-src", "loon-local-panel.src.js");
const OUTPUT = path.join(ROOT, "loon-local-panel.js");
const VENDOR = path.join(ROOT, "vendor", "leaflet");

function read(file) {
  return fs.readFileSync(file, "utf8");
}

function dataUrl(file) {
  const ext = path.extname(file).toLowerCase();
  const mime = ext === ".png" ? "image/png" : "application/octet-stream";
  return `data:${mime};base64,${read(`${file}.b64`).replace(/\s+/g, "")}`;
}

function templateSafe(value) {
  return value.replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
}

let css = read(path.join(VENDOR, "leaflet.css"));
for (const name of ["layers.png", "layers-2x.png", "marker-icon.png", "marker-icon-2x.png", "marker-shadow.png"]) {
  css = css.replaceAll(`url(images/${name})`, `url(${dataUrl(path.join(VENDOR, "images", name))})`);
}

const leaflet = read(path.join(VENDOR, "leaflet.js"));
const source = read(SOURCE);
const output = source
  .replace("/*__LEAFLET_CSS__*/", templateSafe(css))
  .replace("/*__LEAFLET_JS__*/", templateSafe(leaflet));

if (output.includes("__LEAFLET_CSS__") || output.includes("__LEAFLET_JS__")) {
  throw new Error("Leaflet placeholders were not replaced");
}

fs.writeFileSync(OUTPUT, output);
console.log(`Built ${path.relative(process.cwd(), OUTPUT)} (${Buffer.byteLength(output)} bytes)`);
