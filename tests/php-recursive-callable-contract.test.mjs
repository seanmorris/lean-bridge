/**
 * Native PHP recursive callback layout, generation and rejection contracts.
 *
 * @file
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkPhpRecursiveCold } from './helpers/php-recursive-callable-cold.mjs';
import { phpRecursiveCallableDocumentation } from './helpers/php-recursive-callable-docs.mjs';
import { canonicalJson, sha256 } from '../src/capsule/node.mjs';
import { compileCallablePhpGraphPackageModel as model } from '../src/backends/php/callable-graph-model.mjs';
import { generateCallablePhpGraphPackage as generate } from '../src/backends/php/callable-graph-package.mjs';
import { compilePhpPackageModel } from '../src/backends/php/generate.mjs';
import { generateCopiedPhpGraphPackage } from '../src/backends/php/copied-graph-package.mjs';
import { generateCopiedPhpPackage } from '../src/backends/php/copied-values.mjs';
import { auditPhpPackage } from '../src/backends/php/package-audit.mjs';
import { compileNativeGraphProjection } from '../src/build/native-graph-projection.mjs';
import { nativeRecursiveCallableReviewedIr } from './helpers/native-recursive-callable-fixture.mjs';
import { nativeRecursiveReviewedIr } from './helpers/native-recursive-reviewed.mjs';
import { jvmRecursiveMixedFixture } from './helpers/jvm-recursive-callable-mixed.mjs';
import { callableReviewedIr } from './helpers/callable-fixture.mjs';
import { phpCallableSignatures } from './helpers/php-callable-fixture.mjs';
import { structuredCallableReviewedIr } from './helpers/structured-callable-fixture.mjs';
import { phpStructuredRegressionFixtures } from './helpers/php-structured-callable-regression.mjs';

test('Composer-only and combined native callback targets share the exact graph layout', () => {
	const ir = nativeRecursiveCallableReviewedIr(), compiled = compileNativeGraphProjection(ir, ['php-native']);
	assert.equal(compiled.namespace, 'LeanStructured'); assert.equal(compiled.functions.length, 33); assert.equal(compiled.callbacks.size, 18);
	for(const target of ['c', 'cpp', 'pypi', 'cargo', 'rubygems', 'cpan', 'nuget', 'maven'])
		assert.equal(compileNativeGraphProjection(ir, [target, 'php-native'], 'LeanBridge::Structured').layoutSha256, compiled.layoutSha256);
	for(const targets of [[], ['php-native', 'php-native'], ['php-native', 'wit-wasi'], ['php-wasm'], ['unknown']])
		assert.throws(() => compileNativeGraphProjection(ir, targets), { code: 'native-graph-projection-unavailable' });
});
test('both recursive corpora produce deterministic complete audited packages', async () => {
	for(const ir of [nativeRecursiveCallableReviewedIr(), (await jvmRecursiveMixedFixture()).ir])
	{
		const before = structuredClone(ir), files = generate(ir), manifest = JSON.parse(files['binding-manifest.json']);
		assert.deepEqual(ir, before); assert.deepEqual(generate(ir), files); assert.equal(auditPhpPackage(ir, files), true);
		assert.equal(manifest.generator.id, 'lean-wasm/php-callable-graph'); assert.ok(manifest.exports.includes('LeanStructured\\LeanClosure'));
		assert.throws(() => auditPhpPackage(ir, files, { integerBits: 32 }), { code: 'unsupported-copied-php-profile' });
		for(const [path, source] of Object.entries(files).filter(([path]) => path !== 'binding-manifest.json'))
		{
			const changed = { ...files, [path]: source + '\n/* resigned drift */\n' };
			changed['binding-manifest.json'] = canonicalJson({ ...manifest, filesSha256: { ...manifest.filesSha256, [path]: sha256(changed[path]) } });
			assert.throws(() => auditPhpPackage(ir, changed), { code: 'copied-graph-source-drift' }, path);
		}
		for(const field of ['publicFiles', 'exports', 'aliases']) assert.throws(() => auditPhpPackage(ir, { ...files, 'binding-manifest.json': canonicalJson({ ...manifest, [field]: [] }) }), { code: 'copied-graph-source-drift' });
		for(const path of manifest.publicFiles) assert.doesNotMatch(files[path], /\bFFI\b|CallableRuntime|uintptr_t|signatureId|_graph_/);
	}
});
test('recursive generation preserves all primitive and acyclic public names', async () => {
	const combined = model((await jvmRecursiveMixedFixture()).ir);
	assert.equal(combined.functions.length, 98); assert.equal(combined.callbacks.size, 59);
	for(const ir of [callableReviewedIr(phpCallableSignatures), structuredCallableReviewedIr()])
	{
		const old = compilePhpPackageModel(ir);
		for(const fn of old.copied.surface.functions) assert.equal(combined.functions.find(current => current.declaration.name === fn.declaration.name)?.publicName, fn.field);
	}
	const wide = combined.functions.find(fn => fn.publicName === 'wide_unit').parameters[0].callback;
	assert.equal(wide.parameters.length, 16); assert.equal(wide.result.ref.name, 'unit');
});
test('recursive callbacks preserve unsupported ownership and effect rejections', () => {
	for(const change of [
		ir => { ir.types.find(type => type.kind === 'callback').callable.resultMode = 'promise'; }
		, ir => { ir.types.find(type => type.kind === 'callback').callable.parameters[0].ownership = 'borrow'; }
		, ir => { ir.types.find(type => type.name === 'Payload').fields[0].type = { kind: 'named', id: ir.types.find(type => type.kind === 'callback').id }; }
		, ir => { ir.types.find(type => type.name === 'Payload').name = 'LeanClosure'; }
	]) { const ir = nativeRecursiveCallableReviewedIr(); change(ir); assert.throws(() => model(ir)); }
	const duplicate = nativeRecursiveCallableReviewedIr(); duplicate.declarations[0].name = 'SameName'; duplicate.declarations[1].name = 'same_name';
	assert.throws(() => model(duplicate), /Reserved or duplicate/);
});
test('native asset metadata is closed and bound to the exact callback layout', () => {
	const ir = nativeRecursiveCallableReviewedIr(), compiled = model(ir), hash = 'a'.repeat(64);
	const evidence = {
		componentId: ir.component.id
		, componentReceiptSha256: hash
		, runtimeIdentity: hash
		, library: 'libstructured.so'
		, copiedGraph: { schemaVersion: 1, layoutSha256: compiled.layoutSha256 }
		, libraries: Object.fromEntries(['libstructured.so', 'libcomponent.so', 'libleanshared.so', 'liblean_bridge_native.so'].map(name => [name, hash]))
	};
	assert.equal(auditPhpPackage(ir, generate(ir, evidence)), true);
	for(const change of [{ componentId: 'wrong' }
		, { runtimeIdentity: 'bad' }
		, { extra: true }
		, { library: '../libstructured.so' }
		, { copiedGraph: { ...evidence.copiedGraph, layoutSha256: '0'.repeat(64) } }
		, { copiedGraph: { ...evidence.copiedGraph, extra: true } }
		, { libraries: {} }
		, { libraries: { ...evidence.libraries, '../liboutside.so': hash } }]) assert.throws(() => generate(ir, { ...evidence, ...change }));
});
test('previous copied and acyclic generated package bytes are unchanged', () => {
	// Frozen at e17c1fe, before recursive PHP callbacks. Compare complete packages.
	const baseline = {
		callables: '05bd3efe59969c07748214ff56c8c7c15efe47ada9238de0b88d23eebef952f8'
		, collections: '41829728f64a2046aedab1743e96772303f443fab3c370e87335c33c5eff80e0'
		, compounds: '274fad95a924a4518d60ed56511602e7e1d4b17544b0b4d9943c55b80b2fdd95'
		, lists: 'acb684209f87044798138a85ea47708f4e9c5b2f00b548ca0f2da08decc4cf50'
		, aliases: 'c22cda84977458eb81af7ca1dde7add4286a07e44e20543209438fdd6b428cb8'
		, variants: '60850b5bac8e10382afa7b5673e3a95b95854be996b8406034697a56ffce96fc'
		, structured: 'ab738d5e1998662cced5b594978d81b879aa4700d37cc11b428f67a1a2915a38'
		, recursive: '7632e9b6a61cbde8a43c88e9191312f52d8f55cc3ff66d5e4b570908af3c42f7'
	};
	const current = { ...Object.fromEntries(Object.entries({ ...phpStructuredRegressionFixtures, structured: structuredCallableReviewedIr }).map(([name, ir]) => [name, sha256(canonicalJson(generateCopiedPhpPackage(ir())))])), recursive: sha256(canonicalJson(generateCopiedPhpGraphPackage(nativeRecursiveReviewedIr()))) };
	assert.deepEqual(current, baseline);
});

