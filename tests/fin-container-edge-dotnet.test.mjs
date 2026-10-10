/**
 * Full C# caller observation and hostile-instrument controls over actual compiled Lean.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { nativeArtifactPaths } from "../src/build/native-artifacts.mjs";
import { finContainerEdgeConsumer } from "./helpers/fin-container-edges.mjs";
import { finContainerEdgeCompilerModel } from "./helpers/fin-container-edge-compiled-fixture.mjs";
import { finContainerEdgeEntries } from "./helpers/fin-container-edge-dispatch.mjs";
import { repeatFinContainerEdges } from "./helpers/fin-container-edge-install.mjs";
import { assertFinContainerEdgeGdbRun, finContainerEdgeGdbScript, prepareFinContainerEdgeGdb } from "./helpers/fin-container-edge-gdb.mjs";
import { finContainerEdgeDotnetChecks, finContainerEdgeDotnetExpected, finContainerEdgeDotnetProbe, readFinContainerEdgeDotnet } from "./helpers/fin-container-edge-dotnet.mjs";
import { finContainerEdgeDotnetPublicFixture } from "./helpers/fin-container-edge-dotnet-fixture.mjs";
import { observeFinContainerEdgeDotnet } from "./helpers/fin-container-edge-dotnet-observer.mjs";
import { installFinContainerEdgeDotnet, verifyFinContainerEdgeDotnetEnvironment } from "./helpers/fin-container-edge-dotnet-closure.mjs";
import { copiedCleanEnvironment, installCopiedConsumer } from "./helpers/copied-fixture-install.mjs";

const transcript = rows => rows.map(([step, method, status, counts]) => `edge-dotnet ${step} ${method} ${status} ${counts.join(" ")}\n`).join("") + `fin-container-ok:${finContainerEdgeDotnetChecks}\n`;

test(".NET transcript requires all 12,047 public calls including Some(null) and recovery", () => {
	assert.equal(finContainerEdgeDotnetExpected.length, 12047);
	assert.deepEqual(finContainerEdgeDotnetExpected.at(-1)[3], [1003, 1003, 1001, 1001, 1001, 1003, 1003, 1003]);
	const totals = [[1001, 1003, 1, 1], [1001, 1003, 1, 1], [1001, 1003, 0, 1], [1003, 1003, 1, 3], [1003, 1004, 0, 0], [1003, 1010, 0, 0]];
	for(const [index, method] of finContainerEdgeEntries.entries())
	{
		const rows = finContainerEdgeDotnetExpected.filter(row => row[1] === method);
		assert.deepEqual(["ok", "fin", "null", "value"].map(status => rows.filter(row => row[2] === status).length), totals[index], method);
	}
	assert.deepEqual(readFinContainerEdgeDotnet(transcript(finContainerEdgeDotnetExpected)), finContainerEdgeDotnetExpected);
	for(const mutate of [
		rows => { rows[1][3][0]++; }
		, rows => { rows[0][3][6]--; }
		, rows => { rows[1][2] = "ok"; }
		, rows => { rows[0][1] = "flatten"; }
		, rows => { [rows[0], rows[1]] = [rows[1], rows[0]]; }
		, rows => { rows.splice(19, 1); }
		, rows => { rows.push(rows.at(-1)); }
	]) {
		const rows = structuredClone(finContainerEdgeDotnetExpected); mutate(rows);
		assert.throws(() => readFinContainerEdgeDotnet(transcript(rows)));
	}
	assert.throws(() => readFinContainerEdgeDotnet(transcript(finContainerEdgeDotnetExpected).replace("fin-container-ok:14089", "fin-container-ok:14088")));
	assert.throws(() => { finContainerEdgeDotnetExpected[0][3][0]++; });
});

test(".NET instrumentation retains every assertion and public type without changing the loader", async () => {
	const model = finContainerEdgeCompilerModel(), original = await finContainerEdgeConsumer("dotnet");
	const { consumer, counter, api, source } = await finContainerEdgeDotnetProbe(model, model.component, "/probe/out/LeanBridge.Fincontainers.dll");
	const restored = consumer.replaceAll("EdgeApi.", "Api.").replace("static void Main(string[] args) {\n        EdgeCounter.Initial(args);", "static void Main() {");
	assert.equal(restored, original);
	assert.equal(source, consumer + "\n" + counter + api);
	assert.equal((api.match(/=> EdgeCounter.Call\(/gu) ?? []).length, 6);
	assert.ok(counter.includes('loaded.Location != "/probe/out/LeanBridge.Fincontainers.dll"'));
	assert.ok(counter.includes("error.GetType() == typeof(ArgumentException)"));
	assert.ok(counter.includes("throw;"));
	assert.doesNotMatch(source, /DllImport|NativeLibrary|SetDllImportResolver|LoadFrom|SetData|Unsafe/u);
	await assert.rejects(finContainerEdgeDotnetProbe(model, model.component, "relative"), assert.AssertionError);
});

test("real C# edge calls preserve NuGet loading and reject forged entry measurements", { skip: process.env.LEAN_BRIDGE_FIN_CONTAINER_EDGE_SOURCE_TEST !== "1" }, async t => {
	const fixture = await finContainerEdgeDotnetPublicFixture(t);
	const { root, model, libraries, command } = fixture;
	const consumer = join(root, "consumer");
	const installation = await installCopiedConsumer({ profile: "dotnet", consumer
		, handoff: fixture.handoff, packages: fixture.packages
		, environment: { LEAN_BRIDGE_DOTNET: command }
		, fixture: { source: () => finContainerEdgeConsumer("dotnet"), success: "fin-container-ok", expectedChecks: finContainerEdgeDotnetChecks, installDotnet: installFinContainerEdgeDotnet } });
	const relocated = await repeatFinContainerEdges({ profile: "dotnet", consumer
		, handoff: fixture.handoff, packages: fixture.packages, command
		, dotnetEnvironment: installation.dotnetEnvironment });
	assert.equal(relocated.exactPackageFiles, true);
	const dotnetEnvironment = { ...installation.dotnetEnvironment, root: join(consumer, "dotnet-relocated") };
	const options = { installed: join(dotnetEnvironment.root, "inspection")
		, receiptPath: fixture.receiptPath, receiptBytes: fixture.receiptBytes
		, expectedModelSha256: sha256(fixture.modelBytes), dotnetEnvironment
		, probeRoot: join(root, "public-probe") };
	const report = await observeFinContainerEdgeDotnet(options);
	assert.equal(report.kind, "fin-container-edge-public-dotnet-v1");
	assert.equal(report.checks, 14089); assert.equal(report.measuredCalls, 12047);
	assert.deepEqual(report.observations, finContainerEdgeDotnetExpected);
	assert.equal(report.receiptSha256, sha256(fixture.receiptBytes));
	assert.equal(report.modelSha256, sha256(fixture.modelBytes));
	assert.equal(report.archiveSha256, fixture.archiveSha256);
	assert.equal(report.runs.length, 2);
	assert.equal(report.dotnetEnvironment.packageFileSetSha256, report.probeEnvironment.packageFileSetSha256);
	assert.deepEqual(report.libraries, libraries);
	for(const flag of ["installedFilesUnchanged", "sameOriginalArchive", "runtimeDefinitionsChecked", "loadedAssemblyChecked", "repeatedColdProcess", "missingInstrumentRefused"])
		assert.equal(report[flag], true, flag);
	const application = join(options.probeRoot, "application");
	const files = Object.fromEntries(await Promise.all((await nativeArtifactPaths(application)).map(async path => [path, sha256(await readFile(join(application, path)))])));
	const observer = await prepareFinContainerEdgeGdb({ model
		, component: model.component
		, nativeDirectory: report.libraryDirectory, libraries
		, probeRoot: join(root, "gdb-controls"), cwd: application
		, env: { ...copiedCleanEnvironment, LEAN_NUM_THREADS: "1"
			, DOTNET_ROOT: dirname(command)
			, DOTNET_CLI_HOME: join(application, "dotnet-home")
			, DOTNET_CLI_TELEMETRY_OPTOUT: "1", DOTNET_NOLOGO: "1"
			, DOTNET_MULTILEVEL_LOOKUP: "0" }
		, argv: ({ record, nonce, configSha256, definerIndices }) => [command, "out/Consumer.dll", record, nonce, configSha256, definerIndices.join(",")] });
	const run = await observer.run(); assert.equal(run.code, 0, run.output + run.stderr);
	assert.equal(sha256(run.stdout), report.stdoutSha256);
	const rows = readFinContainerEdgeDotnet(run.stdout), manifest = await assertFinContainerEdgeGdbRun(observer, run, rows);
	const site = '            state["entries"][self.column] += 1';
	for(const replacement of [
		'            if self.column != 6:\n                state["entries"][self.column] += 1'
		, '            if self.column != 0:\n                state["entries"][self.column] += 1'
		, site + '\n            state["entries"][0] += 1'
	]) {
		assert.equal(finContainerEdgeGdbScript.split(site).length, 2);
		const result = await observer.run({ script: finContainerEdgeGdbScript.replace(site, replacement) });
		assert.equal(result.code, 5, result.output + result.stderr);
		assert.equal(result.stderr, "wrong .NET edge dispatch count\n");
	}
	for(const [before, after] of [
		['"entries": [0] * WIDTH', '"entries": [1] * WIDTH']
		, ['config["nonce"].encode()', 'b"0" * 32']
		, ['config["configSha256"].encode()', 'b"0" * 64']
	]) {
		assert.equal(finContainerEdgeGdbScript.split(before).length, 2);
		const result = await observer.run({ script: finContainerEdgeGdbScript.replace(before, after) });
		assert.equal(result.code, 2, result.output + result.stderr); assert.equal(result.stdout, "");
	}
	for(const inject of [{ arm: true }, { write: 1 }])
	{
		const result = await observer.run({ inject }); assert.equal(result.code, 71, result.output);
	}
	const bytes = await readFile(run.armed);
	try
	{
		await writeFile(run.armed, canonicalJson({ ...manifest, nonce: "0".repeat(32) }));
		await assert.rejects(assertFinContainerEdgeGdbRun(observer, run, rows), assert.AssertionError);
	}
	finally
	{ await writeFile(run.armed, bytes); }
	assert.deepEqual(await nativeArtifactPaths(application), Object.keys(files));
	for(const [path, digest] of Object.entries(files)) assert.equal(sha256(await readFile(join(application, path))), digest, path);
	await verifyFinContainerEdgeDotnetEnvironment(dotnetEnvironment);
	await assert.rejects(observeFinContainerEdgeDotnet({ ...options, dotnetEnvironment: null }), /original guarded deployment/u);
	await assert.rejects(observeFinContainerEdgeDotnet({ ...options, probeRoot: join(options.installed, "probe") }), /outside the installed package/u);
	await assert.rejects(observeFinContainerEdgeDotnet({ ...options, probeRoot: join(dotnetEnvironment.root, "probe") }), /outside the installed package/u);
	await assert.rejects(observeFinContainerEdgeDotnet({ ...options, expectedModelSha256: "0".repeat(64) }), /producer's model/u);
	const library = join(dotnetEnvironment.root, "out", report.assembly), original = await readFile(library);
	try
	{
		await writeFile(library, Buffer.concat([original, Buffer.from("drift")]));
		await assert.rejects(observeFinContainerEdgeDotnet({ ...options, probeRoot: join(root, "assembly-drift") }), /file drift/u);
	}
	finally
	{ await writeFile(library, original); }
	await verifyFinContainerEdgeDotnetEnvironment(dotnetEnvironment);
	t.diagnostic(`.NET source fixture: ${report.checks} assertions, ${report.measuredCalls} measured calls, stdout SHA-256 ${report.stdoutSha256}`);
});
