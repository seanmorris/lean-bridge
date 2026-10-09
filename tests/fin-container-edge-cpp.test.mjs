/**
 * Full generated C++ public API execution with per-call Lean entry measurement.
 * Compiler fixtures validate the instrumentation, not installed-package acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { copyFile, mkdir, mkdtemp, readFile, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { hashBindingIr } from "../src/binding-ir/canonical.mjs";
import { boostSources } from "../src/backends/cpp/boost.mjs";
import { compileFinContainerEdgeFixture, finContainerEdgeCompilerModel } from "./helpers/fin-container-edge-compiled-fixture.mjs";
import { finContainerEdgeColumns, finContainerEdgeEntries, finContainerEdgeInterposer } from "./helpers/fin-container-edge-dispatch.mjs";
import { finContainerEdgeCppExpected, finContainerEdgeCppProbe, finContainerEdgeCppSymbols, readFinContainerEdgeCpp } from "./helpers/fin-container-edge-cpp.mjs";
import { finContainerEdgeConsumer } from "./helpers/fin-container-edges.mjs";
import { observeFinContainerEdgePublic } from "./helpers/fin-container-edge-public-observer.mjs";
import { copiedCleanEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

const text = rows => rows.map(([step, method, status, counts]) => `edge-cpp ${step} ${method} ${status} ${counts.join(" ")}\n`).join("") + "fin-container-ok:14099\n";
const totals = [[1001, 1004], [1001, 1004], [1001, 1004], [1003, 1006], [1003, 1004], [1003, 1010]];

test("C++ expectations retain its distinct negative-Nat cases and all recovery calls", () => {
	assert.equal(finContainerEdgeCppExpected.length, 12044);
	assert.deepEqual(finContainerEdgeCppExpected.at(-1)[3], [1003, 1003, 1001, 1001, 1001, 1003, 1003, 1003]);
	for(const [index, method] of finContainerEdgeEntries.entries())
	{
		const rows = finContainerEdgeCppExpected.filter(row => row[1] === method);
		assert.deepEqual([rows.filter(row => row[2] === 0).length, rows.filter(row => row[2] === 1).length], totals[index], method);
	}
	assert.throws(() => { finContainerEdgeCppExpected[0][3][0]++; });
});

test("C++ transcript refuses compensated counts, altered calls and incomplete consumer execution", () => {
	const valid = text(finContainerEdgeCppExpected);
	assert.deepEqual(readFinContainerEdgeCpp(valid), finContainerEdgeCppExpected);
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
		const rows = structuredClone(finContainerEdgeCppExpected); mutate(rows);
		assert.throws(() => readFinContainerEdgeCpp(text(rows)), assert.AssertionError);
	}
	for(const changed of [valid.trimEnd(), valid + "\n", valid.replace("fin-container-ok:14099", "fin-container-ok:2039"), valid.replace(" 1 present", " 01 present")])
		assert.throws(() => readFinContainerEdgeCpp(changed), assert.AssertionError);
});

test("C++ instrumentation keeps every original assertion and requires exact wire definition identities", async () => {
	const model = finContainerEdgeCompilerModel();
	const definitions = Object.fromEntries(finContainerEdgeCppSymbols.map(symbol => [symbol, "/verified/lib/libfincontainers.so"]));
	for(const mutate of [
		value => { delete value[finContainerEdgeCppSymbols[0]]; }
		, value => { value.unknown = "/verified/lib/libother.so"; }
		, value => { value[finContainerEdgeCppSymbols[0]] = "relative.so"; }
		, value => { value[finContainerEdgeCppSymbols[0]] = "/verified/invalid\0.so"; }
	]) {
		const changed = structuredClone(definitions); mutate(changed);
		await assert.rejects(finContainerEdgeCppProbe(model, model.component, changed), assert.AssertionError);
	}
	const original = await finContainerEdgeConsumer("cpp"), source = await finContainerEdgeCppProbe(model, model.component, definitions);
	assert.equal((source.match(/unexpected C\+\+ wire definition:/gu) ?? []).length, 6);
	assert.ok(source.endsWith(original.slice(original.indexOf("  const Nat huge"))));
	assert.ok(source.includes(original.slice(original.indexOf("using Nat = api::Nat;"), original.indexOf("int main() {"))));
	for(const method of finContainerEdgeEntries)
		assert.ok(source.includes(`lean_bridge::fincontainers::${method.replace(/[A-Z]/gu, letter => `_${letter.toLowerCase()}`)}(input)`));
});

test("full C++ consumer executes compiled Lean and refuses broken entry instruments", { skip: process.env.LEAN_BRIDGE_FIN_CONTAINER_EDGE_SOURCE_TEST !== "1" }, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-fin-edge-cpp-public-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const lean = resolve(process.env.LEAN_BRIDGE_LEAN ?? ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2/bin/lean");
	const { model, environment, prefix } = await compileFinContainerEdgeFixture(root, lean, { cpp: true });
	const source = await finContainerEdgeCppProbe(model, model.component), instrument = finContainerEdgeInterposer(model, model.component);
	await saveLakeFile(root, "public.cpp", source);
	await saveLakeFile(root, "interposer.c", instrument);
	const strict = ["-Wall", "-Wextra", "-Werror"];
	const compile = name => runCopied("/usr/bin/c++", ["-std=c++20", ...strict, "-Icpp/include", "-Iraw/include", `${name}.cpp`, "-L.", "-Wl,--no-as-needed", "-ledge-source", "-Wl,-rpath,$ORIGIN", "-ldl", "-o", name], root, environment);
	await compile("public");
	await runCopied("/usr/bin/cc", ["-std=c11", ...strict, "-shared", "-fPIC", "interposer.c", "-ldl", "-o", "interposer.so"], root, environment);
	const runtime = { ...copiedCleanEnvironment, LEAN_NUM_THREADS: "1" };
	await assert.rejects(() => runCopied(join(root, "public"), [], root, runtime)
		, error => /exited with status 2:/u.test(error.message) && error.details.stdout === "" && error.details.stderr === "edge interposer is not loaded\n");
	const observed = await runCopied(join(root, "public"), [], root, { ...runtime, LD_PRELOAD: join(root, "interposer.so") });
	assert.equal(observed.stderr, "");
	assert.deepEqual(readFinContainerEdgeCpp(observed.stdout), finContainerEdgeCppExpected);
	for(const [label, before, after] of [
		["missing-adapter", "++counts[6];", "/* omitted adapter */"]
		, ["missing-source", "++counts[0];", "/* omitted source */"]
		, ["extra-source", "++counts[2];", "++counts[2]; ++counts[0];"]
	]) {
		assert.equal(instrument.split(before).length, 2);
		await saveLakeFile(root, `${label}.c`, instrument.replace(before, after));
		await runCopied("/usr/bin/cc", ["-std=c11", ...strict, "-shared", "-fPIC", `${label}.c`, "-ldl", "-o", `${label}.so`], root, environment);
		await assert.rejects(() => runCopied(join(root, "public"), [], root, { ...runtime, LD_PRELOAD: join(root, `${label}.so`) })
			, error => /exited with status 5:/u.test(error.message) && error.details.stderr === "wrong C++ edge dispatch count\n", label);
	}
	await saveLakeFile(root, "nonzero.c", instrument.replace("static unsigned long counts[8];", "static unsigned long counts[8] = {1};"));
	await runCopied("/usr/bin/cc", ["-std=c11", ...strict, "-shared", "-fPIC", "nonzero.c", "-ldl", "-o", "nonzero.so"], root, environment);
	await assert.rejects(() => runCopied(join(root, "public"), [], root, { ...runtime, LD_PRELOAD: join(root, "nonzero.so") })
		, error => /exited with status 3:/u.test(error.message) && error.details.stdout === "" && error.details.stderr === "edge counters are not initially zero\n");
	const catchLine = "    edge_record(index, method, error.status, before);";
	assert.equal(source.split(catchLine).length, 2);
	await saveLakeFile(root, "rejected-entry.cpp", source.replace(catchLine, `    lean_bridge::fincontainers::present({});\n${catchLine}`));
	await compile("rejected-entry");
	await assert.rejects(() => runCopied(join(root, "rejected-entry"), [], root, { ...runtime, LD_PRELOAD: join(root, "interposer.so") })
		, error => /exited with status 5:/u.test(error.message) && error.details.stderr === "wrong C++ edge dispatch count\n");
	const correct = Object.fromEntries(finContainerEdgeCppSymbols.map(symbol => [symbol, join(root, "libedge-source.so")]));
	await saveLakeFile(root, "verified.cpp", await finContainerEdgeCppProbe(model, model.component, correct));
	await compile("verified");
	const verified = await runCopied(join(root, "verified"), [], root, { ...runtime, LD_PRELOAD: join(root, "interposer.so") });
	assert.equal(verified.stdout, observed.stdout); assert.equal(verified.stderr, "");
	const wrong = { ...correct, [finContainerEdgeCppSymbols[0]]: join(root, "libedge-gmp.so") };
	await saveLakeFile(root, "wrong.cpp", await finContainerEdgeCppProbe(model, model.component, wrong));
	await compile("wrong");
	await assert.rejects(() => runCopied(join(root, "wrong"), [], root, { ...runtime, LD_PRELOAD: join(root, "interposer.so") })
		, error => /exited with status 6:/u.test(error.message) && error.details.stdout === "" && error.details.stderr === `unexpected C++ wire definition: ${finContainerEdgeCppSymbols[0]}\n`);
	// Synthetic receipt, moved headers/libraries: observer validation, not package-manager evidence.
	const staging = join(root, "receipt-fixture"), installed = join(root, "receipt-fixture-moved");
	await mkdir(join(staging, "lib"), { recursive: true });
	await copyFile(join(root, "libedge-source.so"), join(staging, "lib/libedge-source.so"));
	const members = ["lib/libedge-source.so", "include/fincontainers.h", "include/fincontainers.hpp"];
	for(const name of ["libleanshared.so", "libleanshared_1.so", "libleanshared_2.so"])
	{
		await copyFile(join(prefix, "lib/lean", name), join(staging, "lib", name));
		members.push(`lib/${name}`);
	}
	await saveLakeFile(staging, "include/fincontainers.h", await readFile(join(root, "raw/include/fincontainers.h")));
	await saveLakeFile(staging, "include/fincontainers.hpp", await readFile(join(root, "cpp/include/fincontainers.hpp")));
	const boost = boostSources();
	for(const path of Object.keys(boost).filter(path => path.startsWith("include/")))
	{
		await saveLakeFile(staging, path, boost[path]); members.push(path);
	}
	const modelBytes = Buffer.from(JSON.stringify({ ...model, bindingIrSha256: hashBindingIr(model.bindingIr) }));
	await saveLakeFile(staging, "lean-bridge/component/model.json", modelBytes);
	members.push("lean-bridge/component/model.json");
	const files = {};
	for(const path of members)
	{
		const bytes = await readFile(join(staging, path));
		files[path] = { bytes: bytes.length, sha256: sha256(bytes) };
	}
	const receiptBytes = Buffer.from(JSON.stringify({ component: model.component, bindingIrSha256: hashBindingIr(model.bindingIr), files }));
	await saveLakeFile(staging, "package-receipt.json", receiptBytes);
	await rename(staging, installed);
	const options = { installed, receiptPath: "package-receipt.json", receiptBytes, profile: "cpp", expectedModelSha256: sha256(modelBytes), probeRoot: join(root, "receipt-probe") };
	const receiptObservation = await observeFinContainerEdgePublic(options);
	assert.deepEqual(receiptObservation.observations, finContainerEdgeCppExpected);
	assert.equal(receiptObservation.kind, "fin-container-edge-public-cpp-v1");
	assert.equal(receiptObservation.profile, "cpp"); assert.equal(receiptObservation.observed, true);
	assert.equal(receiptObservation.checks, 14099); assert.equal(receiptObservation.measuredCalls, 12044);
	assert.equal(receiptObservation.runtimeDefinitionsChecked, true); assert.equal(receiptObservation.installedFilesUnchanged, true);
	assert.deepEqual(receiptObservation.linkLibraries, ["libedge-source.so"]);
	const dynamic = (await runCopied("/usr/bin/readelf", ["-d", join(options.probeRoot, "public")], root, environment)).stdout;
	assert.match(dynamic, /NEEDED.*\[libedge-source.so\]/u);
	assert.doesNotMatch(dynamic, /NEEDED.*\[libleanshared(?:_[12])?\.so\]/u);
	const definingPaths = symbols => Object.fromEntries(symbols.map(symbol => [symbol, join(receiptObservation.libraryDirectory, receiptObservation.definitions[symbol])]));
	assert.equal(receiptObservation.probeSha256, sha256(await finContainerEdgeCppProbe(model, model.component, definingPaths(finContainerEdgeCppSymbols))));
	assert.equal(receiptObservation.interposerSha256, sha256(finContainerEdgeInterposer(model, model.component, definingPaths(receiptObservation.columns))));
	const headers = members.filter(path => path.startsWith("include/"));
	assert.deepEqual(receiptObservation.headerDigests, Object.fromEntries(headers.map(path => [path, files[path].sha256])));
	await assert.rejects(observeFinContainerEdgePublic(options), { code: "EEXIST" });
	await assert.rejects(observeFinContainerEdgePublic({ ...options, probeRoot: join(installed, "probe") }), /outside the installed package/u);
	await assert.rejects(observeFinContainerEdgePublic({ ...options, profile: "rust" }), /supports only C and C\+\+/u);
	const headerPath = "include/fincontainers.hpp", headerBytes = await readFile(join(installed, headerPath));
	await saveLakeFile(installed, headerPath, Buffer.concat([headerBytes, Buffer.from("\n/* changed */\n")]));
	await assert.rejects(observeFinContainerEdgePublic({ ...options, probeRoot: join(root, "changed-header") }), /native artifact drift/u);
	await saveLakeFile(installed, headerPath, headerBytes);
	const unpinned = JSON.parse(receiptBytes);
	delete unpinned.files["include/boost/multiprecision/cpp_int.hpp"];
	const unpinnedBytes = Buffer.from(JSON.stringify(unpinned));
	await saveLakeFile(installed, "package-receipt.json", unpinnedBytes);
	await assert.rejects(observeFinContainerEdgePublic({ ...options, receiptBytes: unpinnedBytes, probeRoot: join(root, "unpinned-header") }), /not receipt-pinned: include\/boost\/multiprecision\/cpp_int.hpp/u);
	await saveLakeFile(installed, "package-receipt.json", receiptBytes);
	t.diagnostic(JSON.stringify({ scope: "compiler/runtime source gate, not installed-package acceptance"
		, originalConsumerChecks: 14099
		, measuredCalls: observed.stdout.split("\n").length - 2
		, columns: finContainerEdgeColumns(model, model.component)
		, finalCounts: finContainerEdgeCppExpected.at(-1)[3]
		, probeSha256: sha256(source), interposerSha256: sha256(instrument)
		, stdoutSha256: sha256(observed.stdout)
		, compiledLeanSha256: sha256(await readFile(join(root, "FinContainers.c"))) }));
});
