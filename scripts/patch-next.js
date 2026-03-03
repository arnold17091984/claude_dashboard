#!/usr/bin/env node
/**
 * Patches Next.js 16's start-server.js to fix the _debug.default interop issue
 * on Node.js v22.12+ where require(esm) is enabled by default.
 *
 * The issue: _interop_require_default wraps the debug module namespace object,
 * causing _debug.default to be undefined instead of the debug function.
 *
 * Run automatically via postinstall or manually: node scripts/patch-next.js
 */
const fs = require("fs");
const path = require("path");

const nextDir = path.dirname(require.resolve("next/package.json"));
let patched = 0;

// Find all .js files that use _debug.default pattern
function patchFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  let content = fs.readFileSync(filePath, "utf8");

  // Replace the _interop_require_default function to handle ESM namespace objects
  const oldInterop = `function _interop_require_default(obj) {
    return obj && obj.__esModule ? obj : {
        default: obj
    };
}`;
  const newInterop = `function _interop_require_default(obj) {
    if (obj && obj.__esModule) return obj;
    if (typeof obj === 'object' && obj !== null && 'default' in obj) return obj;
    return { default: obj };
}`;

  if (content.includes(oldInterop)) {
    content = content.replace(oldInterop, newInterop);
    fs.writeFileSync(filePath, content);
    patched++;
    console.log(`  patched: ${path.relative(nextDir, filePath)}`);
    return;
  }

  // Also handle minified/single-line variant
  const oldInteropMin =
    "function _interop_require_default(obj){return obj&&obj.__esModule?obj:{default:obj}}";
  const newInteropMin =
    "function _interop_require_default(obj){if(obj&&obj.__esModule)return obj;if(typeof obj==='object'&&obj!==null&&'default' in obj)return obj;return{default:obj}}";

  if (content.includes(oldInteropMin)) {
    content = content.replace(oldInteropMin, newInteropMin);
    fs.writeFileSync(filePath, content);
    patched++;
    console.log(`  patched: ${path.relative(nextDir, filePath)}`);
  }
}

console.log("Patching Next.js for Node v22.12+ require(esm) compatibility...");

// Key files that use _debug.default
const filesToPatch = [
  "dist/server/lib/start-server.js",
  "dist/server/lib/router-server.js",
  "dist/server/next-server.js",
  "dist/server/dev/next-dev-server.js",
];

for (const file of filesToPatch) {
  patchFile(path.join(nextDir, file));
}

// Also scan for any other files with the pattern
const distServer = path.join(nextDir, "dist/server");
function scanDir(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanDir(full);
    } else if (entry.name.endsWith(".js")) {
      patchFile(full);
    }
  }
}
scanDir(path.join(nextDir, "dist/server/lib"));

console.log(`Done. ${patched} file(s) patched.`);
