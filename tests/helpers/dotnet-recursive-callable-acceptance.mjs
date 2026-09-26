/**
 * Fresh NuGet-only authors, original offline installs and SDK-free recursive execution.
 *
 * @file
 */
import assert from 'node:assert/strict';
import { readFile, mkdir, cp, readdir, rename, rm, realpath } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { canonicalJson, sha256 } from '../../src/capsule/node.mjs';
import { buildCanonicalProject } from '../../src/build/canonical-build.mjs';
import { ordinaryDotnetEvidence } from '../../src/build/native-dotnet-artifacts.mjs';
import { nativeArtifactPaths, verifyNativeFiles } from '../../src/build/native-artifacts.mjs';
import { packageOrdinaryNuget } from '../../src/release/native-nuget.mjs';
import { verifyPackageSetReceipt } from '../../src/release/package-set-receipt.mjs';
import { generateCallableDotnetGraphPackage } from '../../src/backends/dotnet/callable-graph-package.mjs';
import { copyPackageSetHandoff } from './package-set.mjs';
import { nativeRecursiveCallableReviewedIr, nativeRecursiveCallableExports, nativeRecursiveCallableArities } from './native-recursive-callable-fixture.mjs';
import { nativeFixtureEnvironment, copiedCleanEnvironment, runCopied } from './copied-fixture-install.mjs';
import { saveLakeFile, lakeInputState } from './lake-workspace.mjs';
import { dotnetRecursiveMixedFixture } from './dotnet-recursive-callable-mixed.mjs';
import { checkDotnetRecursiveProbes } from './dotnet-recursive-callable-probes.mjs';
import { dotnetRecursiveCallableDocumentation } from './dotnet-recursive-callable-docs.mjs';
import { prepareDotnetRecursiveConsumer } from './dotnet-recursive-callable-consumer.mjs';
import { assertDotnetRecursiveProbes } from './dotnet-recursive-callable-faults.mjs';

/**
 * Build both source paths and consume original packages after deleting producers.
 *
 * @param directory - Task-owned test workspace.
 * @param diagnostic - Progress callback for the native and managed build steps.
 * @param includeMixed - Combine all primitive callbacks with recursive APIs.
 */
