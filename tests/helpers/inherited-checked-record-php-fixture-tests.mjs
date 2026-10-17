/**
 * Source-only controls for the inherited checked-record native PHP caller.
 * Genuine generated value classes run here; no compiled Lean extension does.
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
import { generateCopiedPhpPackage } from "../../src/backends/php/copied-values.mjs";
import { validateBindingIr } from "../../src/binding-ir/contract.mjs";
import { validateExportConfiguration } from "../../src/analyze/export-configuration.mjs";
import {
	inheritedCheckedRecordConfiguration
	, inheritedCheckedRecordReview
} from "./inherited-checked-record-fixture.mjs";
import {
	inheritedCheckedRecordPhpCaller
	, inheritedCheckedRecordPhpConfiguration
	, inheritedCheckedRecordPhpCounts
	, inheritedCheckedRecordPhpLoadCeilings
	, inheritedCheckedRecordPhpModes
	, inheritedCheckedRecordPhpReview
	, inheritedCheckedRecordPhpRoutes
	, inheritedCheckedRecordPhpSelection
	, parseInheritedCheckedRecordPhpResult
} from "./inherited-checked-record-php-fixture.mjs";
import { runCopied } from "./copied-fixture-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

const php = process.env.LEAN_BRIDGE_PHP ?? "/usr/bin/php";
const functions = [
	"first", "normalized", "pair", "aliased", "nested", "echo_"
	, "produce", "produce_stamped"
];
const fullFaults = [
	"produce-offset", "produce-stamped-mark", "accept-invalid"
	, "wrong-diagnostic", "normalize-bypass", "echo-alias"
	, "wrong-host-exception"
];
const resultOnlyFaults = [
	"produce-offset", "produce-stamped-mark", "inputs-exported"
];

test("inherited checked-record native PHP keeps both author contracts and constructor-free results", async () => {
	for(const route of inheritedCheckedRecordPhpRoutes)
		for(const mode of inheritedCheckedRecordPhpModes)
		{
			const configuration = inheritedCheckedRecordPhpConfiguration(route, mode);
			validateExportConfiguration(configuration);
			assert.deepEqual(configuration.targets, {
				"php-native": {
					name: "example/inheritedcheckedrecords", version: "1.0.0"
				}
			});
			const review = inheritedCheckedRecordPhpReview(mode);
			const before = structuredClone(review); validateBindingIr(review);
			assert.deepEqual(review, before);
			if(mode === "full") assert.deepEqual(review, inheritedCheckedRecordReview());
			else
			{
				assert.deepEqual(review.declarations.map(item => item.name)
					, ["produce", "produceStamped"]);
				assert.equal(review.types.some(type => type.name === "TicketAlias"), false);
			}
			const source = generateCopiedPhpPackage(review)["src/Api.php"];
			assert.deepEqual([...source.matchAll(/^function ([a-z_]+)\(/gmu)]
				.map(match => match[1]), mode === "full" ? functions : functions.slice(-2));
			assert.match(source, /final readonly class Span\n\{/u);
			assert.match(source, /final readonly class Ticket\n\{/u);
			assert.match(source, /final readonly class Stamped\n\{/u);
			assert.equal(source.includes("function echo_("), mode === "full");
			assert.equal(source.includes("function echo("), false);
			const caller = await inheritedCheckedRecordPhpCaller(route, mode);
			assert.equal(caller.includes(`const INHERITED_CHECKED_RECORD_RESULT_ONLY = ${mode === "result-only"};\n`), true);
			assert.equal(caller.includes(`const INHERITED_PARAMETER_PREFIX = '${route === "reviewed" ? "value" : "arg"}';\n`), true);
		}
	assert.throws(() => inheritedCheckedRecordPhpReview("unknown"));
	assert.throws(() => inheritedCheckedRecordPhpConfiguration("unknown", "full"));
	assert.throws(() => inheritedCheckedRecordPhpConfiguration("ordinary", "unknown"));
	await assert.rejects(inheritedCheckedRecordPhpCaller("unknown", "full"));
	await assert.rejects(inheritedCheckedRecordPhpCaller("ordinary", "unknown"));
	for(const mode of inheritedCheckedRecordPhpModes)
	{
		const counts = inheritedCheckedRecordPhpCounts[mode];
		assert.deepEqual(parseInheritedCheckedRecordPhpResult(JSON.stringify(counts), mode), counts);
		for(const key of Object.keys(counts))
			assert.throws(() => parseInheritedCheckedRecordPhpResult(
				JSON.stringify({ ...counts, [key]: counts[key] + 1 }), mode));
		assert.throws(() => parseInheritedCheckedRecordPhpResult(
			JSON.stringify({ ...counts, extra: 1 }), mode));
	}
	assert.throws(() => parseInheritedCheckedRecordPhpResult("{}", "unknown"));
});

test("inherited checked-record native PHP gates reject disabled, misspelled, or repeated selections", () => {
	const prefix = "LEAN_BRIDGE_INHERITED_CHECKED_RECORD_PHP_";
	const enabled = { [prefix + "TEST"]: "1" };
	assert.deepEqual(inheritedCheckedRecordPhpSelection({}), {
		enabled: false, routes: ["ordinary", "reviewed"]
		, modes: ["full", "result-only"], maxLoad: 8
	});
	assert.equal(inheritedCheckedRecordPhpSelection(enabled).enabled, true);
	for(const maxLoad of inheritedCheckedRecordPhpLoadCeilings)
		assert.equal(inheritedCheckedRecordPhpSelection({
			...enabled, [prefix + "MAX_LOAD"]: String(maxLoad)
		}).maxLoad, maxLoad);
	for(const maxLoad of ["", "6", "10", "24", "not-a-number"])
		assert.throws(() => inheritedCheckedRecordPhpSelection({
			...enabled, [prefix + "MAX_LOAD"]: maxLoad
		}));
	for(const flag of ["", "true", "yes", "2", true, null])
		assert.throws(() => inheritedCheckedRecordPhpSelection({
			[prefix + "TEST"]: flag
		}));
	for(const [name, valid] of [["ROUTES", "ordinary"], ["MODES", "full"]])
	{
		for(const raw of ["", "unknown", `${valid},`, `${valid},${valid}`, true, null])
			assert.throws(() => inheritedCheckedRecordPhpSelection({
				...enabled, [prefix + name]: raw
			}));
		for(const flag of [undefined, "0"])
			assert.throws(() => inheritedCheckedRecordPhpSelection({
				[prefix + "TEST"]: flag, [prefix + name]: valid
			}));
		assert.deepEqual(inheritedCheckedRecordPhpSelection({
			...enabled, [prefix + name]: valid
		})[name.toLowerCase()], [valid]);
	}
	for(const name of ["OUTPUT", "MAX_LOAD"])
		for(const flag of [undefined, "0"])
			assert.throws(() => inheritedCheckedRecordPhpSelection({
				[prefix + "TEST"]: flag, [prefix + name]: "explicit"
			}));
	const ordinary = inheritedCheckedRecordConfiguration("ordinary", ["c"]);
	assert.deepEqual(Object.keys(ordinary.targets), ["c"]);
});

test("inherited checked-record native PHP caller rejects every independent model fault", {
	skip: !existsSync(php) && "Select LEAN_BRIDGE_PHP to run PHP caller controls"
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-inherited-php-model-"));
	t.after(() => rm(root, { recursive: true }));
	for(const mode of inheritedCheckedRecordPhpModes)
	{
		const directory = join(root, mode);
		for(const [path, source] of Object.entries({
			...generateCopiedPhpPackage(inheritedCheckedRecordPhpReview(mode))
			, ...bundledBrickMath()
		})) await saveLakeFile(directory, path, source);
		for(const route of inheritedCheckedRecordPhpRoutes)
			for(const strictness of ["weak", "strict"])
			{
				let source = await inheritedCheckedRecordPhpCaller(route, mode);
				if(strictness === "strict") source = source.replace(
					"declare(strict_types=0);", "declare(strict_types=1);");
				const caller = `${route}-${strictness}.php`;
				await saveLakeFile(directory, caller, source);
				const syntax = await runCopied(php, ["-n", "-l", join(directory, caller)], directory);
				assert.equal(syntax.stderr, "");
				const run = await runCopied(php, ["-n"
					, resolve("tests/helpers/inherited-checked-record-php-model.php")
					, join(directory, "dependencies/brick-math/autoload.php")
					, join(directory, "src/Api.php"), join(directory, caller)
					, route === "ordinary" ? "arg" : "value", mode], directory);
				assert.equal(run.stderr, "");
				parseInheritedCheckedRecordPhpResult(run.stdout, mode);
			}
		const caller = join(directory, "ordinary-weak.php");
		for(const fault of mode === "full" ? fullFaults : resultOnlyFaults)
			await assert.rejects(runCopied(php, ["-n"
				, resolve("tests/helpers/inherited-checked-record-php-model.php")
				, join(directory, "dependencies/brick-math/autoload.php")
				, join(directory, "src/Api.php"), caller, "arg", mode, fault]
			, directory), undefined, fault);
	}
	t.diagnostic("Generated PHP values plus an independent model; no installed Lean extension executes.");
});
