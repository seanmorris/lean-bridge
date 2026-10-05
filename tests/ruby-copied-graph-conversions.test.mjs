/**
 * Checked Ruby native layouts and bounded, failure-safe private conversions.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { generateCopiedRubyGraphConversions } from "../src/backends/ruby/copied-graph-conversions.mjs";
import { generateCopiedCGraphTypes } from "../src/backends/c/copied-graph-layout.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";
import { rubyConversionIr, rubyGraphLayouts, rubyGraphProbeModule } from "./helpers/ruby-graph-probes.mjs";
import { nativeRecursiveReviewedIr } from "./helpers/native-recursive-reviewed.mjs";
import { assertAdministrativeSourceUpdate } from "./helpers/test-registration-history.mjs";

test("recorded Ruby conversion evidence binds source and compiled acceptance without claiming gems", async () => {
	const receipt = JSON.parse(await readFile("docs/evidence/ruby-recursive-conversions-20260923.json", "utf8"));
	assert.equal(receipt.planNode, 1219); assert.equal(receipt.installedPackage, false);
	for(const [path, hash] of Object.entries(receipt.sourceHashes)) await assertAdministrativeSourceUpdate(path, hash);
	const generated = generateCopiedRubyGraphConversions(rubyConversionIr());
	assert.equal(receipt.isolated.sourceSha256, sha256(generated.source));
	assert.equal(receipt.isolated.valuesSha256, sha256(generated.valuesSource));
	assert.equal(receipt.isolated.layoutSha256, sha256(rubyGraphLayouts(generated).c));
	assert.equal(receipt.isolated.probeSha256, sha256(await readFile("tests/fixtures/structured-types/recursive-conversions.rb")));
	assert.equal(receipt.isolated.nativeSha256, sha256(await readFile("tests/fixtures/structured-types/recursive-rust-native.c")));
	assert.equal(receipt.isolated.compiledLean, false); assert.equal(receipt.isolated.installedPackage, false);
	assert.deepEqual(receipt.isolated.report, { ruby: "3.3.12", checks: 2612, layoutChecks: 478, checkpoints: 231, inputFailures: 276, outputFailures: 186 });
	const ir = nativeRecursiveReviewedIr(); ir.declarations.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
	const compiled = generateCopiedRubyGraphConversions(ir);
	assert.equal(receipt.native.compiledLean, true); assert.equal(receipt.native.installedPackage, false);
	assert.deepEqual(receipt.native.observations.map(item => item.reviewed), [false, true]);
	for(const item of receipt.native.observations)
	{
		assert.equal(item.rubySourceSha256, sha256(compiled.source));
		assert.equal(item.rubyValuesSha256, sha256(compiled.valuesSource));
		assert.equal(item.probeSha256, sha256(await readFile("tests/fixtures/structured-types/recursive-ruby-lean.rb")));
		assert.equal(item.exports, 18); assert.deepEqual(item.scenarios.map(scenario => scenario.mode), ["carrier", "raw", "during"]);
		for(const scenario of item.scenarios)
		{
			assert.equal(scenario.checks, 1553); assert.equal(scenario.nativeCheckpoints, 28); assert.equal(scenario.rubyCheckpoints, 157);
			assert.equal(scenario.inputFailures, 93); assert.equal(scenario.outputFailures, 64);
		}
	}
});

test("Ruby graph conversions preserve deterministic native storage and validation order", () => {
	const ir = rubyConversionIr(), before = structuredClone(ir), model = generateCopiedRubyGraphConversions(ir);
	assert.deepEqual(ir, before); assert.deepEqual(generateCopiedRubyGraphConversions(ir), model);
	const scalar = name => model.types.find(node => node.ref.name === name);
	assert.equal(scalar("bool").pack, "C"); assert.equal(scalar("unit").pack, "C"); assert.equal(scalar("char").pack, "L<");
	assert.doesNotMatch(model.valuesSource, /Fiddle|\.pack\(|\.unpack/);
	const call = model.source.slice(model.source.indexOf("def graph_call_join_trees"));
	assert.ok(call.indexOf("checked.close") < call.indexOf("scope = GraphScope.new"));
	assert.ok(call.indexOf("input1 =") < call.indexOf("graph_status(lifecycle[0].call)"));
	assert.ok(call.indexOf("graph_status(lifecycle[0].call)") < call.indexOf("graph_status(invoke.call"));
	assert.match(call, /ensure\n\s*begin\n\s*clear.call\(output\) if output\n\s*ensure\n\s*scope.close/);
	assert.match(model.source, /::Thread.handle_interrupt\(::Exception => :never\)/);
});

test("Ruby graph conversions match C layouts and clear owned outputs on failure", {
	skip: process.env.LEAN_BRIDGE_RUBY_GRAPH_TEST !== "1", timeout: 180_000
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-ruby-graph-conversions-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const ir = rubyConversionIr(), model = generateCopiedRubyGraphConversions(ir), layout = rubyGraphLayouts(model);
	const fixture = await readFile("tests/fixtures/structured-types/recursive-rust-native.c", "utf8");
	const probe = await readFile("tests/fixtures/structured-types/recursive-conversions.rb", "utf8");
	await saveLakeFile(root, "recursive.h", generateCopiedCGraphTypes(ir).header);
	await saveLakeFile(root, "native.c", `#include "recursive.h"\n${fixture}\n${layout.c}`);
	await runCopied("/usr/bin/cc", ["-std=c11", "-Wall", "-Wextra", "-Werror", "-O1", "-fPIC", "-shared", "native.c", "-o", "libgraph-probe.so"], root, { PATH: "/usr/bin:/bin" });
	await saveLakeFile(root, "graph.rb", rubyGraphProbeModule(model));
	await saveLakeFile(root, "check.rb", probe);
	const command = resolve(process.env.LEAN_BRIDGE_RUBY ?? ".toolchains/ruby33/bin/ruby");
	const execution = await runCopied(command, ["--disable-gems", "-w", "check.rb", join(root, "libgraph-probe.so")], root);
	assert.equal(execution.stderr, ""); const report = JSON.parse(execution.stdout);
	assert.equal(report.layoutChecks, layout.count); assert.ok(report.checks > 500); assert.ok(report.checkpoints > 20);
	await saveLakeFile("build/recursive", "ruby-conversions.json", canonicalJson({ schemaVersion: 1
		, compiledLean: false
		, installedPackage: false
		, report
		, sourceSha256: sha256(model.source)
		, valuesSha256: sha256(model.valuesSource)
		, probeSha256: sha256(probe)
		, nativeSha256: sha256(fixture)
		, layoutSha256: sha256(layout.c) }));
});

test("ordinary and reviewed Lean graphs execute through Ruby with cleanup and retirement", {
	skip: process.env.LEAN_BRIDGE_RUBY_GRAPH_NATIVE_TEST !== "1", timeout: 600_000
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-ruby-native-graphs-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const { checkRubyNativeGraphs } = await import("./helpers/ruby-native-graphs.mjs");
	const report = await checkRubyNativeGraphs(root);
	assert.deepEqual(report.observations.map(run => run.reviewed), [false, true]);
	for(const run of report.observations)
	{
		assert.equal(run.exports, 18); assert.equal(run.scenarios.length, 3);
		assert.deepEqual(run.scenarios.map(item => item.mode), ["carrier", "raw", "during"]);
	}
	await saveLakeFile("build/recursive", "ruby-native.json", canonicalJson(report));
});

test("downstream CI requires isolated and compiled Ruby graph conversion checks", async () => {
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	assert.ok(workflow.includes("LEAN_BRIDGE_RUBY_GRAPH_TEST=1 LEAN_BRIDGE_RUBY_GRAPH_NATIVE_TEST=1 node --test tests/ruby-copied-graph-conversions.test.mjs"));
	for(const name of ["ruby-conversions", "ruby-native"])
	{
		assert.ok(workflow.includes(`test -s build/recursive/${name}.json`));
		assert.ok(workflow.includes(`            build/recursive/${name}.json\n`));
	}
});
