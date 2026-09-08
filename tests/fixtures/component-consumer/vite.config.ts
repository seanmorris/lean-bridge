/**
 * Keep the runtime and component as explicit browser assets, including workers.
 *
 * @file
 */

import { defineConfig } from "vite";

export default defineConfig({
	base: "/consumer-example/"
	, build: { target: "esnext", assetsInlineLimit: 0 }
	, worker: { format: "es" }
});
