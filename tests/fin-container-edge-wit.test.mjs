/**
 * Complete Component Model edge observation and refusal controls against actual compiled Lean.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { nativeArtifactPaths } from "../src/build/native-artifacts.mjs";
import { finContainerEdgeConsumer } from "./helpers/fin-container-edges.mjs";
import { finContainerEdgeCompilerModel } from "./helpers/fin-container-edge-compiled-fixture.mjs";
import { finContainerEdgeEntries, finContainerEdgeInterposer, finContainerEdgeRawExpected } from "./helpers/fin-container-edge-dispatch.mjs";
import { repeatFinContainerEdges } from "./helpers/fin-container-edge-install.mjs";
import { verifyFinContainerEdgeArchiveClosure, verifyFinContainerEdgeFileClosure } from "./helpers/fin-container-edge-closure.mjs";
import { verifyFinContainerEdgeDeployment } from "./helpers/fin-container-edge-observer.mjs";
import { finContainerEdgeWitChecks, finContainerEdgeWitExpected, finContainerEdgeWitProbe, finContainerEdgeWitSymbols, readFinContainerEdgeWit } from "./helpers/fin-container-edge-wit.mjs";
import { finContainerEdgeWitFixture } from "./helpers/fin-container-edge-wit-fixture.mjs";
import { finContainerEdgeWitDefinitions, observeFinContainerEdgeWit } from "./helpers/fin-container-edge-wit-observer.mjs";
import { copiedCleanEnvironment, installCopiedConsumer, runCopied } from "./helpers/copied-fixture-install.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

const transcript = rows => rows.map(([step, method, status, counts]) => `edge-wit ${step} ${method} ${status} ${counts.join(" ")}\n`).join("") + `fin-container-ok:${finContainerEdgeWitChecks}\n`;

test("WIT transcript requires the complete original calls and 6,000 recovery pairs", () => {
	assert.equal(finContainerEdgeWitExpected.length, 12038);
	assert.deepEqual(finContainerEdgeWitExpected.at(-1)[3], [1003, 1003, 1001, 1001, 1001, 1003, 1003, 1003]);
	const totals = [[1001, 1003], [1001, 1003], [1001, 1003], [1003, 1003], [1003, 1004], [1003, 1010]];
	for(const [index, method] of finContainerEdgeEntries.entries())
	{
		const rows = finContainerEdgeWitExpected.filter(row => row[1] === method);
		assert.deepEqual([0, 1].map(status => rows.filter(row => row[2] === status).length), totals[index], method);
	}
	assert.deepEqual(readFinContainerEdgeWit(transcript(finContainerEdgeWitExpected)), finContainerEdgeWitExpected);
	for(const mutate of [
		rows => { rows[1][3][0]++; }
		, rows => { rows[0][3][6]--; }
		, rows => { rows[1][2] = 0; }
		, rows => { rows[0][1] = "flatten"; }
		, rows => { [rows[0], rows[1]] = [rows[1], rows[0]]; }
		, rows => { rows.splice(19, 1); }
		, rows => { rows.push(rows.at(-1)); }
	]) {
		const rows = structuredClone(finContainerEdgeWitExpected); mutate(rows);
		assert.throws(() => readFinContainerEdgeWit(transcript(rows)));
	}
	assert.throws(() => readFinContainerEdgeWit(transcript(finContainerEdgeWitExpected).replace("fin-container-ok:14066", "fin-container-ok:2033")));
	assert.throws(() => { finContainerEdgeWitExpected[0][3][0]++; });
});

test("WIT probe preserves all statements and borrows the same public call values", async () => {
	const model = finContainerEdgeCompilerModel(), original = await finContainerEdgeConsumer("wit-wasi");
	const definitions = Object.fromEntries(finContainerEdgeWitSymbols.map(symbol => [symbol, "/installed/lib/libfixture.so"]));
	const { source, prelude, initial } = await finContainerEdgeWitProbe(model, model.component, definitions);
	assert.equal(source.replace("#define _GNU_SOURCE\n", "").replace(prelude + "\n", "").replace(initial, ""), original);
	assert.equal((source.match(/#define fincontainers_wasmtime_call edge_wit_call/gu) ?? []).length, 1);
	assert.equal((source.match(/unexpected WIT public definition:/gu) ?? []).length, finContainerEdgeWitSymbols.length);
	assert.ok(prelude.includes("fincontainers_wasmtime_call(session, name, args, count, output)"));
	assert.ok(prelude.includes("return error;"));
	assert.doesNotMatch(prelude, /val_delete|error_delete|lean_|malloc|calloc/u);
	for(const mutate of [
		value => { delete value[finContainerEdgeWitSymbols[0]]; }
		, value => { value.unexpected = "/installed/other.so"; }
		, value => { value[finContainerEdgeWitSymbols[0]] = "relative.so"; }
		, value => { value[finContainerEdgeWitSymbols[0]] = "/bad\0.so"; }
	]) {
		const changed = structuredClone(definitions); mutate(changed);
		await assert.rejects(finContainerEdgeWitProbe(model, model.component, changed), assert.AssertionError);
	}
});

test("real WIT edge calls cross the compiled component with checked native entries", { skip: process.env.LEAN_BRIDGE_FIN_CONTAINER_EDGE_SOURCE_TEST !== "1" }, async t => {
	const fixture = await finContainerEdgeWitFixture(t), { root, model, libraries } = fixture;
	const consumer = join(root, "consumer");
	const installation = await installCopiedConsumer({ profile: "wit-wasi"
		, consumer
		, handoff: fixture.handoff, packages: fixture.packages
		, environment: { LEAN_BRIDGE_WASM_TOOLS: fixture.wasmTools }
		, fixture: { source: () => finContainerEdgeConsumer("wit-wasi")
			, success: "fin-container-ok", expectedChecks: finContainerEdgeWitChecks
			, wit: [/empty-array: func/u, /empty-list: func/u, /empty-option: func/u, /optional-digits: func/u]
			, verifyInstalledPackage: verifyFinContainerEdgeArchiveClosure } });
	const relocated = await repeatFinContainerEdges({ profile: "wit-wasi", consumer
		, handoff: fixture.handoff, packages: fixture.packages
		, command: installation.command, measureDispatch: true
		, expectedModelSha256: sha256(fixture.modelBytes)
		, leanPrefix: fixture.prefix });
	assert.equal(relocated.exactPackageFiles, true);
	assert.deepEqual(relocated.rawAdapterDispatch.observed, finContainerEdgeRawExpected);
	const report = relocated.publicHostDispatch;
	assert.equal(report.kind, "fin-container-edge-public-wit-v1");
	assert.equal(report.checks, 14066); assert.equal(report.measuredCalls, 12038);
	assert.deepEqual(report.observations, finContainerEdgeWitExpected);
	assert.equal(report.receiptSha256, sha256(fixture.receiptBytes));
	assert.equal(report.modelSha256, sha256(fixture.modelBytes));
	assert.deepEqual(report.libraries, libraries); assert.equal(report.repeatExecutions, 2);
	assert.deepEqual(report.linkLibraries, ["libfincontainers_wasmtime.so", "libwasmtime.so"]);
	for(const flag of ["installedFilesUnchanged", "runtimeDefinitionsChecked", "repeatedColdProcess", "missingInstrumentRefused"])
		assert.equal(report[flag], true, flag);
	const options = { installed: report.packageDirectory, receiptPath: fixture.receiptPath, receiptBytes: fixture.receiptBytes, expectedModelSha256: sha256(fixture.modelBytes), exactFileClosure: true };
	const deployment = await verifyFinContainerEdgeDeployment(options), definitions = await finContainerEdgeWitDefinitions(deployment);
	const selected = symbols => Object.fromEntries(symbols.map(symbol => [symbol, definitions[symbol]]));
	const instrument = finContainerEdgeInterposer(model, model.component, selected(deployment.columns));
	const { source } = await finContainerEdgeWitProbe(model, model.component, selected(finContainerEdgeWitSymbols));
	const probe = join(root, "controls"); await mkdir(probe);
	await saveLakeFile(probe, "public.c", source);
	const tools = { ...copiedCleanEnvironment, PATH: "/usr/bin:/bin" }, strict = ["-std=c11", "-Wall", "-Wextra", "-Werror"];
	const link = ["-L", deployment.directory, "-lfincontainers_wasmtime", "-lwasmtime", `-Wl,-rpath,${deployment.directory}`, "-ldl"];
	const compile = () => runCopied("/usr/bin/cc", [...strict, "-I", join(options.installed, "include"), "public.c", ...link, "-o", "public"], probe, tools);
	await compile();
	const buildInstrument = async bytes => {
		await saveLakeFile(probe, "interposer.c", bytes);
		await runCopied("/usr/bin/cc", [...strict, "-shared", "-fPIC", "interposer.c", "-ldl", "-o", "libedge.so"], probe, tools);
	};
	await buildInstrument(instrument);
	const execute = () => runCopied(join(probe, "public"), [], probe, { ...copiedCleanEnvironment, LEAN_NUM_THREADS: "1", LD_PRELOAD: join(probe, "libedge.so") });
	const normal = await execute(); assert.equal(normal.stderr, ""); assert.equal(sha256(normal.stdout), report.stdoutSha256);
	for(const changed of [
		instrument.replace("++counts[0];", "/* source entry deliberately uncounted */")
		, instrument.replace("++counts[6];", "/* adapter entry deliberately uncounted */")
		, instrument.replace("++counts[6];", "++counts[6]; ++counts[0];")
	]) {
		assert.notEqual(changed, instrument); await buildInstrument(changed);
		await assert.rejects(execute, error => /exited with status 5:/u.test(error.message) && error.details.stderr === "wrong WIT edge dispatch count\n");
	}
	await buildInstrument(instrument.replace("counts[8];", "counts[8] = {1};"));
	await assert.rejects(execute, error => /exited with status 3:/u.test(error.message) && error.details.stdout === "");
	await buildInstrument(instrument);
	const foreign = { ...selected(finContainerEdgeWitSymbols), fincontainers_wasmtime_call: "/foreign/lib.so" };
	await saveLakeFile(probe, "public.c", (await finContainerEdgeWitProbe(model, model.component, foreign)).source); await compile();
	await assert.rejects(execute, error => /exited with status 6:/u.test(error.message) && error.details.stdout === "");
	await saveLakeFile(probe, "public.c", source); await compile();
	const badDefiners = { ...selected(deployment.columns), [deployment.columns[0]]: "/foreign/lib.so" };
	await buildInstrument(finContainerEdgeInterposer(model, model.component, badDefiners));
	await assert.rejects(execute, error => /exited with status 6:/u.test(error.message) && /unexpected edge definition/u.test(error.details.stderr));
	await buildInstrument(instrument);
	const packageFiles = {};
	for(const path of await nativeArtifactPaths(options.installed)) packageFiles[path] = sha256(await readFile(join(options.installed, path)));
	await verifyFinContainerEdgeFileClosure(options);
	await assert.rejects(observeFinContainerEdgeWit({ ...options, probeRoot: join(options.installed, "probe") }), /outside the installed package/u);
	await assert.rejects(observeFinContainerEdgeWit({ ...options, probeRoot: join(root, "wrong-model"), expectedModelSha256: "0".repeat(64) }), /producer's model/u);
	const receiptFile = join(options.installed, options.receiptPath);
	try
	{
		for(const mutate of [
			value => { delete value.componentSha256; }
			, value => { value.componentSha256 = "0".repeat(64); }
			, value => { value.wasmtime = "0.0.0"; }
		]) {
			const receipt = JSON.parse(fixture.receiptBytes); mutate(receipt);
			const bytes = canonicalJson(receipt); await writeFile(receiptFile, bytes);
			await assert.rejects(observeFinContainerEdgeWit({ ...options, receiptBytes: bytes, probeRoot: join(root, "metadata-drift") }), assert.AssertionError);
		}
	}
	finally
	{ await writeFile(receiptFile, fixture.receiptBytes); }
	const library = join(deployment.directory, "libfincontainers_wasmtime.so"), original = await readFile(library);
	try
	{
		await writeFile(library, Buffer.concat([original, Buffer.from("drift")]));
		await assert.rejects(observeFinContainerEdgeWit({ ...options, probeRoot: join(root, "host-drift") }));
	}
	finally
	{ await writeFile(library, original); }
	for(const [path, digest] of Object.entries(packageFiles)) assert.equal(sha256(await readFile(join(options.installed, path))), digest, basename(path));
	assert.deepEqual(await verifyFinContainerEdgeDeployment(options), deployment);
	t.diagnostic(`WIT source fixture: ${report.checks} assertions, ${report.measuredCalls} measured calls, stdout SHA-256 ${report.stdoutSha256}`);
});
