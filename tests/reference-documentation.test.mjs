/**
 * Keep generated references and executable concept examples tied to their contracts.
 *
 * @file
 */

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';
import { cliUsage, cliExitCodes, validateCliResult } from '../src/cli/contract.mjs';
import { componentScalarTypes } from '../src/abi/component-scalars.mjs';
import { docPages, demos } from '../site/registry.mjs';
import { typeGuideProfiles } from '../scripts/generate-type-docs.mjs';
import { renderReferenceApiCapture } from '../scripts/capture-reference-apis.mjs';
import { canonicalJson } from '../src/capsule/node.mjs';
import {
	adapterExports, algorithmReferences, generateReferenceDocs, packageReference, renderReferenceDocuments
} from '../scripts/generate-reference-docs.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const text = relative => readFile(path.join(root, relative), 'utf8');
const blocks = (markdown, language) => [...markdown.matchAll(new RegExp(`^\`\`\`${language}\\n([\\s\\S]*?)^\`\`\`\\s*$`, 'gmu'))]
	.map(match => match[1].trim());

test('compiler API captures ignore JSON member order and still detect changed source identities', async () => {
	const capture = JSON.parse(await text('tests/fixtures/documentation/package-api/lean-author.json'));
	const reordered = value => Array.isArray(value) ? value.map(reordered) : value && typeof value === 'object'
		? Object.fromEntries(Object.entries(value).reverse().map(([key, item]) => [key, reordered(item)])) : value;
	const analysis = { inputs: reordered(capture.inputs), bindingIr: { origin: 'lean-elaborated', document: reordered(capture.ir) }, adapterHints: [] };
	assert.equal(renderReferenceApiCapture(analysis), canonicalJson(capture));
	assert.equal(renderReferenceApiCapture(reordered(analysis)), canonicalJson(capture));
	analysis.inputs[0].sha256 = '0'.repeat(64);
	assert.notEqual(renderReferenceApiCapture(analysis), canonicalJson(capture));
});

test('generated references and consumer type sections match the current contracts exactly', async () => {
	const documents = await generateReferenceDocs();
	assert.equal(Object.keys(documents).length, 4 + Object.keys(typeGuideProfiles).length);
	assert.deepEqual(await renderReferenceDocuments(), documents, 'Generation is deterministic');
	for(const [filename, content] of Object.entries(documents))
	{
		assert.equal(await text(filename), content);
		assert.ok(docPages.some(page => page.source === filename));
		assert.doesNotMatch(content, /\{\{[A-Z_]+\}\}|\bany\b.*=>/u);
	}
});

test('CLI reference uses real help and the entry point rejects invalid command options', async () => {
	const markdown = await text('docs/reference/cli.md');
	assert.equal(blocks(markdown, 'text')[0], cliUsage.trim());
	const help = spawnSync(process.execPath, ['scripts/lean-bridge.mjs', '--help'], {
		cwd: root, encoding: 'utf8', timeout: 30000
	});
	assert.ifError(help.error);
	assert.equal(help.status, 0);
	assert.equal(help.stdout, cliUsage);
	assert.equal(help.stderr, '');
	const failure = spawnSync(process.execPath, ['scripts/lean-bridge.mjs', 'build', '--check', '--json'], {
		cwd: root, encoding: 'utf8', timeout: 30000
	});
	assert.ifError(failure.error);
	assert.equal(failure.status, cliExitCodes.usage);
	const result = JSON.parse(failure.stdout);
	assert.equal(validateCliResult(result), true);
	assert.equal(result.diagnostics[0].code, 'unknown-option');
});

test('package reference declarations come from the actual author and scalar generators', async () => {
	const markdown = await text('docs/reference/package-api.md');
	const expected = await Promise.all([
		packageReference(path.join(root, 'tests/fixtures/documentation/lean-author'))
		, packageReference(path.join(root, 'tests/fixtures/onboarding/scalars'))
	]);
	assert.deepEqual(blocks(markdown, 'ts'), expected.map(value => value.declarations.trim()));
	const tutorial = expected[0].ir;
	assert.deepEqual(tutorial.declarations.map(declaration => declaration.name), ['add', 'isEmpty']);
	assert.deepEqual(tutorial.assurance, []);
	assert.deepEqual(tutorial.declarations[0].source.extensions['lean-lang.org/theorem-references'], ['OnboardingSmall.add_commutative']);
	const scalarMarkdown = await text('docs/reference/types.md');
	assert.deepEqual([...scalarMarkdown.matchAll(/^\| `([a-z0-9]+)` \|/gmu)].map(match => match[1]), componentScalarTypes);
	assert.match(scalarMarkdown, /16 MiB/u);
});

