/**
 * Source and transcript controls for additive Fin edge instrumentation. Installed package execution is
 * a separate acceptance gate; generated expectations are never recorded as measured dispatch.
 *
 * @file
 */
import assert from "node:assert/strict";
import { copyFile, mkdir, mkdtemp, readFile, rename, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { generateGmpProjection } from "../src/backends/c/gmp-projection.mjs";
import { brokerHeader, brokerSource } from "../src/backends/native/runtime-broker.mjs";
import { generateNativeLeanAdapters } from "../src/build/native-model.mjs";
import { finContainerEntryAdapter } from "./helpers/fin-container-entry-dispatch.mjs";
import { finContainerEdgeColumns, finContainerEdgeEntries, finContainerEdgeInterposer, finContainerEdgePublicProbe, finContainerEdgeRawCases, finContainerEdgeRawExpected, finContainerEdgeRawProbe, finContainerEdgeSourceEntries, readFinContainerEdgeRaw } from "./helpers/fin-container-edge-dispatch.mjs";
import { finContainerEdgeConsumer, finContainerEdgeRefinements, finContainerEdgeReviewedIr, finContainerEdgeSource } from "./helpers/fin-container-edges.mjs";
import { observeFinContainerEdgeRaw, verifyFinContainerEdgeDeployment } from "./helpers/fin-container-edge-observer.mjs";
import { copiedCleanEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

const model = id => ({ component: { id }
	, exports: finContainerEdgeEntries.map(method => ({
		name: `FinContainers.${method}`
		, symbol: finContainerEntryAdapter(id, `FinContainers.${method}`)
		, parameters: [{}]
		, refinements: structuredClone(finContainerEdgeRefinements[`FinContainers.${method}`])
	}))
});
const base = model("fincontainers@1.0.0");
const transcript = rows => rows.map(([name, status, counts]) => `${name} ${status} ${counts.join(" ")}\n`).join("");

test("edge columns bind all six exact declarations, refinements and adapter identities to the receipt", () => {
	for(const id of ["fincontainers@1.0.0", "FinContainers.Api@1.0.0", "org.leanbridge:fincontainers@1.0.0", "example/fincontainers@1.0.0"])
	{
		const current = model(id), columns = finContainerEdgeColumns(current, current.component);
		assert.equal(new Set(columns).size, 8);
		assert.deepEqual(columns.slice(0, 2), ["l_FinContainers_present", "l_FinContainers_flatten"]);
		assert.deepEqual(columns.slice(2), finContainerEdgeEntries.map(name => finContainerEntryAdapter(id, `FinContainers.${name}`)));
	}
	assert.throws(() => finContainerEdgeColumns(base, { id: "other@1.0.0" }));
	for(const mutate of [
		copy => { copy.exports.pop(); }
		, copy => { copy.exports.push(copy.exports[0]); }
		, copy => { copy.exports[1].symbol = finContainerEntryAdapter("other@1.0.0", copy.exports[1].name); }
		, copy => { copy.exports[0].parameters.push({}); }
		, copy => { copy.exports[2].refinements.parameters[0].arguments[0].bound = "1"; }
		, copy => { copy.exports[4].refinements.result = null; }
	]) {
		const copy = structuredClone(base); mutate(copy);
		assert.throws(() => finContainerEdgeColumns(copy, copy.component));
		assert.throws(() => finContainerEdgeRawProbe(copy, copy.component));
		assert.throws(() => finContainerEdgeInterposer(copy, copy.component));
	}
});

test("raw cases include all zero-bound and nested positions before the first positive control", () => {
	assert.equal(finContainerEdgeRawCases.length, 35);
	assert.ok(finContainerEdgeRawCases.slice(0, 24).every(row => row.outcome === null));
	assert.ok(finContainerEdgeRawCases.slice(24).every(row => row.outcome !== null));
	const cases = Object.fromEntries(finContainerEdgeRawCases.map(row => [row.name, row]));
	for(const method of ["emptyArray", "emptyList", "emptyOption"])
		for(const [word, value] of [["zero", 0n], ["one", 1n], ["wide", 2n ** 70n]])
			assert.deepEqual(cases[`invalid-${method}-${word}`].argument, method === "emptyOption" ? { some: value } : [value]);
	for(let row = 0; row < 3; row++)
	{
		assert.equal(cases[`invalid-present-${row}`].argument[row].some, 10n);
		assert.equal(cases[`invalid-optionalDigits-${row}`].argument.some[row], 10n);
		for(let column = 0; column < 3; column++) assert.equal(cases[`invalid-flatten-${row}-${column}`].argument[row][column], 10n);
	}
	assert.deepEqual(cases["valid-emptyOption"].outcome, { some: null });
	assert.deepEqual(cases["valid-optionalDigits-absent"].outcome, { some: null });
	assert.deepEqual(cases["valid-optionalDigits-empty"].outcome, { some: { some: [] } });
	assert.deepEqual(cases["valid-flatten-values"].outcome, { some: { some: [0n, 1n, 9n] } });
	assert.throws(() => { finContainerEdgeRawCases[0].argument[0] = 1n; });
});

test("raw counts require adapter-only rejection, exact positive calls and every recovery pair", () => {
	assert.equal(finContainerEdgeRawExpected.length, 42);
	for(const [, status, counts] of finContainerEdgeRawExpected.slice(1, 25))
	{
		assert.equal(status, "none");
		assert.deepEqual(counts.slice(0, 2), [0, 0]);
	}
	assert.deepEqual(finContainerEdgeRawExpected.at(-1)[2], [1002, 1003, 2004, 2004, 2004, 2006, 2005, 2012]);
	const text = transcript(finContainerEdgeRawExpected);
	assert.deepEqual(readFinContainerEdgeRaw(text), finContainerEdgeRawExpected);
	for(const mutate of [
		rows => { rows[1][2][0]++; }
		, rows => { rows[1][2][2]--; }
		, rows => { rows[25][2][2]--; }
		, rows => { rows[25][1] = "none"; }
		, rows => { [rows[1], rows[2]] = [rows[2], rows[1]]; }
		, rows => { rows.pop(); }
		, rows => { rows.push(rows.at(-1)); }
		, rows => { rows[0][2].pop(); }
		, rows => { rows.at(-1)[2][7]--; }
	]) {
		const rows = structuredClone(finContainerEdgeRawExpected); mutate(rows);
		assert.throws(() => readFinContainerEdgeRaw(transcript(rows)));
	}
	for(const malformed of [text.trimEnd(), `${text}\n`, text.replace(" 0", " 00"), text.replace(" 0", " -1"), text.replace(" 0", " 1e0")])
		assert.throws(() => readFinContainerEdgeRaw(malformed));
});

test("raw instrumentation checks each call, complete result values, retained inputs and owned cleanup", () => {
	const source = finContainerEdgeRawProbe(base, base.component);
	assert.equal((source.match(/cycle < 1000/gu) ?? []).length, 6);
	assert.ok(source.includes("lean_inc(argument)"));
	assert.ok(source.includes('same(input_shapes[index], argument, snapshot)'));
	assert.ok(source.includes("same(output_shapes[index], lean_ctor_get(result, 0), lean_ctor_get(expected, 0))"));
	assert.ok(source.includes("else if (result != lean_box(0))"));
	assert.ok(source.includes("counter(i) != before[i] + delta"));
	assert.ok(source.includes("lean_dec(result); lean_dec(argument); lean_dec(snapshot); lean_dec(expected);"));
	assert.ok(source.includes("RTLD_DEFAULT"));
	assert.ok(finContainerEdgeInterposer(base, base.component).includes("RTLD_NEXT"));
	assert.equal((finContainerEdgeInterposer(base, base.component).match(/return next\(argument\)/gu) ?? []).length, 8);
});

test("public instrumentation preserves every original assertion and checks both counters per call", async () => {
	const source = await finContainerEdgePublicProbe(base, base.component), original = await finContainerEdgeConsumer("c");
	const tail = original.slice(original.indexOf("int main(void) {") + "int main(void) {".length);
	assert.ok(source.endsWith(tail), "no original consumer assertion was replaced");
	assert.equal((source.match(/#define fincontainers_/gu) ?? []).length, 6);
	assert.equal((source.match(/status == FINCONTAINERS_STATUS_OK &&/gu) ?? []).length, 6);
	assert.ok(source.includes("edge_counter(i) != before[i] + delta"));
	assert.ok(source.includes("edge counters are not initially zero"));
	await assert.rejects(finContainerEdgePublicProbe(base, { id: "other@1.0.0" }));
});

test("deployment binding refuses foreign receipts, model drift and unrecorded native libraries", async t => {
	const installed = await mkdtemp(join(tmpdir(), "lean-bridge-fin-edge-receipt-"));
	t.after(() => rm(installed, { recursive: true, force: true }));
	// A format-only ELF fixture exercises receipt rejection, not linking or measured execution.
	const elf = Buffer.alloc(64); elf.write("\x7fELF", "binary"); elf[4] = 2; elf[5] = 1;
	elf.writeUInt16LE(62, 18); elf.writeUInt16LE(3, 16);
	const modelBytes = Buffer.from(JSON.stringify({ ...base, bindingIrSha256: "b".repeat(64) }));
	const files = { "lean-bridge/component/model.json": modelBytes, "lib/libedge.so": elf };
	for(const [path, bytes] of Object.entries(files)) await saveLakeFile(installed, path, bytes);
	const receipt = { component: base.component, bindingIrSha256: "b".repeat(64)
		, files: Object.fromEntries(Object.entries(files).map(([path, bytes]) => [path, { bytes: bytes.length, sha256: sha256(bytes) }])) };
	const receiptBytes = Buffer.from(JSON.stringify(receipt)), receiptPath = "package-receipt.json";
	await saveLakeFile(installed, receiptPath, receiptBytes);
	const options = { installed, receiptPath, receiptBytes, expectedModelSha256: sha256(modelBytes) };
	const verified = await verifyFinContainerEdgeDeployment(options);
	assert.deepEqual(verified.libraries, { "libedge.so": sha256(elf) });
	await assert.rejects(observeFinContainerEdgeRaw({ ...options, probeRoot: join(installed, "probe") }), /outside the installed package/u);
	await assert.rejects(observeFinContainerEdgeRaw({ ...options, probeRoot: installed }), /outside the installed package/u);
	await assert.rejects(verifyFinContainerEdgeDeployment({ ...options, receiptBytes: Buffer.from("{}") }), /original archive member/u);
	await assert.rejects(verifyFinContainerEdgeDeployment({ ...options, expectedModelSha256: "a".repeat(64) }), /producer's model/u);
	await saveLakeFile(installed, "lib/foreign.so", elf);
	await assert.rejects(verifyFinContainerEdgeDeployment(options), /unrecorded native library/u);
	await rm(join(installed, "lib/foreign.so"));
	await symlink(join(installed, "lib/libedge.so"), join(installed, "lib/alias.so"));
	await assert.rejects(verifyFinContainerEdgeDeployment(options), /unsupported native artifact/u);
	await rm(join(installed, "lib/alias.so"));
	await saveLakeFile(installed, "lean-bridge/component/model.json", Buffer.from("{}"));
	await assert.rejects(verifyFinContainerEdgeDeployment(options), /native artifact drift/u);
	await saveLakeFile(installed, "lean-bridge/component/model.json", modelBytes);
	assert.deepEqual(await verifyFinContainerEdgeDeployment(options), verified);
});

const enabled = process.env.LEAN_BRIDGE_FIN_CONTAINER_EDGE_SOURCE_TEST === "1";
test("fresh Lean preserves the measured calls and executes all raw cases with actual counters", { skip: !enabled }, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-fin-edge-boundaries-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const lean = resolve(process.env.LEAN_BRIDGE_LEAN ?? ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2/bin/lean");
	const environment = { ...copiedCleanEnvironment, LEAN_PATH: root, LEAN_NUM_THREADS: "1" };
	const erased = tree => tree.kind === "fin" ? { kind: "primitive", name: "nat", lean: "Nat", abi: { cType: "lean_object*", box: "lean_box", unbox: "lean_unbox", heap: false } }
		: { kind: tree.kind, element: erased(tree.arguments[0]) };
	const compiled = { ...structuredClone(base), pointerBits: 64, types: [] };
	for(const item of compiled.exports)
	{
		item.module = "FinContainers";
		item.parameters = [{ name: "arg0", type: erased(item.refinements.parameters[0]) }];
		item.result = erased(item.refinements.result);
	}
	const adapters = generateNativeLeanAdapters(compiled);
	await saveLakeFile(root, "FinContainers.lean", await finContainerEdgeSource());
	await saveLakeFile(root, `${adapters.module}.lean`, adapters.leanSource);
	await runCopied(lean, ["-o", "FinContainers.olean", "-c", "FinContainers.c", "FinContainers.lean"], root, environment);
	await runCopied(lean, ["-c", "adapters.c", `${adapters.module}.lean`], root, environment);
	const generated = await readFile(join(root, "adapters.c"), "utf8");
	for(const name of finContainerEdgeEntries)
	{
		const call = new RegExp(`= l_FinContainers_${name}\\(`, "u");
		if(finContainerEdgeSourceEntries.includes(name)) assert.match(generated, call, `${name}: optimizer removed the counted source call`);
		else assert.doesNotMatch(generated, call, `${name}: identity source is no longer inlined; add its counter`);
	}
	// This is a compiler/runtime source gate, not an installed-package or relocated-archive claim.
	const prefix = (await runCopied(lean, ["--print-prefix"], root)).stdout.trim();
	await saveLakeFile(root, "lean_bridge_native_runtime.h", brokerHeader);
	await saveLakeFile(root, "broker.c", brokerSource);
	await saveLakeFile(root, "raw.c", finContainerEdgeRawProbe(compiled, compiled.component));
	await saveLakeFile(root, "interposer.c", finContainerEdgeInterposer(compiled, compiled.component));
	const includes = [`-I${join(prefix, "include")}`], libraries = [`-L${join(prefix, "lib/lean")}`, "-lleanshared", `-Wl,-rpath,${join(prefix, "lib/lean")}`];
	const compile = { ...environment, PATH: "/usr/bin:/bin" };
	await runCopied("/usr/bin/cc", ["-shared", "-fPIC", "-O2", ...includes, "FinContainers.c", "adapters.c", "broker.c", ...libraries, "-lpthread", "-o", "libedge-source.so"], root, compile);
	await runCopied("/usr/bin/cc", ["-std=c11", "-Wall", "-Wextra", "-Werror", ...includes, "raw.c", "-L.", "-Wl,--no-as-needed", "-ledge-source", ...libraries, "-Wl,-rpath,$ORIGIN", "-ldl", "-o", "raw"], root, compile);
	await runCopied("/usr/bin/cc", ["-std=c11", "-Wall", "-Wextra", "-Werror", "-shared", "-fPIC", "interposer.c", "-ldl", "-o", "interposer.so"], root, compile);
	const observed = await runCopied(join(root, "raw"), [], root, { ...environment, LD_PRELOAD: join(root, "interposer.so") });
	assert.equal(observed.stderr, "");
	assert.deepEqual(readFinContainerEdgeRaw(observed.stdout), finContainerEdgeRawExpected);
	t.diagnostic(JSON.stringify({ scope: "fresh compiler/runtime source gate, not installed-package acceptance"
		, sourceSha256: sha256(await finContainerEdgeSource())
		, adapterSourceSha256: sha256(adapters.leanSource)
		, compiledAdapterSha256: sha256(generated)
		, rawProbeSha256: sha256(await readFile(join(root, "raw.c")))
		, interposerSha256: sha256(await readFile(join(root, "interposer.c")))
		, observedSha256: sha256(observed.stdout)
		, columns: finContainerEdgeColumns(compiled, compiled.component)
		, finalCounts: readFinContainerEdgeRaw(observed.stdout).at(-1)[2]
		, inlinedSourceFunctionsNotCounted: finContainerEdgeEntries.filter(name => !finContainerEdgeSourceEntries.includes(name)) }));
	await assert.rejects(() => runCopied(join(root, "raw"), [], root, environment)
		, error => error.details.stderr === "edge interposer is not loaded\n");
	for(const [label, before, after] of [
		["missing-adapter", "++counts[2];", "/* omit one measured adapter */"]
		, ["missing-source", "++counts[0];", "/* omit one measured source */"]
		, ["extra-source", "++counts[6];", "++counts[6]; ++counts[0];"]
	]) {
		const interposer = finContainerEdgeInterposer(compiled, compiled.component);
		assert.equal(interposer.split(before).length, 2);
		await saveLakeFile(root, `${label}.c`, interposer.replace(before, after));
		await runCopied("/usr/bin/cc", ["-std=c11", "-Wall", "-Wextra", "-Werror", "-shared", "-fPIC", `${label}.c`, "-ldl", "-o", `${label}.so`], root, compile);
		await assert.rejects(() => runCopied(join(root, "raw"), [], root, { ...environment, LD_PRELOAD: join(root, `${label}.so`) })
			, error => error.details.stderr === "edge raw probe: wrong per-call source or adapter count\n", label);
	}
	// Exercise the observer against a relocated local compiler fixture with an explicit synthetic
	// receipt. This proves its binding/instrumentation, not package-manager installation or provenance.
	const staging = join(root, "receipt-fixture"), installed = join(root, "receipt-fixture-moved");
	await mkdir(join(staging, "lib"), { recursive: true });
	await copyFile(join(root, "libedge-source.so"), join(staging, "lib/libedge-source.so"));
	for(const name of ["libleanshared.so", "libleanshared_1.so", "libleanshared_2.so"])
		await copyFile(join(prefix, "lib/lean", name), join(staging, "lib", name));
	const modelBytes = Buffer.from(JSON.stringify({ ...compiled, bindingIrSha256: "b".repeat(64) }));
	await saveLakeFile(staging, "lean-bridge/component/model.json", modelBytes);
	const files = {};
	for(const path of ["lean-bridge/component/model.json", "lib/libedge-source.so", "lib/libleanshared.so", "lib/libleanshared_1.so", "lib/libleanshared_2.so"])
	{
		const bytes = await readFile(join(staging, path));
		files[path] = { bytes: bytes.length, sha256: sha256(bytes) };
	}
	const receiptBytes = Buffer.from(JSON.stringify({ component: compiled.component, bindingIrSha256: "b".repeat(64), files }));
	await saveLakeFile(staging, "package-receipt.json", receiptBytes);
	await rename(staging, installed);
	const options = { installed, receiptPath: "package-receipt.json", receiptBytes, expectedModelSha256: sha256(modelBytes), probeRoot: join(root, "receipt-probe"), leanPrefix: prefix };
	const receiptObservation = await observeFinContainerEdgeRaw(options);
	assert.deepEqual(receiptObservation.observed, finContainerEdgeRawExpected);
	assert.equal(receiptObservation.runtimeDefinitionsChecked, true);
	assert.equal(receiptObservation.installedFilesUnchanged, true);
	assert.match(receiptObservation.caller, /not a host-language call/u);
	await assert.rejects(observeFinContainerEdgeRaw(options), { code: "EEXIST" });
	const columns = finContainerEdgeColumns(compiled, compiled.component);
	const wrongDefinitions = Object.fromEntries(columns.map(symbol => [symbol, join(root, "libedge-source.so")]));
	wrongDefinitions[columns[2]] = join(root, "wrong-library.so");
	await saveLakeFile(root, "wrong-definition.c", finContainerEdgeInterposer(compiled, compiled.component, wrongDefinitions));
	await runCopied("/usr/bin/cc", ["-std=c11", "-Wall", "-Wextra", "-Werror", "-shared", "-fPIC", "wrong-definition.c", "-ldl", "-o", "wrong-definition.so"], root, compile);
	await assert.rejects(() => runCopied(join(root, "raw"), [], root, { ...environment, LD_PRELOAD: join(root, "wrong-definition.so") })
		, error => /exited with status 6:/u.test(error.message) && error.details.stderr === `unexpected edge definition: ${columns[2]}\n`);
});

test("raw and public edge probes compile against the pinned Lean API and generated GMP header", { skip: !enabled }, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-fin-edge-dispatch-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const lean = resolve(process.env.LEAN_BRIDGE_LEAN ?? ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2/bin/lean");
	const prefix = (await runCopied(lean, ["--print-prefix"], root)).stdout.trim();
	for(const [path, source] of Object.entries(generateGmpProjection(finContainerEdgeReviewedIr()).files)) await saveLakeFile(root, path, source);
	for(const [name, source] of [["raw", finContainerEdgeRawProbe(base, base.component)], ["interposer", finContainerEdgeInterposer(base, base.component)], ["public", await finContainerEdgePublicProbe(base, base.component)]])
	{
		await saveLakeFile(root, `${name}.c`, source);
		const result = await runCopied("/usr/bin/cc", ["-std=c11", "-Wall", "-Wextra", "-Werror", "-fsyntax-only", `-I${join(prefix, "include")}`, "-Iinclude", `${name}.c`], root);
		assert.equal(result.stdout, ""); assert.equal(result.stderr, "");
	}
});
