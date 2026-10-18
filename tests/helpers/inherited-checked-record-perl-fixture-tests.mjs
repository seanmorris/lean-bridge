/**
 * Source-only controls for the independent inherited checked-record Perl
 * caller. No prepared CPAN archive or compiled Lean library executes here.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import {
	validateExportConfiguration
} from "../../src/analyze/export-configuration.mjs";
import { projectPerlNames } from "../../src/backends/perl/naming.mjs";
import { validateBindingIr } from "../../src/binding-ir/contract.mjs";
import {
	checkedRecordPerlConfigurations
	, checkedRecordPerlExecutables
} from "./checked-record-perl-install.mjs";
import { runCopied } from "./copied-fixture-install.mjs";
import {
	inheritedCheckedRecordPerlCaller
	, inheritedCheckedRecordPerlCallerArgs
	, inheritedCheckedRecordPerlConfiguration
	, inheritedCheckedRecordPerlCounts
	, inheritedCheckedRecordPerlLoadCeilings
	, inheritedCheckedRecordPerlModes
	, inheritedCheckedRecordPerlReview
	, inheritedCheckedRecordPerlRoutes
	, inheritedCheckedRecordPerlSelection
	, inheritedCheckedRecordPerlTarget
	, parseInheritedCheckedRecordPerlResult
} from "./inherited-checked-record-perl-fixture.mjs";
import {
	inheritedCheckedRecordReview
} from "./inherited-checked-record-fixture.mjs";

const executables = checkedRecordPerlExecutables();
const callerPath = resolve(
	"tests/fixtures/inherited-checked-record-consumers/perl.pl"
);
const modelPath = resolve(
	"tests/helpers/inherited-checked-record-perl-model.pl"
);
const available = [modelPath, callerPath, ...Object.values(executables)]
	.every(existsSync);
const fullNames = [
	"first", "normalized", "pair", "aliased", "nested", "echo"
	, "produce", "produce_stamped"
];

test("inherited checked-record Perl preserves both author contracts and result-only records", async () => {
	for(const route of inheritedCheckedRecordPerlRoutes)
		for(const mode of inheritedCheckedRecordPerlModes)
		{
			const configuration
				= inheritedCheckedRecordPerlConfiguration(route, mode);
			validateExportConfiguration(configuration);
			assert.deepEqual(configuration.targets, {
				cpan: inheritedCheckedRecordPerlTarget
			});
			const review = inheritedCheckedRecordPerlReview(mode);
			validateBindingIr(review);
			const expectedNames = mode === "full"
				? fullNames : fullNames.slice(-2);
			assert.deepEqual(projectPerlNames(
				inheritedCheckedRecordPerlTarget.module
				, review.declarations.map(declaration => ({
					...declaration, name: declaration.source.declaration
				}))
			).map(declaration => declaration.publicName), expectedNames);
			const records = Object.fromEntries(review.types
				.filter(type => type.kind === "record")
				.map(type => [type.name, type.fields.map(field => field.name)]));
			assert.deepEqual(records, {
				Span: ["lo", "hi"]
				, Stamped: ["toTicket", "mark"]
				, Ticket: ["toSpan", "word"]
			});
			assert.ok(review.types.every(type => !type.fields.some(field =>
				["ordered", "linked", "stamped"].includes(field.name)
			)));
			assert.equal(review.types.some(type => type.name === "TicketAlias")
				, mode === "full");
			assert.deepEqual(
				inheritedCheckedRecordPerlCallerArgs(route, mode)
				, [
					...mode === "result-only" ? ["--result-only"] : []
					, ...route === "reviewed" ? ["--reviewed"] : []
				]
			);
		}
	assert.deepEqual(inheritedCheckedRecordPerlReview("full")
		, inheritedCheckedRecordReview());
	assert.equal(await inheritedCheckedRecordPerlCaller("ordinary")
		, await inheritedCheckedRecordPerlCaller("reviewed"));
	assert.throws(() => inheritedCheckedRecordPerlConfiguration(
		"unknown", "full"));
	assert.throws(() => inheritedCheckedRecordPerlConfiguration(
		"ordinary", "unknown"));
	assert.throws(() => inheritedCheckedRecordPerlReview("unknown"));
	assert.throws(() => inheritedCheckedRecordPerlCallerArgs(
		"ordinary", "unknown"));
});

test("inherited checked-record Perl gates close routes, modes, and load ceilings", () => {
	const prefix = "LEAN_BRIDGE_INHERITED_CHECKED_RECORD_PERL_";
	const enabled = { [prefix + "TEST"]: "1" };
	assert.deepEqual(inheritedCheckedRecordPerlSelection({}), {
		enabled: false, routes: ["ordinary", "reviewed"]
		, modes: ["full", "result-only"], maxLoad: 12
	});
	assert.equal(inheritedCheckedRecordPerlSelection({ CI: "true" }).maxLoad, 8);
	for(const flag of ["", "true", "yes", "2", true, null])
		assert.throws(() => inheritedCheckedRecordPerlSelection({
			[prefix + "TEST"]: flag
		}));
	for(const [name, valid] of [["ROUTES", "ordinary"], ["MODES", "full"]])
	{
		for(const raw of ["", "unknown", `${valid},`, `${valid},${valid}`, true, null])
			assert.throws(() => inheritedCheckedRecordPerlSelection({
				...enabled, [prefix + name]: raw
			}));
		for(const flag of [undefined, "0"])
			assert.throws(() => inheritedCheckedRecordPerlSelection({
				[prefix + "TEST"]: flag, [prefix + name]: valid
			}));
	}
	for(const name of ["OUTPUT", "MAX_LOAD"])
		for(const flag of [undefined, "0"])
			assert.throws(() => inheritedCheckedRecordPerlSelection({
				[prefix + "TEST"]: flag, [prefix + name]: "explicit"
			}));
	for(const flag of [undefined, "0"])
		assert.throws(() => inheritedCheckedRecordPerlSelection({
			[prefix + "TEST"]: flag
			, LEAN_BRIDGE_INHERITED_CHECKED_RECORD_PERLS: "{}"
		}));
	for(const maxLoad of inheritedCheckedRecordPerlLoadCeilings)
		assert.equal(inheritedCheckedRecordPerlSelection({
			...enabled, [prefix + "MAX_LOAD"]: String(maxLoad)
		}).maxLoad, maxLoad);
	for(const maxLoad of ["", "6", "10", "24", "Infinity", "NaN", 8, null])
		assert.throws(() => inheritedCheckedRecordPerlSelection({
			...enabled, [prefix + "MAX_LOAD"]: maxLoad
		}));
});

test("independent inherited checked-record Perl caller covers every closed selection and ABI", {
	skip: !available, timeout: 120_000
}, async () => {
	for(const configuration of checkedRecordPerlConfigurations)
		for(const route of inheritedCheckedRecordPerlRoutes)
			for(const mode of inheritedCheckedRecordPerlModes)
			{
				const run = await runCopied(executables[configuration], [
					modelPath, callerPath
					, ...inheritedCheckedRecordPerlCallerArgs(route, mode)
				], process.cwd());
				assert.equal(run.code, 0, run.stderr);
				assert.equal(run.stderr, "");
				assert.deepEqual(parseInheritedCheckedRecordPerlResult(
					run.stdout, mode), inheritedCheckedRecordPerlCounts[mode]);
			}
	assert.equal(await readFile(callerPath, "utf8")
		, await inheritedCheckedRecordPerlCaller());
	for(const mode of inheritedCheckedRecordPerlModes)
	{
		const counts = inheritedCheckedRecordPerlCounts[mode];
		for(const key of Object.keys(counts))
			assert.throws(() => parseInheritedCheckedRecordPerlResult(
				JSON.stringify({ ...counts, [key]: counts[key] + 1 }), mode));
		assert.throws(() => parseInheritedCheckedRecordPerlResult(
			JSON.stringify({ ...counts, extra: 1 }), mode));
	}
	assert.throws(() => parseInheritedCheckedRecordPerlResult(
		"{}", "unknown"));
});

test("inherited checked-record Perl caller rejects independent semantic faults", {
	skip: !available, timeout: 120_000
}, async t => {
	const command = executables[checkedRecordPerlConfigurations[0]];
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
			await assert.rejects(runCopied(command, [
				modelPath, callerPath, `--fault=${fault}`
				, ...mode === "result-only" ? ["--result-only"] : []
			], process.cwd()), error => {
				assert.equal(error.code, "build-command-failed");
				assert.match(error.message, /exited with status [1-9][0-9]*/u);
				return true;
			}, `${mode} accepted ${fault}`);
	t.diagnostic("Eleven independent result, export, diagnostic, conversion, normalization, rejection, and copy faults refused; no prepared CPAN archive executed.");
});
