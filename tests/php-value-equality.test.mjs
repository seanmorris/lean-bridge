/**
 * Check PHP value equality under each public projection without loading Lean.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { bundledBrickMath } from "../src/backends/php/brick-math.mjs";
import { generateCopiedPhpPackage } from "../src/backends/php/copied-values.mjs";
import { generateCopiedPhpZendAdapter } from "../src/backends/php/copied-zend.mjs";
import { collectionReviewedIr } from "./helpers/collection-fixture.mjs";
import { compoundReviewedIr } from "./helpers/compound-fixture.mjs";
import { listReviewedIr } from "./helpers/list-fixture.mjs";
import { nativeAliasReviewedIr } from "./helpers/native-alias-fixture.mjs";
import { phpVariantReviewedIr } from "./helpers/php-variant-fixture.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

test("PHP records, wrappers and variants have exact bounded content equality and matching hashes", { skip: process.env.LEAN_BRIDGE_PHP_EQUALITY_TEST !== "1", timeout: 120_000 }, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-php-value-equality-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const program = await readFile("tests/fixtures/collection-consumers/php-equality.php", "utf8");
	const fixtures = { collections: collectionReviewedIr()
		, compounds: compoundReviewedIr()
		, lists: listReviewedIr(), aliases: nativeAliasReviewedIr()
		, variants: phpVariantReviewedIr() };
	const reports = [];
	for(const [profile, integerBits, generate] of [
		["ffi", 64, generateCopiedPhpPackage]
		, ["zend32", 32, ir => generateCopiedPhpZendAdapter(ir, { integerBits: 32 })]
		, ["zend64", 64, ir => generateCopiedPhpZendAdapter(ir, { integerBits: 64 })]
	]) {
		const directory = join(root, profile), sourceHashes = {};
		for(const [name, ir] of Object.entries(fixtures))
			for(const [path, source] of Object.entries(generate(ir)).filter(([path]) => path.endsWith(".php")))
			{
				await saveLakeFile(directory, `${name}/${path}`, source);
				sourceHashes[`${name}/${path}`] = sha256(source);
			}
		for(const [path, source] of Object.entries(bundledBrickMath())) await saveLakeFile(directory, path, source);
		await saveLakeFile(directory, "equality.php", program);
		const result = await runCopied(process.env.LEAN_BRIDGE_PHP ?? "/usr/bin/php", ["-n", "equality.php", String(integerBits)], directory);
		assert.equal(result.stderr, ""); const observation = JSON.parse(result.stdout);
		assert.ok(observation.checks > 6000); assert.ok(observation.rejections >= 56);
		assert.equal(observation.projections, 5); assert.equal(observation.nativeCalls, 0);
		reports.push({ profile, integerBits, sourceHashes, observation });
		t.diagnostic(`${profile}: ${observation.checks} equality/hash checks and ${observation.rejections} rejected invalid values`);
	}
	await saveLakeFile("build/equality", "php.json", canonicalJson({ schemaVersion: 1
		, kind: "php-value-equality-preflight"
		, compiledLean: false, installedPackage: false
		, sourceSha256: sha256(program), reports }));
});
