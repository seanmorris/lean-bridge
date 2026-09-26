/**
 * Original NuGet source and asset verification with isolated recursive failure probes.
 *
 * @file
 */
import assert from 'node:assert/strict';
import { readFile, mkdir, cp } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { sha256, canonicalJson } from '../../src/capsule/node.mjs';
import { compileCallableDotnetGraphPackageModel } from '../../src/backends/dotnet/callable-graph-model.mjs';
import { nativeGraphProjectionSources } from '../../src/build/native-graph-sources.mjs';
import { dotnetGraphLayoutProbe } from './dotnet-graph-probes.mjs';
import { saveLakeFile } from './lake-workspace.mjs';
import { copiedCleanEnvironment, runCopied } from './copied-fixture-install.mjs';
import { checkDotnetStructuredCallableTypes } from './dotnet-structured-callable-types.mjs';
import { checkDotnetRecursiveTypes } from './dotnet-recursive-callable-types.mjs';
import { checkDotnetRecursiveOwnership } from './dotnet-recursive-callable-ownership.mjs';

const json = async path => JSON.parse(await readFile(path, 'utf8'));
const digest = async path => sha256(await readFile(path));
const hashes = files => Object.fromEntries(Object.entries(files).map(([name, text]) => [name, sha256(text)]));
const fixture = name => readFile('tests/fixtures/structured-callable-consumers/' + name, 'utf8');
const project = files => '<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net8.0</TargetFramework><Nullable>enable</Nullable><ImplicitUsings>disable</ImplicitUsings><AllowUnsafeBlocks>true</AllowUnsafeBlocks><TreatWarningsAsErrors>true</TreatWarningsAsErrors><EnableNETAnalyzers>false</EnableNETAnalyzers><EnableDefaultCompileItems>false</EnableDefaultCompileItems></PropertyGroup><ItemGroup>' + Object.keys(files).filter(name => name.endsWith('.cs')).map(name => '<Compile Include="' + name + '"/>').join('') + '</ItemGroup></Project>\n';

const nativeProbe = (library, layout) => `using System;
using System.Runtime.InteropServices;
using LeanBridge.Structured.Interop;
internal static unsafe class NativeProbe {
private static readonly nint Handle = NativeLibrary.Load(${JSON.stringify(library)});
internal const int LayoutCount = ${layout.count};
internal static uint Live() => ((delegate* unmanaged[Cdecl]<uint>)NativeLibrary.GetExport(Handle, "fixture_live"))();
internal static void LayoutCheck() {
 var count = ((delegate* unmanaged[Cdecl]<nuint>)NativeLibrary.GetExport(Handle, "graph_fixture_layout_count"))();
 var expected = Layout(); if(count != (nuint)expected.Length)throw new Exception("layout count");
 for(nuint i=0;i<count;++i)if(((delegate* unmanaged[Cdecl]<nuint,nuint>)NativeLibrary.GetExport(Handle,"graph_fixture_layout"))(i)!=expected[i])throw new Exception("layout offset "+i);
}
${layout.source}
}
`;

