/**
 * Ruby source/runtime instrumentation with the full original consumer and real compiled Lean.
 * These compiler-shaped fixtures are not installed RubyGems acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, copyFile, mkdir, mkdtemp, readFile, rename, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { hashBindingIr } from "../src/binding-ir/canonical.mjs";
import { generateCopiedRubyPackage } from "../src/backends/ruby/copied-values.mjs";
import { compileFinContainerEdgeSplitFixture, finContainerEdgeCompilerModel } from "./helpers/fin-container-edge-compiled-fixture.mjs";
import { finContainerEdgeConsumer } from "./helpers/fin-container-edges.mjs";
import { finContainerEdgeEntries } from "./helpers/fin-container-edge-dispatch.mjs";
import { finContainerEdgeRubyExpected, finContainerEdgeRubyProbe, readFinContainerEdgeRuby } from "./helpers/fin-container-edge-ruby.mjs";
import { assertFinContainerEdgeGdbRun, finContainerEdgeGdbScript, prepareFinContainerEdgeGdb } from "./helpers/fin-container-edge-gdb.mjs";
import { observeFinContainerEdgeRuby } from "./helpers/fin-container-edge-ruby-observer.mjs";
import { finContainerGdbScript } from "./helpers/fin-container-dispatch-gdb.mjs";
import { copiedCleanEnvironment } from "./helpers/copied-fixture-install.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

const text = rows => rows.map(([step, method, status, counts]) => `edge-ruby ${step} ${method} ${status} ${counts.join(" ")}\n`).join("") + "fin-container-ok:14094\n";

test("Ruby edge transcript retains every carrier, bound and negative-Nat rejection", () => {
	assert.equal(finContainerEdgeRubyExpected.length, 12047);
	assert.deepEqual(finContainerEdgeRubyExpected.at(-1)[3], [1003, 1003, 1001, 1001, 1001, 1003, 1003, 1003]);
	const totals = [[1001, 1003, 0, 1], [1001, 1003, 1, 1], [1001, 1003, 1, 1], [1003, 1003, 1, 3], [1003, 1004, 0, 0], [1003, 1010, 0, 0]];
	for(const [index, method] of finContainerEdgeEntries.entries())
	{
		const rows = finContainerEdgeRubyExpected.filter(row => row[1] === method);
		assert.deepEqual(["ok", "fin", "type", "value"].map(status => rows.filter(row => row[2] === status).length), totals[index], method);
	}
	assert.deepEqual(readFinContainerEdgeRuby(text(finContainerEdgeRubyExpected)), finContainerEdgeRubyExpected);
	for(const mutate of [
		rows => { rows[1][3][0]++; }
		, rows => { rows[0][3][6]--; }
		, rows => { rows[1][2] = "ok"; }
		, rows => { rows[0][1] = "flatten"; }
		, rows => { [rows[0], rows[1]] = [rows[1], rows[0]]; }
		, rows => { rows.splice(19, 1); }
		, rows => { rows.push(rows.at(-1)); }
	]) {
		const rows = structuredClone(finContainerEdgeRubyExpected); mutate(rows);
		assert.throws(() => readFinContainerEdgeRuby(text(rows)));
	}
	assert.throws(() => readFinContainerEdgeRuby(text(finContainerEdgeRubyExpected).replace("14094", "2025")));
	assert.throws(() => { finContainerEdgeRubyExpected[0][3][0]++; });
});

test("Ruby instrumentation preserves original assertions and the historical GDB failure logic", async () => {
	const model = finContainerEdgeCompilerModel(), original = await finContainerEdgeConsumer("ruby");
	const source = await finContainerEdgeRubyProbe(model, model.component);
	assert.ok(source.endsWith(original.slice(original.indexOf("Some = API::Some"))));
	assert.equal(source.split('require "lean_bridge/fincontainers"').length, 2);
	assert.equal(source.split("API = EdgeApi").length, 2);
	assert.doesNotMatch(source, /remove_const|define_singleton_method|class_eval/u);
	assert.ok(finContainerEdgeGdbScript.includes('WIDTH = 8'));
	for(const part of ['os.O_EXCL | os.O_NOFOLLOW', '"injected record write failure"', '"injected arming failure"', 'state["failure"] is not None', 'gdb.solib_name(found[0])', 'definitions(name) != [address]'])
	{
		assert.ok(finContainerGdbScript.includes(part)); assert.ok(finContainerEdgeGdbScript.includes(part));
	}
	const changed = structuredClone(model); changed.exports.find(item => item.name === "FinContainers.emptyArray").refinements.parameters[0].arguments[0].bound = "1";
	await assert.rejects(finContainerEdgeRubyProbe(changed, changed.component), assert.AssertionError);
	for(const installed of [undefined, "relative", "/root\0suffix", 1])
		await assert.rejects(finContainerEdgeRubyProbe(model, model.component, { installed }), assert.AssertionError);
});

test("Ruby normal deep-binding loader executes every edge call under verified address breakpoints", { skip: process.env.LEAN_BRIDGE_FIN_CONTAINER_EDGE_SOURCE_TEST !== "1" }, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-fin-edge-ruby-public-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const lean = resolve(process.env.LEAN_BRIDGE_LEAN ?? ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2/bin/lean");
	const { model, prefix } = await compileFinContainerEdgeSplitFixture(root, lean);
	const site = join(root, "ruby"), directory = join(site, "lib/lean_bridge/fincontainers/native/linux-x64");
	await mkdir(directory, { recursive: true });
	const libraries = {};
	for(const name of ["libedge-source.so", "liblean_bridge_native.so", "libleanshared.so", "libleanshared_1.so", "libleanshared_2.so"])
	{
		const source = join(name.startsWith("libleanshared") ? join(prefix, "lib/lean") : root, name);
		await copyFile(source, join(directory, name)); libraries[name] = sha256(await readFile(source));
	}
	const generated = generateCopiedRubyPackage(model.bindingIr, { componentId: model.component.id, runtimeIdentity: sha256("synthetic Ruby edge source runtime"), library: "libedge-source.so", libraries });
	for(const [path, source] of Object.entries(generated)) await saveLakeFile(site, path, source);
	const source = await finContainerEdgeRubyProbe(model, model.component);
	await saveLakeFile(root, "public.rb", source);
	const ruby = resolve(".toolchains/ruby33/bin/ruby");
	const options = { model, component: model.component
		, nativeDirectory: directory, libraries
		, probeRoot: join(root, "gdb"), cwd: root
		, argv: ({ record, nonce, configSha256, definerIndices }) => [ruby, "--disable-gems", "public.rb", record, nonce, configSha256, definerIndices.join(",")]
		, env: { ...copiedCleanEnvironment, RUBYLIB: join(site, "lib"), LEAN_NUM_THREADS: "1" } };
	const observer = await prepareFinContainerEdgeGdb(options);
	const absent = await observer.run({ gdb: false });
	assert.equal(absent.code, 2); assert.equal(absent.stdout, ""); assert.equal(absent.stderr, "edge record is not attached with empty counters\n");
	const stale = await observer.run({ before: path => writeFile(path, "stale") }); assert.equal(stale.code, 70);
	const foreign = await observer.run({ root }); assert.equal(foreign.code, 3);
	const wrong = observer.identity.definers.map(name => observer.identity.libraries.find(other => other !== name));
	const misplaced = await observer.run({ overrideDefiners: wrong }); assert.equal(misplaced.code, 3);
	for(const inject of [{ arm: true }, { write: 1 }])
	{
		const refusal = await observer.run({ inject }); assert.equal(refusal.code, 71, refusal.output);
	}
	const accepted = await observer.run();
	assert.equal(accepted.code, 0, accepted.output + accepted.stderr);
	const rows = readFinContainerEdgeRuby(accepted.stdout);
	const armed = await assertFinContainerEdgeGdbRun(observer, accepted, rows);
	const repeated = await observer.run();
	assert.equal(repeated.stdout, accepted.stdout);
	const again = await assertFinContainerEdgeGdbRun(observer, repeated, readFinContainerEdgeRuby(repeated.stdout));
	assert.notEqual(again.pid, armed.pid); assert.notEqual(repeated.nonce, accepted.nonce);
	const manifestBytes = await readFile(accepted.armed), recordBytes = await readFile(accepted.record);
	for(const mutate of [
		value => { value.nonce = "0".repeat(32); }
		, value => { value.breakpoints[0].offset++; }
		, value => { value.breakpoints[0].address++; }
		, value => { value.breakpoints.pop(); }
	]) {
		const value = JSON.parse(manifestBytes); mutate(value);
		await writeFile(accepted.armed, JSON.stringify(value));
		await assert.rejects(assertFinContainerEdgeGdbRun(observer, accepted, rows), assert.AssertionError);
	}
	await writeFile(accepted.armed, manifestBytes);
	for(const offset of [0, 8, 12, 16, 80, 112, 120, 124, 128, 132, 136, 200, 232, 264])
	{
		const bytes = Buffer.from(recordBytes); bytes[offset] ^= 1;
		await writeFile(accepted.record, bytes);
		await assert.rejects(assertFinContainerEdgeGdbRun(observer, accepted, rows), assert.AssertionError);
	}
	await writeFile(accepted.record, recordBytes);
	const siteText = '            state["entries"][self.column] += 1';
	assert.equal(finContainerEdgeGdbScript.split(siteText).length, 2);
	for(const [label, replacement] of [
		["dropped-adapter", '            if self.column != 6:\n                state["entries"][self.column] += 1']
		, ["dropped-source", '            if self.column != 0:\n                state["entries"][self.column] += 1']
		, ["extra-source", siteText + '\n            state["entries"][0] += 1']
	]) {
		const result = await observer.run({ script: finContainerEdgeGdbScript.replace(siteText, replacement) });
		assert.equal(result.code, 5, label + ": " + result.output); assert.equal(result.stderr, "wrong Ruby edge dispatch count\n");
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
	const rejection = '      record_call(index, name, status, before)';
	assert.equal(source.split(rejection).length, 2);
	await saveLakeFile(root, "public.rb", source.replace(rejection, `      LeanBridge::Fincontainers.present([])\n${rejection}`));
	const rejectedEntry = await observer.run();
	assert.equal(rejectedEntry.code, 5); assert.equal(rejectedEntry.stderr, "wrong Ruby edge dispatch count\n");
	await saveLakeFile(root, "public.rb", source);
	for(const [name, hash] of Object.entries(libraries)) assert.equal(sha256(await readFile(join(directory, name))), hash);
	for(const [path, bytes] of Object.entries(generated)) assert.equal(await readFile(join(site, path), "utf8"), bytes);
	await assert.rejects(prepareFinContainerEdgeGdb({ ...options, libraries: { ...libraries, "libedge-source.so": "0".repeat(64) } }), assert.AssertionError);
	await assert.rejects(prepareFinContainerEdgeGdb({ ...options, env: { ...options.env, LD_PRELOAD: "unsafe" } }), /never preload/u);
	await assert.rejects(prepareFinContainerEdgeGdb(options), { code: "EEXIST" });
	await assert.rejects(prepareFinContainerEdgeGdb({ ...options, probeRoot: join(directory, "probe") }), /outside the installed package/u);
	const componentFile = join(directory, "libedge-source.so"), originalBytes = await readFile(componentFile);
	await writeFile(componentFile, Buffer.concat([originalBytes, Buffer.from("drift")]));
	await assert.rejects(observer.run(), /native library drift/u);
	await writeFile(componentFile, originalBytes);
	const linked = join(root, "linked-directory"); await symlink(directory, linked);
	await assert.rejects(prepareFinContainerEdgeGdb({ ...options, nativeDirectory: linked }), assert.AssertionError);

	// This receipt is explicitly synthetic source-test data, not a produced or installed gem.
	const bindingIrSha256 = hashBindingIr(model.bindingIr), modelPath = "lean-bridge/component/model.json";
	const modelBytes = Buffer.from(JSON.stringify({ ...model, bindingIrSha256 }));
	await saveLakeFile(site, modelPath, modelBytes);
	const members = [...Object.keys(generated), ...Object.keys(libraries).map(name => `lib/lean_bridge/fincontainers/native/linux-x64/${name}`), modelPath];
	const files = {};
	for(const path of members)
	{
		const bytes = await readFile(join(site, path)); files[path] = { bytes: bytes.length, sha256: sha256(bytes) };
	}
	const receiptPath = "lean-bridge/package-receipt.json", receiptBytes = Buffer.from(JSON.stringify({ component: model.component, bindingIrSha256, files }));
	await saveLakeFile(site, receiptPath, receiptBytes);
	const installed = `${site}-relocated`; await rename(site, installed);
	await assert.rejects(access(site), { code: "ENOENT" });
	const moved = { installed, receiptPath, receiptBytes, expectedModelSha256: sha256(modelBytes), command: ruby, probeRoot: join(root, "receipt-probe") };
	const report = await observeFinContainerEdgeRuby(moved);
	assert.equal(report.kind, "fin-container-edge-public-ruby-v1");
	assert.equal(report.checks, 14094); assert.equal(report.measuredCalls, 12047);
	assert.deepEqual(report.observations, finContainerEdgeRubyExpected);
	assert.equal(report.stdoutSha256, sha256(accepted.stdout));
	assert.equal(report.receiptSha256, sha256(receiptBytes)); assert.equal(report.modelSha256, sha256(modelBytes));
	assert.equal(report.installedFilesUnchanged, true); assert.equal(report.loadedModulesChecked, true);
	assert.equal(report.repeatedColdProcess, true); assert.equal(report.runtimeDefinitionsChecked, true);
	assert.equal(report.probeSha256, sha256(await finContainerEdgeRubyProbe(model, model.component, { installed })));
	assert.deepEqual(report.moduleDigests, Object.fromEntries(Object.keys(generated).filter(path => path.endsWith(".rb")).map(path => [path, files[path].sha256])));
	await assert.rejects(observeFinContainerEdgeRuby(moved), { code: "EEXIST" });
	await assert.rejects(observeFinContainerEdgeRuby({ ...moved, probeRoot: join(installed, "probe") }), /outside the installed package/u);
	await assert.rejects(observeFinContainerEdgeRuby({ ...moved, expectedModelSha256: "0".repeat(64) }), /producer's model/u);
	await assert.rejects(observeFinContainerEdgeRuby({ ...moved, receiptBytes: Buffer.concat([receiptBytes, Buffer.from("\n")]) }), /original archive member/u);
	const modulePath = join(installed, "lib/lean_bridge/fincontainers.rb"), moduleBytes = await readFile(modulePath);
	await writeFile(modulePath, Buffer.concat([moduleBytes, Buffer.from("\n# drift\n")]));
	await assert.rejects(observeFinContainerEdgeRuby({ ...moved, probeRoot: join(root, "altered-module") }), /native artifact drift/u);
	await writeFile(modulePath, moduleBytes);
	const wrongModuleSource = await finContainerEdgeRubyProbe(model, model.component, { installed: site });
	await saveLakeFile(root, "public.rb", wrongModuleSource);
	const movedOptions = { ...options, nativeDirectory: report.libraryDirectory, probeRoot: join(root, "wrong-module-gdb"), env: { ...options.env, RUBYLIB: join(installed, "lib") } };
	const wrongModule = await prepareFinContainerEdgeGdb(movedOptions);
	const locationFailure = await wrongModule.run();
	assert.equal(locationFailure.code, 6); assert.equal(locationFailure.stdout, ""); assert.equal(locationFailure.stderr, "unexpected Ruby module location\n");
	t.diagnostic(JSON.stringify({ scope: "source/runtime fixture with synthetic receipt, not installed RubyGems acceptance", checks: report.checks, measuredCalls: rows.length, finalCounts: rows.at(-1)[3], stdoutSha256: report.stdoutSha256, probeSha256: report.probeSha256, scriptSha256: report.scriptSha256, coldProcesses: report.runs.length }));
});
