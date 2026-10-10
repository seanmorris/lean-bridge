/**
 * Real Lean/PHP/GDB observer controls. The Composer fixture has a synthetic source-test receipt;
 * this does not establish canonical two-root installed-package acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { hashBindingIr } from "../src/binding-ir/canonical.mjs";
import { generateCopiedPhpPackage } from "../src/backends/php/copied-values.mjs";
import { compileFinContainerEdgeSplitFixture, finContainerEdgeCompilerModel } from "./helpers/fin-container-edge-compiled-fixture.mjs";
import { finContainerEdgeConsumer } from "./helpers/fin-container-edges.mjs";
import { repeatFinContainerEdges } from "./helpers/fin-container-edge-install.mjs";
import { finContainerEdgeEntries } from "./helpers/fin-container-edge-dispatch.mjs";
import { finContainerEdgePhpExpected, finContainerEdgePhpProbe, readFinContainerEdgePhp } from "./helpers/fin-container-edge-php.mjs";
import { assertFinContainerEdgeGdbRun, finContainerEdgeGdbScript, prepareFinContainerEdgeGdb } from "./helpers/fin-container-edge-gdb.mjs";
import { observeFinContainerEdgePhp } from "./helpers/fin-container-edge-php-observer.mjs";
import { finContainerEdgePhpFixture } from "./helpers/fin-container-edge-php-closure-fixture.mjs";
import { installFinContainerEdgePhp, verifyFinContainerEdgePhpEnvironment } from "./helpers/fin-container-edge-php-closure.mjs";
import { copiedCleanEnvironment, installCopiedConsumer } from "./helpers/copied-fixture-install.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

const text = rows => rows.map(([step, method, status, counts]) => `edge-php ${step} ${method} ${status} ${counts.join(" ")}\n`).join("") + "fin-container-ok:14089\n";

test("PHP transcript requires all original and edge calls, including exact exception categories", () => {
	assert.equal(finContainerEdgePhpExpected.length, 12047);
	assert.deepEqual(finContainerEdgePhpExpected.at(-1)[3], [1003, 1003, 1001, 1001, 1001, 1003, 1003, 1003]);
	const totals = [[1001, 1003, 0, 1], [1001, 1003, 1, 1], [1001, 1003, 1, 1], [1003, 1003, 1, 3], [1003, 1004, 0, 0], [1003, 1010, 0, 0]];
	for(const [index, method] of finContainerEdgeEntries.entries())
	{
		const rows = finContainerEdgePhpExpected.filter(row => row[1] === method);
		assert.deepEqual(["ok", "fin", "type", "value"].map(status => rows.filter(row => row[2] === status).length), totals[index], method);
	}
	assert.deepEqual(readFinContainerEdgePhp(text(finContainerEdgePhpExpected)), finContainerEdgePhpExpected);
	for(const mutate of [
		rows => { rows[1][3][0]++; }
		, rows => { rows[0][3][6]--; }
		, rows => { rows[1][2] = "ok"; }
		, rows => { rows[0][1] = "flatten"; }
		, rows => { [rows[0], rows[1]] = [rows[1], rows[0]]; }
		, rows => { rows.splice(19, 1); }
		, rows => { rows.push(rows.at(-1)); }
	]) {
		const rows = structuredClone(finContainerEdgePhpExpected); mutate(rows);
		assert.throws(() => readFinContainerEdgePhp(text(rows)));
	}
	assert.throws(() => readFinContainerEdgePhp(text(finContainerEdgePhpExpected).replace("14089", "2026")));
	assert.throws(() => { finContainerEdgePhpExpected[0][3][0]++; });
});

test("PHP probe preserves every original assertion and caller strictness", async () => {
	const model = finContainerEdgeCompilerModel(), original = await finContainerEdgeConsumer("php-native");
	const source = await finContainerEdgePhpProbe(model, model.component, { autoload: "/consumer/vendor/autoload.php" });
	let assertions = source.slice(source.indexOf("$checks = 0;"));
	for(const name of ["empty_array", "empty_list", "empty_option", "optional_digits"])
		assertions = assertions.replaceAll(`\\edge_${name}(`, `\\LeanFincontainers\\${name}(`);
	assert.equal(assertions, original.slice(original.indexOf("$checks = 0;")));
	assert.equal(source.split("require '/consumer/vendor/autoload.php';").length, 2);
	assert.doesNotMatch(source, /runkit|uopz|FFI::|eval\(/u);
	assert.equal(await finContainerEdgePhpProbe(model, model.component, { autoload: "/consumer/vendor/autoload.php" }, "strict"), source.replace("declare(strict_types=0);", "declare(strict_types=1);"));
	for(const autoload of [undefined, "relative", "/root\0suffix", 1])
		await assert.rejects(finContainerEdgePhpProbe(model, model.component, { autoload }), assert.AssertionError);
	await assert.rejects(finContainerEdgePhpProbe(model, model.component, { autoload: "/a" }, "coerced"), assert.AssertionError);
	const changed = structuredClone(model); changed.exports.find(item => item.name === "FinContainers.emptyArray").refinements.parameters[0].arguments[0].bound = "1";
	await assert.rejects(finContainerEdgePhpProbe(changed, changed.component, { autoload: "/a" }), assert.AssertionError);
});

test("PHP observer measures real Lean through guarded Composer in both relocated caller modes", { skip: process.env.LEAN_BRIDGE_FIN_CONTAINER_EDGE_SOURCE_TEST !== "1" }, async t => {
	const fixture = await finContainerEdgePhpFixture(t), { root, payload } = fixture;
	const compiled = join(root, "compiled"); await mkdir(compiled);
	const lean = resolve(process.env.LEAN_BRIDGE_LEAN ?? ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2/bin/lean");
	const { model, prefix } = await compileFinContainerEdgeSplitFixture(compiled, lean);
	const directory = join(payload, "native/linux-x64"); await mkdir(directory, { recursive: true });
	const libraries = {};
	for(const name of ["libedge-source.so", "liblean_bridge_native.so", "libleanshared.so", "libleanshared_1.so", "libleanshared_2.so"])
	{
		const source = join(name.startsWith("libleanshared") ? join(prefix, "lib/lean") : compiled, name);
		await copyFile(source, join(directory, name)); libraries[name] = sha256(await readFile(source));
	}
	const generated = generateCopiedPhpPackage(model.bindingIr, { componentId: model.component.id, runtimeIdentity: sha256("synthetic PHP edge source runtime"), library: "libedge-source.so", libraries });
	for(const [path, source] of Object.entries(generated)) await saveLakeFile(payload, path, source);
	const bindingIrSha256 = hashBindingIr(model.bindingIr), modelPath = "lean-bridge/component/model.json";
	const modelBytes = Buffer.from(JSON.stringify({ ...model, bindingIrSha256 }));
	await saveLakeFile(payload, modelPath, modelBytes); await fixture.receipt();
	const receiptPath = "lean-bridge/package-receipt.json";
	const receipt = { ...JSON.parse(await readFile(join(payload, receiptPath))), component: model.component, bindingIrSha256 };
	const receiptBytes = Buffer.from(canonicalJson(receipt)); await saveLakeFile(payload, receiptPath, receiptBytes);
	const handoff = await fixture.pack("compiled"), consumer = join(root, "consumer");
	const installation = await installCopiedConsumer({ profile: "php-native"
		, consumer
		, ...handoff
		, environment: { LEAN_BRIDGE_PHP: "/usr/bin/php", LEAN_BRIDGE_COMPOSER: "/usr/bin/composer" }
		, fixture: { source: () => finContainerEdgeConsumer("php-native"), success: "fin-container-ok", expectedChecks: 14089, installPhp: installFinContainerEdgePhp } });
	assert.equal(installation.checks, 14089);
	const relocated = await repeatFinContainerEdges({ profile: "php-native"
		, consumer, ...handoff, command: installation.command
		, phpEnvironment: installation.phpEnvironment });
	assert.equal(relocated.exactPackageFiles, true); assert.equal(relocated.repeatStrictExecution, true);
	const oldRoot = installation.phpEnvironment.root, movedRoot = oldRoot + "-relocated";
	await assert.rejects(access(oldRoot), { code: "ENOENT" });
	const phpEnvironment = { ...installation.phpEnvironment, root: movedRoot };
	const installed = join(movedRoot, "vendor", phpEnvironment.name);
	const identity = { installed, autoload: join(movedRoot, "vendor/autoload.php") };
	const probe = join(root, "probe"); await mkdir(probe);
	const source = await finContainerEdgePhpProbe(model, model.component, identity);
	await saveLakeFile(probe, "public.php", source);
	const options = { model, component: model.component
		, nativeDirectory: join(installed, "native/linux-x64"), libraries
		, probeRoot: join(probe, "gdb"), cwd: probe
		, env: { ...copiedCleanEnvironment, LEAN_NUM_THREADS: "1" }
		, argv: ({ record, nonce, configSha256, definerIndices }) => [phpEnvironment.command, ...phpEnvironment.runtimeFlags, "public.php", record, nonce, configSha256, definerIndices.join(",")] };
	const observer = await prepareFinContainerEdgeGdb(options);
	const absent = await observer.run({ gdb: false });
	assert.equal(absent.code, 2); assert.equal(absent.stdout, ""); assert.equal(absent.stderr, "edge record is not attached with empty counters\n");
	const accepted = await observer.run();
	assert.equal(accepted.code, 0, accepted.output + accepted.stderr);
	const rows = readFinContainerEdgePhp(accepted.stdout);
	await assertFinContainerEdgeGdbRun(observer, accepted, rows);
	const recordBytes = await readFile(accepted.record), manifestBytes = await readFile(accepted.armed);
	for(const offset of [0, 8, 12, 16, 80, 112, 120, 124, 128, 132, 136, 200, 232, 264])
	{
		const bytes = Buffer.from(recordBytes); bytes[offset] ^= 1;
		await writeFile(accepted.record, bytes);
		await assert.rejects(assertFinContainerEdgeGdbRun(observer, accepted, rows), assert.AssertionError);
	}
	await writeFile(accepted.record, recordBytes);
	for(const mutate of [
		value => { value.nonce = "0".repeat(32); }
		, value => { value.breakpoints[0].address++; }
		, value => { value.breakpoints[0].offset++; }
		, value => { value.breakpoints.pop(); }
	]) {
		const value = JSON.parse(manifestBytes); mutate(value);
		await writeFile(accepted.armed, JSON.stringify(value));
		await assert.rejects(assertFinContainerEdgeGdbRun(observer, accepted, rows), assert.AssertionError);
	}
	await writeFile(accepted.armed, manifestBytes);
	const site = '            state["entries"][self.column] += 1';
	assert.equal(finContainerEdgeGdbScript.split(site).length, 2);
	for(const [label, replacement] of [
		["dropped-adapter", '            if self.column != 6:\n                state["entries"][self.column] += 1']
		, ["dropped-source", '            if self.column != 0:\n                state["entries"][self.column] += 1']
		, ["extra-source", site + '\n            state["entries"][0] += 1']
	]) {
		const result = await observer.run({ script: finContainerEdgeGdbScript.replace(site, replacement) });
		assert.equal(result.code, 5, label + ": " + result.output); assert.equal(result.stderr, "wrong PHP edge dispatch count\n");
	}
	for(const [before, after] of [
		['"entries": [0] * WIDTH', '"entries": [1] * WIDTH']
		, ['config["nonce"].encode()', 'b"0" * 32']
		, ['config["configSha256"].encode()', 'b"0" * 64']
	]) {
		assert.equal(finContainerEdgeGdbScript.split(before).length, 2);
		const result = await observer.run({ script: finContainerEdgeGdbScript.replace(before, after) });
		assert.equal(result.code, 2, result.output); assert.equal(result.stdout, "");
		assert.equal(result.stderr, "edge record is not attached with empty counters\n");
	}
	for(const inject of [{ arm: true }, { write: 1 }])
	{
		const refusal = await observer.run({ inject }); assert.equal(refusal.code, 71, refusal.output);
	}
	const wrong = observer.identity.definers.map(name => observer.identity.libraries.find(other => other !== name));
	assert.equal((await observer.run({ overrideDefiners: wrong })).code, 3);
	const rejection = "            self::recordCall($index, $name, $status, $before);";
	assert.equal(source.split(rejection).length, 2);
	await saveLakeFile(probe, "public.php", source.replace(rejection, `            \\LeanFincontainers\\present([]);\n${rejection}`));
	const rejectedEntry = await observer.run();
	assert.equal(rejectedEntry.code, 5); assert.equal(rejectedEntry.stderr, "wrong PHP edge dispatch count\n");
	await saveLakeFile(probe, "public.php", await finContainerEdgePhpProbe(model, model.component, { ...identity, installed: payload }));
	const wrongModule = await observer.run();
	assert.equal(wrongModule.code, 6); assert.equal(wrongModule.stderr, "unexpected PHP module location\n");
	await saveLakeFile(probe, "public.php", source);
	const moved = { installed, receiptPath, receiptBytes, expectedModelSha256: sha256(modelBytes), phpEnvironment, probeRoot: join(root, "receipt-probe") };
	const report = await observeFinContainerEdgePhp(moved);
	assert.equal(report.kind, "fin-container-edge-public-php-v1");
	assert.equal(report.checks, 14089); assert.equal(report.measuredCalls, 12047);
	assert.deepEqual(report.observations, finContainerEdgePhpExpected);
	assert.equal(report.receiptSha256, sha256(receiptBytes)); assert.equal(report.modelSha256, sha256(modelBytes));
	assert.equal(report.installedFilesUnchanged, true); assert.equal(report.loadedModulesChecked, true);
	assert.equal(report.repeatedColdProcess, true); assert.equal(report.runtimeDefinitionsChecked, true);
	assert.deepEqual(report.modes.map(mode => mode.mode), ["weak", "strict"]);
	assert.equal(new Set(report.modes.flatMap(mode => mode.runs.map(run => run.nonce))).size, 4);
	for(const mode of report.modes)
	{
		assert.equal(mode.stdoutSha256, sha256(accepted.stdout));
		assert.equal(mode.probeSha256, sha256(await finContainerEdgePhpProbe(model, model.component, identity, mode.mode)));
	}
	assert.deepEqual(report.phpEnvironment, await verifyFinContainerEdgePhpEnvironment(phpEnvironment));
	await assert.rejects(observeFinContainerEdgePhp(moved), { code: "EEXIST" });
	await assert.rejects(observeFinContainerEdgePhp({ ...moved, phpEnvironment: null }), /original guarded Composer/u);
	await assert.rejects(observeFinContainerEdgePhp({ ...moved, probeRoot: join(installed, "probe") }), /outside the installed package/u);
	await assert.rejects(observeFinContainerEdgePhp({ ...moved, expectedModelSha256: "0".repeat(64) }), /producer's model/u);
	const module = join(installed, "src/Api.php"), originalModule = await readFile(module);
	await saveLakeFile(installed, "src/Api.php", Buffer.concat([originalModule, Buffer.from("\n// drift\n")]));
	await assert.rejects(observeFinContainerEdgePhp({ ...moved, probeRoot: join(root, "altered-module") }), /native artifact drift/u);
	await saveLakeFile(installed, "src/Api.php", originalModule);
	await saveLakeFile(movedRoot, "vendor/unrecorded.php", "<?php exit(87);\n");
	await assert.rejects(observeFinContainerEdgePhp({ ...moved, probeRoot: join(root, "extra-autoload") }), /unrecorded or missing PHP file/u);
	t.diagnostic(JSON.stringify({ scope: "real Lean with synthetic Composer receipt, not canonical installed acceptance", checksPerProcess: report.checks, measuredCallsPerProcess: rows.length, finalCounts: rows.at(-1)[3], modes: report.modes.map(mode => ({ mode: mode.mode, stdoutSha256: mode.stdoutSha256, probeSha256: mode.probeSha256, coldProcesses: mode.runs.length })), scriptSha256: report.scriptSha256 }));
});