// These hooks affect an isolated adapter copy. Original installed assets and
// managed source remain byte-identical before and after every probe.
const hooks = `#include <stdint.h>
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
const live = 'uint32_t fixture_live(void) { lean_bridge_native_snapshot state; lean_bridge_native_snapshot_read(&state); return state.live_identities; }\n';

const instrument = (original, model) => {
	const files = { ...original }, edits = {};
	const replace = (file, key, pattern, replacement, minimum = 1) => {
		const count = [...files[file].matchAll(pattern)].length;
		assert.ok(count >= minimum, key + ': ' + count); edits[key] = count;
		files[file] = files[file].replace(pattern, replacement);
	};
	replace('Runtime.cs', 'checkpoints', /internal static void Checkpoint\(\) \{ \}/g, 'internal static void Checkpoint() { global::FaultProbe.Tick(); }');
	replace('Runtime.cs', 'allocation', /global::System.Runtime.InteropServices.NativeMemory.AllocZeroed/g, 'global::FaultProbe.Allocate');
	replace('Runtime.cs', 'release', /global::System.Runtime.InteropServices.NativeMemory.Free/g, 'global::FaultProbe.Free', 2);
	replace('Runtime.cs', 'scopes', / {8}CheckOnly = checkOnly;/g, '        global::FaultProbe.Tick(); CheckOnly = checkOnly; global::FaultProbe.Scopes++;');
	replace('Runtime.cs', 'closeScopes', /allocations.Clear\(\); hosts.Clear\(\); outputs.Clear\(\);/g, 'allocations.Clear(); hosts.Clear(); outputs.Clear(); global::FaultProbe.Scopes--;');
	replace('Runtime.cs', 'conversion', /(internal static [^\n]+ (?:Read|Write)\d+\([^\n]+\)\n {4}\{)/g, '$1\n        global::FaultProbe.Tick();', 40);
	replace('Runtime.cs', 'clear', / {12}\(\(delegate\* unmanaged\[Cdecl\]<nint, void>\)savedRelease\)\(savedOwner\);/g, '        { ((delegate* unmanaged[Cdecl]<nint, void>)savedRelease)(savedOwner); global::FaultProbe.Clears++; }');
	replace('Calls.cs', 'frames', /internal CallbackFrame\(GraphScope scope\) \{ Replies = scope; \}/g, 'internal CallbackFrame(GraphScope scope) { global::FaultProbe.Tick(); Replies = scope; global::FaultProbe.Frames++; }');
	replace('Calls.cs', 'roots', /internal void Keep\(global::System.Delegate callback\) => roots.Add\(callback\);/g, 'internal void Keep(global::System.Delegate callback) { global::FaultProbe.Tick(); roots.Add(callback); global::FaultProbe.Roots++; global::FaultProbe.Tick(); }');
	replace('Calls.cs', 'closeFrames', /global::System.GC.KeepAlive\(roots\); roots.Clear\(\);/g, 'global::System.GC.KeepAlive(roots); global::FaultProbe.Roots -= roots.Count; roots.Clear(); global::FaultProbe.Frames--;');
	replace('Calls.cs', 'adopt', / {8}token = value; value = 0;/g, '        global::FaultProbe.Tick(); token = value; value = 0;');
	replace('Calls.cs', 'returned', /( {12}var status = [^\n]+;)/g, '$1\n            global::FaultProbe.Tick();', 40);
	const recursive = model.functions.find(fn => fn.publicName === 'CallRecursive');
	replace('Calls.cs', 'poisonedSymbol', new RegExp(JSON.stringify(recursive.native), 'g'), '"fixture_poisoned_result"');
	return { files, edits, recursive };
};

/**
 * Validate installed sources, then instrument separate task-owned copies.
 *
 * @param options - Original installed archive and isolated probe inputs.
 * @param options.root - Task-owned directory for instrumented copies.
 * @param options.installed - Unchanged original NuGet installation.
 * @param options.runtimeHeaders - Runtime headers verified against the installed manifest.
 * @param options.dotnet - Absolute .NET SDK driver.
 * @param options.environment - Explicit native compiler environment.
 */
export const checkDotnetRecursiveProbes = async ({ root, installed, runtimeHeaders, dotnet, environment }) => {
	const component = join(installed, 'lean-bridge/component');
	const nativeModel = await json(join(component, 'model.json'));
	const receipt = await json(join(component, 'native-component.json'));
	const adapter = await json(join(installed, 'lean-bridge/native-c-adapter.json'));
	const runtime = await json(join(installed, 'lean-bridge/runtime.json'));
	const packageReceipt = await json(join(installed, 'lean-bridge/package-receipt.json'));
	const compiled = await json(join(installed, 'lean-bridge/native-dotnet.json'));
	assert.equal(packageReceipt.bindingIrSha256, nativeModel.bindingIrSha256);
	assert.equal(adapter.componentReceiptSha256, sha256(canonicalJson(receipt)));
	const model = compileCallableDotnetGraphPackageModel(nativeModel.bindingIr);
	const native = nativeGraphProjectionSources(nativeModel, receipt);
	for(const [name, text] of Object.entries(native)) assert.equal(sha256(text), adapter.files[name].sha256, name);
	for(const [name, identity] of Object.entries(runtime.files).filter(([name]) => name.startsWith('include/')))
		assert.equal(await digest(join(runtimeHeaders, name.slice(8))), identity.sha256, name);
	const original = {};
	for(const name of ['Values.cs', 'Runtime.cs', 'Api.cs', 'Calls.cs'])
	{
		const path = 'src/' + model.assembly + '/' + name;
		original[name] = await readFile(join(installed, 'lean-bridge/dotnet', path), 'utf8');
		assert.equal(sha256(original[name]), compiled.files[path].sha256, path);
	}
	const libraries = join(installed, 'runtimes/linux-x64/native');
	for(const [name, hash] of Object.entries(compiled.evidence.libraries)) assert.equal(await digest(join(libraries, name)), hash);
	const layout = dotnetGraphLayoutProbe(model);
	const env = work => ({ ...copiedCleanEnvironment, DOTNET_ROOT: dirname(dotnet), DOTNET_CLI_HOME: join(work, 'home'), DOTNET_NOLOGO: '1', DOTNET_CLI_TELEMETRY_OPTOUT: '1', NUGET_PACKAGES: join(work, 'packages') });
	const common = {
		'RecursiveCases.cs': await fixture('dotnet-recursive.cs')
		, 'StructuredValues.cs': await readFile('tests/fixtures/structured-callable-consumers/dotnet-values.cs', 'utf8')
		, 'NuGet.Config': '<configuration><packageSources><clear/></packageSources></configuration>\n'
	};
	const write = async (work, files) => { for(const [name, text] of Object.entries(files)) await saveLakeFile(work, name, text); };
	const build = async (work, files) => {
		await write(work, { ...files, 'Probe.csproj': project(files) });
		await runCopied(dotnet, ['build', 'Probe.csproj', '--disable-build-servers', '-p:UseSharedCompilation=false', '-o', 'out'], work, env(work));
		await cp(libraries, join(work, 'out/runtimes/linux-x64/native'), { recursive: true });
	};
	const compile = async (work, file, output) => {
		await runCopied(environment.CC ?? 'cc', ['-std=c11'
			, '-fPIC'
			, '-shared'
			, '-O2'
			, '-Wall'
			, '-Wextra'
			, '-Werror'
			, '-I' + join(work, 'include/detail')
			, '-I' + component
			, '-I' + runtimeHeaders
			, file
			, '-L' + libraries
			, '-Wl,--no-as-needed'
			, '-l:' + receipt.library
			, '-llean_bridge_native'
			, '-lleanshared'
			, '-pthread'
			, '-Wl,-z,defs'
			, '-Wl,-z,nodelete'
			, '-Wl,-rpath,' + libraries
			, '-o'
			, output], work, environment);
	};
	const run = async (work, mode) => {
		const output = await runCopied(dotnet, ['out/Probe.dll', mode], work, env(work));
		assert.equal(output.stderr, ''); return JSON.parse(output.stdout);
	};
	const baseline = join(root, 'baseline'), baselineLibrary = join(baseline, 'libprobe.so');
	const baselineFiles = {
		...original
		, ...common
		, 'NativeProbe.cs': nativeProbe(baselineLibrary, layout)
		, 'Program.cs': 'internal static class Program { private static void Main(string[] args) { if(args[0]=="recursive")RecursiveCases.Run(); else RecursiveCases.Lifetimes(); } }\n'
	};
	await write(baseline, {
		...Object.fromEntries(Object.entries(native).filter(([name]) => name.endsWith('.h')))
		, 'probe.c': '#include <stddef.h>\n#include "' + model.prefix + '-graph-types.h"\n#include "lean_bridge_native_runtime.h"\n' + live + layout.c
	});
	await compile(baseline, 'probe.c', baselineLibrary);
	await build(baseline, baselineFiles);
	const recursive = await run(baseline, 'recursive'), lifetimes = await run(baseline, 'lifetimes');
	assert.equal(recursive.nesting, 64); assert.equal(recursive.layout, layout.count); assert.ok(recursive.checks > 8000);
	assert.equal(lifetimes.capacity, 4096); assert.equal(lifetimes.identities, 0); assert.equal(lifetimes.finalized, true);
	console.log('fresh NuGet sources: ' + recursive.checks + ' recursive checks and ' + lifetimes.checks + ' lifetime checks');
	const faults = join(root, 'faults');
	const changed = instrument(original, model), fn = changed.recursive;
	const retire = 'void ' + model.prefix + '_graph_retire(void) { lean_bridge_native_runtime_retire(); }';
	assert.equal(native['src/native.c'].split(retire).length, 2);
	const nativeFiles = {
		...native
		, 'src/native.c': hooks + native['src/native.c'].replace(retire, 'void ' + model.prefix + '_graph_retire(void) { ++fault_retired; lean_bridge_native_runtime_retire(); }') + live + layout.c
			+ '\nuint32_t fixture_poisoned_result(const ' + fn.parameters[0].node.name + ' *input, const ' + model.prefix + '_callback_' + fn.parameters[1].callback.key + ' *callback, ' + fn.result.node.name + ' *output) { uint32_t status = ' + fn.native + '(input,callback,output); if (!status && fault_poison) { assert(output->_bridge_owner && output->_bridge_release && fault_live); output->kind=UINT32_MAX; ++fault_poisoned; fault_poison=0; } return status; }\n'
	};
	await write(faults, nativeFiles);
	const instrumentedLibrary = join(faults, adapter.library);
	await compile(faults, 'src/native.c', instrumentedLibrary);
	const adapterHash = compiled.evidence.libraries[adapter.library], changedHash = await digest(instrumentedLibrary);
	assert.equal(changed.files['Calls.cs'].split(adapterHash).length, 2);
	changed.files['Calls.cs'] = changed.files['Calls.cs'].replace(adapterHash, changedHash);
	const deployedLibrary = join(faults, 'out/runtimes/linux-x64/native', adapter.library);
	const faultNative = `using System.Runtime.InteropServices;
