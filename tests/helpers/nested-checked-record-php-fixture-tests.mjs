/**
 * Source-only controls for the nested checked-record native PHP caller. Genuine generated
 * value classes and host checks run here; no compiled Lean extension or installed package does.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { bundledBrickMath } from "../../src/backends/php/brick-math.mjs";
import { compileCopiedPhpModel } from "../../src/backends/php/copied-model.mjs";
import { generateCopiedPhpPackage } from "../../src/backends/php/copied-values.mjs";
import { validateBindingIr } from "../../src/binding-ir/contract.mjs";
import { validateExportConfiguration } from "../../src/analyze/export-configuration.mjs";
import { canonicalJson } from "../../src/capsule/node.mjs";
import { nestedCheckedRecordConfiguration, nestedCheckedRecordReview } from "./nested-checked-record-fixture.mjs";
import {
	nestedCheckedRecordPhpCaller
	, nestedCheckedRecordPhpConfiguration
	, nestedCheckedRecordPhpCounts
	, nestedCheckedRecordPhpModes
	, nestedCheckedRecordPhpReview
	, nestedCheckedRecordPhpRoutes
	, nestedCheckedRecordPhpSelection
	, parseNestedCheckedRecordPhpResult
} from "./nested-checked-record-php-fixture.mjs";
import { runCopied } from "./copied-fixture-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

const php = process.env.LEAN_BRIDGE_PHP ?? "/usr/bin/php";
const phpNames = [
	"first", "second", "pair", "in_array", "in_list", "in_option"
	, "in_product", "in_except", "in_holder", "in_choice", "echo_array"
	, "produce_option", "produce_array"
];
export const nestedCheckedRecordPhpResultFaults = Object.freeze([
	"produce-offset", "produce-array-length", "produce-keyed-array"
	, "produce-bare-packet", "accept-int", "wrong-host-exception"
	, "lean-host-message"
]);
export const nestedCheckedRecordPhpInputFaults = Object.freeze([
	"missing-fin", "fin-after-constructor", "missing-normalization"
	, "conflated-constructor", "diagnostic-suffix", "wrong-status"
	, "wrong-error-class", "wrong-path", "wrong-choice", "except-swapped"
	, "holder-tag", "echo-normalizes", "echo-swapped-fields"
	, "list-as-array"
]);

test("nested checked-record native PHP keeps both author contracts and constructor-free results", async () => {
	for(const route of nestedCheckedRecordPhpRoutes) for(const mode of nestedCheckedRecordPhpModes)
	{
		const expected = nestedCheckedRecordConfiguration(route, ["c"], mode);
		const actual = nestedCheckedRecordPhpConfiguration(route, mode); validateExportConfiguration(actual);
		assert.deepEqual({ ...actual, targets: expected.targets }, expected);
		assert.deepEqual(actual.targets, { "php-native": { name: "example/nestedcheckedrecords", version: "1.0.0" } });
		const review = nestedCheckedRecordPhpReview(mode), before = structuredClone(review); validateBindingIr(review);
		assert.deepEqual(review, nestedCheckedRecordReview(mode));
		const source = generateCopiedPhpPackage(review)["src/Api.php"];
		assert.deepEqual(review, before);
		const names = mode === "full" ? phpNames : phpNames.slice(-2);
		assert.deepEqual([...source.matchAll(/^function ([a-z_]+)\(/gmu)].map(match => match[1]), names);
		assert.match(source, /final readonly class Packet\n\{\n(?: {4}\/\*\* @var [^\n]+\n)? {4}public \\Brick\\Math\\BigInteger \$digit;\n(?: {4}\/\*\* @var [^\n]+\n)? {4}public \\Brick\\Math\\BigInteger \$word;\n/u);
		assert.equal(source.includes("final readonly class Holder\n"), mode === "full");
		assert.equal(source.includes("final readonly class ChoicePacket extends Choice\n"), mode === "full");
		const caller = await nestedCheckedRecordPhpCaller(route, mode);
		assert.equal(caller.includes(`const NESTED_CHECKED_RECORD_RESULT_ONLY = ${mode === "result-only"};\n`), true);
		assert.equal(caller.includes(`const NESTED_PARAMETER_PREFIX = '${route === "reviewed" ? "value" : "arg"}';\n`), true);
	}
	await assert.rejects(nestedCheckedRecordPhpCaller("unknown", "full"));
	await assert.rejects(nestedCheckedRecordPhpCaller("ordinary", "unknown"));
	assert.throws(() => nestedCheckedRecordPhpConfiguration("unknown", "full"));
	assert.throws(() => nestedCheckedRecordPhpConfiguration("ordinary", "unknown"));
	for(const mode of nestedCheckedRecordPhpModes)
	{
		const counts = nestedCheckedRecordPhpCounts[mode];
		assert.deepEqual(parseNestedCheckedRecordPhpResult(JSON.stringify(counts), mode), counts);
		for(const key of Object.keys(counts))
			assert.throws(() => parseNestedCheckedRecordPhpResult(JSON.stringify({ ...counts, [key]: counts[key] + 1 }), mode));
		assert.throws(() => parseNestedCheckedRecordPhpResult(JSON.stringify({ ...counts, extra: 1 }), mode));
	}
	assert.throws(() => parseNestedCheckedRecordPhpResult("{}", "unknown"));
});

test("nested checked-record native PHP gates reject disabled, misspelled or repeated selections", () => {
	const prefix = "LEAN_BRIDGE_NESTED_CHECKED_RECORD_PHP_", enabled = { [prefix + "TEST"]: "1" };
	assert.deepEqual(nestedCheckedRecordPhpSelection({}), { enabled: false
		, routes: ["ordinary", "reviewed"], modes: ["full", "result-only"]
		, maxLoad: 8 });
	assert.equal(nestedCheckedRecordPhpSelection(enabled).enabled, true);
	for(const maxLoad of [8, 12, 16, 20])
		assert.equal(nestedCheckedRecordPhpSelection({ ...enabled
			, [prefix + "MAX_LOAD"]: String(maxLoad) }).maxLoad, maxLoad);
	for(const maxLoad of ["", "6", "10", "24", "not-a-number"])
		assert.throws(() => nestedCheckedRecordPhpSelection({ ...enabled
			, [prefix + "MAX_LOAD"]: maxLoad }));
	for(const flag of ["", "true", "yes", "2", true, null])
		assert.throws(() => nestedCheckedRecordPhpSelection({ [prefix + "TEST"]: flag }));
	for(const [name, valid] of [["ROUTES", "ordinary"], ["MODES", "full"]])
	{
		for(const raw of ["", "unknown", `${valid},`, `${valid},${valid}`, true, null])
			assert.throws(() => nestedCheckedRecordPhpSelection({ ...enabled, [prefix + name]: raw }));
		for(const flag of [undefined, "0"])
			assert.throws(() => nestedCheckedRecordPhpSelection({ [prefix + "TEST"]: flag, [prefix + name]: valid }));
		assert.deepEqual(nestedCheckedRecordPhpSelection({ ...enabled, [prefix + name]: valid })[name.toLowerCase()], [valid]);
	}
	for(const name of ["OUTPUT", "MAX_LOAD"]) for(const flag of [undefined, "0"])
		assert.throws(() => nestedCheckedRecordPhpSelection({ [prefix + "TEST"]: flag, [prefix + name]: "explicit" }));
});

test("nested checked-record native PHP caller rejects every oracle fault in weak and strict modes", {
	skip: !existsSync(php) && "Select LEAN_BRIDGE_PHP to run PHP caller controls"
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-nested-php-model-"));
	t.after(() => rm(root, { recursive: true }));
	for(const mode of nestedCheckedRecordPhpModes)
	{
		const directory = join(root, mode), review = nestedCheckedRecordPhpReview(mode);
		for(const [path, source] of Object.entries({ ...generateCopiedPhpPackage(review), ...bundledBrickMath() }))
			await saveLakeFile(directory, path, source);
		const model = compileCopiedPhpModel(review, { lists: true, variants: true });
		const checks = Object.fromEntries(model.surface.functions.map(fn => [fn.field, fn.declaration.parameters.map(site => model.surface.copy(site.type).index)]));
		await saveLakeFile(directory, "checks.json", canonicalJson(checks));
		for(const route of nestedCheckedRecordPhpRoutes) for(const strictness of ["weak", "strict"])
		{
			let source = await nestedCheckedRecordPhpCaller(route, mode);
			if(strictness === "strict") source = source.replace("declare(strict_types=0);", "declare(strict_types=1);");
			const caller = `${route}-${strictness}.php`;
			await saveLakeFile(directory, caller, source);
			const syntax = await runCopied(php, ["-n", "-l", join(directory, caller)], directory);
			assert.equal(syntax.stderr, "");
			const run = await runCopied(php, ["-n"
				, resolve("tests/helpers/nested-checked-record-php-model.php")
				, join(directory, "dependencies/brick-math/autoload.php")
				, join(directory, "src/Api.php"), join(directory, caller)
				, route === "ordinary" ? "arg" : "value"
				, mode, join(directory, "checks.json")], directory);
			assert.equal(run.stderr, ""); const result = JSON.parse(run.stdout);
			assert.equal(result.installedAcceptance, false);
			parseNestedCheckedRecordPhpResult(JSON.stringify(result.counts), mode);
			assert.deepEqual(result.rejectedFaults, [...nestedCheckedRecordPhpResultFaults
				, ...mode === "full" ? nestedCheckedRecordPhpInputFaults : ["inputs-exported"]]);
		}
	}
	t.diagnostic("Genuine generated value classes and host checks with an explicit Lean double; no installed extension executes.");
});
