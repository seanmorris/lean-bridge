/**
 * Prerender the explicit public routes for static hosting without an application server.
 *
 * @file
 */

import type { Config } from "@react-router/dev/config";
import { prerenderPaths } from "./registry.mjs";
import { normalizeBase } from "./paths.mjs";

export default {
	appDirectory: "app"
	, buildDirectory: "../build/react-site"
	// Preview requires basename to include Vite base's trailing slash.
	, basename: normalizeBase(process.env.LEAN_BRIDGE_SITE_BASE)
	, ssr: false
	, prerender: [...prerenderPaths]
} satisfies Config;
