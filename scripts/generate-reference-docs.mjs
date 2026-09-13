/**
 * Generate checked Markdown reference pages from executable repository contracts.
 *
 * @file
 */

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { analyzeLeanProject } from '../src/analyze/lean-project.mjs';
import { generateJavaScriptPackage } from '../src/backends/javascript/generate.mjs';
import { componentScalarTypes, scalarCopyLimit } from '../src/abi/component-scalars.mjs';
import { cliUsage, cliExitCodes, parseCliArguments } from '../src/cli/contract.mjs';
import { renderTypeDocuments } from './generate-type-docs.mjs';

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));
export const referenceNames = Object.freeze(['cli', 'package-api', 'types', 'algorithms']);
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const fence = (language, text) => `\`\`\`${language}\n${text.trim()}\n\`\`\``;
const cell = value => String(value).replaceAll('|', '\\|').replace(/\s+/gu, ' ').trim();
const table = (headings, rows) => [headings, headings.map(() => '---'), ...rows]
	.map(row => `| ${row.map(cell).join(' | ')} |`).join('\n');
const inline = value => `\`${value}\``;

/**
 * Read a module's public names and call parameters without executing its runtime.
 *
 * @param source - Adapter JavaScript inspected as syntax, never imported.
 * @param filename - Source label included in validation diagnostics.
 */
export function adapterExports(source, filename = 'runtime.mjs')
{
	const ast = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
	assert.equal(ast.parseDiagnostics.length, 0, `Invalid adapter source: ${filename}`);
	const result = [];
	for(const statement of ast.statements)
	{
		assert.ok(!ts.isExportDeclaration(statement) && !ts.isExportAssignment(statement),
			`Unreviewed export form in ${filename}`);
		if(!statement.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword)) continue;
		assert.ok(ts.isVariableStatement(statement), `Unreviewed export form in ${filename}`);
		for(const declaration of statement.declarationList.declarations)
		{
			assert.ok(ts.isIdentifier(declaration.name), `Unreviewed binding in ${filename}`);
			const value = declaration.initializer;
			const signature = ts.isArrowFunction(value) || ts.isFunctionExpression(value)
				? `${declaration.name.text}(${value.parameters.map(parameter => parameter.getText(ast)).join(', ').replace(/\s+/gu, ' ')})`
				: declaration.name.text;
			const documentation = statement.jsDoc?.at(-1)?.comment;
			const summary = typeof documentation === 'string' ? documentation
				: documentation?.map(part => part.text ?? '').join('') ?? 'Exported constant or initialization alias.';
			result.push({ name: declaration.name.text, signature, summary });
		}
	}
	return result;
}

/**
 * Verify the receipts used by the catalog against their actual Lean sources.
 *
 * @param root - Repository containing the manifest, receipts, and Lean sources.
 */
export async function algorithmReferences(root = repositoryRoot)
{
	const manifest = JSON.parse(await readFile(path.join(root, 'demos/manifest.json'), 'utf8'));
	const algorithms = [];
	for(const demo of manifest.demos)
	{
		assert.match(demo.slug, /^lean-[a-z-]+$/u);
		const directory = `demos/${demo.slug}`;
		const receipt = JSON.parse(await readFile(path.join(root, directory, 'runtime/proof-audit.json'), 'utf8'));
		assert.equal(receipt.schemaVersion, 1);
		for(const theorem of demo.theorems) assert.ok(receipt.theorems.includes(theorem), `${demo.slug}: missing ${theorem}`);
		for(const [name, expected] of Object.entries(receipt.sourceFiles))
		{
			assert.match(name, /^[A-Za-z0-9_-]+\.lean$/u);
			const source = await readFile(path.join(root, directory, name));
			assert.equal(source.length, expected.bytes, `${demo.slug}/${name}: source length`);
			assert.equal(sha256(source), expected.sha256, `${demo.slug}/${name}: source hash`);
		}
		const source = await readFile(path.join(root, directory, 'runtime.mjs'), 'utf8');
		const files = await readdir(path.join(root, directory));
		const benchmark = files.includes('benchmark-workload.mjs') ? 'benchmark-workload.mjs' : 'benchmark.mjs';
		assert.ok(files.includes(benchmark), `${demo.slug}: missing benchmark source`);
		algorithms.push({ ...demo, directory, receipt, benchmark, exports: adapterExports(source, directory) });
	}
	return algorithms;
}

/**
 * Emit the same public declaration file that the component packager emits.
 *
 * @param projectRoot - Ordinary Lean fixture analyzed without compiling or changing it.
 */
export async function packageReference(projectRoot)
{
	const analysis = await analyzeLeanProject(projectRoot);
	assert.ok(analysis.bindingIr, `No inferred API in ${projectRoot}`);
	const ir = analysis.bindingIr.document;
	return { ir, declarations: generateJavaScriptPackage(ir)['index.d.ts'] };
}

/**
 * Render one selected generator set into its reviewed Markdown templates.
 *
 * @param root0 - Optional source location for isolated checks.
 * @param root0.root - Repository containing the reviewed templates and contracts.
 */
