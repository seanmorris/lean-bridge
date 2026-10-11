/**
 * Compile the full C# probe against the original NuGet archive with guarded restore/build inputs.
 * Both the initial consumer and this separate probe deployment remain authenticated throughout.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { sha256 } from "../../src/capsule/node.mjs";
import { copiedCleanEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { finContainerEdgeEntries, finContainerEdgeSourceEntries, finContainerEdgeWireSymbols } from "./fin-container-edge-dispatch.mjs";
import { assertFinContainerEdgeProbeLocation, finContainerEdgeDefinitions, verifyFinContainerEdgeDeployment } from "./fin-container-edge-observer.mjs";
import { assertFinContainerEdgeGdbRun, finContainerEdgeGdbScript, prepareFinContainerEdgeGdb } from "./fin-container-edge-gdb.mjs";
import { finContainerGdbCommand } from "./fin-container-dispatch-gdb.mjs";
import { finContainerEdgeDotnetChecks, finContainerEdgeDotnetProbe, readFinContainerEdgeDotnet } from "./fin-container-edge-dotnet.mjs";
import { installFinContainerEdgeDotnet, verifyFinContainerEdgeDotnetEnvironment } from "./fin-container-edge-dotnet-closure.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

/**
 * Run the complete consumer twice, counting actual native entries without modifying package files.
 *
 * @param options - Original archive and relocated guarded .NET installation.
 * @param options.installed - Original package inspection directory.
 * @param options.receiptPath - Original package receipt path.
 * @param options.receiptBytes - Receipt bytes authenticated against the original archive.
 * @param options.expectedModelSha256 - Producer model identity.
 * @param options.probeRoot - Fresh probe directory outside the whole original consumer tree.
 * @param options.dotnetEnvironment - Guarded original feed, cache, tool and deployed application.
 */
