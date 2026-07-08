// Copy the files over so that they can be uploaded by the pages publish command.
import fs from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(import.meta.url), "../../");
const client = resolve(root, "dist/frontend/browser");
const ssr = resolve(root, "dist/frontend/server");
const cloudflare = resolve(root, "dist/frontend/cloudflare");
const worker = resolve(cloudflare, "_worker.js");

fs.cpSync(client, cloudflare, { recursive: true });
fs.cpSync(ssr, worker, { recursive: true });

// Angular's server bundle is Node-targeted: every chunk (and server.mjs) is prefixed with
//   globalThis.require ??= createRequire(import.meta.url)
// On Cloudflare's workerd runtime import.meta.url is undefined in the bundled worker, so
// createRequire(undefined) throws at module-init and the worker never starts. Because the
// banner uses ??=, pre-seeding a valid globalThis.require makes every banner short-circuit.
// shim.mjs must be the worker's first-evaluated module, so index.js imports it before the
// Angular entry (ESM evaluates a module's imports depth-first, in source order).
const shim = `import { createRequire } from 'node:module';
globalThis.require ??= createRequire('file:///worker.mjs');
`;
const entry = `import './shim.mjs';
import handler from './server.mjs';
export default handler;
`;

fs.writeFileSync(join(worker, "shim.mjs"), shim);
fs.writeFileSync(join(worker, "index.js"), entry);
