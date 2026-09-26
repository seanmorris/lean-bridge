/**
 * Typed Java/Kotlin recursive callables, exact public packages and native admission.
 *
 * @file
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { canonicalJson, sha256 } from '../src/capsule/node.mjs';
import { compileCallableJvmGraphPackageModel as model } from '../src/backends/jvm/callable-graph-model.mjs';
import { generateCallableJvmGraphSources as sources } from '../src/backends/jvm/callable-graph-calls.mjs';
import { generateCallableJvmGraphPackage } from '../src/backends/jvm/callable-graph-package.mjs';
import { generateCopiedJvmGraphPackage } from '../src/backends/jvm/copied-graph-package.mjs';
import { jvmGraphAssets } from '../src/backends/jvm/copied-graph-assets.mjs';
import { compileCopiedJvmModel } from '../src/backends/jvm/copied-model.mjs';
import { compileCallableDotnetGraphPackageModel } from '../src/backends/dotnet/callable-graph-model.mjs';
import { compileNativeGraphProjection } from '../src/build/native-graph-projection.mjs';
import { auditManagedBindingPackage } from '../src/backends/managed/package-audit.mjs';
import { nativeRecursiveCallableReviewedIr } from './helpers/native-recursive-callable-fixture.mjs';
import { nativeRecursiveReviewedIr } from './helpers/native-recursive-reviewed.mjs';
import { callableReviewedIr } from './helpers/callable-fixture.mjs';
import { structuredCallableReviewedIr } from './helpers/structured-callable-fixture.mjs';
import { jvmRecursiveMixedFixture } from './helpers/jvm-recursive-callable-mixed.mjs';

const assets = (model, evidence) => jvmGraphAssets(model, evidence, true);

test('Maven-only recursive callables share layouts with every admitted native backend', () => {
	const ir = nativeRecursiveCallableReviewedIr(), compiled = compileNativeGraphProjection(ir, ['maven']);
	assert.equal(compiled.namespace, 'org.leanbridge.structured');
	assert.equal(compiled.functions.length, 33); assert.equal(compiled.callbacks.size, 18);
	for(const target of ['c', 'cpp', 'pypi', 'cargo', 'rubygems', 'cpan', 'nuget'])
		assert.equal(compileNativeGraphProjection(ir, [target, 'maven'], 'LeanBridge::Structured').layoutSha256, compiled.layoutSha256);
	for(const targets of [[], ['maven', 'maven'], ['maven', 'php-native'], ['maven', 'wit-wasi'], ['unknown']])
		assert.throws(() => compileNativeGraphProjection(ir, targets), { code: 'native-graph-projection-unavailable' });
});

test('recursive JVM public audit rejects source drift while allowing FFM-like copied names', () => {
	for(const name of ['Payload', 'MemorySegment', 'Thread', 'ClosureLease'])
	{
		const ir = nativeRecursiveCallableReviewedIr(); ir.types.find(type => type.name === 'Payload').name = name;
		const files = generateCallableJvmGraphPackage(ir), manifest = JSON.parse(files['binding-manifest.json']);
		assert.deepEqual(generateCallableJvmGraphPackage(ir), files);
		assert.equal(manifest.generator, 'jvm-callable-graph-v1');
		assert.deepEqual(auditManagedBindingPackage(ir, files, 'jvm').publicFiles, manifest.publicFiles);
		for(const path of manifest.publicFiles.filter(path => /\/(?:Api|Fn.*)\.(?:java|kt)$/.test(path)))
			assert.throws(() => auditManagedBindingPackage(ir, { ...files, [path]: files[path] + '\n// unverified source\n' }, 'jvm'), { code: 'private-ffi-public' });
		assert.throws(() => auditManagedBindingPackage(ir, { ...files, 'binding-manifest.json': JSON.stringify({ ...manifest, publicFiles: [] }) }, 'jvm'), { code: 'private-ffi-public' });
	}
});

test('all nineteen primitive callback families and wide Unit signatures coexist with recursive values', async () => {
	const fixture = await jvmRecursiveMixedFixture(), compiled = model(fixture.ir);
	assert.equal(compiled.functions.length, 98); assert.equal(compiled.callbacks.size, 59);
	const wide = compiled.functions.find(fn => fn.publicName === 'wideUnit').parameters[0].callback;
	assert.equal(wide.parameters.length, 16); assert.equal(wide.result.ref.name, 'unit');
	const files = generateCallableJvmGraphPackage(fixture.ir);
	assert.match(files['src/main/java/org/leanbridge/structured/' + wide.publicName + '.java'], /void invoke\(long arg0,[^\n]*long arg15\)/);
	assert.match(files['src/main/kotlin/org/leanbridge/structured/kotlin/Api.kt'], /fun `wideUnit`\([^\n]+\): kotlin.Unit/);
	auditManagedBindingPackage(fixture.ir, files, 'jvm');
});

test('callable admission preserves the previous copied-only JVM package bytes', () => {
	assert.equal(sha256(canonicalJson(generateCopiedJvmGraphPackage(nativeRecursiveReviewedIr())))
		, '7816866ada03a9092ee606dae2645adb0158ab8ce820585a86133cc815b7f25f');
});

test('the JVM recursive model retains all original exports and both copied catalogs', () => {
	const ir = nativeRecursiveCallableReviewedIr(), original = structuredClone(ir), compiled = model(ir);
	assert.deepEqual(ir, original);
	assert.equal(compiled.functions.length, 33); assert.equal(compiled.callbacks.size, 18);
	assert.equal(compiled.layoutSha256, compileCallableDotnetGraphPackageModel(ir).layoutSha256);
	assert.deepEqual(compiled.functions.map(fn => fn.definition.id), ir.declarations.map(fn => fn.id));
	for(const callback of compiled.callbacks.values()) for(const node of [...callback.parameters, callback.result])
	{
		assert.ok(node.publicType); assert.ok(compiled.kotlin.publicTypes[node.id]);
	}
	const recursive = compiled.functions.find(fn => fn.publicName === 'callRecursive');
	assert.equal(recursive.parameters[0].node.publicType, 'Tree');
	assert.match(compiled.kotlin.publicTypes[recursive.parameters[0].node.id], /kotlin.*Tree/);
});

test('synthetic payload catalogs cannot conceal invalid public function names', () => {
	for(const name of ['wait', 'getClass', 'class', 'clone', 'toString'])
	{
		const ir = nativeRecursiveCallableReviewedIr(); ir.declarations[0].name = name;
		assert.throws(() => model(ir), /Reserved or duplicate/);
	}
	const duplicate = nativeRecursiveCallableReviewedIr(); duplicate.declarations[0].name = 'same_name'; duplicate.declarations[1].name = 'sameName';
	assert.throws(() => model(duplicate), /Reserved or duplicate/);
	const keyword = nativeRecursiveCallableReviewedIr(); keyword.declarations[0].parameters[0].name = 'class';
	assert.equal(model(keyword).functions[0].parameterNames[0], 'class_');
	keyword.declarations[0].parameters[1].name = 'class_';
	assert.throws(() => model(keyword), /collide after keyword escaping/);
	const helper = nativeRecursiveCallableReviewedIr(); helper.declarations[0].parameters[0].name = '_CallableGraphRuntime';
	assert.equal(model(helper).functions[0].parameterNames[0], '_CallableGraphRuntime_');
	helper.declarations[0].parameters[1].name = '_CallableGraphRuntime_';
	assert.throws(() => model(helper), /collide after keyword escaping/);
});

test('primitive SAM and function names remain identical inside a recursive package', () => {
	const primitive = callableReviewedIr(), expected = compileCopiedJvmModel(primitive), ir = nativeRecursiveCallableReviewedIr();
	ir.types.push(...primitive.types); ir.producers.push(...primitive.producers); ir.declarations.push(...primitive.declarations);
	const compiled = model(ir);
	for(const fn of expected.surface.functions) assert.equal(compiled.functions.find(current => current.definition.id === fn.declaration.id).publicName, fn.publicName);
	for(const callback of expected.surface.callbacks.values()) assert.equal(compiled.callbacks.get(callback.type.id).publicName, callback.publicName);
});

test('the JVM recursive model rejects resource-like callable fields and async delivery', () => {
	for(const change of [
		ir => { ir.types.find(type => type.kind === 'callback').callable.resultMode = 'promise'; }
		, ir => { ir.types.find(type => type.kind === 'callback').callable.parameters[0].ownership = 'borrow'; }
		, ir => { ir.types.find(type => type.name === 'Payload').fields[0].type = { kind: 'named', id: ir.types.find(type => type.kind === 'callback').id }; }
	]) { const ir = nativeRecursiveCallableReviewedIr(); change(ir); assert.throws(() => model(ir)); }
});

test('both public projections retain typed callback APIs without exposing FFM', () => {
	const model = sources(nativeRecursiveCallableReviewedIr());
	for(const file of model.publicFiles)
	{
		assert.ok(model.files[file], file);
		assert.doesNotMatch(model.files[file], /\b(?:MemorySegment|MemoryLayout|SymbolLookup|Arena|Linker)\b/);
	}
	assert.equal(new Set(model.publicFiles).size, model.publicFiles.length);
	assert.equal(new Set(model.internalFiles).size, model.internalFiles.length);
	const runtime = Object.entries(model.files).find(([path]) => path.endsWith('/_CallableGraphRuntime.java'))[1];
	assert.doesNotMatch(runtime, /undefined/);
	for(const cb of model.callbacks.values())
	{
		assert.ok(runtime.includes('borrowJava' + cb.index)); assert.ok(runtime.includes('invokeJava' + cb.index));
		if(cb.structured)
		{ assert.ok(runtime.includes('borrowKotlin' + cb.index)); assert.ok(runtime.includes('invokeKotlin' + cb.index)); }
	}
	const old = compileCopiedJvmModel(structuredCallableReviewedIr());
	for(const cb of old.surface.callbacks.values()) assert.equal(model.callbacks.get(cb.type.id).publicName, cb.publicName);
	assert.match(runtime, /MemorySegment\.copy\(reply, 0, _GraphRuntime\.checked\(output/);
	assert.match(runtime, /new CallbackFrame\(catalog, scope, links\.lifecycle\(\)\)/);
	assert.match(runtime, /long value = token; token = 0;/);
	assert.match(runtime, /Thread\.currentThread\(\) != thread/);
});

test('the scoped JVM callable loader keeps exact asset hashes and long-token descriptors', () => {
	const model = sources(nativeRecursiveCallableReviewedIr()), hash = 'a'.repeat(64);
	const evidence = {
		componentId: model.ir.component.id
		, library: 'lib' + model.prefix + '.so'
		, runtimeIdentity: hash
		, componentReceiptSha256: hash
		, libraries: { ['lib' + model.prefix + '.so']: hash, 'libleanshared.so': hash, 'liblean_bridge_native.so': hash, 'libcomponent.so': hash }
	};
	const source = assets(model, evidence);
	assert.match(source, /volatile Links targets/); assert.match(source, /static Links resolve\(\)/);
	assert.match(source, /verifyResource\("libstructured.so",/);
	assert.match(source, /Conflicting builds of the same Lean component/);
	assert.match(source, /Incompatible Lean runtime identities/);
	assert.match(source, /_CallableGraphNative\.class\.getResourceAsStream/);
	for(const cb of model.callbacks.values())
	{
		assert.ok(source.includes(JSON.stringify(cb.call)));
		assert.ok(source.includes(JSON.stringify(cb.dispose) + ', java.lang.foreign.FunctionDescriptor.ofVoid(java.lang.foreign.ValueLayout.JAVA_LONG)'));
	}
	for(const fn of model.functions) assert.equal(source.split(JSON.stringify(fn.native)).length, 2);
	assert.doesNotMatch(source, /resolved\[|_GraphRuntime\.Target\[/);
	assert.match(assets(model, null), /Build a prepared Maven release/);
	assert.throws(() => assets(model, { ...evidence, runtimeIdentity: 'bad' }));
});
