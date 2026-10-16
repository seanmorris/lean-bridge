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
import { mutualCheckedRecordConfiguration } from "./mutual-checked-record-fixture.mjs";
import { recursiveCheckedRecordConfiguration } from "./recursive-checked-record-fixture.mjs";
import {
	parseRecursiveCheckedRecordRubyResult, recursiveCheckedRecordRubyCaller
	, recursiveCheckedRecordRubyCallerArgs, recursiveCheckedRecordRubyConfiguration
	, recursiveCheckedRecordRubyCounts, recursiveCheckedRecordRubyPackage
	, recursiveCheckedRecordRubyReview, recursiveCheckedRecordRubySelection
} from "./recursive-checked-record-ruby-fixture.mjs";
import { assertRecursiveCheckedRecordRubyResources } from "./recursive-checked-record-ruby-resources.mjs";

export const recursiveCheckedRecordRubyModuleFaults = Object.freeze({
	recursive: Object.freeze(["second-normalizes-root-only"])
	, mutual: Object.freeze(["stop-as-none"])
});
export const recursiveCheckedRecordRubyFaults = Object.freeze([
	"produce-offset", "produce-single", "produce-digits", "accept-bool"
	, "wrong-host-exception", "alias-constant", "missing-fin"
	, "missing-normalization", "conflated-constructor", "diagnostic-suffix"
	, "wrong-status", "wrong-path", "root-only", "echo-unnormalized"
	, "echo-drops-tail", "cycle-as-lean", "depth-unbounded", "shared-as-cycle"
	, "groups-drop-none", "echo-groups-drops-none", "poison-after-reject"
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
	const publics = [];
	for(const fixture of ["recursive", "mutual"])
	{
		const { requirePath } = recursiveCheckedRecordRubyPackage(fixture);
		const files = generateCopiedRubyGraphPackage(recursiveCheckedRecordRubyReview(fixture), null
			, { refinementDiagnostics: true });
		publics.push(join(root, `${fixture}.rb`));
		await saveLakeFile(root, `${fixture}.rb`, files[`lib/${requirePath}.rb`]);
	}
	const model = resolve("tests/helpers/recursive-checked-record-ruby-model.rb");
	const run = await runCopied(ruby, [model, join(root, "consumer.rb"), ...publics], root);
	assert.equal(run.stderr, "");
	const result = JSON.parse(run.stdout);
	assert.equal(result.installedAcceptance, false);
	assert.deepEqual(result.results, [recursiveCheckedRecordRubyCounts.recursive
		, recursiveCheckedRecordRubyCounts.mutual]);
	assert.deepEqual(result.rejectedFaults, Object.fromEntries(["recursive", "mutual"].map(fixture =>
		[fixture, [...recursiveCheckedRecordRubyFaults, ...recursiveCheckedRecordRubyModuleFaults[fixture]]])));
	assert.equal(await readFile(join(root, "consumer.rb"), "utf8"), caller);
	t.diagnostic("A Ruby runtime double exercises the caller with generated value classes; no installed Lean library executes.");
});

test("recursive checked-record Ruby keeps both author contracts and gem coordinates", () => {
	const base = { recursive: recursiveCheckedRecordConfiguration, mutual: mutualCheckedRecordConfiguration };
	for(const route of ["ordinary", "reviewed"]) for(const fixture of ["recursive", "mutual"])
	{
		const expected = base[fixture](route);
		const actual = recursiveCheckedRecordRubyConfiguration(route, fixture);
		assert.deepEqual({ ...actual, targets: expected.targets }, expected);
		assert.deepEqual(actual.targets, { rubygems: { name: `${fixture}checkedrecords`, version: "1.0.0" } });
		const pkg = recursiveCheckedRecordRubyPackage(fixture);
		assert.equal(pkg.requirePath, `lean_bridge/${fixture}checkedrecords`);
		assert.equal(pkg.namespace, `LeanBridge::${fixture[0].toUpperCase()}${fixture.slice(1)}checkedrecords`);
		assert.deepEqual(recursiveCheckedRecordRubyCallerArgs(fixture), [fixture]);
		const counts = recursiveCheckedRecordRubyCounts[fixture];
		const stdout = `${JSON.stringify(Object.fromEntries(Object.entries(counts).sort()))}\n`;
		assert.deepEqual(parseRecursiveCheckedRecordRubyResult(stdout, fixture), counts);
		for(const key of Object.keys(counts).filter(key => key !== "module"))
			assert.throws(() => parseRecursiveCheckedRecordRubyResult(stdout.replace(`"${key}":${counts[key]}`
				, `"${key}":${counts[key] + 1}`), fixture));
		assert.throws(() => parseRecursiveCheckedRecordRubyResult(stdout.replace("{", "{\"extra\":1,"), fixture));
	}
	assert.throws(() => recursiveCheckedRecordRubyPackage("unknown"));
	assert.throws(() => recursiveCheckedRecordRubyCallerArgs("unknown"));
});

test("recursive checked-record Ruby gates reject disabled selections and unsupported modules", () => {
	const prefix = "LEAN_BRIDGE_RECURSIVE_CHECKED_RECORD_RUBY_", enabled = { [prefix + "TEST"]: "1" };
	assert.deepEqual(recursiveCheckedRecordRubySelection({}), {
		enabled: false, routes: ["ordinary", "reviewed"]
		, fixtures: ["recursive", "mutual"], maxLoad: 8
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
	assert.deepEqual(recursiveCheckedRecordRubySelection({ ...enabled, [prefix + "FIXTURES"]: "mutual" }).fixtures
		, ["mutual"]);
	for(const maxLoad of [8, 12, 16, 20])
		assert.equal(recursiveCheckedRecordRubySelection({ ...enabled, [prefix + "MAX_LOAD"]: String(maxLoad) }).maxLoad
			, maxLoad);
	for(const maxLoad of ["", "6", "24", "eight"])
		assert.throws(() => recursiveCheckedRecordRubySelection({ ...enabled, [prefix + "MAX_LOAD"]: maxLoad }));
	const GiB = 1024 ** 3, admitted = { freeBytes: 3 * GiB, availableBytes: 4 * GiB, load: 7.5 };
	assertRecursiveCheckedRecordRubyResources({ observations: [admitted], waits: 0 }, 8);
	assert.throws(() => assertRecursiveCheckedRecordRubyResources({ observations: [{ ...admitted, load: 8 }], waits: 0 }, 8));
});
