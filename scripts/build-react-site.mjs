/**
 * Remove prior prerender pages before React Router's preview-based static generation.
 *
 * @file
 */

import { execFileSync } from "node:child_process";
import { rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const output = fileURLToPath(new URL("../build/react-site/", import.meta.url));
// Stale HTML would otherwise be served by Vite preview before the new renderer.
await rm(output, { recursive: true, force: true });
execFileSync(process.execPath, [fileURLToPath(new URL("../node_modules/@react-router/dev/bin.cjs", import.meta.url)), "build"], {
	cwd: fileURLToPath(new URL("../site/", import.meta.url))
	, stdio: "inherit"
});
