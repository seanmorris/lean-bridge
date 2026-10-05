/**
 * Execute the native PHP ownership guide from a compiled C/Composer release.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { processBuildRunner } from "../src/build/process-runner.mjs";
import { copiedCleanEnvironment, nativeFixtureEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { installOwnedPhpArchive, ownedPhpInventory } from "./helpers/owned-php-installed.mjs";
import { lakeInputState, saveLakeFile } from "./helpers/lake-workspace.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";

const explain = error => { error.message += ": " + JSON.stringify(error.details ?? {}); throw error; };
const block = (section, language) => {
	const match = section.match(new RegExp("```" + language + "\\n([^]*?)\\n```"));
	assert.ok(match, language + " documentation block"); return match[1] + "\n";
};

test("native PHP borrowed-result author and consumer guides work in installed C/Composer packages", {
	skip: process.env.LEAN_BRIDGE_OWNED_PHP_BORROW_TEST !== "1", timeout: 1800000
}, async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-php-borrow-docs-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const authorGuide = await readFile("docs/publish/php.md", "utf8"), consumerGuide = await readFile("docs/php.md", "utf8");
	const base = authorGuide.split("### Export resource-containing values\n")[1].split("\n### ")[0];
	const contract = authorGuide.split("### Anchor a result to an input\n")[1].split("\n### ")[0];
	const consumer = consumerGuide.split("### Owner-anchored results\n")[1].split("\n### ")[0];
	const lean = block(base, "lean"), example = block(consumer, "php");
	const config = canonicalJson({ ...JSON.parse(block(base, "json")), ...JSON.parse(block(contract, "json")) });
	const author = join(directory, "author"), project = join(author, "project");
	const producer = join(author, "release"), handoff = join(directory, "handoff");
	await saveLakeFile(project, "Owned.lean", lean);
	await saveLakeFile(project, "lean-bridge.exports.json", config);
	await saveLakeFile(project, "lean-toolchain", "leanprover/lean4:v4.32.2\n");
	await saveLakeFile(project, "lakefile.toml", 'name = "owned-aggregates"\nversion = "1.0.0"\n[[lean_lib]]\nname = "Owned"\n');
	const before = await lakeInputState(project), environment = nativeFixtureEnvironment([]), cli = resolve("scripts/lean-bridge.mjs");
	const invocation = await processBuildRunner.capture({ command: process.execPath
		, args: [cli, "build", "--project", project, "--output", producer, "--target", "c", "--target", "php-native", "--json"]
		, cwd: directory, env: environment, timeoutMs: 1200000 }).catch(explain);
	const response = JSON.parse(invocation.stdout);
	assert.equal(response.status, "ok"); assert.deepEqual(response.result.targets, ["c", "php-native"]);
	assert.deepEqual(await lakeInputState(project), before);
	const model = JSON.parse(await readFile(join(producer, "native/component/model.json"), "utf8"));
	assert.equal(model.schemaVersion, 9); assert.equal(model.ownedGraph.inputTransfers, undefined);
	assert.deepEqual(model.ownedGraph.resultAnchors.exports, [{ bindingId: "lean:Owned.callbackRecord", parameter: 0 }]);
	const phpProjection = response.result.projections.find(projection => projection.ecosystem === "php-native");
	assert.equal(phpProjection.backend, "owned-php-cli-ffi-v1");
	const receipt = await copyPackageSetHandoff(producer, handoff);
	assert.deepEqual([...new Set(receipt.packages.map(pkg => pkg.target))], ["c", "php-native"]);
	await rm(author, { recursive: true, force: true }); await assert.rejects(access(author), { code: "ENOENT" });
	const verification = await processBuildRunner.capture({ command: process.execPath
		, args: [cli, "verify", "--receipt", join(handoff, "package-set-receipt.json"), "--json"]
		, cwd: directory, env: copiedCleanEnvironment }).catch(explain);
	const verified = JSON.parse(verification.stdout); assert.equal(verified.status, "ok");
	const pkg = phpProjection.packages[0];
	const installed = await installOwnedPhpArchive({ root: join(directory, "consumer")
		, archive: join(handoff, "archives", pkg.archive), pkg, environment });
	await rm(handoff, { recursive: true, force: true }); await assert.rejects(access(handoff), { code: "ENOENT" });
	await saveLakeFile(installed.deployment, "borrowed.php", example);
	const inventory = await ownedPhpInventory(installed.deployment);
	const observed = await runCopied(installed.php, [...installed.runtimeOptions, "borrowed.php"], installed.deployment, installed.environment);
	assert.equal(observed.stderr, ""); assert.equal(observed.stdout, "42\nexpired\n42\n");
	assert.deepEqual(await runCopied(installed.php, [...installed.runtimeOptions, "borrowed.php"], installed.deployment, installed.environment), observed);
	assert.deepEqual(await ownedPhpInventory(installed.deployment), inventory);
	await saveLakeFile("build/owned-php-borrow-packaging", "documentation.json", canonicalJson({
		schemaVersion: 1, planNode: 1219, cliIntegrated: true
		, mixedTargets: ["c", "php-native"], borrowOnly: true
		, producerRemoved: true, handoffRemoved: true
		, sourceUnchanged: true, relocated: true
		, sourceHashes: { lean: sha256(lean), config: sha256(config), example: sha256(example) }
		, cliBuild: response, packageSetReceipt: receipt, verification: verified
		, observed, installation: installed.evidence, inventory
	}));
	t.diagnostic("Original documentation example: 42, expired, 42 from a relocated Composer installation");
});
