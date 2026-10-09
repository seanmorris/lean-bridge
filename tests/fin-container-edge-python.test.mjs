/**
 * Execute the unchanged full Python consumer against fresh compiled Lean on both pinned floors.
 * Synthetic source fixtures validate the observer, not wheel installation or hosted acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { finContainerEdgeCompilerModel } from "./helpers/fin-container-edge-compiled-fixture.mjs";
import { compileFinContainerEdgePythonFixture } from "./helpers/fin-container-edge-python-fixture.mjs";
import { finContainerEdgeEntries, finContainerEdgeInterposer, finContainerEdgeWireSymbols } from "./helpers/fin-container-edge-dispatch.mjs";
import { finContainerEdgePythonExpected, finContainerEdgePythonProbe, readFinContainerEdgePython } from "./helpers/fin-container-edge-python.mjs";
import { observeFinContainerEdgePython } from "./helpers/fin-container-edge-python-observer.mjs";
import { finContainerEdgeConsumer } from "./helpers/fin-container-edges.mjs";
import { copiedCleanEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

const text = rows => rows.map(([step, method, status, counts]) => `edge-python ${step} ${method} ${status} ${counts.join(" ")}\n`).join("") + "fin-container-ok:14095\n";
const totals = [[1001, 1003, 0, 0], [1001, 1003, 1, 0], [1001, 1003, 1, 0], [1003, 1003, 1, 3], [1003, 1004, 0, 0], [1003, 1010, 0, 0]];

test("Python expected calls distinguish bounds from type and negative-Nat errors", () => {
	assert.equal(finContainerEdgePythonExpected.length, 12044);
	assert.deepEqual(finContainerEdgePythonExpected.at(-1)[3], [1003, 1003, 1001, 1001, 1001, 1003, 1003, 1003]);
	for(const [index, method] of finContainerEdgeEntries.entries())
	{
		const rows = finContainerEdgePythonExpected.filter(row => row[1] === method);
		assert.deepEqual(["ok", "fin", "type", "value"].map(status => rows.filter(row => row[2] === status).length), totals[index], method);
	}
	assert.throws(() => { finContainerEdgePythonExpected[0][3][0]++; });
});

test("Python transcript requires every call and exact error class, even when aggregate counts agree", () => {
	const valid = text(finContainerEdgePythonExpected);
	assert.deepEqual(readFinContainerEdgePython(valid), finContainerEdgePythonExpected);
	for(const mutate of [
		rows => { rows[1][3][0]++; }
		, rows => { rows[0][3][6]--; }
		, rows => { rows.find(row => row[2] === "type")[2] = "fin"; }
		, rows => { rows.find(row => row[2] === "value")[2] = "type"; }
		, rows => { rows[0][1] = "flatten"; }
		, rows => { [rows[0], rows[1]] = [rows[1], rows[0]]; }
		, rows => { rows.pop(); }
		, rows => { rows.push(rows.at(-1)); }
		, rows => { rows.at(-1)[3][5]--; }
	]) {
		const rows = structuredClone(finContainerEdgePythonExpected); mutate(rows);
		assert.throws(() => readFinContainerEdgePython(text(rows)), assert.AssertionError);
	}
	for(const changed of [valid.trimEnd(), valid + "\n", valid.replace("fin-container-ok:14095", "fin-container-ok:2029"), valid.replace(" 1 present", " 01 present")])
		assert.throws(() => readFinContainerEdgePython(changed), assert.AssertionError);
});

test("Python proxy preserves the original consumer and binds both imported modules and wire definitions", async () => {
	const model = finContainerEdgeCompilerModel(), packageDirectory = "/verified/site/lean_fincontainers";
	const definitions = Object.fromEntries(finContainerEdgeWireSymbols.map(symbol => [symbol, "/verified/lib/libfincontainers.so"]));
	for(const mutate of [
		value => { delete value.definitions[finContainerEdgeWireSymbols[0]]; }
		, value => { value.definitions.unknown = "/verified/lib/other.so"; }
		, value => { value.definitions[finContainerEdgeWireSymbols[0]] = "relative.so"; }
		, value => { value.packageDirectory = "relative"; }
		, value => { value.packageDirectory += "\0"; }
		, value => { delete value.packageDirectory; }
		, value => { delete value.definitions; }
	]) {
		const changed = structuredClone({ definitions, packageDirectory }); mutate(changed);
		await assert.rejects(finContainerEdgePythonProbe(model, model.component, changed), assert.AssertionError);
	}
	const original = await finContainerEdgeConsumer("python"), source = await finContainerEdgePythonProbe(model, model.component, { definitions, packageDirectory });
	assert.ok(source.startsWith(original.slice(0, original.indexOf("checks = 0"))));
	assert.ok(source.endsWith(original.slice(original.indexOf("checks = 0"))));
	assert.ok(source.includes("_edge_original._native._LIBRARY[_edge_symbol]"));
	assert.ok(source.includes("(_edge_original._native, '_native.py')"));
	assert.doesNotMatch(source, /sys\.path\.insert|setattr\(_edge_original/u);
});

test("both Python floors execute the full consumer with measured Lean entries and relocated modules", { skip: process.env.LEAN_BRIDGE_FIN_CONTAINER_EDGE_SOURCE_TEST !== "1" }, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-fin-edge-python-public-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const lean = resolve(process.env.LEAN_BRIDGE_LEAN ?? ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2/bin/lean");
	const fixture = await compileFinContainerEdgePythonFixture(root, lean);
	const { model, environment, site, receiptPath, receiptBytes, expectedModelSha256 } = fixture;
	const source = await finContainerEdgePythonProbe(model, model.component), instrument = finContainerEdgeInterposer(model, model.component);
	await saveLakeFile(root, "public.py", source);
	await saveLakeFile(root, "interposer.c", instrument);
	const strict = ["-std=c11", "-Wall", "-Wextra", "-Werror", "-shared", "-fPIC"];
	await runCopied("/usr/bin/cc", [...strict, "interposer.c", "-ldl", "-o", "interposer.so"], root, environment);
	for(const [label, before, after] of [
		["missing-adapter", "++counts[6];", "/* omitted adapter */"]
		, ["missing-source", "++counts[0];", "/* omitted source */"]
		, ["extra-source", "++counts[2];", "++counts[2]; ++counts[0];"]
		, ["nonzero", "static unsigned long counts[8];", "static unsigned long counts[8] = {1};"]
	]) {
		assert.equal(instrument.split(before).length, 2);
		await saveLakeFile(root, `${label}.c`, instrument.replace(before, after));
		await runCopied("/usr/bin/cc", [...strict, `${label}.c`, "-ldl", "-o", `${label}.so`], root, environment);
	}
	const rejection = "                _edge_record(index, method, 'fin', before)";
	assert.equal(source.split(rejection).length, 2);
	await saveLakeFile(root, "rejected-entry.py", source.replace(rejection, `                _edge_original.present([])\n${rejection}`));
	for(const [floor, expectedVersion] of [["311", "3.11.16"], ["312", "3.12.14"]]) await t.test(`Python ${expectedVersion}`, async () => {
		const base = resolve(`.toolchains/python${floor}/bin/python3`), stage = join(root, `venv-${floor}`), moved = `${stage}-moved`;
		await runCopied(base, ["-I", "-B", "-m", "venv", "--without-pip", stage], root, environment);
		const purelib = (await runCopied(join(stage, "bin/python3"), ["-I", "-B", "-c", "import sysconfig; print(sysconfig.get_path('purelib'))"], root, environment)).stdout.trim();
		assert.ok(purelib.startsWith(stage + "/"));
		await cp(join(site, "lean_fincontainers"), join(purelib, "lean_fincontainers"), { recursive: true });
		await rename(stage, moved);
		const command = join(moved, "bin/python3"), installed = moved + purelib.slice(stage.length);
		const runtime = { ...copiedCleanEnvironment, LEAN_NUM_THREADS: "1", LD_PRELOAD: join(root, "interposer.so") };
		const args = ["-I", "-B", "public.py"];
		await assert.rejects(() => runCopied(command, args, root, copiedCleanEnvironment)
			, error => /exited with status 2:/u.test(error.message) && error.details.stdout === "" && error.details.stderr === "edge interposer is not loaded\n");
		const observed = await runCopied(command, args, root, runtime);
		assert.equal(observed.stderr, ""); assert.deepEqual(readFinContainerEdgePython(observed.stdout), finContainerEdgePythonExpected);
		for(const label of ["missing-adapter", "missing-source", "extra-source", "nonzero"])
			await assert.rejects(() => runCopied(command, args, root, { ...runtime, LD_PRELOAD: join(root, `${label}.so`) })
				, error => (label === "nonzero" ? /exited with status 3:/u : /exited with status 5:/u).test(error.message)
					&& error.details.stderr === (label === "nonzero" ? "edge counters are not initially zero\n" : "wrong Python edge dispatch count\n"), label);
		await assert.rejects(() => runCopied(command, ["-I", "-B", "rejected-entry.py"], root, runtime)
			, error => /exited with status 5:/u.test(error.message) && error.details.stderr === "wrong Python edge dispatch count\n");
		const options = { installed, receiptPath, receiptBytes, expectedModelSha256, command, probeRoot: join(root, `receipt-probe-${floor}`) };
		const report = await observeFinContainerEdgePython(options);
		assert.equal(report.kind, "fin-container-edge-public-python-v1");
		assert.equal(report.profile, "python"); assert.equal(report.python, expectedVersion);
		assert.equal(report.observed, true); assert.equal(report.checks, 14095); assert.equal(report.measuredCalls, 12044);
		assert.equal(report.repeatedColdProcess, true); assert.equal(report.installedFilesUnchanged, true);
		assert.deepEqual(report.observations, finContainerEdgePythonExpected);
		const definitions = Object.fromEntries(finContainerEdgeWireSymbols.map(symbol => [symbol, join(report.libraryDirectory, report.definitions[symbol])]));
		const identity = { definitions, packageDirectory: report.packageDirectory };
		assert.equal(report.probeSha256, sha256(await finContainerEdgePythonProbe(model, model.component, identity)));
		assert.equal(report.stdoutSha256, sha256(observed.stdout));
		const receipt = JSON.parse(receiptBytes);
		assert.deepEqual(report.moduleDigests, Object.fromEntries(["lean_fincontainers/__init__.py", "lean_fincontainers/_native.py"].map(path => [path, receipt.files[path].sha256])));
		await assert.rejects(observeFinContainerEdgePython(options), { code: "EEXIST" });
		await assert.rejects(observeFinContainerEdgePython({ ...options, probeRoot: join(installed, "probe") }), /outside the installed package/u);
		const changed = { ...identity, definitions: { ...definitions, [finContainerEdgeWireSymbols[0]]: join(report.libraryDirectory, "liblean_bridge_native.so") } };
		await saveLakeFile(root, `wrong-wire-${floor}.py`, await finContainerEdgePythonProbe(model, model.component, changed));
		await assert.rejects(() => runCopied(command, ["-I", "-B", `wrong-wire-${floor}.py`], root, runtime)
			, error => /exited with status 6:/u.test(error.message) && error.details.stdout === "" && error.details.stderr === `unexpected Python wire definition: ${finContainerEdgeWireSymbols[0]}\n`);
		await saveLakeFile(root, `wrong-module-${floor}.py`, await finContainerEdgePythonProbe(model, model.component, { ...identity, packageDirectory: join(root, "foreign-module") }));
		await assert.rejects(() => runCopied(command, ["-I", "-B", `wrong-module-${floor}.py`], root, runtime)
			, error => /exited with status 6:/u.test(error.message) && error.details.stdout === "" && error.details.stderr === "unexpected Python package location\n");
		const path = "lean_fincontainers/_native.py", bytes = await readFile(join(installed, path));
		await saveLakeFile(installed, path, Buffer.concat([bytes, Buffer.from("\n# altered\n")]));
		await assert.rejects(observeFinContainerEdgePython({ ...options, probeRoot: join(root, `changed-module-${floor}`) }), /native artifact drift/u);
		await saveLakeFile(installed, path, bytes);
		t.diagnostic(JSON.stringify({ scope: "compiler/runtime source gate, not installed-package acceptance"
			, python: report.python, checks: report.checks
			, measuredCalls: report.measuredCalls
			, finalCounts: report.observations.at(-1)[3]
			, stdoutSha256: report.stdoutSha256, probeSha256: sha256(source)
			, interposerSha256: sha256(instrument) }));
	});
});