internal static unsafe class FaultNative {
private static readonly nint Handle = NativeLibrary.Load(${JSON.stringify(deployedLibrary)});
private static nint Symbol(string name) => NativeLibrary.GetExport(Handle,"fixture_fault_"+name);
internal static void Reset(ulong value) => ((delegate* unmanaged[Cdecl]<ulong,void>)Symbol("reset"))(value);
internal static void Poison() => ((delegate* unmanaged[Cdecl]<void>)Symbol("poison"))();
${['Live', 'Attempts', 'Poisoned', 'Retired'].map(name => 'internal static ulong ' + name + '() => ((delegate* unmanaged[Cdecl]<ulong>)Symbol("' + name.toLowerCase() + '"))();').join('\n')}
}
`;
	const faultFiles = {
		...changed.files
		, ...common
		, 'Faults.cs': await fixture('dotnet-recursive-faults.cs')
		, 'NativeProbe.cs': nativeProbe(deployedLibrary, layout)
		, 'FaultNative.cs': faultNative
	};
	await build(faults, faultFiles);
	await cp(instrumentedLibrary, deployedLibrary);
	const failure = await run(faults, 'faults'), poison = await run(faults, 'poison');
	assert.equal(failure.shapes.length, 36); assert.equal(failure.deferred, 36); assert.equal(failure.identities, 0);
	for(const seed of [0, 1, 2, 3]) assert.deepEqual(failure.shapes.filter(row => row.seed === seed).map(row => row.shape), ['array', 'list', 'option', 'result', 'tuple', 'record', 'variant', 'alias', 'recursive']);
	let expected = 0;
	for(const row of failure.shapes)
	{
		assert.deepEqual(Object.keys(row.paths).sort(), ['callback', 'create', 'create-call', 'held-call', 'repeated']);
		const count = Object.values(row.paths).reduce((sum, p) => sum + p.checkpoints * 2 + p.hostAllocations + p.nativeAllocations, 0);
		assert.equal(row.faults, count); expected += count;
	}
	assert.equal(failure.faults, expected); assert.ok(expected > 20000);
	assert.equal(poison.retired, 1); assert.equal(poison.malformed, 1); assert.equal(poison.clears, 1);
	console.log('fresh NuGet isolated copies: ' + failure.faults + ' injected failures; malformed output clears and retires once');
	const ownership = await checkDotnetRecursiveOwnership({ root, source: faults, model, dotnet, environment: env(root), nativeAssets: join(faults, 'out/runtimes') });
	const typesRoot = join(root, 'typed'); await mkdir(typesRoot);
	const assembly = join(installed, 'lib/net8.0', model.assembly + '.dll');
	const structuredTypes = await checkDotnetStructuredCallableTypes({ root: typesRoot, dotnet, assembly, environment: env(typesRoot) });
	const recursiveTypes = await checkDotnetRecursiveTypes({ root: typesRoot, dotnet, assembly, environment: env(typesRoot), model });
	return {
		originalSources: hashes(original)
		, originalAdapterSources: hashes(native)
		, runtimeHeaders: Object.fromEntries(Object.entries(runtime.files).filter(([name]) => name.startsWith('include/')))
		, installedAssemblySha256: await digest(assembly)
		, recursive
		, lifetimes
		, structuredTypes
		, recursiveTypes
		, baselineSources: hashes(baselineFiles)
		, instrumentedSources: hashes({ ...faultFiles, ...nativeFiles })
		, edits: changed.edits
		, originalAdapterSha256: adapterHash
		, instrumentedAdapterSha256: changedHash
		, authenticatedLoaderRetained: true
		, installedAssetIsolation: true
		, faults: failure
		, poison
		, ownership
	};
};
