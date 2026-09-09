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
		, consumerIds: ['node-javascript', 'node-typescript', 'browser-javascript']
		, searchAliases: ['JavaScript', 'TypeScript', 'JS', 'TS', 'Browser', 'Browser JavaScript', 'React', 'Workers', 'Browser Workers', 'Node.js']
	}
	, ...[
		['receive-package', 'Receive a package']
		, ['javascript', 'JavaScript (Node.js)']
		, ['typescript', 'TypeScript (Node.js)']
		, ['browser', 'Browser JavaScript']
	].map(([id, title]) => ({ id, route: `/docs/consume/${id}/`, source: `docs/consume/${id}.md`, title, group: 'Consume', ...(id === 'receive-package' ? {} : { legacy: true }) }))
	, {
		id: 'react', route: '/docs/consume/react/', source: 'docs/react.md'
		, title: 'Use a component from React', group: 'Consume', legacy: true
	}
	, {
		id: 'browser-workers', route: '/docs/consume/browser-workers/'
		, source: 'docs/browser-workers.md'
		, title: 'Browser assets and workers', group: 'Consume', legacy: true
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
	, ...[
		['python', 'Python', ['python']]
		, ['rust', 'Rust', ['rust']]
		, ['c', 'C', ['c']]
		, ['cpp', 'C++', ['cpp']]
		, ['dotnet', 'C# / .NET', ['dotnet']]
		, ['java', 'Java', ['jvm']]
		, ['kotlin', 'Kotlin', ['jvm']]
		, ['ruby', 'Ruby', ['ruby']]
		, ['php-native', 'Native PHP', ['php-native']]
		, ['php-wasm', 'PHP-Wasm', ['php-wasm']]
		, ['wit-wasi', 'WIT / WASI', ['wit-wasi']]
	].map(([id, title, consumerIds]) => ({ id, route: `/docs/consume/${id}/`, source: `docs/consume/${id}.md`, title, group: 'Consume', consumerIds }))
	, {
		id: 'dotnet-jvm-ruby'
		, route: '/docs/consume/dotnet-jvm-ruby/'
		, source: 'docs/dotnet-jvm-ruby.md'
		, title: '.NET, JVM, and Ruby'
		, group: 'Consume'
		, legacy: true
	}
	, {
		id: 'runtimes'
		, route: '/docs/consume/runtimes/'
		, source: 'docs/consumers.md'
		, title: 'Runtime and package reference'
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
		, ['publish-npm', 'npm', 'Publish to npm']
		, ['publish-pypi', 'pypi', 'Publish to PyPI']
		, ['publish-cargo', 'cargo', 'Publish Rust crates with Cargo']
		, ['publish-nuget', 'nuget', 'Publish to NuGet']
		, ['publish-maven', 'maven', 'Publish to Maven repositories']
		, ['publish-rubygems', 'rubygems', 'Publish to RubyGems']
		, ['publish-composer', 'composer', 'Publish with Composer']
		, ['publish-archives', 'archives', 'Distribute C, C++, and WASI archives']
		, ['publish-nix', 'nix', 'Publish signed Nix packages']
	].map(([id, slug, title]) => ({ id, route: `/docs/publish/${slug}/`, source: `docs/publish/${slug}.md`, title, group: 'Publish' }))
	, {
		id: 'publish-pages', route: '/docs/publish/github-pages/'
		, source: 'docs/publish/github-pages.md'
		, title: 'Publish the documentation site', group: 'Publish', legacy: true
	}
	, {
		id: 'release-pipeline'
		, route: '/docs/publish/pipeline/'
		, source: 'docs/publish/pipeline.md'
		, title: 'Release pipeline'
		, group: 'Publish'
		, legacy: true
	}
	, ...[
		['contributing', '', 'CONTRIBUTING.md', 'Contributing to Lean Bridge', ['Contributing', 'Contribute']]
		, ['contributing-documentation', 'documentation/', 'site/README.md', 'Develop the documentation site', ['Documentation development', 'Site development']]
		, ['contributing-demos', 'demos/', 'demos/README.md', 'Develop and verify demos', ['Demo development', 'Demo testing']]
		, ['contributing-testing', 'testing/', 'docs/contributing/testing.md', 'Build example packages and run checks', ['Example packages', 'Acceptance tests']]
		, ['contributing-release-pipeline', 'release-pipeline/', 'src/release/README.md', 'Release tooling and package extensions', ['Release tooling', 'Signer integration']]
		, ['contributing-pages', 'github-pages/', 'docs/contributing/github-pages.md', 'Publish the documentation and demos', ['GitHub Pages', 'Site deployment']]
	].map(([id, slug, source, title, searchAliases]) => ({
		id
		, route: `/docs/contributing/${slug}`
		, source
		, title
		, group: 'Contributing'
		, searchAliases
	}))
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
