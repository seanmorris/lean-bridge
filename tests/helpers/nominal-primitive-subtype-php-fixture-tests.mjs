/**
 * Source-only controls for native PHP primitive-base nominal packages.
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
import { validateExportConfiguration } from "../../src/analyze/export-configuration.mjs";
import { canonicalJson } from "../../src/capsule/node.mjs";
import { nominalPrimitiveSubtypeConfiguration, nominalPrimitiveSubtypeFields } from "./nominal-primitive-subtype-fixture.mjs";
import { nominalPrimitiveSubtypePhpCaller, nominalPrimitiveSubtypePhpConfiguration, nominalPrimitiveSubtypePhpCounts, nominalPrimitiveSubtypePhpModes, nominalPrimitiveSubtypePhpReview, nominalPrimitiveSubtypePhpRoutes, nominalPrimitiveSubtypePhpSelection, parseNominalPrimitiveSubtypePhpResult } from "./nominal-primitive-subtype-php-fixture.mjs";
import { runCopied } from "./copied-fixture-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

const php = process.env.LEAN_BRIDGE_PHP ?? "/usr/bin/php";

test("primitive-base nominal PHP configurations preserve both source routes and result-only APIs", async () => {
	for(const route of nominalPrimitiveSubtypePhpRoutes) for(const mode of nominalPrimitiveSubtypePhpModes)
	{
		const configuration = nominalPrimitiveSubtypePhpConfiguration(route, mode);
		validateExportConfiguration(configuration);
		assert.deepEqual(configuration, { ...nominalPrimitiveSubtypeConfiguration(route, ["c"], mode === "result-only")
			, targets: { "php-native": { name: "example/nominalprimitivesubtypes", version: "1.0.0" } } });
		assert.deepEqual(nominalPrimitiveSubtypePhpReview(mode), structuredClone(nominalPrimitiveSubtypePhpReview(mode)));
		if(mode === "result-only") assert.equal(configuration.contracts, undefined);
		const ordinary = await nominalPrimitiveSubtypePhpCaller("ordinary", mode);
		assert.equal(await nominalPrimitiveSubtypePhpCaller("reviewed", mode), ordinary.replaceAll(/arg([01])/gu, "value$1"));
		const counts = nominalPrimitiveSubtypePhpCounts[mode];
		assert.deepEqual(parseNominalPrimitiveSubtypePhpResult(JSON.stringify(counts), mode), counts);
		for(const key of Object.keys(counts))
			assert.throws(() => parseNominalPrimitiveSubtypePhpResult(JSON.stringify({ ...counts, [key]: counts[key] + 1 }), mode));
		assert.throws(() => parseNominalPrimitiveSubtypePhpResult(JSON.stringify({ ...counts, extra: true }), mode));
	}
	assert.throws(() => nominalPrimitiveSubtypePhpConfiguration("unknown", "full"));
	assert.throws(() => nominalPrimitiveSubtypePhpConfiguration("ordinary", "unknown"));
	assert.throws(() => nominalPrimitiveSubtypePhpReview("unknown"));
	await assert.rejects(nominalPrimitiveSubtypePhpCaller("unknown", "full"));
	await assert.rejects(nominalPrimitiveSubtypePhpCaller("ordinary", "unknown"));
});

test("primitive-base nominal PHP gates reject disabled explicit work and invalid selections", () => {
	const prefix = "LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_PHP_", enabled = { [prefix + "TEST"]: "1" };
	assert.deepEqual(nominalPrimitiveSubtypePhpSelection({}), { enabled: false, routes: ["ordinary", "reviewed"], modes: ["full", "result-only"] });
	assert.equal(nominalPrimitiveSubtypePhpSelection(enabled).enabled, true);
	for(const flag of ["", "true", "yes", "2", true, null])
		assert.throws(() => nominalPrimitiveSubtypePhpSelection({ [prefix + "TEST"]: flag }));
	for(const [name, valid] of [["ROUTES", "ordinary"], ["MODES", "full"]])
	{
		for(const raw of ["", "unknown", valid + ",", valid + "," + valid, true, null])
			assert.throws(() => nominalPrimitiveSubtypePhpSelection({ ...enabled, [prefix + name]: raw }));
		for(const flag of [undefined, "0"])
			assert.throws(() => nominalPrimitiveSubtypePhpSelection({ [prefix + "TEST"]: flag, [prefix + name]: valid }));
		assert.deepEqual(nominalPrimitiveSubtypePhpSelection({ ...enabled, [prefix + name]: valid })[name.toLowerCase()], [valid]);
	}
	for(const name of ["OUTPUT", "VERSION", "COMPOSER_VERSION", "MAX_LOAD"])
		assert.throws(() => nominalPrimitiveSubtypePhpSelection({ [prefix + name]: "explicit" }));
});

test("generated primitive-base nominal PHP API preserves all nineteen fields and native word types", () => {
	for(const mode of nominalPrimitiveSubtypePhpModes)
	{
		const review = nominalPrimitiveSubtypePhpReview(mode), before = structuredClone(review);
		const source = generateCopiedPhpPackage(review)["src/Api.php"];
		assert.deepEqual(review, before);
		for(const name of ["Packet", "RawPacket", "Pair", "EventEmpty", "EventBox", "EventChoices"])
			assert.match(source, new RegExp(`^(?:abstract readonly class Event|final readonly class ${name})`, "mu"));
		for(const field of nominalPrimitiveSubtypeFields) assert.ok(source.includes(`$${field.name}`), field.name);
		for(const name of ["produce", "produce_group", "produce_pair", "produce_event", "produce_choices", "word_bits"])
			assert.match(source, new RegExp(`^function ${name}\\(`, "mu"));
		for(const name of ["echo_a", "echo_b", "refuse_unit", "combine", "echo_pair", "echo_event_a", "echo_event_b", "aliases"])
			assert.equal(source.includes(`function ${name}(`), mode === "full", name);
		assert.ok(source.includes("public \\Brick\\Math\\BigInteger $usizeValue;"));
		assert.ok(source.includes("public int $isizeValue;"));
	}
});

test("independent primitive-base nominal PHP caller passes in weak and strict modes", {
	skip: !existsSync(php) && "Select LEAN_BRIDGE_PHP to run PHP caller controls"
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-nominal-primitive-php-controls-"));
	t.after(() => rm(root, { recursive: true }));
	for(const mode of nominalPrimitiveSubtypePhpModes)
	{
		const directory = join(root, mode), review = nominalPrimitiveSubtypePhpReview(mode);
		for(const [path, source] of Object.entries({ ...generateCopiedPhpPackage(review), ...bundledBrickMath() }))
			await saveLakeFile(directory, path, source);
		const model = compileCopiedPhpModel(review, { lists: true, variants: true });
		const checks = Object.fromEntries(model.surface.functions.map(fn => [fn.field, fn.declaration.parameters.map(site => model.surface.copy(site.type).index)]));
		await saveLakeFile(directory, "checks.json", canonicalJson(checks));
		for(const route of nominalPrimitiveSubtypePhpRoutes) for(const strictness of ["weak", "strict"])
		{
			let source = await nominalPrimitiveSubtypePhpCaller(route, mode);
			if(strictness === "strict") source = source.replace("declare(strict_types=0);", "declare(strict_types=1);");
			const caller = `${route}-${strictness}.php`;
			await saveLakeFile(directory, caller, source);
			const syntax = await runCopied(php, ["-n", "-l", join(directory, caller)], directory);
			assert.equal(syntax.stderr, "");
			const run = await runCopied(php, ["-n"
				, resolve("tests/helpers/nominal-primitive-subtype-php-model.php")
				, join(directory, "dependencies/brick-math/autoload.php")
				, join(directory, "src/Api.php"), join(directory, caller)
				, route === "ordinary" ? "arg" : "value"
				, mode, join(directory, "checks.json")], directory);
			assert.equal(run.stderr, "");
			assert.deepEqual(parseNominalPrimitiveSubtypePhpResult(run.stdout, mode), nominalPrimitiveSubtypePhpCounts[mode]);
		}
	}
});
