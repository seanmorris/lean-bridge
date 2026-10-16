/**
 * Source-only controls for the nested checked-record Ruby caller. No compiled Lean
 * library or installed gem executes here; the caller runs against a Ruby oracle.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { generateCopiedRubyPackage } from "../../src/backends/ruby/copied-values.mjs";
import { validateBindingIr } from "../../src/binding-ir/contract.mjs";
import { validateExportConfiguration } from "../../src/analyze/export-configuration.mjs";
import { nestedCheckedRecordConfiguration, nestedCheckedRecordReview } from "./nested-checked-record-fixture.mjs";
import {
	nestedCheckedRecordRubyCaller
	, nestedCheckedRecordRubyCallerArgs
	, nestedCheckedRecordRubyConfiguration
	, nestedCheckedRecordRubyCounts
	, nestedCheckedRecordRubyModes
	, nestedCheckedRecordRubyReview
	, nestedCheckedRecordRubyRoutes
	, nestedCheckedRecordRubySelection
	, parseNestedCheckedRecordRubyResult
} from "./nested-checked-record-ruby-fixture.mjs";
import { runCopied } from "./copied-fixture-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

const ruby = process.env.LEAN_BRIDGE_RUBY ?? resolve(".toolchains/ruby33/bin/ruby");
const modulePath = "lib/lean_bridge/nestedcheckedrecords.rb";
const rubyNames = [
	"first", "second", "pair", "in_array", "in_list", "in_option"
	, "in_product", "in_except", "in_holder", "in_choice", "echo_array"
	, "produce_option", "produce_array"
];
export const nestedCheckedRecordRubyResultFaults = Object.freeze([
	"produce-offset", "produce-array-length", "produce-frozen-array"
	, "produce-bare-packet", "accept-true", "wrong-host-exception"
]);
export const nestedCheckedRecordRubyInputFaults = Object.freeze([
	"missing-fin", "fin-after-constructor", "missing-normalization"
	, "conflated-constructor", "diagnostic-suffix", "wrong-error-class"
	, "wrong-path", "wrong-choice", "except-swapped", "holder-tag"
	, "echo-normalizes", "echo-aliases-input", "echo-swapped-fields"
	, "mutate-accepted-input", "mutate-rejected-input", "list-as-array"
	, "lean-host-message"
]);

test("nested checked-record Ruby keeps both author contracts and constructor-free results", async () => {
	for(const route of nestedCheckedRecordRubyRoutes) for(const mode of nestedCheckedRecordRubyModes)
	{
		const expected = nestedCheckedRecordConfiguration(route, ["c"], mode);
		const actual = nestedCheckedRecordRubyConfiguration(route, mode); validateExportConfiguration(actual);
		assert.deepEqual({ ...actual, targets: expected.targets }, expected);
		assert.deepEqual(actual.targets, { rubygems: { name: "nestedcheckedrecords", version: "1.0.0" } });
		const review = nestedCheckedRecordRubyReview(mode), before = structuredClone(review); validateBindingIr(review);
		assert.deepEqual(review, nestedCheckedRecordReview(mode));
		const source = generateCopiedRubyPackage(review)[modulePath];
		assert.deepEqual(review, before);
		const names = mode === "full" ? rubyNames : rubyNames.slice(-2);
		assert.deepEqual([...source.matchAll(/^ {4}def ([a-z_]+)\(/gmu)].map(match => match[1]), names);
		assert.match(source, /class Packet\n {6}attr_reader :digit, :word\n/u);
		if(mode === "full")
		{
			assert.match(source, /class Holder\n {6}attr_reader :packet, :tag\n/u);
			assert.match(source, /class Choice::Empty < Choice\n/u); assert.match(source, /class Choice::Packet < Choice\n/u);
		}
		assert.deepEqual(nestedCheckedRecordRubyCallerArgs(route, mode)
			, [...mode === "result-only" ? ["--result-only"] : [], ...route === "reviewed" ? ["--reviewed"] : []]);
	}
	assert.equal(await nestedCheckedRecordRubyCaller("reviewed"), await nestedCheckedRecordRubyCaller("ordinary"));
	assert.throws(() => nestedCheckedRecordRubyConfiguration("unknown", "full"));
	assert.throws(() => nestedCheckedRecordRubyConfiguration("ordinary", "unknown"));
	assert.throws(() => nestedCheckedRecordRubyCallerArgs("ordinary", "unknown"));
	await assert.rejects(nestedCheckedRecordRubyCaller("unknown"));
	for(const mode of nestedCheckedRecordRubyModes)
	{
		const counts = nestedCheckedRecordRubyCounts[mode];
		assert.deepEqual(parseNestedCheckedRecordRubyResult(JSON.stringify(counts), mode), counts);
		for(const key of Object.keys(counts))
			assert.throws(() => parseNestedCheckedRecordRubyResult(JSON.stringify({ ...counts, [key]: counts[key] + 1 }), mode));
		assert.throws(() => parseNestedCheckedRecordRubyResult(JSON.stringify({ ...counts, extra: 1 }), mode));
	}
	assert.throws(() => parseNestedCheckedRecordRubyResult("{}", "unknown"));
});

test("nested checked-record Ruby gates reject disabled, misspelled or repeated selections", () => {
	const prefix = "LEAN_BRIDGE_NESTED_CHECKED_RECORD_RUBY_", enabled = { [prefix + "TEST"]: "1" };
	assert.deepEqual(nestedCheckedRecordRubySelection({}), { enabled: false, routes: ["ordinary", "reviewed"], modes: ["full", "result-only"] });
	assert.equal(nestedCheckedRecordRubySelection(enabled).enabled, true);
	for(const flag of ["", "true", "yes", "2", true, null])
		assert.throws(() => nestedCheckedRecordRubySelection({ [prefix + "TEST"]: flag }));
	for(const [name, valid] of [["ROUTES", "ordinary"], ["MODES", "full"]])
	{
		for(const raw of ["", "unknown", `${valid},`, `${valid},${valid}`, true, null])
			assert.throws(() => nestedCheckedRecordRubySelection({ ...enabled, [prefix + name]: raw }));
		for(const flag of [undefined, "0"])
			assert.throws(() => nestedCheckedRecordRubySelection({ [prefix + "TEST"]: flag, [prefix + name]: valid }));
		assert.deepEqual(nestedCheckedRecordRubySelection({ ...enabled, [prefix + name]: valid })[name.toLowerCase()], [valid]);
	}
	for(const flag of [undefined, "0"])
		assert.throws(() => nestedCheckedRecordRubySelection({ [prefix + "TEST"]: flag, [prefix + "OUTPUT"]: "explicit" }));
});

test("nested checked-record Ruby caller detects every result, input and selection fault in an oracle", { skip: !existsSync(ruby) }, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-nested-ruby-model-"));
	t.after(() => rm(root, { recursive: true }));
	const caller = await nestedCheckedRecordRubyCaller("ordinary"), path = join(root, "consumer.rb");
	await saveLakeFile(root, "consumer.rb", caller);
	const generated = join(root, "generated.rb");
	await saveLakeFile(root, "generated.rb", generateCopiedRubyPackage(nestedCheckedRecordRubyReview("full"))[modulePath]);
	for(const generatedValueClasses of [false, true])
	{
		const args = ["--disable-gems", "-W:no-experimental"
			, resolve("tests/helpers/nested-checked-record-ruby-model.rb")
			, path, ...generatedValueClasses ? [generated] : []];
		const run = await runCopied(ruby, args, root);
		assert.equal(run.stderr, ""); const result = JSON.parse(run.stdout);
		assert.equal(result.installedAcceptance, false);
		assert.equal(result.generatedValueClasses, generatedValueClasses);
		assert.deepEqual(result.results, nestedCheckedRecordRubyModes.flatMap(mode => ["arg", "value"].map(parameterPrefix => ({
			...nestedCheckedRecordRubyCounts[mode]
			, resultOnly: mode === "result-only", parameterPrefix }))));
		assert.deepEqual(result.rejectedFaults, {
			full: [...nestedCheckedRecordRubyResultFaults, ...nestedCheckedRecordRubyInputFaults]
			, "result-only": [...nestedCheckedRecordRubyResultFaults, "inputs-exported"]
		});
	}
	assert.equal(await readFile(path, "utf8"), caller);
	t.diagnostic("Explicit runtime doubles exercise the caller with independent and generated value classes; no installed Lean library executes.");
});
