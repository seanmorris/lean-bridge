/**
 * Native failure injection bound to the original installed Composer package.
 *
 * @file
 */
import assert from 'node:assert/strict';
import { cp, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { sha256 } from '../../src/capsule/node.mjs';
import { nativeArtifactPaths, verifyNativeFiles } from '../../src/build/native-artifacts.mjs';
import { nativeGraphProjectionSources } from '../../src/build/native-graph-sources.mjs';
import { nativeCallbackHeader } from '../../src/build/native-component.mjs';
import { brokerHeader } from '../../src/backends/native/runtime-broker.mjs';
import { compileCallablePhpGraphPackageModel } from '../../src/backends/php/callable-graph-model.mjs';
import { generateCallablePhpGraphPackage } from '../../src/backends/php/callable-graph-package.mjs';
import { phpGraphLayoutProbe } from './php-graph-conversion-fixture.mjs';
import { runCopied } from './copied-fixture-install.mjs';
import { saveLakeFile } from './lake-workspace.mjs';

/**
 * Compile an isolated adapter with allocation faults and malformed native outputs.
 *
 * @param options - Original installed package and a separate probe directory.
 * @param options.work - Task-owned scratch directory.
 * @param options.installed - Unmodified relocated Composer installation.
 * @param options.php - Original installed package evidence.
 * @param options.nativeEvidence - Original compiled native asset identities.
 * @param options.environment - Explicit native compiler and Lean headers.
 */
export const preparePhpRecursiveNativeProbe = async ({ work, installed, php, nativeEvidence, environment }) => {
	const originalRoot = join(installed, 'vendor/lean-bridge/structured');
	await verifyNativeFiles(installed, php.deployment);
	const root = join(work, 'deployment/vendor/lean-bridge/structured');
	await cp(installed, join(work, 'deployment'), { recursive: true });
	const json = async path => JSON.parse(await readFile(join(originalRoot, path), 'utf8'));
	const model = await json('lean-bridge/component/model.json'), receipt = await json('lean-bridge/component/native-component.json');
	const adapter = await json('lean-bridge/native-c-adapter.json'), runtime = await json('lean-bridge/runtime.json');
	const projection = compileCallablePhpGraphPackageModel(model.bindingIr), evidence = nativeEvidence;
	const generated = generateCallablePhpGraphPackage(model.bindingIr, evidence);
	for(const [path, source] of Object.entries(generated)) assert.equal(await readFile(join(originalRoot, path), 'utf8'), source, path);
	const native = nativeGraphProjectionSources(model, receipt);
	native['src/php-graph-clear.c'] = projection.nativeReleaseSource;
	for(const [path, source] of Object.entries(native))
	{
		assert.equal(await readFile(join(originalRoot, 'lean-bridge/adapter', path), 'utf8'), source, path);
		assert.equal(sha256(source), adapter.files[path].sha256, path);
	}
	const headers = join(work, 'headers');
	const header = brokerHeader.replace('#ifdef __cplusplus\n}', nativeCallbackHeader + '\n#ifdef __cplusplus\n}');
	for(const [path, identity] of Object.entries(runtime.files).filter(([path]) => path.startsWith('include/')))
	{
		const bytes = path === 'include/lean_bridge_native_runtime.h' ? Buffer.from(header) : await readFile(join(environment.LEAN_BRIDGE_LEAN_PREFIX, path));
		assert.equal(sha256(bytes), identity.sha256, path); assert.equal(bytes.length, identity.bytes);
		await saveLakeFile(headers, path.slice(8), bytes);
	}
	const hooks = `#include <stddef.h>
#include <stdint.h>
#include <stdlib.h>
#include <assert.h>
static uint64_t fixture_live_allocations, fixture_attempts, fixture_target, fixture_retirements, fixture_poisoned;
static uint32_t fixture_mode;
static void *fixture_allocate(size_t size) { if (++fixture_attempts==fixture_target) return NULL; void *value=malloc(size); if(value)++fixture_live_allocations; return value; }
static void fixture_free(void *value) { assert(value && fixture_live_allocations); --fixture_live_allocations; free(value); }
#define LB_GRAPH_MALLOC fixture_allocate
#define LB_GRAPH_FREE fixture_free
void fixture_fault_reset(uint64_t target) { fixture_target=target;fixture_attempts=0; }
uint64_t fixture_fault_live(void) { return fixture_live_allocations; }
uint64_t fixture_fault_attempts(void) { return fixture_attempts; }
uint64_t fixture_fault_retired(void) { return fixture_retirements; }
uint64_t fixture_fault_poisoned(void) { return fixture_poisoned; }
void fixture_fault_mode(uint32_t mode) { fixture_mode=mode; }
`;
	const originalNative = Object.fromEntries(Object.entries(native).map(([path, value]) => [path, sha256(value)]));
	let source = native['src/native.c'];
	const change = (from, to) => { assert.equal(source.split(from).length, 2, from); source = source.replace(from, to); };
	const recursive = projection.functions.find(fn => fn.publicName === 'call_recursive'), make = projection.functions.find(fn => fn.publicName === 'make_recursive');
	change(recursive.native + '(', 'fixture_original_recursive(');
	change(make.native + '(', 'fixture_original_make_recursive(');
	change('void ' + projection.prefix + '_graph_retire(void) { lean_bridge_native_runtime_retire(); }', 'void ' + projection.prefix + '_graph_retire(void) { ++fixture_retirements; lean_bridge_native_runtime_retire(); }');
	const layout = phpGraphLayoutProbe(projection);
	source = hooks + source + '\n' + layout.c + `
uint32_t ${recursive.native}(const ${recursive.parameters[0].node.name} *input,const ${projection.prefix}_callback_${recursive.parameters[1].callback.key} *callback,${recursive.result.node.name} *output) {
  uint32_t status=fixture_original_recursive(input,callback,output);
  if(!status && fixture_mode) {
    uint32_t mode=fixture_mode;fixture_mode=0;++fixture_poisoned;
    assert(output->_bridge_owner && output->_bridge_release && fixture_live_allocations);
    if(mode==1) output->kind=UINT32_MAX;
    else if(mode==2 || mode==4) { output->kind=STRUCTURED_TREE_T_KIND_BRANCH;output->cases.branch.children.data=mode==2?output:(void*)1;output->cases.branch.children.length=mode==2?1:SIZE_MAX; }
    else if(mode==3) lean_bridge_native_runtime_retire();
    else assert(0);
  }
  return status;
}
uint32_t ${make.native}(const ${make.parameters[0].node.name} *input,uint64_t *output) {
  uint32_t status=fixture_original_make_recursive(input,output);
  if(!status && fixture_mode==5) { fixture_mode=0;++fixture_poisoned;${make.result.callback.dispose}(*output);*output=0; }
  return status;
}
`;
	native['src/native.c'] = source;
	for(const [path, contents] of Object.entries(native)) await saveLakeFile(work, path, contents);
	const libraries = join(root, 'native/linux-x64');
	await runCopied('/usr/bin/cc', ['-std=c11'
		, '-O2'
		, '-Wall'
		, '-Wextra'
		, '-Werror'
		, '-UNDEBUG'
		, '-fPIC'
		, '-shared'
		, '-pthread'
		, '-I' + join(work, 'include/detail')
		, '-I' + join(root, 'lean-bridge/component')
		, '-I' + headers
		, 'src/native.c'
		, 'src/php-graph-clear.c'
		, '-L' + libraries
		, '-Wl,--no-as-needed'
		, '-l:' + receipt.library
		, '-llean_bridge_native'
		, '-lleanshared'
		, '-Wl,--no-undefined'
		, '-Wl,-z,nodelete'
		, '-Wl,-rpath,$ORIGIN'
		, '-o'
		, join(libraries, adapter.library)], work, environment);
	const adapterHash = sha256(await readFile(join(libraries, adapter.library)));
	assert.notEqual(adapterHash, evidence.libraries[adapter.library]);
	const changedEvidence = { ...evidence, libraries: { ...evidence.libraries, [adapter.library]: adapterHash } };
	const changedFiles = generateCallablePhpGraphPackage(model.bindingIr, changedEvidence);
	for(const [path, contents] of Object.entries(changedFiles)) await saveLakeFile(root, path, contents);
	await saveLakeFile(work, 'layout.php', layout.php);
	const result = {
		schemaVersion: 1
		, work
		, installed
		, isolated: true
		, originalNative
		, layout: layout.count
		, originalAdapter: evidence.libraries[adapter.library]
		, instrumentedAdapter: adapterHash
		, originalSources: Object.fromEntries(Object.entries(generated).map(([path, value]) => [path, sha256(value)]))
		, instrumentedSources: Object.fromEntries(Object.entries(changedFiles).map(([path, value]) => [path, sha256(value)]))
		, instrumentedNative: Object.fromEntries(Object.entries(native).map(([path, value]) => [path, sha256(value)]))
		, runtimeHeadersVerified: true
	};
	assert.deepEqual((await nativeArtifactPaths(installed)).sort(), Object.keys(php.deployment).sort());
	await verifyNativeFiles(installed, php.deployment);
	return result;
};
