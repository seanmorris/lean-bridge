/**
 * Public recursive and lifetime consumers linked to the original NuGet assembly.
 *
 * @file
 */
import assert from 'node:assert/strict';
import { readFile, cp, rename, rm } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { sha256 } from '../../src/capsule/node.mjs';
import { compileCallableDotnetGraphPackageModel } from '../../src/backends/dotnet/callable-graph-model.mjs';
import { dotnetGraphLayoutProbe } from './dotnet-graph-probes.mjs';
import { saveLakeFile } from './lake-workspace.mjs';
import { copiedCleanEnvironment, runCopied } from './copied-fixture-install.mjs';

/**
 * Exercise only the public API of the unchanged original NuGet assembly.
 *
 * @param options - Isolated consumer build and original NuGet inputs.
 * @param options.root - Task-owned source and relocated deployment directory.
 * @param options.installed - Original NuGet installation.
 * @param options.probeRoot - Verified C layout observer source directory.
 * @param options.runtimeHeaders - Headers matching the installed runtime manifest.
 * @param options.dotnet - Absolute .NET SDK driver.
 * @param options.environment - Explicit native compiler environment.
 * @param options.documentation - Exact publisher and C# consumer examples.
 */
export const prepareDotnetRecursiveConsumer = async ({ root, installed, probeRoot, runtimeHeaders, dotnet, environment, documentation }) => {
	const source = join(root, 'source'), output = join(source, 'out');
	const component = join(installed, 'lean-bridge/component');
	const nativeModel = JSON.parse(await readFile(join(component, 'model.json')));
	const model = compileCallableDotnetGraphPackageModel(nativeModel.bindingIr);
	const layout = dotnetGraphLayoutProbe(model);
	const native = await readFile(join(probeRoot, 'baseline/probe.c'), 'utf8');
	const assembly = join(installed, 'lib/net8.0', model.assembly + '.dll');
	const observer = `using System;
using System.Runtime.InteropServices;
internal static unsafe class NativeProbe {
 private static readonly nint Handle = NativeLibrary.Load(System.IO.Path.Combine(AppContext.BaseDirectory,"recursive-observer.so"));
 internal const int LayoutCount = ${layout.count};
 internal static uint Live() => ((delegate* unmanaged[Cdecl]<uint>)NativeLibrary.GetExport(Handle,"fixture_live"))();
 // Full C/C# field-offset parity is checked by the separate original-source probe.
 internal static void LayoutCheck() {
  var count = ((delegate* unmanaged[Cdecl]<nuint>)NativeLibrary.GetExport(Handle,"graph_fixture_layout_count"))();
  if(count != LayoutCount)throw new Exception("native observation layout count");
 }
}
`;
	const files = {
		'Program.cs': 'internal static class Program { private static void Main(string[] args) { if(args[0]=="recursive")RecursiveCases.Run(); else RecursiveCases.Lifetimes(); } }\n'
		, 'RecursiveCases.cs': await readFile('tests/fixtures/structured-callable-consumers/dotnet-recursive.cs', 'utf8')
		, 'StructuredValues.cs': await readFile('tests/fixtures/structured-callable-consumers/dotnet-values.cs', 'utf8')
		, 'NativeProbe.cs': observer
	};
	const project = names => '<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net8.0</TargetFramework><Nullable>enable</Nullable><UseAppHost>false</UseAppHost><AllowUnsafeBlocks>true</AllowUnsafeBlocks><TreatWarningsAsErrors>true</TreatWarningsAsErrors><EnableDefaultCompileItems>false</EnableDefaultCompileItems></PropertyGroup><ItemGroup>' + names.map(name => '<Compile Include="' + name + '"/>').join('') + '<Reference Include="' + model.assembly + '"><HintPath>' + assembly + '</HintPath></Reference></ItemGroup></Project>\n';
	for(const [name, text] of Object.entries(files)) await saveLakeFile(source, name, text);
	await saveLakeFile(source, 'Consumer.csproj', project(Object.keys(files)));
	await saveLakeFile(source, 'Example.cs', documentation.consumer + '\n');
	await saveLakeFile(source, 'Example.csproj', project(['Example.cs']));
	await saveLakeFile(source, 'NuGet.Config', '<configuration><packageSources><clear/></packageSources></configuration>');
	await saveLakeFile(source, 'observer.c', native);
	const libraries = join(installed, 'runtimes/linux-x64/native');
	const env = { ...copiedCleanEnvironment, DOTNET_ROOT: dirname(dotnet), DOTNET_CLI_HOME: join(source, 'home'), DOTNET_NOLOGO: '1', DOTNET_CLI_TELEMETRY_OPTOUT: '1', NUGET_PACKAGES: join(source, 'packages') };
	for(const [project, destination] of [['Consumer', 'out'], ['Example', 'example']])
	{
		await runCopied(dotnet, ['build', project + '.csproj', '--disable-build-servers', '-p:UseSharedCompilation=false', '-o', destination], source, env);
		await cp(libraries, join(source, destination, 'runtimes/linux-x64/native'), { recursive: true });
		assert.equal(sha256(await readFile(join(source, destination, model.assembly + '.dll'))), sha256(await readFile(assembly)));
	}
	await runCopied(environment.CC ?? 'cc', ['-std=c11'
		, '-fPIC'
		, '-shared'
		, '-O2'
		, '-Wall'
		, '-Wextra'
		, '-Werror'
		, '-I' + join(probeRoot, 'baseline/include/detail')
		, '-I' + runtimeHeaders
		, 'observer.c'
		, '-L' + libraries
		, '-Wl,--no-as-needed'
		, '-llean_bridge_native'
		, '-lleanshared'
		, '-Wl,-z,defs'
		, '-Wl,-z,nodelete'
		, '-Wl,-rpath,$ORIGIN/runtimes/linux-x64/native'
		, '-o'
		, join(output, 'recursive-observer.so')], source, environment);
	const results = {};
	for(const mode of ['recursive', 'lifetimes'])
	{
		const result = await runCopied(dotnet, ['Consumer.dll', mode], output, env);
		assert.equal(result.stderr, ''); results[mode] = JSON.parse(result.stdout);
	}
	assert.equal(results.recursive.nesting, 64); assert.equal(results.recursive.layout, layout.count);
	assert.ok(results.recursive.checks > 8000);
	assert.equal(results.lifetimes.capacity, 4096); assert.equal(results.lifetimes.identities, 0);
	assert.equal(results.lifetimes.finalized, true);
	const example = await runCopied(dotnet, ['Example.dll'], join(source, 'example'), env);
	assert.equal(example.stderr, ''); assert.equal(example.stdout, '20\n19\n20\n');
	await rename(output, join(root, 'deployed')); await rename(join(source, 'example'), join(root, 'example'));
	await rm(source, { recursive: true, force: true });
	return {
		...results
		, example: example.stdout
		, originalAssemblySha256: sha256(await readFile(assembly))
		, sourceHashes: Object.fromEntries(Object.entries({ ...files, 'observer.c': native, 'Example.cs': documentation.consumer }).map(([name, text]) => [name, sha256(text)]))
	};
};
