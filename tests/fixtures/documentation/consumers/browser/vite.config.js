/**
 * Keep the compiled runtime and component assets under the deployment prefix.
 *
 * @file
 */
import { defineConfig } from "vite";

export default defineConfig({
	base: "/consumer-example/"
	, build: { target: "esnext", assetsInlineLimit: 0 }
});
