/**
 * Execute the complete public C consumer against real Lean and normal generated C/GMP bindings.
 * These source gates do not substitute for installed, relocated package acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { copyFile, mkdir, mkdtemp, readFile, readdir, rename, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { hashBindingIr } from "../src/binding-ir/canonical.mjs";
import { compileFinContainerEdgeFixture, finContainerEdgeCompilerModel } from "./helpers/fin-container-edge-compiled-fixture.mjs";
import { finContainerEdgeColumns, finContainerEdgeEntries, finContainerEdgeInterposer, finContainerEdgePublicExpected, finContainerEdgePublicProbe, finContainerEdgePublicSymbols, readFinContainerEdgePublic } from "./helpers/fin-container-edge-dispatch.mjs";
import { observeFinContainerEdgePublic } from "./helpers/fin-container-edge-public-observer.mjs";
import { assertFinContainerEdgeProbeLocation, observeFinContainerEdgeRaw } from "./helpers/fin-container-edge-observer.mjs";
import { copiedCleanEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

const text = rows => rows.map(([step, method, status, counts]) => `edge-public ${step} ${method} ${status} ${counts.join(" ")}\n`).join("") + "fin-container-ok:14114\n";
const expectedTotals = [[1001, 1004], [1001, 1004], [1002, 1004], [1004, 1005], [1003, 1004], [1002, 1011]];

test("raw and public probes cannot write through an outside symlink into the installed package", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-fin-edge-probe-location-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const installed = join(root, "installed");
	await mkdir(installed);
	await symlink(installed, join(root, "alias"));
	await assertFinContainerEdgeProbeLocation(installed, join(root, "outside"));
	for(const probeRoot of [installed, join(installed, "probe"), join(root, "alias/probe")])
	{
		await assert.rejects(assertFinContainerEdgeProbeLocation(installed, probeRoot), /outside the installed package/u);
		for(const observe of [observeFinContainerEdgeRaw, observeFinContainerEdgePublic])
			await assert.rejects(observe({ installed, probeRoot }), /outside the installed package/u);
	}
	assert.deepEqual(await readdir(installed), []);
});

test("public expectations include the old consumer, malformed carriers and all six thousand recovery pairs", () => {
	assert.equal(finContainerEdgePublicExpected.length, 12045);
	assert.deepEqual(finContainerEdgePublicExpected.at(-1)[3], [1003, 1002, 1001, 1001, 1002, 1004, 1003, 1002]);
	for(const [index, method] of finContainerEdgeEntries.entries())
	{
		const rows = finContainerEdgePublicExpected.filter(row => row[1] === method);
		assert.deepEqual([rows.filter(row => row[2] === 0).length, rows.filter(row => row[2] === 1).length], expectedTotals[index], method);
	}
	assert.throws(() => { finContainerEdgePublicExpected[0][3][0]++; });
	assert.equal(finContainerEdgeCompilerModel().exports.length, 12);
});

test("public instrumentation requires exactly six absolute GMP definition identities", async () => {
	const model = finContainerEdgeCompilerModel();
	const definitions = Object.fromEntries(finContainerEdgePublicSymbols.map(symbol => [symbol, "/verified/lib/libfincontainers_gmp.so"]));
	for(const mutate of [
		value => { delete value[finContainerEdgePublicSymbols[0]]; }
		, value => { value.unknown = "/verified/lib/libother.so"; }
		, value => { value[finContainerEdgePublicSymbols[0]] = "relative.so"; }
		, value => { value[finContainerEdgePublicSymbols[0]] = "/verified/invalid\0.so"; }
	]) {
		const changed = structuredClone(definitions); mutate(changed);
		await assert.rejects(finContainerEdgePublicProbe(model, model.component, changed), assert.AssertionError);
	}
	const source = await finContainerEdgePublicProbe(model, model.component, definitions);
	assert.equal((source.match(/unexpected public edge definition:/gu) ?? []).length, 6);
});

test("public transcript requires exact per-call identities, statuses, counters and complete consumer success", () => {
	const valid = text(finContainerEdgePublicExpected);
	assert.deepEqual(readFinContainerEdgePublic(valid), finContainerEdgePublicExpected);
	for(const mutate of [
		rows => { rows[1][3][0]++; }
		, rows => { rows[0][3][6]--; }
		, rows => { rows[1][2] = 0; }
		, rows => { rows[0][1] = "flatten"; }
		, rows => { [rows[0], rows[1]] = [rows[1], rows[0]]; }
		, rows => { rows.pop(); }
		, rows => { rows.push(rows.at(-1)); }
		, rows => { rows.at(-1)[3][5]--; }
	]) {
		const rows = structuredClone(finContainerEdgePublicExpected); mutate(rows);
		assert.throws(() => readFinContainerEdgePublic(text(rows)), assert.AssertionError);
	}
	for(const changed of [valid.trimEnd(), valid + "\n", valid.replace("fin-container-ok:14114", "fin-container-ok:2041"), valid.replace(" 1 present", " 01 present")])
		assert.throws(() => readFinContainerEdgePublic(changed), assert.AssertionError);
});

test("complete public consumer executes real Lean with every entry measured and broken instruments refused", { skip: process.env.LEAN_BRIDGE_FIN_CONTAINER_EDGE_SOURCE_TEST !== "1" }, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-fin-edge-public-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const lean = resolve(process.env.LEAN_BRIDGE_LEAN ?? ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2/bin/lean");
	const { model, environment, prefix } = await compileFinContainerEdgeFixture(root, lean);
	const source = await finContainerEdgePublicProbe(model, model.component);
	const instrument = finContainerEdgeInterposer(model, model.component);
	await saveLakeFile(root, "public.c", source);
	await saveLakeFile(root, "interposer.c", instrument);
	const strict = ["-std=c11", "-Wall", "-Wextra", "-Werror"];
	await runCopied("/usr/bin/cc", [...strict, "-Igmp/include", "public.c", "-L.", "-Wl,--no-as-needed", "-ledge-gmp", "-ledge-source", "-lgmp", "-Wl,-rpath,$ORIGIN", "-ldl", "-o", "public"], root, environment);
	await runCopied("/usr/bin/cc", [...strict, "-shared", "-fPIC", "interposer.c", "-ldl", "-o", "interposer.so"], root, environment);
	const runtime = { ...copiedCleanEnvironment, LEAN_NUM_THREADS: "1" };
	await assert.rejects(() => runCopied(join(root, "public"), [], root, runtime)
		, error => /exited with status 2:/u.test(error.message) && error.details.stdout === "" && error.details.stderr === "edge interposer is not loaded\n");
	const observed = await runCopied(join(root, "public"), [], root, { ...runtime, LD_PRELOAD: join(root, "interposer.so") });
	assert.equal(observed.stderr, "");
	assert.deepEqual(readFinContainerEdgePublic(observed.stdout), finContainerEdgePublicExpected);
	for(const [label, before, after] of [
		["missing-adapter", "++counts[6];", "/* omitted adapter */"]
		, ["missing-source", "++counts[0];", "/* omitted source */"]
		, ["extra-source", "++counts[2];", "++counts[2]; ++counts[0];"]
	]) {
		assert.equal(instrument.split(before).length, 2);
		await saveLakeFile(root, `${label}.c`, instrument.replace(before, after));
		await runCopied("/usr/bin/cc", [...strict, "-shared", "-fPIC", `${label}.c`, "-ldl", "-o", `${label}.so`], root, environment);
		await assert.rejects(() => runCopied(join(root, "public"), [], root, { ...runtime, LD_PRELOAD: join(root, `${label}.so`) })
			, error => /exited with status 5:/u.test(error.message) && error.details.stderr === "wrong public edge dispatch count\n", label);
	}
	// An explicitly synthetic receipt validates the observer, not a package-manager installation.
	const staging = join(root, "receipt-fixture"), installed = join(root, "receipt-fixture-moved");
	await mkdir(join(staging, "lib"), { recursive: true });
	const members = ["lib/libedge-source.so", "lib/libedge-gmp.so"];
	for(const name of ["libedge-source.so", "libedge-gmp.so"]) await copyFile(join(root, name), join(staging, "lib", name));
	for(const name of ["libleanshared.so", "libleanshared_1.so", "libleanshared_2.so"])
	{
		await copyFile(join(prefix, "lib/lean", name), join(staging, "lib", name));
		members.push(`lib/${name}`);
	}
	for(const path of ["include/fincontainers.h", "include/detail/fincontainers_gmp.h"])
	{
		await saveLakeFile(staging, path, await readFile(join(root, "gmp", path)));
		members.push(path);
	}
	const multiarch = (await runCopied("/usr/bin/cc", ["-print-multiarch"], root, environment)).stdout.trim();
	assert.match(multiarch, /^[A-Za-z0-9_-]+$/u);
	await saveLakeFile(staging, "include/gmp.h", await readFile(`/usr/include/${multiarch}/gmp.h`));
	const gmp = (await runCopied("/usr/bin/cc", ["-print-file-name=libgmp.so.10"], root, environment)).stdout.trim();
	assert.ok(gmp.startsWith("/"));
	await copyFile(gmp, join(staging, "lib/libgmp.so.10"));
	members.push("include/gmp.h", "lib/libgmp.so.10", "lean-bridge/component/model.json");
	const bindingIrSha256 = hashBindingIr(model.bindingIr);
	const modelBytes = Buffer.from(JSON.stringify({ ...model, bindingIrSha256 }));
	await saveLakeFile(staging, "lean-bridge/component/model.json", modelBytes);
	const files = {};
	for(const path of members)
	{
		const bytes = await readFile(join(staging, path));
		files[path] = { bytes: bytes.length, sha256: sha256(bytes) };
	}
	const receiptBytes = Buffer.from(JSON.stringify({ component: model.component, bindingIrSha256, files }));
	await saveLakeFile(staging, "package-receipt.json", receiptBytes);
	await rename(staging, installed);
	const options = { installed, receiptPath: "package-receipt.json", receiptBytes, expectedModelSha256: sha256(modelBytes), probeRoot: join(root, "receipt-probe") };
	const receiptObservation = await observeFinContainerEdgePublic(options);
	assert.deepEqual(receiptObservation.observations, finContainerEdgePublicExpected);
	assert.equal(receiptObservation.profile, "c");
	assert.equal(receiptObservation.observed, true);
	assert.equal(receiptObservation.runtimeDefinitionsChecked, true);
	assert.equal(receiptObservation.installedFilesUnchanged, true);
	const definingPaths = symbols => Object.fromEntries(symbols.map(symbol => [symbol, join(receiptObservation.libraryDirectory, receiptObservation.definitions[symbol])]));
	assert.equal(receiptObservation.probeSha256, sha256(await finContainerEdgePublicProbe(model, model.component, definingPaths(finContainerEdgePublicSymbols))));
	assert.equal(receiptObservation.interposerSha256, sha256(finContainerEdgeInterposer(model, model.component, definingPaths(receiptObservation.columns))));
	assert.deepEqual(Object.keys(receiptObservation.headerDigests), ["include/fincontainers.h", "include/detail/fincontainers_gmp.h", "include/gmp.h"]);
	await assert.rejects(observeFinContainerEdgePublic(options), { code: "EEXIST" });
	await assert.rejects(observeFinContainerEdgePublic({ ...options, probeRoot: join(installed, "probe") }), /outside the installed package/u);
	const header = join(installed, "include/fincontainers.h"), headerBytes = await readFile(header);
	await saveLakeFile(installed, "include/fincontainers.h", Buffer.concat([headerBytes, Buffer.from("\n/* altered */\n")]));
	await assert.rejects(observeFinContainerEdgePublic({ ...options, probeRoot: join(root, "changed-header") }), /native artifact drift/u);
	await saveLakeFile(installed, "include/fincontainers.h", headerBytes);
	const wrong = Object.fromEntries(finContainerEdgePublicSymbols.map(symbol => [symbol, join(root, "libedge-gmp.so")]));
	wrong[finContainerEdgePublicSymbols[0]] = join(root, "libedge-source.so");
	await saveLakeFile(root, "wrong-public.c", await finContainerEdgePublicProbe(model, model.component, wrong));
	await runCopied("/usr/bin/cc", [...strict, "-Igmp/include", "wrong-public.c", "-L.", "-Wl,--no-as-needed", "-ledge-gmp", "-ledge-source", "-lgmp", "-Wl,-rpath,$ORIGIN", "-ldl", "-o", "wrong-public"], root, environment);
	await assert.rejects(() => runCopied(join(root, "wrong-public"), [], root, { ...runtime, LD_PRELOAD: join(root, "interposer.so") })
		, error => /exited with status 6:/u.test(error.message) && error.details.stdout === "" && error.details.stderr === `unexpected public edge definition: ${finContainerEdgePublicSymbols[0]}\n`);
	t.diagnostic(JSON.stringify({ scope: "compiler/runtime source gate, not installed-package acceptance"
		, originalConsumerChecks: 14114, measuredCalls: 12045
		, columns: finContainerEdgeColumns(model, model.component)
		, finalCounts: finContainerEdgePublicExpected.at(-1)[3]
		, probeSha256: sha256(source), interposerSha256: sha256(instrument)
		, stdoutSha256: sha256(observed.stdout)
		, compiledLeanSha256: sha256(await readFile(join(root, "FinContainers.c"))) }));
});