export const checkDotnetRecursiveCallables = async (directory, diagnostic = () => { }, includeMixed = false) => {
	const root = directory;
	const environment = nativeFixtureEnvironment(['dotnet']);
	const dotnet = await realpath(environment.LEAN_BRIDGE_DOTNET), dotnetRoot = dirname(dotnet);
	const json = async path => JSON.parse(await readFile(path, 'utf8'));
	const digest = async path => sha256(await readFile(path));
	const snapshot = async root => Object.fromEntries(await Promise.all((await nativeArtifactPaths(root)).map(async name => [name, await digest(join(root, name))])));
	const select = values => values.sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).at(-1);
	const managed = work => ({ ...copiedCleanEnvironment, DOTNET_ROOT: dotnetRoot, DOTNET_CLI_HOME: join(work, 'home'), DOTNET_CLI_TELEMETRY_OPTOUT: '1', DOTNET_NOLOGO: '1', NUGET_PACKAGES: join(work, 'packages'), NUGET_HTTP_CACHE_PATH: join(work, 'http-cache') });
	const reports = [];
	const documentation = await dotnetRecursiveCallableDocumentation();
	const mixed = includeMixed ? await dotnetRecursiveMixedFixture(documentation.source) : null;
	const includeProbes = !includeMixed;
	const expectedExports = mixed ? 97 : 33, expectedSignatures = mixed ? 59 : 18;
	for(const path of ['ordinary-source', 'reviewed-ir'])
	{
		const work = join(root, path), author = join(work, 'author'), projectRoot = join(author, 'project'), outputRoot = join(author, 'release'), handoff = join(work, 'handoff');
		await cp('tests/fixtures/onboarding/structured-callables', projectRoot, { recursive: true });
		await saveLakeFile(projectRoot, 'Structured.lean', mixed?.source ?? documentation.source);
		const configuration = { schemaVersion: 1, modules: ['Structured'], targets: { nuget: { name: 'Lean.Structured', version: '1.0.0' } } };
		if(path === 'ordinary-source')
		{ configuration.exports = mixed?.exports ?? nativeRecursiveCallableExports; configuration.arities = mixed?.arities ?? nativeRecursiveCallableArities; }
		else await saveLakeFile(projectRoot, 'structured.binding-ir.json', canonicalJson(mixed?.ir ?? nativeRecursiveCallableReviewedIr()));
		await saveLakeFile(projectRoot, 'lean-bridge.exports.json', canonicalJson(configuration));
		const before = await lakeInputState(projectRoot);
		diagnostic(path + ': build fresh NuGet-only author package');
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: ['nuget'], environment, onProgress: event => diagnostic(path + ': ' + (event.message ?? event.phase)) }).catch(error => { error.message += ': ' + JSON.stringify(error.details); throw error; });
		assert.deepEqual(built.targets, ['nuget']); assert.deepEqual(await lakeInputState(projectRoot), before);
		const nativeRoot = join(outputRoot, 'native/component'), runtimeRoot = join(outputRoot, 'native/runtime'), adapterRoot = join(outputRoot, 'native/c-binding'), dotnetRoot = join(outputRoot, 'native/dotnet');
		const { model, projection, evidence, adapter } = await ordinaryDotnetEvidence({ nativeRoot, runtimeRoot, adapterRoot });
		assert.equal(model.schemaVersion, path === 'ordinary-source' ? 4 : 5); assert.equal(model.bindingIr.declarations.length, expectedExports); assert.equal(model.copiedGraph.callbacks.length, expectedSignatures);
		assert.equal(adapter.gmp, undefined); assert.equal(adapter.files['include/structured.h'], undefined);
		const sources = generateCallableDotnetGraphPackage(model.bindingIr, evidence);
		assert.equal(JSON.parse(sources['binding-manifest.json']).generator, 'dotnet-callable-graph-v1');
		const options = { working: join(author, 'repacked'), dotnetRoot, nativeRoot, runtimeRoot, adapterRoot, leanPrefix: environment.LEAN_BRIDGE_LEAN_PREFIX, settings: { name: 'Lean.Structured', version: '1.0.0' }, glibcMinimumVersion: environment.LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR ?? '2.38' };
		const repeated = await packageOrdinaryNuget(options); assert.deepEqual(repeated.packages, built.packages); await rm(options.working, { recursive: true, force: true });
		const packageSet = await copyPackageSetHandoff(outputRoot, handoff); await verifyPackageSetReceipt({ receiptPath: join(handoff, 'package-set-receipt.json') });
		assert.equal(packageSet.packages.length, 1); const pkg = packageSet.packages[0]; assert.equal(pkg.target, 'nuget'); assert.equal(pkg.ecosystem, 'nuget'); assert.equal(pkg.artifacts.length, 1);
		const handoffSha256 = await digest(join(handoff, 'package-set-receipt.json'));
		const archive = await readFile(join(handoff, pkg.artifacts[0].path)); assert.equal(sha256(archive), pkg.artifacts[0].sha256);
		const producerSources = await snapshot(dotnetRoot);
		const runtimeHeaders = join(work, 'probe-headers');
		if(includeProbes) await cp(join(runtimeRoot, 'include'), runtimeHeaders, { recursive: true });
		await rm(author, { recursive: true, force: true });
		diagnostic(path + ': author removed; install original archive into an empty offline cache');
		const consumer = join(work, 'consumer'), feed = join(consumer, 'feed'), cache = join(consumer, 'packages');
		await mkdir(cache, { recursive: true }); assert.deepEqual(await readdir(cache), []);
		await saveLakeFile(feed, pkg.name + '.' + pkg.version + '.nupkg', archive);
		let publicSource = await readFile('tests/fixtures/structured-callable-consumers/dotnet-recursive-installed.cs', 'utf8');
		if(mixed)
		{ publicSource = publicSource.replace('if (mode == "acyclic")', 'if (mode == "mixed") { MixedCases.Run(); return 0; }\n            if (mode == "acyclic")'); await saveLakeFile(consumer, 'Mixed.cs', mixed.consumer); }
		await saveLakeFile(consumer, 'Program.cs', publicSource);
		await saveLakeFile(consumer, 'Acyclic.cs', (await readFile('tests/fixtures/structured-callable-consumers/dotnet.cs', 'utf8')).replace('internal static class Program', 'internal static class AcyclicCases').replace('private static void Main()', 'internal static void Run()').replace('Expired or wrong-thread host callback', 'Invalid native copied input'));
		await saveLakeFile(consumer, 'StructuredValues.cs', await readFile('tests/fixtures/structured-callable-consumers/dotnet-values.cs'));
		await saveLakeFile(consumer, 'Consumer.csproj', '<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net8.0</TargetFramework><Nullable>enable</Nullable><ImplicitUsings>disable</ImplicitUsings><UseAppHost>false</UseAppHost><TreatWarningsAsErrors>true</TreatWarningsAsErrors><EnableDefaultCompileItems>false</EnableDefaultCompileItems><NuGetAudit>false</NuGetAudit></PropertyGroup><ItemGroup><Compile Include="Program.cs"/><Compile Include="Acyclic.cs"/><Compile Include="StructuredValues.cs"/>' + (mixed ? '<Compile Include="Mixed.cs"/>' : '') + '<PackageReference Include="' + pkg.name + '" Version="[' + pkg.version + ']"/></ItemGroup></Project>');
		await saveLakeFile(consumer, 'NuGet.Config', '<configuration><packageSources><clear/><add key="prepared" value="feed"/></packageSources><fallbackPackageFolders><clear/></fallbackPackageFolders></configuration>');
		await runCopied(dotnet, ['restore', 'Consumer.csproj', '--configfile', 'NuGet.Config'], consumer, managed(consumer));
		await runCopied(dotnet, ['build', 'Consumer.csproj', '--no-restore', '--disable-build-servers', '-p:UseSharedCompilation=false', '-o', 'out'], consumer, managed(consumer));
		const installed = join(cache, pkg.name.toLowerCase(), pkg.version), original = await snapshot(installed);
		assert.equal(original[pkg.name.toLowerCase() + '.' + pkg.version + '.nupkg'], pkg.artifacts[0].sha256);
		const installedReceipt = await json(join(installed, 'lean-bridge/package-receipt.json'));
		assert.equal(installedReceipt.kind, 'lean-bridge-ordinary-nuget-package'); assert.equal(installedReceipt.runtimeIdentity, pkg.runtimeIdentity);
		assert.equal(installedReceipt.bindingIrSha256, model.bindingIrSha256);
		await verifyNativeFiles(installed, Object.fromEntries(Object.entries(installedReceipt.files).filter(([name]) => !['[Content_Types].xml', '_rels/.rels', pkg.name + '.nuspec'].includes(name))));
		for(const [file, source] of Object.entries(sources).filter(([file]) => file.startsWith('src/') || file === 'binding-manifest.json')) assert.equal(await readFile(join(installed, 'lean-bridge/dotnet', file), 'utf8'), source, file);
		const assets = await json(join(consumer, 'obj/project.assets.json'));
		assert.deepEqual(Object.keys(assets.libraries), [pkg.name + '/' + pkg.version]); assert.deepEqual(Object.keys(assets.project.restore.sources), [feed]);
		await rm(handoff, { recursive: true, force: true }); await rm(feed, { recursive: true, force: true });
		const initial = await runCopied(dotnet, ['Consumer.dll'], join(consumer, 'out'), managed(consumer)); assert.equal(initial.stderr, '');
		const publicResult = JSON.parse(initial.stdout); assert.equal(publicResult.mode, 'public'); assert.equal(publicResult.checks, 15);
		assert.deepEqual(await snapshot(installed), original);
		let probes = null, originalRecursive = null;
		const recursiveRoot = join(work, 'original-recursive');
		if(includeProbes)
		{
			const probeRoot = join(work, 'isolated-probes');
			probes = await checkDotnetRecursiveProbes({ root: probeRoot, installed, runtimeHeaders, dotnet, environment });
			assertDotnetRecursiveProbes(probes);
			originalRecursive = await prepareDotnetRecursiveConsumer({ root: recursiveRoot, installed, probeRoot, runtimeHeaders, dotnet, environment, documentation });
			assert.deepEqual(await snapshot(installed), original);
			await rm(probeRoot, { recursive: true, force: true }); await rm(runtimeHeaders, { recursive: true, force: true });
		}
		const relocated = join(work, 'relocated'), host = join(work, 'runtime-only'); await rename(join(consumer, 'out'), relocated);
		const deployment = await snapshot(relocated), actualDotnetRoot = dirname(dotnet);
		const fxr = select((await readdir(join(actualDotnetRoot, 'host/fxr'))).filter(v => v.startsWith('8.0.'))), fx = select((await readdir(join(actualDotnetRoot, 'shared/Microsoft.NETCore.App'))).filter(v => v.startsWith('8.0.')));
		await mkdir(host); await cp(dotnet, join(host, 'dotnet')); await cp(join(actualDotnetRoot, 'host/fxr', fxr), join(host, 'host/fxr', fxr), { recursive: true }); await cp(join(actualDotnetRoot, 'shared/Microsoft.NETCore.App', fx), join(host, 'shared/Microsoft.NETCore.App', fx), { recursive: true });
		await rm(consumer, { recursive: true, force: true });
		const runtimeEnvironment = { ...copiedCleanEnvironment, DOTNET_ROOT: host, DOTNET_MULTILEVEL_LOOKUP: '0', DOTNET_NOLOGO: '1' };
		const execute = async mode => { const result = await runCopied(join(host, 'dotnet'), ['Consumer.dll', mode], relocated, runtimeEnvironment); assert.equal(result.stderr, ''); return JSON.parse(result.stdout); };
		assert.equal((await runCopied(join(host, 'dotnet'), ['--list-sdks'], relocated, runtimeEnvironment)).stdout.trim(), '');
		if(originalRecursive)
		{
			const originalDeployment = await snapshot(join(recursiveRoot, 'deployed'));
			const originalExample = await snapshot(join(recursiveRoot, 'example'));
			for(const mode of ['recursive', 'lifetimes'])
			{
				const result = await runCopied(join(host, 'dotnet'), ['Consumer.dll', mode], join(recursiveRoot, 'deployed'), runtimeEnvironment);
				assert.equal(result.stderr, ''); assert.deepEqual(JSON.parse(result.stdout), originalRecursive[mode]);
			}
			const result = await runCopied(join(host, 'dotnet'), ['Example.dll'], join(recursiveRoot, 'example'), runtimeEnvironment);
			assert.equal(result.stderr, ''); assert.equal(result.stdout, originalRecursive.example);
			assert.deepEqual(await snapshot(join(recursiveRoot, 'deployed')), originalDeployment);
			assert.deepEqual(await snapshot(join(recursiveRoot, 'example')), originalExample);
			originalRecursive = { ...originalRecursive, deployment: originalDeployment, exampleDeployment: originalExample, sdkFree: true, sourceFree: true, relocated: true };
		}
		assert.deepEqual(await execute('public'), publicResult); const acyclic = await execute('acyclic'); assert.equal(acyclic.checks, 274237);
		let mixedResult = null;
		if(mixed)
		{ const result = await runCopied(join(host, 'dotnet'), ['Consumer.dll', 'mixed'], relocated, runtimeEnvironment); assert.equal(result.stderr, ''); assert.match(result.stdout, /^callable-dotnet-ok:\d+\n$/); mixedResult = { checks: Number(result.stdout.trim().split(':')[1]), sourceSha256: sha256(mixed.consumer), sourceFree: true, sdkFree: true }; assert.ok(mixedResult.checks > 100000); diagnostic(path + ': mixed primitive/recursive package passed ' + mixedResult.checks + ' primitive and sixteen-argument callable checks'); }
		assert.deepEqual(await snapshot(relocated), deployment);
		const libraries = Object.keys(deployment).filter(name => name.endsWith('.so')); assert.equal(libraries.length, 4);
		const tamperChecks = [];
		for(const target of libraries)
		{
			const good = await readFile(join(relocated, target)), changed = Buffer.from(good); changed[changed.length - 1] ^= 1;
			await saveLakeFile(relocated, target, changed);
			const cold = await execute('cold'), tampered = await execute('tampered'); assert.equal(cold.checks, 5); assert.equal(tampered.checks, 3);
			await saveLakeFile(relocated, target, good); tamperChecks.push({ target, cold, tampered });
		}
		assert.deepEqual(await snapshot(relocated), deployment); assert.deepEqual(await execute('public'), publicResult);
		reports.push({ path, profile: "dotnet", freshAuthor: true, nugetOnly: true, exports: expectedExports, signatures: expectedSignatures, archive: pkg.artifacts[0], packages: packageSet.packages, handoffSha256, bindingIrSha256: model.bindingIrSha256, layoutSha256: projection.layoutSha256, producerSources, installedFiles: original, deployedFiles: deployment, public: publicResult, acyclic, mixed: mixedResult, probes, originalRecursive, documentation: { authorSha256: sha256(documentation.author), configurationSha256: sha256(documentation.configuration), consumerSha256: sha256(documentation.consumer) }, tamperChecks, onlyPreparedDependency: true, emptyNuGetCache: true, producerRemovedBeforeInstall: true, handoffRemoved: true, installedUnchanged: true, sdkFree: true, relocated: true, installedReceipt });
		diagnostic(path + ': original NuGet archive passed public, acyclic, cold-input and all four asset-tamper checks after relocation without SDK or source');
		await rm(work, { recursive: true, force: true });
	}
	return { schemaVersion: 1, reports };
};
