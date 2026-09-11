/**
 * Declares public routes and the canonical sources rendered by the site.
 *
 * @file
 */

import manifest from '../demos/manifest.json' with { type: 'json' };

export const documentationGroups = Object.freeze(['Start', 'Build and publish', 'Use a package', 'Concepts', 'Reference', 'Contributing']);

const reactDemoSlugs = new Set(manifest.demos.map(demo => demo.slug));

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
		, title: 'Build and publish a Lean package', navTitle: 'Overview'
		, group: 'Build and publish', section: 'Prepare a library'
	}
	, ...[
		['lean-setup', 'setup', 'Set up the toolchain']
		, ['lean-first-component', 'first-component', 'Build your first component']
		, ['lean-existing-package', 'existing-package', 'Adapt an existing library']
		, ['lean-proofs', 'proofs-and-assurance', 'Proofs and assurance']
		, ['lean-exports', 'export-decisions', 'Choose supported exports']
		, ['lean-diagnostics', 'diagnostics', 'Resolve build failures']
	].map(([id, slug, title]) => ({ id, route: `/docs/lean/${slug}/`, source: `docs/lean/${slug}.md`, title, group: 'Build and publish', section: 'Prepare a library' }))
	, {
		id: 'consume'
		, route: '/docs/consume/'
		, source: 'docs/consume.md'
		, title: 'Use a published Lean package', navTitle: 'Overview'
		, section: 'Get started'
		, group: 'Use a package'
	}
	, {
		id: 'javascript-typescript'
		, route: '/docs/consume/javascript-typescript/'
		, source: 'docs/javascript-typescript.md'
		, title: 'JavaScript and TypeScript'
		, group: 'Use a package'
		, consumerIds: ['node-javascript', 'node-typescript', 'browser-javascript']
		, searchAliases: ['JavaScript', 'TypeScript', 'JS', 'TS', 'Browser', 'Browser JavaScript', 'React', 'Workers', 'Browser Workers', 'Node.js']
	}
	, ...[
		['receive-package', 'Use a prepared release']
		, ['javascript', 'JavaScript (Node.js)']
		, ['typescript', 'TypeScript (Node.js)']
		, ['browser', 'Browser JavaScript']
	].map(([id, title]) => ({ id, route: `/docs/consume/${id}/`, source: `docs/consume/${id}.md`, title, group: 'Use a package', ...(id === 'receive-package' ? { section: 'Get started' } : { legacy: true }) }))
	, {
		id: 'react', route: '/docs/consume/react/', source: 'docs/react.md'
		, title: 'Use a component from React', group: 'Use a package', legacy: true
	}
	, {
		id: 'browser-workers', route: '/docs/consume/browser-workers/'
		, source: 'docs/browser-workers.md'
		, title: 'Browser assets and workers', group: 'Use a package', legacy: true
	}
	, {
		id: 'demo-api', route: '/docs/consume/demo-api/', source: 'docs/demo-api.md'
		, title: "Use a demo's local API", group: 'Use a package'
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
		, ['perl', 'Perl', ['perl']]
		, ['php', 'PHP', ['php-native', 'php-wasm']]
		, ['php-native', 'Native PHP', ['php-native']]
		, ['php-wasm', 'PHP-Wasm', ['php-wasm']]
		, ['wit-wasi', 'WIT / WASI', ['wit-wasi']]
	].map(([id, title, consumerIds]) => ({
		id, route: `/docs/consume/${id}/`, title, group: 'Use a package'
		, source: id === 'php' ? 'docs/php.md' : `docs/consume/${id}.md`
		, ...(['php-native', 'php-wasm'].includes(id) ? { legacy: true } : { consumerIds })
		, ...(id === 'php' ? { searchAliases: ['Native PHP', 'PHP-Wasm', 'PHP Wasm'] } : {})
		, ...(id === 'dotnet' ? { searchAliases: ['C#', '.NET', 'C#/.NET'] } : {})
		, ...(id === 'wit-wasi' ? { searchAliases: ['WIT', 'WASI'] } : {})
	}))
	, {
		id: 'dotnet-jvm-ruby'
		, route: '/docs/consume/dotnet-jvm-ruby/'
		, source: 'docs/dotnet-jvm-ruby.md'
		, title: '.NET, JVM, and Ruby'
		, group: 'Use a package'
		, legacy: true
	}
	, {
		id: 'runtimes'
		, route: '/docs/consume/runtimes/'
		, source: 'docs/consumers.md'
		, title: 'Runtime and package reference'
		, group: 'Reference'
	}
	, {
		id: 'publish'
		, route: '/docs/publish/'
		, source: 'docs/publishing.md'
		, title: 'Choose targets and package formats'
		, navTitle: 'Choose target languages'
		, group: 'Build and publish', section: 'Prepare a library'
		, searchAliases: ['Publishing', 'Publish', 'Package managers', 'Registries']
	}
	, ...[
		['npm', 'JavaScript and TypeScript', ['npm', 'Publish JavaScript', 'Build JavaScript', 'Publish TypeScript']]
		, ['pypi', 'Python', ['PyPI', 'Publish Python', 'Build Python']]
		, ['cargo', 'Rust', ['Cargo', 'Publish Rust', 'Build Rust']]
		, ['c', 'C', ['Publish C', 'Build C']]
		, ['cpp', 'C++', ['Publish C++', 'Build C++']]
		, ['nuget', 'C# / .NET', ['NuGet', 'Publish C#', 'Build .NET']]
		, ['maven', 'Java and Kotlin', ['Maven', 'Publish Java', 'Publish Kotlin']]
		, ['rubygems', 'Ruby', ['RubyGems', 'Publish Ruby', 'Build Ruby']]
		, ['cpan', 'Perl', ['CPAN', 'PAUSE', 'Publish Perl', 'Build Perl']]
		, ['php', 'PHP', ['Composer', 'Packagist', 'Publish PHP', 'Build PHP']]
		, ['wit-wasi', 'WIT / WASI', ['Publish WASI', 'Build WASI']]
	].map(([slug, language, searchAliases]) => ({
		id: `publish-${slug}`, route: `/docs/publish/${slug}/`
		, source: `docs/publish/${slug}.md`
		, title: `Build and publish ${language} packages`, navTitle: language
		, group: 'Build and publish', section: 'Target languages', searchAliases
	}))
	, ...[
		['publish-local', 'local-handoff', 'Share a local package']
		, ['publish-archives', 'archives', 'Distribute release archives']
		, ['publish-nix', 'nix', 'Publish signed Nix packages']
	].map(([id, slug, title]) => ({
		id, route: `/docs/publish/${slug}/`, source: `docs/publish/${slug}.md`, title
		, group: 'Build and publish', section: 'Distribution'
		, ...(slug === 'nix' ? { searchAliases: ['Nix', 'Binary cache', 'Nix signing'] } : {})
	}))
	, ...[
		['publish-composer', 'composer', 'Publish with Composer']
		, ['publish-sandbox', 'sandbox-release', 'Rehearse a release']
		, ['publish-production', 'production-release', 'Approve a production release']
	].map(([id, slug, title]) => ({
		id, route: `/docs/publish/${slug}/`, source: `docs/publish/${slug}.md`, title
		, group: 'Build and publish', legacy: true
	}))
	, {
		id: 'publish-pages', route: '/docs/publish/github-pages/'
		, source: 'docs/publish/github-pages.md'
		, title: 'Publish the documentation site', group: 'Build and publish'
		, legacy: true
	}
	, {
		id: 'release-pipeline'
		, route: '/docs/publish/pipeline/'
		, source: 'docs/publish/pipeline.md'
		, title: 'Release pipeline'
		, group: 'Build and publish'
		, legacy: true
	}
	, ...[
		['contributing', '', 'CONTRIBUTING.md', 'Contributing to Lean Bridge', ['Contributing', 'Contribute']]
		, ['contributing-documentation', 'documentation/', 'site/README.md', 'Develop the documentation site', ['Documentation development', 'Site development']]
		, ['contributing-demos', 'demos/', 'demos/README.md', 'Develop and verify demos', ['Demo development', 'Demo testing']]
		, ['contributing-testing', 'testing/', 'docs/contributing/testing.md', 'Build example packages and run checks', ['Example packages', 'Acceptance tests']]
		, ['contributing-release-pipeline', 'release-pipeline/', 'src/release/README.md', 'Release tooling and package extensions', ['Release tooling', 'Signer integration']]
		, ['contributing-author-setup', 'author-toolchain/', 'docs/contributing/author-toolchain.md', 'Build the author toolchain from a checkout', ['Checkout CLI', 'Manual runtime build']]
		, ['contributing-cross-language', 'cross-language-authoring/', 'docs/architecture/cross-language-authoring.md', 'Cross-language authoring stages', ['Type surface', 'Shared export configuration']]
		, ['contributing-sandbox', 'sandbox-release/', 'docs/contributing/sandbox-release.md', 'Rehearse a Lean Bridge release', ['Universal sandbox release']]
		, ['contributing-production', 'production-release/', 'docs/contributing/production-release.md', 'Release Lean Bridge', ['Universal production release']]
		, ['contributing-pages', 'github-pages/', 'docs/contributing/github-pages.md', 'Publish the documentation and demos', ['GitHub Pages', 'Site deployment']]
	].map(([id, slug, source, title, searchAliases]) => ({
		id
		, route: `/docs/contributing/${slug}`
		, source
		, title
		, group: 'Contributing'
		, searchAliases
	}))
	, ...[
		['concepts', '', 'index', 'Understand and adopt a verified core']
		, ['change-risk', 'change-risk/', 'change-risk', 'Use proofs to check a change']
		, ['auditable-claims', 'auditable-claims/', 'auditable-claims', 'Audit a correctness claim']
		, ['reusable-cores', 'reusable-cores/', 'reusable-cores', 'Reuse the algorithm, not the screen']
		, ['trust-boundaries', 'trust-boundaries/', 'trust-boundaries', 'Check the integration']
		, ['shared-runtime', 'shared-runtime/', 'shared-runtime', 'Combine Lean packages']
		, ['ownership', 'ownership/', 'ownership', 'Ownership and cleanup']
		, ['adoption', 'adoption/', 'adoption', 'Plan an adoption']
		, ['dijkstra-explained', 'dijkstra/', 'dijkstra', 'Dijkstra on a delivery graph']
		, ['flood-fill-explained', 'flood-fill/', 'flood-fill', 'Flood fill with keys and permissions']
	].map(([id, slug, source, title]) => ({
		id
		, route: `/docs/concepts/${slug}`
		, source: `docs/concepts/${source}.md`
		, title
		, group: 'Concepts'
		, searchAliases: {
			'shared-runtime': ['Shared runtime', 'Composition', 'Combine packages']
			, ownership: ['Ownership', 'Cleanup', 'Dispose']
			, 'dijkstra-explained': ['Dijkstra', 'Shortest path', 'CSR']
			, 'flood-fill-explained': ['Flood fill', 'Capability closure', 'Reachability']
		}[id]
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
	, ...[
		['cli', 'CLI reference']
		, ['package-api', 'Generated package API']
		, ['types', 'Types and values']
		, ['algorithms', 'Algorithm APIs and proofs']
	].map(([slug, title]) => ({
		id: `reference-${slug}`
		, route: `/docs/reference/${slug}/`
		, source: `docs/reference/${slug}.md`
		, title
		, group: 'Reference'
		, searchAliases: {
			cli: ['CLI', 'Command line', 'Exit codes', 'Configuration']
			, 'package-api': ['API', 'Generated API', 'Declarations']
			, types: ['Types', 'Nat', 'bigint', 'Unicode', 'ByteArray']
			, algorithms: ['Algorithms', 'Algorithm API', 'Theorems']
		}[slug]
	}))
	, {
		id: 'status'
		, route: '/status/'
		, source: 'docs/status.md'
		, title: 'Implementation status'
		, group: 'Reference'
	}
].map(page => ({
	...page
	, ...(page.group === 'Use a package' && !page.section ? { section: page.consumerIds ? 'Languages' : 'Integration' } : {})
})).sort((left, right) => documentationGroups.indexOf(left.group) - documentationGroups.indexOf(right.group)
	|| (['Get started', 'Languages', 'Integration'].indexOf(left.section) - ['Get started', 'Languages', 'Integration'].indexOf(right.section))
		* Number(left.group === 'Use a package')).map(page => Object.freeze(page)));

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
