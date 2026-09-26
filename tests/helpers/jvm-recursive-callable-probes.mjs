/**
 * Bind recursive JVM failure probes to original installed Maven package bytes.
 *
 * @file
 */
import assert from 'node:assert/strict';
import { mkdtemp, readFile, cp, readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { canonicalJson, sha256 } from '../../src/capsule/node.mjs';
import { nativeArtifactPaths } from '../../src/build/native-artifacts.mjs';
import { nativeGraphProjectionSources } from '../../src/build/native-graph-sources.mjs';
import { compileJvmSources } from '../../src/build/compile-jvm-sources.mjs';
import { generateCallableJvmGraphPackage } from '../../src/backends/jvm/callable-graph-package.mjs';
import { compileCallableJvmGraphPackageModel } from '../../src/backends/jvm/callable-graph-model.mjs';
import { jvmGraphAssets } from '../../src/backends/jvm/copied-graph-assets.mjs';
import { runCopied, copiedCleanEnvironment } from './copied-fixture-install.mjs';
import { saveLakeFile } from './lake-workspace.mjs';
import { jvmGraphLayoutProbe } from './jvm-graph-conversion-fixture.mjs';
import { instrumentJvmRecursiveCallbacks } from './jvm-recursive-callable-instrument.mjs';
import { checkJvmRecursiveOwnership } from './jvm-recursive-callable-ownership.mjs';
import { checkJvmRecursiveLifetimes } from './jvm-recursive-callable-lifetimes.mjs';
import { assertJvmRecursiveFaultObservation } from './jvm-recursive-callable-faults.mjs';

const json = async file => JSON.parse(await readFile(file, 'utf8'));
const digest = async file => sha256(await readFile(file));
const hashes = files => Object.fromEntries(Object.entries(files).map(([path, source]) => [path, sha256(source)]));
const hooks = `#include <stddef.h>
#include <stdint.h>
#include <stdlib.h>
#include <assert.h>
static uint64_t fault_live, fault_attempts, fault_target, fault_poison, fault_poisoned, fault_retired;
static void *fault_allocate(size_t bytes) { if (++fault_attempts == fault_target) return NULL; void *p = malloc(bytes); if(p)++fault_live; return p; }
static void fault_free(void *p) { assert(p && fault_live); --fault_live; free(p); }
#define LB_GRAPH_MALLOC fault_allocate
#define LB_GRAPH_FREE fault_free
void fixture_fault_reset(uint64_t target) { fault_target=target; fault_attempts=0; }
uint64_t fixture_fault_live(void) { return fault_live; }
uint64_t fixture_fault_attempts(void) { return fault_attempts; }
void fixture_fault_poison(void) { fault_poison=1; }
uint64_t fixture_fault_poisoned(void) { return fault_poisoned; }
uint64_t fixture_fault_retired(void) { return fault_retired; }
`;
/**
 * Verify original installed bytes, then measure isolated native and host fault probes.
 *
 * @param options - Original installation plus a task-owned probe destination.
 * @param options.root - Separate workspace for instrumented copies.
 * @param options.extracted - Original unmodified installed JAR extraction.
 * @param options.installedJar - Original installed package archive.
 * @param options.receipt - Verified embedded package receipt.
 * @param options.headers - Runtime headers checked against the embedded receipt.
 * @param options.environment - Selected native and JVM compilers.
 * @param options.diagnostic - Progress callback.
 */
export const checkJvmRecursiveProbes = async ({ root, extracted, installedJar: jar, receipt, headers, environment, diagnostic }) => {
	const originalHash = await digest(jar), probe = join(root, 'faults');
	const metadata = join(extracted, 'META-INF/lean-bridge');
	assert.deepEqual(await json(join(metadata, 'package-receipt.json')), receipt);
	for(const [path, identity] of Object.entries(receipt.files)) assert.equal(await digest(join(extracted, path)), identity.sha256, path);
	const component = join(metadata, 'component'), nativeModel = await json(join(component, 'model.json')), componentReceipt = await json(join(component, 'native-component.json'));
	const compiled = await json(join(metadata, 'native-jvm.json')), adapter = await json(join(metadata, 'native-c-adapter.json')), runtime = await json(join(metadata, 'runtime.json'));
	assert.equal(sha256(canonicalJson(compiled)), receipt.compiledProjectionSha256);
	const model = compileCallableJvmGraphPackageModel(nativeModel.bindingIr);
	const regenerated = generateCallableJvmGraphPackage(nativeModel.bindingIr, compiled.evidence), sources = {};
	for(const path of Object.keys(compiled.files).filter(path => path.startsWith('src/') || path === 'binding-manifest.json'))
	{
		const source = await readFile(join(metadata, 'jvm', path), 'utf8');
		assert.equal(source, regenerated[path], path); assert.equal(sha256(source), compiled.files[path].sha256, path); sources[path] = source;
	}
	const native = nativeGraphProjectionSources(nativeModel, componentReceipt);
	for(const [path, source] of Object.entries(native)) assert.equal(sha256(source), adapter.files[path].sha256, path);
	for(const [path, identity] of Object.entries(runtime.files).filter(([path]) => path.startsWith('include/'))) assert.equal(await digest(join(headers, path.slice(8))), identity.sha256, path);
	const layout = jvmGraphLayoutProbe(model), recursive = model.functions.find(fn => fn.publicName === 'callRecursive');
	const retire = 'void ' + model.prefix + '_graph_retire(void) { lean_bridge_native_runtime_retire(); }';
	assert.equal(native['src/native.c'].split(retire).length, 2);
	const changedNative = {
		...native
		, 'src/native.c': hooks + native['src/native.c'].replace(retire, 'void ' + model.prefix + '_graph_retire(void) { ++fault_retired; lean_bridge_native_runtime_retire(); }')
			+ model.nativeReleaseSource + '\n' + layout.c
			+ '\nuint32_t fixture_live(void) { lean_bridge_native_snapshot state; lean_bridge_native_snapshot_read(&state); return state.live_identities; }\n'
			+ 'uint32_t fixture_poisoned_result(const ' + recursive.parameters[0].node.name + ' *input, const ' + model.prefix + '_callback_' + recursive.parameters[1].callback.key + ' *callback, ' + recursive.result.node.name + ' *output) { uint32_t status = ' + recursive.native + '(input,callback,output); if (!status && fault_poison) { assert(output->_bridge_owner && output->_bridge_release && fault_live); output->kind=UINT32_MAX; ++fault_poisoned; fault_poison=0; } return status; }\n'
	};
	for(const [path, source] of Object.entries(changedNative)) await saveLakeFile(probe, path, source);
	const resources = join(probe, 'resources'), libraries = join(resources, 'META-INF/lean-bridge/native/linux-x64');
	await cp(join(metadata, 'native/linux-x64'), libraries, { recursive: true });
	await runCopied(environment.CC ?? '/usr/bin/cc', ['-std=c11'
		, '-O2'
		, '-Wall'
		, '-Wextra'
		, '-Werror'
		, '-fPIC'
		, '-shared'
		, '-pthread'
		, '-I' + join(probe, 'include/detail')
		, '-I' + component
		, '-I' + headers
		, 'src/native.c'
		, '-L' + libraries
		, '-Wl,--no-as-needed'
		, '-l:' + componentReceipt.library
		, '-llean_bridge_native'
		, '-lleanshared'
		, '-Wl,--no-undefined'
		, '-Wl,-z,nodelete'
		, '-Wl,-rpath,$ORIGIN'
		, '-o'
		, join(libraries, adapter.library)], probe, environment);
	const adapterHash = await digest(join(libraries, adapter.library)); assert.notEqual(adapterHash, compiled.evidence.libraries[adapter.library]);
	const evidence = { ...compiled.evidence, libraries: { ...compiled.evidence.libraries, [adapter.library]: adapterHash } };
	const changed = instrumentJvmRecursiveCallbacks(sources, model.namespace), files = changed.files, prefix = 'src/main/java/' + model.namespace.replaceAll('.', '/');
	files[prefix + '/_CallableGraphNative.java'] = jvmGraphAssets({ ...model, functions: model.functions.map(fn => fn === recursive ? { ...fn, native: 'fixture_poisoned_result' } : fn) }, evidence, true);
	// Resource authentication remains intact; only the separate probe adapter's
	// expected digest and poisoned symbol are different from the installed package.
	for(const name of ['GraphFaultProbe', 'GraphFaultCases']) files[prefix + '/' + name + '.java'] = await readFile('tests/fixtures/structured-callable-consumers/jvm-recursive-' + name + '.java', 'utf8');
	files[prefix + '/GraphProbeSetup.java'] = `package ${model.namespace};
import java.lang.foreign.*;
import static java.lang.foreign.ValueLayout.*;
final class GraphProbeSetup {
 private GraphProbeSetup() { }
 ${layout.java}
 static void initialize() throws Throwable {
  _CallableGraphNative.resolve();
  var root=java.nio.file.Path.of(System.getProperty(${JSON.stringify('lean.bridge.jvm.native-library-v1.' + evidence.componentId + '.path')}));
  GraphFaultProbe.symbols=SymbolLookup.libraryLookup(root.resolve(${JSON.stringify(adapter.library)}),Arena.global());
  long count=(long)GraphFaultProbe.symbol("graph_fixture_layout_count",FunctionDescriptor.of(JAVA_LONG)).invokeExact();
  var actual=layouts(); var expected=expectedLayouts(); GraphFaultProbe.check(count==actual.length && count==expected.length);
  for(int i=0;i<actual.length;++i) {
   long value=(long)GraphFaultProbe.symbol("graph_fixture_layout",FunctionDescriptor.of(JAVA_LONG,JAVA_LONG)).invokeExact((long)i);
   GraphFaultProbe.check(actual[i]==value && value==expected[i]);
  }
 }
}
`;
	let javaValues = await readFile('tests/fixtures/structured-callable-consumers/java-values.java', 'utf8');
	javaValues = javaValues.slice(0, javaValues.lastIndexOf('}')) + `
 static Tree recursive(int seed) { return new TreeBranch(new Tree[] {new TreeLeaf(BigInteger.ONE.shiftLeft(128+seed)),new TreeBranch(new Tree[] {new TreeLeaf(BigInteger.valueOf(seed)),new TreeBranch(new Tree[0])})}); }
}
`;
	files[prefix + '/StructuredValues.java'] = 'package ' + model.namespace + ';\n' + javaValues;
	let kotlinValues = await readFile('tests/fixtures/structured-callable-consumers/kotlin-values.kt', 'utf8');
	kotlinValues = kotlinValues.slice(0, kotlinValues.lastIndexOf('}')) + `
 fun recursive(seed: Int): Tree = TreeBranch(arrayOf(TreeLeaf(BigInteger.ONE.shiftLeft(128+seed)),TreeBranch(arrayOf(TreeLeaf(BigInteger.valueOf(seed.toLong())),TreeBranch(emptyArray())))))
}
`;
	files['src/main/kotlin/' + model.namespace.replaceAll('.', '/') + '/kotlin/StructuredValues.kt'] = 'package ' + model.namespace + '.kotlin\n' + kotlinValues;
	for(const [path, source] of Object.entries(files)) await saveLakeFile(probe, path, source);
	diagnostic('compile isolated Java/Kotlin fault probes (' + layout.count + ' layout values)');
	await compileJvmSources({ root: probe, files, environment });
	const kotlin = join(dirname(dirname(environment.LEAN_BRIDGE_KOTLINC)), 'lib/kotlin-stdlib.jar');
	const observations = [];
	for(const profile of ['java', 'kotlin']) for(const mode of ['faults', 'poison'])
	{
		const temp = await mkdtemp(join(probe, 'native-temp-'));
		const result = await runCopied(environment.LEAN_BRIDGE_JAVA, ['--enable-native-access=ALL-UNNAMED'
			, '-Xmx512m'
			, '-Xss512k'
			, '-Djava.io.tmpdir=' + temp
			, '-classpath'
			, 'classes:resources:' + kotlin
			, model.namespace + '.GraphFaultCases'
			, profile
			, mode], probe, copiedCleanEnvironment);
		assert.equal(result.stderr, ''); assert.deepEqual(await readdir(temp), []);
		const observation = JSON.parse(result.stdout);
		assertJvmRecursiveFaultObservation({ ...observation, mode, profile });
		observations.push({ profile, mode, ...observation });
		diagnostic('fault probe ' + profile + '/' + mode + ': ' + observation.checks + ' checks');
	}
	const input = { input: probe, model, sources: files, environment, diagnostic };
	const ownership = await checkJvmRecursiveOwnership({ ...input, root: join(root, 'ownership') });
	const lifetimes = await checkJvmRecursiveLifetimes({ ...input, root: join(root, 'lifetimes') });
	assert.equal(await digest(jar), originalHash);
	for(const path of await nativeArtifactPaths(extracted)) if(path !== 'META-INF/lean-bridge/package-receipt.json') assert.equal(await digest(join(extracted, path)), receipt.files[path].sha256, path);
	return {
		originalHash
		, layout: layout.count
		, originalSources: hashes(sources)
		, instrumentedSources: hashes(files)
		, nativeSources: hashes(native)
		, instrumentedNative: hashes(changedNative)
		, originalAdapter: compiled.evidence.libraries[adapter.library]
		, instrumentedAdapter: adapterHash
		, edits: changed.edits
		, observations
		, ownership
		, lifetimes
		, installedPackagesUnchanged: true
		, isolatedProbes: true
	};
};
