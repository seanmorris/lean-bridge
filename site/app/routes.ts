/**
 * Route the static documentation shell and migrated React algorithm workbenches.
 *
 * @file
 */

import { index, route } from "@react-router/dev/routes";
import type { RouteConfig } from "@react-router/dev/routes";

export default [
	index("routes/home.tsx")
	, route("demos", "routes/gallery.tsx")
	, route("demos/lean-myers", "routes/myers.tsx")
	, route("demos/lean-sweep-and-prune", "routes/sweep.tsx")
	, route("demos/lean-dinic", "routes/dinic.tsx")
	, route("docs", "routes/guides/documentation.tsx")
	, route("docs/lean", "routes/guides/lean-author.tsx")
	, route("docs/lean/setup", "routes/guides/lean-setup.tsx")
	, route("docs/lean/first-component", "routes/guides/lean-first-component.tsx")
	, route("docs/lean/proofs-and-assurance", "routes/guides/lean-proofs.tsx")
	, route("docs/lean/export-decisions", "routes/guides/lean-exports.tsx")
	, route("docs/lean/diagnostics", "routes/guides/lean-diagnostics.tsx")
	, route("docs/consume", "routes/guides/consume.tsx")
	, route("docs/consume/javascript-typescript", "routes/guides/javascript-typescript.tsx")
	, route("docs/consume/react", "routes/guides/react.tsx")
	, route("docs/consume/browser-workers", "routes/guides/browser-workers.tsx")
	, route("docs/consume/demo-api", "routes/guides/demo-api.tsx")
	, route("docs/consume/php", "routes/guides/php.tsx")
	, route("docs/consume/dotnet-jvm-ruby", "routes/guides/dotnet-jvm-ruby.tsx")
	, route("docs/consume/runtimes", "routes/guides/runtimes.tsx")
	, route("docs/publish", "routes/guides/publish.tsx")
	, route("docs/publish/local-handoff", "routes/guides/publish-local.tsx")
	, route("docs/publish/sandbox-release", "routes/guides/publish-sandbox.tsx")
	, route("docs/publish/production-release", "routes/guides/publish-production.tsx")
	, route("docs/publish/github-pages", "routes/guides/publish-pages.tsx")
	, route("docs/publish/pipeline", "routes/guides/release-pipeline.tsx")
	, route("docs/concepts/lean-to-wasm", "routes/guides/proof-to-wasm.tsx")
	, route("docs/concepts/benchmarks", "routes/guides/benchmarks.tsx")
	, route("status", "routes/guides/status.tsx")
	, route("*", "routes/not-found.tsx")
] satisfies RouteConfig;