export const observeFinContainerEdgeDotnet = async ({ installed, receiptPath, receiptBytes, expectedModelSha256, probeRoot, dotnetEnvironment }) => {
	await assertFinContainerEdgeProbeLocation(installed, probeRoot);
	assert.ok(dotnetEnvironment, ".NET observation requires the original guarded deployment");
	await assertFinContainerEdgeProbeLocation(dotnetEnvironment.root, probeRoot);
	assert.equal(installed, join(dotnetEnvironment.root, "inspection"));
	assert.deepEqual(Buffer.from(receiptBytes), Buffer.from(dotnetEnvironment.receiptBytes));
	const options = { installed, receiptPath, receiptBytes, expectedModelSha256, exactFileClosure: true };
	const checkOriginal = async () => {
		await verifyFinContainerEdgeDotnetEnvironment(dotnetEnvironment);
		return verifyFinContainerEdgeDeployment(options);
	};
	const before = await checkOriginal(), { command } = dotnetEnvironment;
	const application = join(probeRoot, "application");
	const assembly = `${before.receipt.assembly}.dll`;
	const source = await finContainerEdgeDotnetProbe(before.model, before.receipt.component, join(application, "out", assembly));
	await mkdir(probeRoot); await mkdir(application);
	await saveLakeFile(application, "consumer.cs", source.source);
	const archivePath = `feed/${dotnetEnvironment.archiveName}`;
	const archiveSha256 = dotnetEnvironment.inputs[archivePath].sha256;
	let probe;
	try
	{
		probe = await installFinContainerEdgeDotnet({ root: application
			, archive: join(dotnetEnvironment.root, archivePath)
			, archiveSha256, command });
	}
	finally
	{ await checkOriginal(); }
	assert.equal(probe.context.inputs[archivePath].sha256, archiveSha256);
	assert.deepEqual(Buffer.from(probe.context.receiptBytes), Buffer.from(receiptBytes));
	const check = async () => {
		const original = await checkOriginal();
		await verifyFinContainerEdgeDotnetEnvironment(probe.context);
		assert.equal(sha256(await readFile(join(application, "consumer.cs"))), sha256(source.source));
		return original;
	};
	const nativeDirectory = join(application, "out/runtimes/linux-x64/native");
	const definitions = await finContainerEdgeDefinitions({ ...before, directory: nativeDirectory }, { publicWire: true });
	const env = { ...copiedCleanEnvironment, LEAN_NUM_THREADS: "1"
		, DOTNET_ROOT: dirname(command)
		, DOTNET_CLI_HOME: join(application, "dotnet-home")
		, DOTNET_CLI_TELEMETRY_OPTOUT: "1", DOTNET_NOLOGO: "1"
		, DOTNET_MULTILEVEL_LOOKUP: "0" };
	const version = await runCopied(command, ["--version"], application, env);
	assert.equal(version.stderr, ""); assert.match(version.stdout, /^8\.0\.[0-9]+\n$/u);
	const gdbVersion = await runCopied(finContainerGdbCommand, ["--version"], application, { ...copiedCleanEnvironment, XDG_CACHE_HOME: probeRoot });
	assert.equal(gdbVersion.stderr, ""); assert.match(gdbVersion.stdout, /^GNU gdb /u);
	const observer = await prepareFinContainerEdgeGdb({ model: before.model
		, component: before.receipt.component
		, nativeDirectory, libraries: before.libraries
		, probeRoot: join(probeRoot, "gdb"), cwd: application, env
		, argv: ({ record, nonce, configSha256, definerIndices }) => [command, "out/Consumer.dll", record, nonce, configSha256, definerIndices.join(",")] });
	const runObserved = async settings => {
		await check();
		try
		{ return await observer.run(settings); }
		finally
		{ await check(); }
	};
	const absent = await runObserved({ gdb: false });
	assert.equal(absent.code, 2); assert.equal(absent.stdout, ""); assert.equal(absent.stderr, "edge record is not attached with empty counters\n");
	const run = await runObserved(); assert.equal(run.code, 0, run.output + run.stderr);
	const observations = readFinContainerEdgeDotnet(run.stdout);
	const armed = await assertFinContainerEdgeGdbRun(observer, run, observations);
	const repeat = await runObserved(); assert.equal(repeat.code, 0, repeat.output + repeat.stderr);
	assert.equal(repeat.stdout, run.stdout, "a fresh .NET process must repeat every call");
	const again = await assertFinContainerEdgeGdbRun(observer, repeat, readFinContainerEdgeDotnet(repeat.stdout));
	assert.notEqual(armed.pid, again.pid); assert.notEqual(run.nonce, repeat.nonce);
	assert.deepEqual(await check(), before, ".NET observation must not alter installed files");
	return { kind: "fin-container-edge-public-dotnet-v1"
		, observed: true, profile: "dotnet"
		, caller: "The complete original-plus-edge C# consumer, compiled separately from the same authenticated NuGet archive"
		, instrument: "GDB address breakpoints; production managed and native loaders unchanged"
		, checks: finContainerEdgeDotnetChecks
		, measuredCalls: observations.length, observations
		, dotnet: version.stdout.trim(), dotnetSha256: sha256(await readFile(command))
		, gdb: gdbVersion.stdout.split("\n")[0]
		, gdbSha256: sha256(await readFile(finContainerGdbCommand))
		, componentId: before.model.component.id, columns: before.columns
		, measuredAdapters: finContainerEdgeEntries.map(name => `FinContainers.${name}`)
		, measuredSources: finContainerEdgeSourceEntries.map(name => `FinContainers.${name}`)
		, sourceFunctionsNotMeasured: finContainerEdgeEntries.filter(name => !finContainerEdgeSourceEntries.includes(name)).map(name => `FinContainers.${name}`)
		, publicSymbols: finContainerEdgeWireSymbols, packageDirectory: installed
		, probePackageDirectory: join(application, "inspection")
		, libraryDirectory: nativeDirectory, libraries: before.libraries, assembly
		, assemblySha256: before.receipt.files[`lib/net8.0/${assembly}`].sha256
		, archiveSha256
		, definitions: Object.fromEntries(Object.entries(definitions).map(([symbol, path]) => [symbol, basename(path)]))
		, ...before.identity, dotnetEnvironment: await verifyFinContainerEdgeDotnetEnvironment(dotnetEnvironment)
		, probeEnvironment: await verifyFinContainerEdgeDotnetEnvironment(probe.context)
		, configIdentity: observer.identity, configSha256: observer.configSha256
		, probeSha256: sha256(source.source)
		, scriptSha256: sha256(finContainerEdgeGdbScript)
		, stdoutSha256: sha256(run.stdout)
		, runs: await Promise.all([[run, armed], [repeat, again]].map(async ([result, manifest]) => ({
			pid: manifest.pid, nonce: result.nonce, manifest
			, recordSha256: sha256(await readFile(result.record))
			, manifestSha256: sha256(await readFile(result.armed)) })))
		, missingInstrumentRefused: true, installedFilesUnchanged: true
		, sameOriginalArchive: true, runtimeDefinitionsChecked: true
		, loadedAssemblyChecked: true
		, repeatedColdProcess: true };
};