test('algorithm catalog covers every real export and every selected audited theorem', async () => {
	const algorithms = await algorithmReferences();
	assert.deepEqual(algorithms.map(item => item.slug), demos.map(item => item.slug));
	const markdown = await text('docs/reference/algorithms.md');
	for(const algorithm of algorithms)
	{
		const section = markdown.split(`## ${algorithm.slug}\n`)[1]?.split('\n## ')[0];
		assert.ok(section, algorithm.slug);
		assert.ok(section.includes(`](../../${algorithm.directory}/)`), 'Demo links do not require a legacy source index.html');
		assert.ok(algorithm.exports.length > 0);
		for(const entry of algorithm.exports) assert.ok(section.includes(`\`${entry.signature}\``), entry.name);
		for(const theorem of algorithm.theorems) assert.ok(section.includes(`\`${theorem}\``), theorem);
	}
	assert.deepEqual(demos.find(demo => demo.slug === 'lean-union-find').theorems,
		['solvePartition_correct', 'connected_equivalence']);
});

test('adapter reference reads source without executing it and rejects unreviewed export syntax', () => {
	const source = '/** Solve one request. */\nexport const solve = async ({ input, target = 0 }) => { throw new Error("must not run"); };\nexport const LIMIT = 8;';
	assert.deepEqual(adapterExports(source).map(entry => entry.signature), ['solve({ input, target = 0 })', 'LIMIT']);
	assert.equal(adapterExports(source)[0].summary, 'Solve one request.');
	assert.throws(() => adapterExports('export { secret } from "./private.mjs";'), /Unreviewed export/u);
	assert.throws(() => adapterExports('export const broken = ;'), /Invalid adapter/u);
});

test('catalog generation rejects missing theorem names and altered Lean source', async () => {
	await mkdir(path.join(root, 'build'), { recursive: true });
	const temporary = await mkdtemp(path.join(root, 'build/reference-proof-test-'));
	const directory = path.join(temporary, 'demos/lean-example');
	try
	{
		await mkdir(path.join(directory, 'runtime'), { recursive: true });
		const lean = 'theorem checked : True := True.intro\n';
		const receipt = {
			schemaVersion: 1, checker: 'fixture', theorems: ['checked']
			, sourceFiles: { 'Example.lean': { bytes: Buffer.byteLength(lean), sha256: createHash('sha256').update(lean).digest('hex') } }
		};
		await writeFile(path.join(directory, 'Example.lean'), lean);
		await writeFile(path.join(directory, 'runtime.mjs'), 'export const solve = input => input;');
		await writeFile(path.join(directory, 'benchmark.mjs'), '// fixture\n');
		await writeFile(path.join(directory, 'runtime/proof-audit.json'), JSON.stringify(receipt));
		const manifest = { demos: [{ slug: 'lean-example', theorems: ['missing'] }] };
		await writeFile(path.join(temporary, 'demos/manifest.json'), JSON.stringify(manifest));
		await assert.rejects(algorithmReferences(temporary), /missing missing/u);
		manifest.demos[0].theorems = ['checked'];
		await writeFile(path.join(temporary, 'demos/manifest.json'), JSON.stringify(manifest));
		assert.equal((await algorithmReferences(temporary)).length, 1);
		await writeFile(path.join(directory, 'Example.lean'), lean.replace('True.intro', 'False.elim'));
		await assert.rejects(algorithmReferences(temporary), /source hash/u);
	}
	finally
{ await rm(temporary, { recursive: true, force: true }); }
});

for(const [name, expected] of [
	['dijkstra', '[0,1,2,3]\n[]\n']
	, ['flood-fill', '[0,1]\n[0,1,2,3,4]\n[0,1]\n']
	, ['ownership', '[0,1]\n']
]){
	test(`the ${name} guide's unchanged example runs against compiled Lean`, async () => {
		const markdown = await text(`docs/concepts/${name}.md`);
		const examples = blocks(markdown, 'js');
		assert.equal(examples.length, 1);
		const source = examples[0].replace(/'\.\/(demos\/[a-z-]+\/runtime\.mjs)'/gu,
			(_, relative) => JSON.stringify(pathToFileURL(path.join(root, relative)).href));
		const result = spawnSync(process.execPath, ['--input-type=module'], {
			cwd: root, input: source, encoding: 'utf8', timeout: 30000
		});
		assert.ifError(result.error);
		assert.equal(result.status, 0, result.stdout + result.stderr);
		assert.equal(result.stdout, expected);
		assert.equal(result.stderr, '');
	});
}

test('concept guides preserve result scope, inventory semantics, and distribution differences', async () => {
	assert.match(await text('docs/concepts/dijkstra.md'), /does not establish a general equivalence between empty output and an unreachable target/u);
	assert.match(await text('docs/concepts/flood-fill.md'), /Capabilities are reusable and never consumed/u);
	const shared = await text('docs/concepts/shared-runtime.md');
	assert.match(shared, /separate runtime instances/u);
	assert.match(shared, /exact `@lean-bridge\/runtime` dependency/u);
	assert.match(shared, /not a global singleton/u);
	assert.match(await text('docs/concepts/ownership.md'), /Those values need no Lean-specific cleanup/u);
	assert.match(await text('docs/concepts/adoption.md'), /prepared release/u);
	assert.match(await text('docs/concepts/change-risk.md'), /always returns zero is also commutative/u);
});
