/**
 * Compiles allowlisted canonical Markdown to static, highlighted React modules.
 *
 * @file
 */

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile } from '@mdx-js/mdx';
import remarkGfm from 'remark-gfm';
import { createHighlighter } from 'shiki';
import { demos, docPages, documentationImages } from '../site/registry.mjs';
import { generateReferenceDocs } from './generate-reference-docs.mjs';

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));
const repositoryUrl = 'https://github.com/seanmorris/lean-bridge';
const publicWorkflowReferences = new Set([
	'.github/workflows/demos-pages.yml'
	, '.github/workflows/reproducible-release.yml'
]);
const sourcePages = new Map(docPages.filter(page => page.source)
	.map(page => [page.source, page]));
const demoPages = new Map([
	['demos/index.html', '/demos/']
	, ...demos.map(demo => [`demos/${demo.entrypoint}index.html`, demo.canonicalPage])
]);
const languages = [
	'sh', 'js', 'ts', 'tsx', 'html', 'json', 'lean', 'toml', 'php', 'python'
	, 'rust', 'c', 'cpp', 'csharp', 'java', 'kotlin', 'ruby', 'perl'
	, 'xml', 'cmake', 'wit', 'nix', 'ini'
];

/**
 * Visits Markdown or HTML syntax nodes without loading a browser dependency.
 *
 * @param node - Current syntax node.
 * @param visitor - Callback applied before each node's children.
 */
function walk(node, visitor)
{
	visitor(node);
	for(const child of node.children ?? [])
	{
		walk(child, visitor);
	}
}

/**
 * Collects a syntax node's visible text, including inline code and image labels.
 *
 * @param node - Markdown or HTML syntax node.
 */
function plainText(node)
{
	if(typeof node.value === 'string')
	{
		return node.value;
	}
	if(node.type === 'image')
	{
		return node.alt ?? '';
	}
	return (node.children ?? []).map(plainText).join('');
}

/**
 * Creates stable heading IDs and suffixes repeated headings within a page.
 *
 * @param value - Visible heading text.
 * @param used - IDs already assigned in this page.
 */
function headingId(value, used)
{
	const stem = value.toLowerCase().replace(/[^\p{L}\p{N}_\-\s]/gu, '')
		.replace(/\s/g, '-') || 'section';
	let id = stem;
	let suffix = 0;
	while(used.has(id))
	{
		id = `${stem}-${++suffix}`;
	}
	used.add(id);
	return id;
}

/**
 * Resolves a repository-relative Markdown target without allowing private paths.
 *
 * @param value - A relative path without its query or fragment.
 * @param source - Canonical repository Markdown path.
 */
function sourceTarget(value, source)
{
	const decoded = decodeURIComponent(value);
	if(decoded.includes('\\') || decoded.startsWith('/')
		|| [...decoded].some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)){
		throw new Error(`Invalid local documentation link: ${value}`);
		}
	const target = path.posix.normalize(path.posix.join(
		path.posix.dirname(source), decoded
	));
	const privatePath = target.split('/').some(part => part.startsWith('.'))
		&& !publicWorkflowReferences.has(target);
	if(target === '..' || target.startsWith('../') || privatePath)
	{
		throw new Error(`Private or escaping documentation link: ${value}`);
	}
	return target;
}

/**
 * Rewrites canonical links to portable site routes or revision-pinned sources.
 *
 * @param value - Markdown link URL.
 * @param page - Registered source page.
 * @param options - Revision and optional tracked repository file set.
 */
