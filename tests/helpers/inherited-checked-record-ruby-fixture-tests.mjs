/**
 * Source-only controls for the independent inherited checked-record Ruby
 * caller. No installed gem or compiled Lean library executes here.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { validateExportConfiguration } from "../../src/analyze/export-configuration.mjs";
import { generateCopiedRubyPackage } from "../../src/backends/ruby/copied-values.mjs";
import { validateBindingIr } from "../../src/binding-ir/contract.mjs";
import {
	inheritedCheckedRecordRubyCaller
	, inheritedCheckedRecordRubyCallerArgs
	, inheritedCheckedRecordRubyConfiguration
	, inheritedCheckedRecordRubyCounts
	, inheritedCheckedRecordRubyLoadCeilings
	, inheritedCheckedRecordRubyModes
	, inheritedCheckedRecordRubyReview
	, inheritedCheckedRecordRubyRoutes
	, inheritedCheckedRecordRubySelection
	, parseInheritedCheckedRecordRubyResult
} from "./inherited-checked-record-ruby-fixture.mjs";
import {
	inheritedCheckedRecordReview
} from "./inherited-checked-record-fixture.mjs";
import { runCopied } from "./copied-fixture-install.mjs";

const ruby = process.env.LEAN_BRIDGE_RUBY
	?? resolve(".toolchains/ruby33/bin/ruby");
const callerPath = resolve(
	"tests/fixtures/inherited-checked-record-consumers/ruby.rb");
const modelPath = resolve(
	"tests/helpers/inherited-checked-record-ruby-model.rb");
const modulePath = "lib/lean_bridge/inheritedcheckedrecords.rb";
const fullNames = [
	"first", "normalized", "pair", "aliased", "nested", "echo"
	, "produce", "produce_stamped"
];

test("inherited checked-record Ruby preserves both author contracts and result-only records", async () => {
	for(const route of inheritedCheckedRecordRubyRoutes)
		for(const mode of inheritedCheckedRecordRubyModes)
		{
			const configuration
				= inheritedCheckedRecordRubyConfiguration(route, mode);
			validateExportConfiguration(configuration);
			assert.deepEqual(configuration.targets, {
				rubygems: { name: "inheritedcheckedrecords", version: "1.0.0" }
			});
			const review = inheritedCheckedRecordRubyReview(mode);
			const before = structuredClone(review);
			validateBindingIr(review);
			const source = generateCopiedRubyPackage(review)[modulePath];
			assert.deepEqual(review, before);
			const names = mode === "full" ? fullNames : fullNames.slice(-2);
			assert.deepEqual([...source.matchAll(/^ {4}def ([a-z_]+)\(/gmu)]
				.map(match => match[1]), names);
			assert.match(source
				, /class Span\n(?: {6}#[^\n]+\n)* {6}attr_reader :lo, :hi/u);
			assert.match(source
				, /class Ticket\n(?: {6}#[^\n]+\n)* {6}attr_reader :to_span, :word/u);
			assert.match(source
				, /class Stamped\n(?: {6}#[^\n]+\n)* {6}attr_reader :to_ticket, :mark/u);
			assert.doesNotMatch(source
				, /attr_reader[^\n]*(?:ordered|linked|stamped)/u);
			if(mode === "full")
			{
				assert.match(source, /# TicketAlias = Ticket/u);
				assert.doesNotMatch(source, /^ {4}TicketAlias =/mu);
			}
			else assert.doesNotMatch(source, /TicketAlias|def first/u);
			assert.deepEqual(inheritedCheckedRecordRubyCallerArgs(route, mode), [
				...mode === "result-only" ? ["--result-only"] : []
				, ...route === "reviewed" ? ["--reviewed"] : []
			]);
		}
	assert.deepEqual(inheritedCheckedRecordRubyReview("full")
		, inheritedCheckedRecordReview());
	assert.equal(await inheritedCheckedRecordRubyCaller("ordinary")
		, await inheritedCheckedRecordRubyCaller("reviewed"));
	assert.throws(() => inheritedCheckedRecordRubyConfiguration(
		"unknown", "full"));
	assert.throws(() => inheritedCheckedRecordRubyConfiguration(
		"ordinary", "unknown"));
	assert.throws(() => inheritedCheckedRecordRubyReview("unknown"));
	assert.throws(() => inheritedCheckedRecordRubyCallerArgs(
		"ordinary", "unknown"));
	await assert.rejects(inheritedCheckedRecordRubyCaller("unknown"));
});

test("inherited checked-record Ruby gates close routes, modes, and load ceilings", () => {
	const prefix = "LEAN_BRIDGE_INHERITED_CHECKED_RECORD_RUBY_";
	const enabled = { [prefix + "TEST"]: "1" };
	assert.deepEqual(inheritedCheckedRecordRubySelection({}), {
		enabled: false, routes: ["ordinary", "reviewed"]
		, modes: ["full", "result-only"], maxLoad: 12
	});
	assert.equal(inheritedCheckedRecordRubySelection({ CI: "true" }).maxLoad, 8);
	for(const flag of ["", "true", "yes", "2", true, null])
		assert.throws(() => inheritedCheckedRecordRubySelection({
			[prefix + "TEST"]: flag
		}));
	for(const [name, valid] of [["ROUTES", "ordinary"], ["MODES", "full"]])
	{
		for(const raw of ["", "unknown", `${valid},`, `${valid},${valid}`, true, null])
			assert.throws(() => inheritedCheckedRecordRubySelection({
				...enabled, [prefix + name]: raw
			}));
		for(const flag of [undefined, "0"])
			assert.throws(() => inheritedCheckedRecordRubySelection({
				[prefix + "TEST"]: flag, [prefix + name]: valid
			}));
	}
	for(const name of ["OUTPUT", "MAX_LOAD"])
		for(const flag of [undefined, "0"])
			assert.throws(() => inheritedCheckedRecordRubySelection({
				[prefix + "TEST"]: flag, [prefix + name]: "explicit"
			}));
	for(const maxLoad of inheritedCheckedRecordRubyLoadCeilings)
		assert.equal(inheritedCheckedRecordRubySelection({
			...enabled, [prefix + "MAX_LOAD"]: String(maxLoad)
		}).maxLoad, maxLoad);
	for(const maxLoad of ["", "6", "10", "24", "Infinity", "NaN", 8, null])
		assert.throws(() => inheritedCheckedRecordRubySelection({
			...enabled, [prefix + "MAX_LOAD"]: maxLoad
		}));
});

test("independent inherited checked-record Ruby caller covers every closed selection", {
	skip: !existsSync(ruby)
}, async () => {
	for(const route of inheritedCheckedRecordRubyRoutes)
		for(const mode of inheritedCheckedRecordRubyModes)
		{
			const run = await runCopied(ruby, [
				"--disable-gems", modelPath, callerPath
				, ...inheritedCheckedRecordRubyCallerArgs(route, mode)
			], process.cwd());
			assert.equal(run.code, 0, run.stderr);
			assert.equal(run.stderr, "");
			assert.deepEqual(parseInheritedCheckedRecordRubyResult(
				run.stdout, mode), inheritedCheckedRecordRubyCounts[mode]);
		}
	assert.equal(await readFile(callerPath, "utf8")
		, await inheritedCheckedRecordRubyCaller("ordinary"));
	for(const mode of inheritedCheckedRecordRubyModes)
	{
		const counts = inheritedCheckedRecordRubyCounts[mode];
		for(const key of Object.keys(counts))
			assert.throws(() => parseInheritedCheckedRecordRubyResult(
				JSON.stringify({ ...counts, [key]: counts[key] + 1 }), mode));
		assert.throws(() => parseInheritedCheckedRecordRubyResult(
			JSON.stringify({ ...counts, extra: 1 }), mode));
	}
	assert.throws(() => parseInheritedCheckedRecordRubyResult(
		"{}", "unknown"));
});

test("inherited checked-record Ruby caller rejects independent semantic faults", {
	skip: !existsSync(ruby)
}, async t => {
	const faults = {
		full: [
			"produce-offset", "missing-produce-stamped", "wrong-host-exception"
			, "normalize-bypass", "accept-invalid", "wrong-diagnostic"
			, "echo-alias"
		]
		, "result-only": [
			"produce-offset", "missing-produce-stamped", "wrong-host-exception"
			, "inputs-exported"
		]
	};
	for(const [mode, selected] of Object.entries(faults))
		for(const fault of selected)
		{
			await assert.rejects(runCopied(ruby, [
				"--disable-gems", modelPath, callerPath, `--fault=${fault}`
				, ...mode === "result-only" ? ["--result-only"] : []
			], process.cwd()), error => {
				assert.equal(error.code, "build-command-failed");
				assert.match(error.message, /exited with status 1/u);
				return true;
			}, `${mode} accepted ${fault}`);
		}
	t.diagnostic("Eleven independent result, export, diagnostic, conversion, normalization, and rejection faults refused; no installed gem executed.");
});