export async function renderReferenceDocuments({ root = repositoryRoot } = {})
{
	const typeDocuments = await renderTypeDocuments({ root });
	const [tutorial, scalars, algorithms, schema] = await Promise.all([
		packageReference(path.join(root, 'tests/fixtures/documentation/lean-author'))
		, packageReference(path.join(root, 'tests/fixtures/onboarding/scalars'))
		, algorithmReferences(root)
		, readFile(path.join(root, 'schema/cli-result.schema.json'), 'utf8').then(JSON.parse)
	]);
	const defaults = parseCliArguments(['build'], { cwd: '/project', environment: {}, stderrIsTTY: false });
	const declarationsAst = ts.createSourceFile('index.d.ts', scalars.declarations, ts.ScriptTarget.Latest, true);
	const hostReturns = new Map(declarationsAst.statements.filter(ts.isFunctionDeclaration)
		.map(node => [node.name.text, node.type.getText(declarationsAst)]));
	const rows = componentScalarTypes.map(name => {
		const declaration = scalars.ir.declarations.find(item => item.result.type.name === name);
		assert.ok(declaration, `Missing scalar fixture for ${name}`);
		assert.ok(hostReturns.has(declaration.name), `Missing generated declaration ${declaration.name}`);
		return [inline(name), inline(hostReturns.get(declaration.name)), inline(declaration.name)];
	});
	const values = {
		CLI_HELP: fence('text', cliUsage)
		, CLI_DEFAULTS: fence('json', JSON.stringify({
			format: defaults.format
			, interactive: defaults.interactive
			, selection: defaults.selection
			, cache: defaults.cache, progress: defaults.progress
		}, null, 2))
		, CLI_EXIT_CODES: table(['Outcome', 'Exit code'], Object.entries(cliExitCodes))
		, CLI_RESULT_FIELDS: table(['Required JSON field', 'Schema'], schema.required.map(name => {
			const value = schema.properties[name];
			return [inline(name), inline(JSON.stringify(value.const ?? value.enum ?? value.type ?? value.oneOf))];
		}))
		, PACKAGE_API: fence('ts', tutorial.declarations)
		, SCALAR_API: fence('ts', scalars.declarations)
		, SCALAR_TYPES: table(['Primitive in Binding IR', 'Generated TypeScript result', 'Checked fixture function'], rows)
		, COPY_LIMIT: String(scalarCopyLimit / (1024 * 1024))
		, TYPE_SURFACE: typeDocuments.reference
		, ALGORITHM_INDEX: table(['Algorithm', 'Use it for'], algorithms.map(item => [
			`[${item.title}](#${item.slug})`, item.summary
		]))
		, ALGORITHMS: algorithms.map(item => [
			`## ${item.slug}`, '', item.summary, ''
			, `[Open ${item.title}](../../${item.directory}/) · [Input and result contract](../../${item.directory}/README.md) · [Adapter source](../../${item.directory}/runtime.mjs)`
			, ''
			, table(['Export / call parameters', 'Purpose'], item.exports.map(entry => [inline(entry.signature), entry.summary]))
			, ''
			, `Selected theorems: ${item.theorems.map(inline).join(', ')}.`, ''
			, `The [proof receipt](../../${item.directory}/runtime/proof-audit.json) records ${item.receipt.theorems.length} required declarations checked with ${item.receipt.checker}. This reference build verifies every listed source hash against the Lean files.`
			, ''
			, `[Benchmark source](../../${item.directory}/${item.benchmark}) · [Correctness tests](../../${item.directory}/test.mjs)`
		].join('\n')).join('\n\n')
	};
	const documents = { ...typeDocuments.documents };
	for(const name of referenceNames)
	{
		const template = await readFile(path.join(root, 'site/reference', `${name}.md`), 'utf8');
		const document = template.replace(/\{\{([A-Z_]+)\}\}/gu, (_, key) => {
			assert.ok(Object.hasOwn(values, key), `Unknown reference marker ${key}`);
			return values[key];
		});
		assert.doesNotMatch(document, /\{\{[A-Z_]+\}\}/u);
		documents[`docs/reference/${name}.md`] = document;
	}
	return documents;
}

/**
 * Fail on stale reference pages; writing is an explicit contributor operation.
 *
 * @param root0 - Generation mode and source location.
 * @param root0.root - Repository containing canonical reference pages.
 * @param root0.write - Regenerate files when explicitly requested; otherwise only compare.
 */
export async function generateReferenceDocs({ root = repositoryRoot, write = false } = {})
{
	const documents = await renderReferenceDocuments({ root });
	for(const [relative, content] of Object.entries(documents))
	{
		const filename = path.join(root, relative);
		if(write)
		{
			await mkdir(path.dirname(filename), { recursive: true });
			await writeFile(filename, content);
		}
		else
		{
			const actual = await readFile(filename, 'utf8').catch(error => {
				if(error.code === 'ENOENT') return null;
				throw error;
			});
			assert.equal(actual, content, `${relative} is stale; run npm run docs:reference:write`);
		}
	}
	return documents;
}

if(process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
{
	assert.ok(process.argv.slice(2).every(argument => ['--check', '--write'].includes(argument)), 'Use --check or --write');
	assert.ok(!(process.argv.includes('--check') && process.argv.includes('--write')), 'Choose --check or --write');
	const documents = await generateReferenceDocs({ write: process.argv.includes('--write') });
	console.log(`${process.argv.includes('--write') ? 'Generated' : 'Checked'} ${Object.keys(documents).length} contract-backed reference pages.`);
}
