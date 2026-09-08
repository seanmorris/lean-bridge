/**
 * Bundle only the React site and leave standalone Lean/Wasm assets intact.
 *
 * @file
 */

import { fileURLToPath } from "node:url";
import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";
import { normalizeBase } from "./paths.mjs";
import { readBuildContext } from "./build-context.mjs";
import { demoAssets } from "./dev-assets.ts";

const repository = fileURLToPath(new URL("../", import.meta.url));
const identity = readBuildContext(repository);

export default defineConfig({
	base: normalizeBase(process.env.LEAN_BRIDGE_SITE_BASE)
	, plugins: [demoAssets(repository), reactRouter()]
	, publicDir: false
	, envDir: false
	, envPrefix: "LEAN_BRIDGE_SITE_PUBLIC_"
	, preview: { host: "127.0.0.1" }
	, build: { emptyOutDir: true }
	, define: {
		__BUILD_REVISION__: JSON.stringify(identity.commit)
		, __BUILD_MODIFIED__: JSON.stringify(identity.modified)
	}
	, server: { fs: { allow: [repository] } }
});
