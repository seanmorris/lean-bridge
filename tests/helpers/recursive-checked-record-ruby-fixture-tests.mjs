/**
 * Source-only controls for the recursive checked-record Ruby caller. No compiled Lean
 * library or installed gem executes here; the caller runs against a Ruby oracle.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { generateCopiedRubyGraphPackage } from "../../src/backends/ruby/copied-graph-package.mjs";
import { runCopied } from "./copied-fixture-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { recursiveCheckedRecordConfiguration, recursiveCheckedRecordReview } from "./recursive-checked-record-fixture.mjs";
import {
	parseRecursiveCheckedRecordRubyResult, recursiveCheckedRecordRubyCaller
	, recursiveCheckedRecordRubyCallerArgs, recursiveCheckedRecordRubyConfiguration
	, recursiveCheckedRecordRubyCounts, recursiveCheckedRecordRubyPackage
	, recursiveCheckedRecordRubySelection
} from "./recursive-checked-record-ruby-fixture.mjs";
import { assertRecursiveCheckedRecordRubyResources } from "./recursive-checked-record-ruby-resources.mjs";

export const recursiveCheckedRecordRubyFaults = Object.freeze([
	"produce-offset", "produce-single", "produce-digits", "accept-bool"
	, "wrong-host-exception", "alias-constant", "missing-fin"
	, "missing-normalization", "conflated-constructor", "diagnostic-suffix"
	, "wrong-status", "wrong-path", "root-only", "echo-unnormalized"
	, "echo-drops-tail", "cycle-as-lean", "depth-unbounded", "shared-as-cycle"
	, "groups-drop-none", "echo-groups-drops-none", "poison-after-reject"
	, "second-normalizes-root-only"
]);
const ruby = resolve(process.env.LEAN_BRIDGE_RUBY ?? ".toolchains/ruby33/bin/ruby");

test("recursive checked-record Ruby caller detects every result, input and cycle fault in an oracle", async t => {
	if(await access(ruby).then(() => false, () => true))
	{
		t.skip(`Ruby 3.3 is unavailable at ${ruby}`);
		return;
	}
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-recursive-ruby-model-"));
	t.after(() => rm(root, { recursive: true }));
	const caller = await readFile(recursiveCheckedRecordRubyCaller, "utf8");
	await saveLakeFile(root, "consumer.rb", caller);
	const files = generateCopiedRubyGraphPackage(recursiveCheckedRecordReview(), null
		, { refinementDiagnostics: true });
	await saveLakeFile(root, "public.rb", files["lib/lean_bridge/recursivecheckedrecords.rb"]);
	const model = resolve("tests/helpers/recursive-checked-record-ruby-model.rb");
	const run = await runCopied(ruby, [model, join(root, "consumer.rb"), join(root, "public.rb")], root);
	assert.equal(run.stderr, "");
	const result = JSON.parse(run.stdout);
	assert.equal(result.installedAcceptance, false);
	assert.deepEqual(result.result, recursiveCheckedRecordRubyCounts.recursive);
	assert.deepEqual(result.rejectedFaults, recursiveCheckedRecordRubyFaults);
	assert.equal(await readFile(join(root, "consumer.rb"), "utf8"), caller);
	t.diagnostic("A Ruby runtime double exercises the caller with generated value classes; no installed Lean library executes.");
});

test("recursive checked-record Ruby keeps both author contracts and gem coordinates", () => {
	for(const route of ["ordinary", "reviewed"])
	{
		const expected = recursiveCheckedRecordConfiguration(route);
		const actual = recursiveCheckedRecordRubyConfiguration(route, "recursive");
		assert.deepEqual({ ...actual, targets: expected.targets }, expected);
		assert.deepEqual(actual.targets, { rubygems: { name: "recursivecheckedrecords", version: "1.0.0" } });
	}
	const pkg = recursiveCheckedRecordRubyPackage("recursive");
	assert.equal(pkg.requirePath, "lean_bridge/recursivecheckedrecords");
	assert.equal(pkg.namespace, "LeanBridge::Recursivecheckedrecords");
	assert.deepEqual(recursiveCheckedRecordRubyCallerArgs("recursive"), ["recursive"]);
	for(const value of ["mutual", "unknown"])
	{
		assert.throws(() => recursiveCheckedRecordRubyPackage(value));
		assert.throws(() => recursiveCheckedRecordRubyCallerArgs(value));
	}
	const counts = recursiveCheckedRecordRubyCounts.recursive;
	const stdout = `${JSON.stringify(Object.fromEntries(Object.entries(counts).sort()))}\n`;
	assert.deepEqual(parseRecursiveCheckedRecordRubyResult(stdout, "recursive"), counts);
	for(const key of Object.keys(counts).filter(key => key !== "module"))
		assert.throws(() => parseRecursiveCheckedRecordRubyResult(stdout.replace(`"${key}":${counts[key]}`
			, `"${key}":${counts[key] + 1}`), "recursive"));
	assert.throws(() => parseRecursiveCheckedRecordRubyResult(stdout.replace("{", "{\"extra\":1,"), "recursive"));
});

test("recursive checked-record Ruby gates reject disabled selections and unsupported modules", () => {
	const prefix = "LEAN_BRIDGE_RECURSIVE_CHECKED_RECORD_RUBY_", enabled = { [prefix + "TEST"]: "1" };
	assert.deepEqual(recursiveCheckedRecordRubySelection({}), {
		enabled: false, routes: ["ordinary", "reviewed"]
		, fixtures: ["recursive"], maxLoad: 8
	});
	for(const flag of ["", "true", "2", true, null])
		assert.throws(() => recursiveCheckedRecordRubySelection({ [prefix + "TEST"]: flag }));
	for(const [name, valid] of [["ROUTES", "ordinary"], ["FIXTURES", "recursive"]])
	{
		for(const raw of ["", "unknown", `${valid},`, `${valid},${valid}`, true, null])
			assert.throws(() => recursiveCheckedRecordRubySelection({ ...enabled, [prefix + name]: raw }));
		for(const flag of [undefined, "0"])
			assert.throws(() => recursiveCheckedRecordRubySelection({ [prefix + "TEST"]: flag, [prefix + name]: valid }));
	}
	assert.throws(() => recursiveCheckedRecordRubySelection({ ...enabled, [prefix + "FIXTURES"]: "mutual" }));
	for(const maxLoad of [8, 12, 16, 20])
		assert.equal(recursiveCheckedRecordRubySelection({ ...enabled, [prefix + "MAX_LOAD"]: String(maxLoad) }).maxLoad
			, maxLoad);
	for(const maxLoad of ["", "6", "24", "eight"])
		assert.throws(() => recursiveCheckedRecordRubySelection({ ...enabled, [prefix + "MAX_LOAD"]: maxLoad }));
	const GiB = 1024 ** 3, admitted = { freeBytes: 3 * GiB, availableBytes: 4 * GiB, load: 7.5 };
	assertRecursiveCheckedRecordRubyResources({ observations: [admitted], waits: 0 }, 8);
	assert.throws(() => assertRecursiveCheckedRecordRubyResources({ observations: [{ ...admitted, load: 8 }], waits: 0 }, 8));
});
