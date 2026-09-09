/**
 * Assembles prerendered React routes and checked standalone demos for static hosting.
 *
 * @file
 */

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cp, lstat, mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { demos, docPages, prerenderPaths } from '../site/registry.mjs';
import { normalizeBase, withBase } from '../site/paths.mjs';
import { readBuildContext } from '../site/build-context.mjs';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const demoSlugs = new Set(demos.map(demo => demo.slug));
const rootFiles = new Set(['gallery.css', 'gallery.mjs', 'manifest.json']);
const sharedFiles = new Set([
	'browser-benchmark.mjs', 'browser-benchmark.css', 'demo-page.mjs'
	, 'proof-page.css', 'proof-viewer.mjs', 'proof-services.mjs'
	, 'site-nav.mjs', 'site.css', 'gallery-card.mjs'
]);
const demoFiles = new Set([
	'app.mjs', 'benchmark-workload.mjs', 'browser-benchmark.mjs', 'graph.mjs'
	, 'index.html', 'network.mjs', 'percolation.mjs', 'README.md', 'reference.mjs'
	, 'runtime.mjs', 'scenario.mjs', 'styles.css', 'terrain.mjs'
]);

/**
 * Limits copied demo files to public page dependencies, Lean sources, and receipts.
 *
 * @param localPath - Slash-separated path below the maintained demos directory.
 */
export function allowedDemoPath(localPath)
{
	if(!localPath) return true;
	const parts = localPath.split('/');
	if(parts.some(part => part.startsWith('.') || !part)) return false;
	if(parts.length === 1)
		return rootFiles.has(parts[0]) || parts[0] === 'shared' || demoSlugs.has(parts[0]);
	if(parts[0] === 'shared') return parts.length === 2 && sharedFiles.has(parts[1]);
	if(!demoSlugs.has(parts[0])) return false;
	if(parts.length === 2)
		return demoFiles.has(parts[1]) || parts[1] === 'runtime' || /^[A-Za-z][A-Za-z0-9_]*\.lean$/u.test(parts[1]);
	return parts.length === 3 && parts[1] === 'runtime'
		&& [`${parts[0]}.wasm`, `${parts[0]}.mjs`, 'proof-audit.json'].includes(parts[2]);
}

/**
 * Maps build-only React output to artifact-root paths, removing the host prefix.
 *
 * @param localPath - Slash-separated path below the React client build directory.
 * @param base - Validated deployment prefix.
 */
export function reactOutputPath(localPath, base)
{
	normalizeBase(base);
	if(localPath === '__spa-fallback.html' || localPath.startsWith('.vite/')) return null;
	// React Router can leave a root SPA fallback when prerendering below a prefix.
	if(base !== '/' && localPath === 'index.html') return null;
	if(/^assets\/[A-Za-z0-9_.-]+\.(?:js|css|svg|png|jpe?g|webp|woff2?)$/u.test(localPath))
		return localPath;
	const prefix = base.slice(1);
	const routeFiles = new Set(prerenderPaths.flatMap(route => [
		`${route.slice(1)}index.html`, `${route.slice(1)}_.data`
	]));
	const candidate = localPath.startsWith(prefix) ? localPath.slice(prefix.length) : null;
	if(candidate && routeFiles.has(candidate)) return candidate;
	throw new Error(`Unapproved React build output: ${localPath}`);
}

/**
 * Produces a redirect with a usable link when JavaScript is disabled.
 *
 * @param base - Validated deployment prefix.
 * @param slug - Registered React demo whose old address remains a public alias.
 */
export function demoRedirect(base, slug)
{
	const demo = demos.find(entry => entry.slug === slug && entry.renderingMode === 'react');
	if(!demo) throw new Error(`No React redirect registered for ${slug}`);
	const target = withBase(base, demo.canonicalPage);
	const title = demo.title.replace(/[&<>"']/gu, character => ({
		'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
	})[character]);
	return `<!doctype html>\n<html lang="en"><head><meta charset="utf-8">`
		+ `<meta name="viewport" content="width=device-width, initial-scale=1">`
		+ `<script>location.replace(${JSON.stringify(target)}+location.search+location.hash);</script>`
		+ `<meta http-equiv="refresh" content="0;url=${target}">`
		+ `<meta name="robots" content="noindex"><link rel="canonical" href="${target}">`
		+ `<title>${title} | Lean Bridge</title></head><body>`
		+ `<main><h1>${title}</h1><p>The workbench has moved.</p>`
		+ `<p><a href="${target}">Open the ${title} workbench</a></p>`
		+ `<p>Lean sources, the runtime, and the proof receipt remain at this address.</p>`
		+ `</main></body></html>\n`;
}

/**
 * Lists regular generated files without following symlinks outside the build tree.
 *
 * @param directory - Root directory to inspect.
 * @param prefix - Relative recursion prefix.
 */
