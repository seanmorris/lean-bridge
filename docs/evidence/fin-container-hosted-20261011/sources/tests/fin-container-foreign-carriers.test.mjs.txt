/**
 * Malformed foreign carriers: real Lean source gates and exact transcript/refusal controls.
 * Synthetic receipt fixtures below are not canonical installed-package acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { copyFile, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { hashBindingIr } from "../src/binding-ir/canonical.mjs";
import { finContainerEdgeEntries, finContainerEdgeInterposer } from "./helpers/fin-container-edge-dispatch.mjs";
import { compileFinContainerEdgeSplitFixture, finContainerEdgeCompilerModel } from "./helpers/fin-container-edge-compiled-fixture.mjs";
import { finForeignCases, finForeignExpected, finForeignHeader, finForeignProbe, finForeignSymbols, readFinForeign } from "./helpers/fin-container-foreign-carriers.mjs";
import { observeFinForeignCarriers } from "./helpers/fin-container-foreign-observer.mjs";
import { copiedCleanEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

const text = rows => rows.map(([name, status, calls, counts]) => `foreign-carrier ${name} ${status} ${calls} ${counts.join(" ")}\n`).join("");
test("foreign cases cover each root, active tag, nested position, bound refusal and inactive payload", () => {
	assert.equal(finForeignCases.length, 77);
	assert.equal(new Set(finForeignCases.map(item => item.name)).size, 77);
	const actual = (method, kind) => finForeignCases.filter(item => item.method === method && item.kind === kind).map(item => [item.row, item.column]);
	for(let method = 0; method < 6; method++)
	{
		for(const kind of [0, 1, 2, 3, 4, 9, 10]) assert.deepEqual(actual(method, kind), [[0, 0]]);
		assert.equal(finForeignCases.filter(item => item.method === method && item.accepted).length, 2);
	}
	for(const method of [0, 1, 3, 4]) assert.deepEqual(actual(method, 5), [[0, 0], [1, 0], [2, 0]]);
	assert.deepEqual(actual(2, 5), [[0, 0]]);
	for(const method of [2, 3]) assert.deepEqual(actual(method, 6), [[0, 2], [0, 255]]);
	assert.deepEqual(actual(4, 6), [[0, 2], [0, 255], [1, 2], [1, 255], [2, 2], [2, 255]]);
	assert.deepEqual(actual(5, 7), [[0, 0], [1, 0], [2, 0]]);
	assert.deepEqual(actual(5, 8), [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2], [2, 0], [2, 1], [2, 2]]);
	assert.equal(finForeignExpected.length, 84);
	assert.deepEqual(finForeignExpected.at(-1), ["recovery-flatten", "pairs:1000", 12077, Array(8).fill(1002)]);
	assert.ok(finForeignExpected.slice(0, 66).every(row => row[3].every(count => count === 0)));
	assert.throws(() => { finForeignCases[0].kind = 0; });
});

test("foreign transcript requires every call, refusal, positive control and recovery counter", () => {
	assert.deepEqual(readFinForeign(text(finForeignExpected)), finForeignExpected);
	for(const mutate of [
		rows => { rows[1][3][0]++; }
		, rows => { rows.at(-1)[3][7]--; }
		, rows => { rows[1][1] = "ok"; }
		, rows => { rows[2][0] = rows[1][0]; }
		, rows => { rows[2][2]--; }
		, rows => { rows.splice(10, 1); }
		, rows => { rows.push(rows.at(-1)); }
		, rows => { [rows[0], rows[1]] = [rows[1], rows[0]]; }
	]) {
		const rows = structuredClone(finForeignExpected); mutate(rows);
		assert.throws(() => readFinForeign(text(rows)), assert.AssertionError);
	}
	for(const invalid of [text(finForeignExpected).trimEnd(), text(finForeignExpected) + "\n", text(finForeignExpected).replace(" 0", " 00")])
		assert.throws(() => readFinForeign(invalid), assert.AssertionError);
});

test("foreign probe regenerates production ABI declarations and authenticates all public definitions", async () => {
	const model = finContainerEdgeCompilerModel();
	const definitions = Object.fromEntries(finForeignSymbols.map(symbol => [symbol, "/verified/lib/component.so"]));
	const source = await finForeignProbe(model, definitions);
	assert.equal((source.match(/check_definition\("/gu) ?? []).length, 10);
	assert.equal((source.match(/cycle < 1000/gu) ?? []).length, 6);
	assert.doesNotMatch(source, /lean_alloc|lean_box|lean_ctor|lean_object/u);
	assert.match(finForeignHeader(model), /FINCONTAINERS_BINDING_ABI_VERSION 1u/u);
	assert.match(source, /kind == 4 \? a->nats : NULL/u);
	for(const mutate of [
		value => { delete value[finForeignSymbols[0]]; }
		, value => { value[finForeignSymbols[0]] = "relative.so"; }
		, value => { value[finForeignSymbols[0]] += "\0"; }
		, value => { value.foreign = "/verified/lib/component.so"; }
	]) {
		const changed = { ...definitions }; mutate(changed);
		await assert.rejects(finForeignProbe(model, changed), assert.AssertionError);
	}
	await assert.rejects(observeFinForeignCarriers({ profile: "unselected" }), /Explicit installed package profile/u);
});

test("foreign source probe executes real Lean, authenticates a synthetic receipt and refuses broken counters", { skip: process.env.LEAN_BRIDGE_FIN_CONTAINER_EDGE_SOURCE_TEST !== "1" }, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-fin-foreign-source-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const compiled = join(root, "compiled"); await mkdir(compiled);
	const lean = resolve(process.env.LEAN_BRIDGE_LEAN ?? ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2/bin/lean");
	const { model, prefix, environment } = await compileFinContainerEdgeSplitFixture(compiled, lean, { relocatable: true });
	assert.equal(finForeignHeader(model), await readFile(join(compiled, "raw/include/fincontainers.h"), "utf8"));
	const installed = join(root, "synthetic-package"), native = join(installed, "lib");
	await mkdir(native, { recursive: true }); const files = {};
	for(const name of ["libedge-source.so", "liblean_bridge_native.so", "libleanshared.so", "libleanshared_1.so", "libleanshared_2.so"])
	{
		const source = join(name.startsWith("libleanshared") ? join(prefix, "lib/lean") : compiled, name);
		await copyFile(source, join(native, name));
		const bytes = await readFile(source); files[`lib/${name}`] = { bytes: bytes.length, sha256: sha256(bytes) };
	}
	const bindingIrSha256 = hashBindingIr(model.bindingIr), modelBytes = Buffer.from(JSON.stringify({ ...model, bindingIrSha256 }));
	await saveLakeFile(installed, "lean-bridge/component/model.json", modelBytes);
	files["lean-bridge/component/model.json"] = { bytes: modelBytes.length, sha256: sha256(modelBytes) };
	const receiptBytes = Buffer.from(JSON.stringify({ component: model.component, bindingIrSha256, files }));
	await saveLakeFile(installed, "package-receipt.json", receiptBytes);
	const options = { installed, receiptPath: "package-receipt.json", receiptBytes
		, expectedModelSha256: sha256(modelBytes)
		, profile: "c", exactFileClosure: true
		, probeRoot: join(root, "foreign-probe") };
	const observation = await observeFinForeignCarriers(options);
	assert.deepEqual(observation.observations, finForeignExpected);
	assert.equal(observation.measuredCalls, 12077);
	assert.equal(observation.cases, 77);
	assert.equal(observation.recoveryPairsPerEntrypoint, 1000);
	assert.equal(observation.packageProfile, "c");
	assert.match(observation.caller, /Separate C foreign-carrier probe/u);
	assert.equal(observation.missingInstrumentRefused, true);
	assert.equal(observation.installedFilesUnchanged, true);
	assert.equal(observation.runtimeDefinitionsChecked, true);
	assert.equal(observation.headerSha256, sha256(finForeignHeader(model)));
	await assert.rejects(observeFinForeignCarriers(options), { code: "EEXIST" });
	await assert.rejects(observeFinForeignCarriers({ ...options, probeRoot: join(installed, "probe") }), /outside the installed package/u);
	const select = symbols => Object.fromEntries(symbols.map(symbol => [symbol, join(native, observation.definitions[symbol])]));
	const interposer = finContainerEdgeInterposer(model, model.component, select(observation.columns));
	const runtime = { ...copiedCleanEnvironment, LEAN_NUM_THREADS: "1" };
	for(const [name, before, after] of [
		["missing-adapter", "++counts[2];", "/* omitted adapter */"]
		, ["missing-source", "++counts[0];", "/* omitted source */"]
		, ["extra-source", "++counts[3];", "++counts[3]; ++counts[0];"]
	]) {
		assert.equal(interposer.split(before).length, 2);
		await saveLakeFile(options.probeRoot, `${name}.c`, interposer.replace(before, after));
		await runCopied("/usr/bin/cc", ["-std=c11", "-Wall", "-Wextra", "-Werror", "-shared", "-fPIC", `${name}.c`, "-ldl", "-o", `${name}.so`], options.probeRoot, environment);
		await assert.rejects(runCopied(join(options.probeRoot, "foreign"), [], options.probeRoot, { ...runtime, LD_PRELOAD: join(options.probeRoot, `${name}.so`) })
			, error => /exited with status 5:/u.test(error.message) && error.details.stderr === "foreign carrier probe: incorrect source or adapter dispatch\n", name);
	}
	const wrong = select(finForeignSymbols); wrong[finForeignSymbols[0]] = join(native, "libleanshared.so");
	await saveLakeFile(options.probeRoot, "wrong.c", await finForeignProbe(model, wrong));
	await runCopied("/usr/bin/cc", ["-std=c11", "-Wall", "-Wextra", "-Werror", "-I.", "wrong.c", "-L", native, "-ledge-source", `-Wl,-rpath,${native}`, "-ldl", "-o", "wrong"], options.probeRoot, environment);
	await assert.rejects(runCopied(join(options.probeRoot, "wrong"), [], options.probeRoot, { ...runtime, LD_PRELOAD: join(options.probeRoot, "libedge.so") })
		, error => /exited with status 5:/u.test(error.message) && error.details.stderr === "foreign carrier probe: unexpected public definition\n");
	assert.deepEqual(observation.measuredAdapters, finContainerEdgeEntries.map(name => `FinContainers.${name}`));
});