const php = process.env.LEAN_BRIDGE_PHP ?? '/usr/bin/php';
test('weak and strict recursive callers reject invalid input with FFI absent', { skip: !existsSync(php) }, async t => {
	const root = await mkdtemp(join(tmpdir(), 'lean-bridge-php-recursive-cold-'));
	t.after(() => rm(root, { recursive: true, force: true }));
	const reports = await checkPhpRecursiveCold(root, php);
	assert.equal(reports.length, 4);
});

test('published recursive author and consumer examples are independently executable', async () => {
	const documentation = await phpRecursiveCallableDocumentation();
	assert.match(documentation.example.source, /require __DIR__ \. '\/vendor\/autoload\.php';/u);
	assert.match(documentation.example.source, /finally/u);
	assert.equal(documentation.example.stdout, '42\n20\n42\n');
});

test('PHP CI requires recursive acceptance and retains both original installed reports', async () => {
	const workflow = await readFile('.github/workflows/consumer-matrix.yml', 'utf8');
	const pkg = JSON.parse(await readFile('package.json', 'utf8'));
	assert.equal(pkg.scripts['test:php-recursive-callables'], 'LEAN_BRIDGE_PHP_RECURSIVE_CALLABLE_TEST=1 node --test --test-concurrency=1 tests/php-recursive-callable-contract.test.mjs tests/php-recursive-callables.test.mjs');
	assert.ok(workflow.includes('          npm run test:php-recursive-callables\n'));
	assert.ok(workflow.includes(' && npm run test:php-recursive-callables && '));
	for(const variant of ['recursive', 'mixed'])
	{
		assert.ok(workflow.includes('test -s build/recursive-callables/php-' + variant + '.json\n'));
		assert.ok(workflow.includes('            build/recursive-callables/php-' + variant + '.json\n'));
	}
});
