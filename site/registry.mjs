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
	, {
		id: 'consume'
		, route: '/docs/consume/'
		, source: null
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
		, source: null
		, title: 'Publish a Lean package'
		, group: 'Publish'
	}
	, {
		id: 'release-pipeline'
		, route: '/docs/publish/pipeline/'
		, source: 'src/release/README.md'
		, title: 'Release pipeline'
		, group: 'Publish'
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
