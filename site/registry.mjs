/**
 * Declares public routes and the canonical sources rendered by the site.
 *
 * @file
 */

import manifest from '../demos/manifest.json' with { type: 'json' };

const reactDemoSlugs = new Set(['lean-myers', 'lean-sweep-and-prune', 'lean-dinic']);

export const demos = Object.freeze(manifest.demos.map(demo => Object.freeze({
	...demo
	, canonicalPage: reactDemoSlugs.has(demo.slug)
		? `/demos/${demo.slug}/`
		: `/${demo.entrypoint}`
	, artifactBase: `/${demo.entrypoint}`
	, renderingMode: reactDemoSlugs.has(demo.slug) ? 'react' : 'standalone'
})));

export const docPages = Object.freeze([
	{
		id: 'documentation'
		, route: '/docs/'
		, source: 'docs/README.md'
		, title: 'Documentation map'
		, group: 'Start'
	}
	, {
		id: 'lean-author'
		, route: '/docs/lean/'
		, source: 'docs/lean-author-guide.md'
		, title: 'Package a Lean library'
		, group: 'Author'
	}
	, ...[
		['lean-setup', 'setup', 'Set up the toolchain']
		, ['lean-first-component', 'first-component', 'Build your first component']
		, ['lean-proofs', 'proofs-and-assurance', 'Proofs and assurance']
		, ['lean-exports', 'export-decisions', 'Choose supported exports']
		, ['lean-diagnostics', 'diagnostics', 'Resolve build failures']
	].map(([id, slug, title]) => ({ id, route: `/docs/lean/${slug}/`, source: `docs/lean/${slug}.md`, title, group: 'Author' }))
	, {
		id: 'consume'
		, route: '/docs/consume/'
		, source: 'docs/consume.md'
		, title: 'Use a Lean package'
		, group: 'Consume'
	}
	, {
		id: 'javascript-typescript'
		, route: '/docs/consume/javascript-typescript/'
		, source: 'docs/javascript-typescript.md'
		, title: 'JavaScript and TypeScript'
		, group: 'Consume'
	}
	, {
		id: 'react', route: '/docs/consume/react/', source: 'docs/react.md'
		, title: 'Use a component from React', group: 'Consume'
	}
	, {
		id: 'browser-workers', route: '/docs/consume/browser-workers/'
		, source: 'docs/browser-workers.md'
		, title: 'Browser assets and workers', group: 'Consume'
	}
	, {
		id: 'demo-api', route: '/docs/consume/demo-api/', source: 'docs/demo-api.md'
		, title: "Use a demo's local API", group: 'Consume'
	}
	, {
		id: 'php'
		, route: '/docs/consume/php/'
		, source: 'docs/php.md'
		, title: 'PHP'
		, group: 'Consume'
	}
	, {
		id: 'dotnet-jvm-ruby'
		, route: '/docs/consume/dotnet-jvm-ruby/'
		, source: 'docs/dotnet-jvm-ruby.md'
		, title: '.NET, JVM, and Ruby'
		, group: 'Consume'
	}
	, {
		id: 'runtimes'
		, route: '/docs/consume/runtimes/'
		, source: 'docs/consumers.md'
		, title: 'Downstream consumers'
		, group: 'Consume'
	}
	, {
		id: 'publish'
		, route: '/docs/publish/'
		, source: 'docs/publishing.md'
		, title: 'Publish a Lean package'
		, group: 'Publish'
	}
	, ...[
		['publish-local', 'local-handoff', 'Share a local package']
		, ['publish-sandbox', 'sandbox-release', 'Rehearse a release']
		, ['publish-production', 'production-release', 'Approve a production release']
		, ['publish-pages', 'github-pages', 'Publish the documentation site']
	].map(([id, slug, title]) => ({ id, route: `/docs/publish/${slug}/`, source: `docs/publish/${slug}.md`, title, group: 'Publish' }))
	, {
		id: 'release-pipeline'
		, route: '/docs/publish/pipeline/'
		, source: 'src/release/README.md'
		, title: 'Release pipeline'
		, group: 'Publish'
	}
	, {
		id: 'proof-to-wasm', route: '/docs/concepts/lean-to-wasm/'
		, source: 'docs/concepts/lean-to-wasm.md'
		, title: 'From proof to browser result', group: 'Concepts'
	}
	, {
		id: 'benchmarks', route: '/docs/concepts/benchmarks/'
		, source: 'docs/concepts/benchmarks.md'
		, title: 'Read the benchmarks', group: 'Concepts'
	}
	, {
		id: 'status'
		, route: '/status/'
		, source: 'docs/status.md'
		, title: 'Implementation status'
		, group: 'Reference'
	}
].map(page => Object.freeze(page)));

export const prerenderPaths = Object.freeze([
	'/'
	, '/demos/'
	, '/404/'
	, ...docPages.map(page => page.route)
	, ...demos.filter(demo => demo.renderingMode === 'react')
		.map(demo => demo.canonicalPage)
]);

// These initial canonical guides contain no images. New assets require review.
export const documentationImages = Object.freeze({});