async function listFiles(directory, prefix = '')
{
	const files = [];
	for(const entry of await readdir(resolve(directory, prefix), { withFileTypes: true }))
	{
		const localPath = prefix ? `${prefix}/${entry.name}` : entry.name;
		if(entry.isSymbolicLink()) throw new Error(`Static output cannot contain symlinks: ${localPath}`);
		if(entry.isDirectory()) files.push(...await listFiles(directory, localPath));
		else if(entry.isFile()) files.push(localPath);
		else throw new Error(`Unsupported static output entry: ${localPath}`);
	}
	return files.sort();
}

/**
 * Records exact output bytes without treating the unsigned identity as authentication.
 *
 * @param file - Public output file.
 */
async function hashFile(file)
{
	const bytes = await readFile(file);
	return { bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
}

/**
 * Checks containment without mistaking sibling names for descendants.
 *
 * @param child - Resolved path that might be inside the parent.
 * @param parent - Resolved directory boundary.
 */
function within(child, parent)
{
	const difference = relative(parent, child);
	return !isAbsolute(difference) && difference !== '..' && !difference.startsWith(`..${sep}`);
}

/**
 * Prevents testable publication options from replacing source or compiler directories.
 *
 * @param root - Maintained checkout root.
 * @param output - Requested public artifact directory.
 * @param client - React compiler output used as assembly input.
 */
export function validateOutputDirectory(root, output, client)
{
	root = resolve(root);
	output = resolve(output);
	client = resolve(client);
	const build = resolve(root, 'build');
	if(within(root, output)
		|| (within(output, root) && (!within(output, build) || output === build))
		|| within(output, client) || within(client, output))
		throw new Error('The public output must be a separate generated directory below build, or outside the checkout.');
}

/**
 * Replaces a complete site only after staging succeeds, restoring it on rename failure.
 *
 * @param staging - Newly created sibling staging directory owned by this build.
 * @param output - Final public directory.
 */
export async function publishStagedSite(staging, output)
{
	if(dirname(staging) !== dirname(output) || staging === output)
		throw new Error('Static staging must be a distinct sibling directory.');
	const backup = `${staging}.previous`;
	let hadPrevious = false;
	try
	{
		await rename(output, backup);
		hadPrevious = true;
	}
	catch(error)
	{
		if(error.code !== 'ENOENT') throw error;
	}
	try
	{
		await rename(staging, output);
	}
	catch(error)
	{
		if(hadPrevious) await rename(backup, output);
		throw error;
	}
	if(hadPrevious) await rm(backup, { recursive: true, force: true });
}

/**
 * Builds and stages allowlisted public routes while preserving all raw demo artifacts.
 *
 * @param options - Testable root, output, client directory, build toggle, and site prefix.
 */
export async function assembleSite(options = {})
{
	const root = resolve(options.root ?? repositoryRoot);
	const output = resolve(options.output ?? resolve(root, 'build/github-pages'));
	const client = resolve(options.clientRoot ?? resolve(root, 'build/react-site/client'));
	const base = normalizeBase(options.base ?? process.env.LEAN_BRIDGE_SITE_BASE);
	const demoRoot = resolve(root, 'demos');
	validateOutputDirectory(root, output, client);
	if(options.build !== false)
	{
		execFileSync('npm', ['run', 'site:build'], {
			cwd: root
			, stdio: 'inherit'
			, env: { ...process.env, LEAN_BRIDGE_SITE_BASE: base }
		});
	}
	// Validate required inputs before creating or replacing the published directory.
	const permittedLean = new Set(execFileSync('git', ['ls-files', '-z', '--', 'demos'], {
		cwd: root, encoding: 'utf8'
	}).split('\0').filter(file => file.endsWith('.lean')).map(file => file.slice('demos/'.length)));
	for(const demo of demos)
	{
		await readFile(resolve(demoRoot, demo.slug, 'index.html'));
		for(const file of [`${demo.slug}.wasm`, `${demo.slug}.mjs`, 'proof-audit.json'])
			await readFile(resolve(demoRoot, demo.slug, 'runtime', file));
		const audit = JSON.parse(await readFile(resolve(demoRoot, demo.slug, 'runtime/proof-audit.json'), 'utf8'));
		for(const [file, expected] of Object.entries(audit.sourceFiles))
		{
			if(!/^[A-Za-z][A-Za-z0-9_]*\.lean$/u.test(file))
				throw new Error(`Invalid audited source path: ${demo.slug}/${file}`);
			const actual = await hashFile(resolve(demoRoot, demo.slug, file));
			if(actual.bytes !== expected.bytes || actual.sha256 !== expected.sha256)
				throw new Error(`Source does not match its checked receipt: ${demo.slug}/${file}`);
			permittedLean.add(`${demo.slug}/${file}`);
		}
	}
	const clientFiles = await listFiles(client);
	const overlay = clientFiles.map(file => [file, reactOutputPath(file, base)])
		.filter(([, destination]) => destination);
	const destinations = new Set(overlay.map(([, destination]) => destination));
	for(const route of prerenderPaths)
		if(!destinations.has(`${route.slice(1)}index.html`))
			throw new Error(`Missing prerendered page: ${route}`);
	for(const page of docPages.filter(entry => entry.source))
	{
		const destination = `${page.route.slice(1)}index.html`;
		const [source] = overlay.find(([, target]) => target === destination);
		const html = await readFile(resolve(client, source), 'utf8');
		if(/Loading guide|<(?:div|template)\b[^>]*id="[SB]:/u.test(html))
			throw new Error(`Canonical guide must be readable without JavaScript: ${page.route}`);
	}
	const searchIndex = JSON.parse(await readFile(resolve(root, 'build/site-content/search-index.json'), 'utf8'));
	for(const page of docPages.filter(entry => entry.source))
	{
		const firstHeading = searchIndex.find(entry => entry.route === page.route)?.headings.find(heading => heading.depth === 1);
		const [source] = overlay.find(([, target]) => target === `${page.route.slice(1)}index.html`);
		const html = await readFile(resolve(client, source), 'utf8');
		const headingAttributes = html.match(/<h1\b([^>]*)>/u)?.[1];
		const headingMatches = page.legacy
			? /\bid="[^"]+"/u.test(headingAttributes ?? '')
			: firstHeading && headingAttributes?.includes(`id="${firstHeading.id}"`);
		if(!headingMatches)
			throw new Error(`Canonical guide must render its expected heading: ${page.route}`);
	}
	await mkdir(dirname(output), { recursive: true });
	const staging = await mkdtemp(resolve(dirname(output), '.github-pages-stage-'));
	try
	{
		await cp(demoRoot, staging, {
			recursive: true
			, filter: async source => {
				const localPath = relative(demoRoot, source).replaceAll('\\', '/');
				if(!allowedDemoPath(localPath)) return false;
				if(localPath.endsWith('.lean') && !permittedLean.has(localPath)) return false;
				if((await lstat(source)).isSymbolicLink())
					throw new Error(`Public demo inputs cannot be symlinks: ${localPath}`);
				return true;
			}
		});
		for(const demo of demos.filter(item => item.renderingMode === 'standalone'))
		{
			const file = resolve(staging, demo.slug, 'index.html');
			const html = await readFile(file, 'utf8');
			await writeFile(file, html.replace(/<html\b/u, `<html data-site-base="${base}"`));
		}
		for(const [source, destination] of overlay)
		{
			await mkdir(dirname(resolve(staging, destination)), { recursive: true });
			await cp(resolve(client, source), resolve(staging, destination));
		}
		const routes = {
			prerender: prerenderPaths
			, docs: docPages
			, demos: demos.map(({ slug, canonicalPage, artifactBase, renderingMode }) => ({
				slug, canonicalPage, artifactBase, renderingMode
			}))
		};
		await Promise.all([
			...demos.filter(demo => demo.renderingMode === 'react').map(demo =>
				writeFile(resolve(staging, demo.slug, 'index.html'), demoRedirect(base, demo.slug)))
			, cp(resolve(staging, '404/index.html'), resolve(staging, '404.html'))
			, cp(resolve(root, 'build/site-content/search-index.json'), resolve(staging, 'search-index.json'))
			, writeFile(resolve(staging, '.nojekyll'), '')
			, writeFile(resolve(staging, 'routes.json'), `${JSON.stringify(routes, null, 2)}\n`)
		]);
		const context = readBuildContext(root);
		const identity = {
			schemaVersion: 2
			, commit: context.commit
			, sourceState: context.modified ? 'modified' : 'clean'
			, generatedAt: new Date().toISOString()
			, siteBase: base
			, routes
			, demos: demos.map(demo => demo.slug)
			, artifacts: {}
			, staticFiles: {}
		};
		for(const demo of demos)
		{
			const audit = JSON.parse(await readFile(resolve(staging, demo.slug, 'runtime/proof-audit.json'), 'utf8'));
			for(const [file, expected] of Object.entries(audit.sourceFiles))
			{
				const copied = await hashFile(resolve(staging, demo.slug, file));
				if(copied.bytes !== expected.bytes || copied.sha256 !== expected.sha256)
					throw new Error(`Copied source does not match its checked receipt: ${demo.slug}/${file}`);
			}
			for(const file of [`${demo.slug}.wasm`, `${demo.slug}.mjs`, 'proof-audit.json'])
			{
				const name = `${demo.slug}/runtime/${file}`;
				identity.artifacts[name] = await hashFile(resolve(staging, name));
			}
		}
		for(const name of await listFiles(staging))
			if(!Object.hasOwn(identity.artifacts, name))
				identity.staticFiles[name] = await hashFile(resolve(staging, name));
		await writeFile(resolve(staging, 'build-identity.json'), `${JSON.stringify(identity, null, 2)}\n`);
		await publishStagedSite(staging, output);
		return { output, identity };
	}
	catch(error)
	{
		await rm(staging, { recursive: true, force: true });
		throw error;
	}
}

if(process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
{
	const result = await assembleSite();
	process.stdout.write(`Assembled ${demos.length} demos and ${prerenderPaths.length} React routes in ${result.output}\n`);
}
