/**
 * Independent PHP caller controls against genuine generated value classes.
 * No source-only check is counted as installed acceptance.
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
import { structuralSubtypeConfiguration, structuralSubtypeReview } from "./structural-subtype-installed-fixture.mjs";
import { structuralSubtypePhpConfiguration, structuralSubtypePhpCaller, structuralSubtypePhpCounts, parseStructuralSubtypePhpResult } from "./structural-subtype-php-fixture.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { runCopied } from "./copied-fixture-install.mjs";
import "./structural-subtype-php-evidence-tests.mjs";

const php = process.env.LEAN_BRIDGE_PHP ?? "/usr/bin/php";
const callerControls = Boolean(process.env.LEAN_BRIDGE_PHP) || existsSync(php);

test("structural PHP configurations preserve ordinary and reviewed contracts", async () => {
	for(const route of ["ordinary", "reviewed"])
	{
		const configured = structuralSubtypePhpConfiguration(route), common = structuralSubtypeConfiguration(route, ["c"]);
		assert.deepEqual({ ...configured, targets: common.targets }, common);
		assert.deepEqual(configured.targets, { "php-native": { name: "example/structuralsubtypes", version: "1.0.0" } });
	}
	assert.equal(await structuralSubtypePhpCaller("reviewed"), (await structuralSubtypePhpCaller("ordinary")).replaceAll(/arg([01])/gu, "value$1"));
	assert.throws(() => structuralSubtypePhpConfiguration("unknown"));
	await assert.rejects(structuralSubtypePhpCaller("unknown"));
	assert.deepEqual(parseStructuralSubtypePhpResult(JSON.stringify(structuralSubtypePhpCounts)), structuralSubtypePhpCounts);
	for(const key of Object.keys(structuralSubtypePhpCounts))
		assert.throws(() => parseStructuralSubtypePhpResult(JSON.stringify({ ...structuralSubtypePhpCounts, [key]: 0 })));
});

test("PHP weak and strict callers detect dropped checks, normalization, NUL loss and mutation of either input", { skip: !callerControls && "Select LEAN_BRIDGE_PHP to run caller controls" }, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-structural-php-controls-"));
	t.after(() => rm(root, { recursive: true }));
	for(const [path, source] of Object.entries({ ...generateCopiedPhpPackage(structuralSubtypeReview()), ...bundledBrickMath() }))
		await saveLakeFile(root, path, source);
	for(const route of ["ordinary", "reviewed"]) for(const mode of ["weak", "strict"])
	{
		const source = await structuralSubtypePhpCaller(route), path = join(root, `${route}-${mode}.php`);
		await saveLakeFile(root, `${route}-${mode}.php`, mode === "strict" ? source.replace("declare(strict_types=0);", "declare(strict_types=1);") : source);
		assert.equal((await runCopied(php, ["-n", "-l", path], root)).stderr, "");
		const model = resolve("tests/helpers/structural-subtype-php-model.php");
		const dependency = join(root, "dependencies/brick-math/autoload.php");
		const prefix = route === "ordinary" ? "arg" : "value";
		const args = ["-n", model, dependency, join(root, "src/Api.php"), path, prefix];
		const run = await runCopied(php, args, root);
		assert.equal(run.stderr, "");
		assert.deepEqual(JSON.parse(run.stdout), { ...structuralSubtypePhpCounts, callerMutationControls: 8 });
	}
});