export function rewriteDocumentationLink(value, page, options)
{
	if(!/^[a-f0-9]{40}$/u.test(options.revision))
	{
		throw new Error('Documentation source links require a full Git revision.');
	}
	if(value.startsWith('#') || value === '')
	{
		return value;
	}
	if(/^(?:https?:|mailto:)/iu.test(value))
	{
		return value;
	}
	if(/^[a-z][a-z0-9+.-]*:/iu.test(value) || value.startsWith('//'))
	{
		throw new Error(`Unsupported documentation URL: ${value}`);
	}
	const split = value.search(/[?#]/u);
	const localPath = split < 0 ? value : value.slice(0, split);
	const suffix = split < 0 ? '' : value.slice(split);
	const target = localPath ? sourceTarget(localPath, page.source) : page.source;
	const route = sourcePages.get(target)?.route ?? demoPages.get(target);
	if(route)
	{
		const relative = path.posix.relative(page.route, route);
		return `${relative ? `${relative}/` : './'}${suffix}`;
	}
	if(options.trackedFiles && !options.trackedFiles.has(target))
	{
		throw new Error(`Untracked documentation link: ${page.source} -> ${target}`);
	}
	const escapedPath = target.split('/').map(encodeURIComponent).join('/');
	return `${repositoryUrl}/blob/${options.revision}/${escapedPath}${suffix}`;
}

/**
 * Adds headings and rewrites links while collecting a separate search record.
 *
 * @param page - Registered source page.
 * @param options - Source revision and tracked repository paths.
 * @param metadata - Collected heading and outgoing link records.
 */
function markdownMetadata(page, options, metadata)
{
	return () => tree => {
		const used = new Set();
		const search = [];
		walk(tree, node => {
			if(node.type === 'html' || node.type.startsWith('mdx'))
			{
				throw new Error(`Executable or raw HTML content is not allowed: ${page.source}`);
			}
			if(node.type === 'heading')
			{
				const text = plainText(node);
				const id = headingId(text, used);
				node.data = { ...node.data, hProperties: { id } };
				metadata.headings.push({ depth: node.depth, id, text });
			}
			if(['text', 'inlineCode', 'code'].includes(node.type))
			{
				search.push(node.value);
			}
			if(node.type === 'image' || node.type === 'imageReference')
			{
				const target = node.url && sourceTarget(node.url, page.source);
				if(!target || !Object.hasOwn(documentationImages, target))
				{
					throw new Error(`Image is not allowlisted: ${page.source}`);
				}
				node.url = documentationImages[target];
			}
			if(node.type === 'link' || node.type === 'definition')
			{
				node.url = rewriteDocumentationLink(node.url, page, options);
				metadata.links.push(node.url);
			}
		});
		metadata.searchText = search.join(' ').replace(/\s+/gu, ' ').trim();
	};
}

/**
 * Replaces code blocks with Shiki's static highlighted HTML syntax tree.
 *
 * @param highlighter - Build-only Shiki instance with pinned languages and theme.
 */
function highlightCode(highlighter)
{
	return () => tree => {
		walk(tree, node => {
			if(node.type !== 'element' || node.tagName !== 'pre')
			{
				return;
			}
			const code = node.children?.[0];
			if(code?.tagName !== 'code')
			{
				return;
			}
			const className = code.properties?.className ?? [];
			const label = className.find(value => value.startsWith('language-'))
				?.slice('language-'.length) ?? 'text';
			const language = label === 'gitignore' ? 'text' : label;
			const highlighted = highlighter.codeToHast(
				plainText(code).replace(/\n$/u, '')
				, { lang: language, theme: 'github-dark-default' }
			).children[0];
			highlighted.properties['data-language'] = label;
			Object.assign(node, highlighted);
		});
	};
}

/**
 * Compiles one registered guide without evaluating author JavaScript or JSX.
 *
 * @param markdown - Canonical Markdown source text.
 * @param page - Registered source page descriptor.
 * @param options - Revision, tracked paths, and reusable build-only highlighter.
 */
export async function compileDocumentationPage(markdown, page, options)
{
	if(!/^[a-f0-9]{40}$/u.test(options.revision))
	{
		throw new Error('Documentation source links require a full Git revision.');
	}
	if(sourcePages.get(page.source)?.route !== page.route)
	{
		throw new Error(`Documentation source is not allowlisted: ${page.source}`);
	}
	const highlighter = options.highlighter ?? await createHighlighter({
		themes: ['github-dark-default'], langs: languages
	});
	const extracted = { headings: [], links: [], searchText: '' };
	try
	{
		const compiled = await compile(markdown, {
			format: 'md'
			, development: false
			, remarkPlugins: [remarkGfm, markdownMetadata(page, options, extracted)]
			, rehypePlugins: [highlightCode(highlighter)]
		});
		const metadata = {
			...page
			, headings: extracted.headings
			, sourceUrl: `${repositoryUrl}/blob/${options.revision}/${page.source}`
			, sourceSha256: createHash('sha256').update(markdown).digest('hex')
		};
		return {
			code: String(compiled)
			, metadata
			, links: extracted.links
			, searchText: extracted.searchText
		};
	}
	finally
	{
		if(!options.highlighter)
		{
			highlighter.dispose();
		}
	}
}

/**
 * Checks rewritten site fragments against the headings emitted by the compiler.
 *
 * @param results - Compiled pages keyed by canonical route.
 */
export function validateDocumentationAnchors(results)
{
	for(const [route, result] of Object.entries(results))
	{
		for(const link of result.links)
		{
			const target = new URL(link, `https://site.invalid${route}`);
			if(target.origin !== 'https://site.invalid' || !target.hash)
			{
				continue;
			}
			const destination = results[target.pathname];
			const fragment = decodeURIComponent(target.hash.slice(1));
			// Demo fragments are checked against their assembled HTML by the browser gate.
			if([...demoPages.values()].includes(target.pathname)) continue;
			if(!destination?.metadata.headings.some(heading => heading.id === fragment))
			{
				throw new Error(`Missing documentation heading: ${route} -> ${link}`);
			}
		}
	}
}

/**
 * Builds only the registered documentation modules and their deferred search index.
 *
 * @param options - Optional repository root and generated-output directory for tests.
 */
export async function generateSiteContent(options = {})
{
	const root = options.root ?? repositoryRoot;
	await generateReferenceDocs({ root });
	const output = options.output ?? path.join(root, 'build/site-content');
	const revision = execFileSync('git', ['rev-parse', 'HEAD'], {
		cwd: root, encoding: 'utf8'
	}).trim();
	const trackedFiles = new Set(execFileSync('git', ['ls-files', '-z'], {
		cwd: root, encoding: 'utf8'
	}).split('\0').filter(Boolean));
	const highlighter = await createHighlighter({
		themes: ['github-dark-default'], langs: languages
	});
	const results = {};
	try
	{
		for(const page of docPages.filter(page => page.source))
		{
			const sourcePath = path.join(root, page.source);
			if(await realpath(sourcePath) !== sourcePath)
			{
				throw new Error(`Canonical documentation cannot be a symlink: ${page.source}`);
			}
			results[page.route] = await compileDocumentationPage(
				await readFile(sourcePath, 'utf8'), page
				, { revision, trackedFiles, highlighter }
			);
		}
	}
	finally
	{
		highlighter.dispose();
	}
	validateDocumentationAnchors(results);
	const pages = Object.fromEntries(Object.entries(results)
		.map(([route, result]) => [route, result.metadata]));
	const modules = Object.entries(results).map(([route, result]) =>
		`${JSON.stringify(route)}: () => import('./${result.metadata.id}.mjs')`
	);
	const search = Object.values(results).filter(result => !result.metadata.legacy).map(result => ({
		...result.metadata, searchText: result.searchText
	}));
	await mkdir(output, { recursive: true });
	for(const result of Object.values(results))
	{
		await writeFile(path.join(output, `${result.metadata.id}.mjs`), result.code);
	}
	await writeFile(path.join(output, 'metadata.mjs'),
		`export const pages = ${JSON.stringify(pages, null, 2)};\n`);
	await writeFile(path.join(output, 'index.mjs'), [
		"export { pages } from './metadata.mjs';"
		, `export const pageModules = {\n${modules.join(',\n')}\n};\n`
	].join('\n'));
	await writeFile(path.join(output, 'metadata.d.mts'), [
		'export interface Heading { depth: number; id: string; text: string; }'
		, 'export interface Page { id: string; route: string; source: string; title: string; group: string; legacy?: boolean; consumerIds?: string[]; searchAliases?: string[]; headings: Heading[]; sourceUrl: string; sourceSha256: string; }'
		, 'export const pages: Record<string, Page>;'
	].join('\n'));
	await writeFile(path.join(output, 'index.d.mts'), [
		"import type { ComponentType } from 'react';"
		, "export { pages } from './metadata.mjs';"
		, "export type { Heading, Page } from './metadata.mjs';"
		, 'export const pageModules: Record<string, () => Promise<{ default: ComponentType<{ components?: Record<string, unknown> }> }>>;\n'
	].join('\n'));
	await writeFile(path.join(output, 'search-index.json'),
		`${JSON.stringify(search)}\n`);
	return { pages, revision, output };
}

if(process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
{
	const result = await generateSiteContent();
	console.log(`Compiled ${Object.keys(result.pages).length} canonical documentation pages.`);
}
