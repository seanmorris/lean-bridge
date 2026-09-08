/**
 * Route the static documentation shell and the first React algorithm workbench.
 *
 * @file
 */

import { index, route } from "@react-router/dev/routes";
import type { RouteConfig } from "@react-router/dev/routes";

export default [
	index("routes/home.tsx")
	, route("demos", "routes/gallery.tsx")
	, route("demos/lean-myers", "routes/myers.tsx")
	, route("docs", "routes/guides/documentation.tsx")
	, route("docs/lean", "routes/guides/lean-author.tsx")
	, route("docs/consume", "routes/docs.tsx", { id: "consume" })
	, route("docs/consume/javascript-typescript", "routes/guides/javascript-typescript.tsx")
	, route("docs/consume/php", "routes/guides/php.tsx")
	, route("docs/consume/dotnet-jvm-ruby", "routes/guides/dotnet-jvm-ruby.tsx")
	, route("docs/consume/runtimes", "routes/guides/runtimes.tsx")
	, route("docs/publish", "routes/docs.tsx", { id: "publish" })
	, route("docs/publish/pipeline", "routes/guides/release-pipeline.tsx")
	, route("status", "routes/guides/status.tsx")
	, route("*", "routes/not-found.tsx")
] satisfies RouteConfig;
