/**
 * Execute the exact receiver author and consumer examples from an installed ZIP.
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

const block = (source, heading, language, occurrence = 0) => {
	assert.ok(Number.isSafeInteger(occurrence) && occurrence >= 0);
	const sections = source.split(heading + "\n"); assert.equal(sections.length, 2);
	const section = sections[1].split(/^#{1,3} /mu)[0];
	const blocks = [...section.matchAll(new RegExp("^```" + language + "\\n([^]*?)^```", "gmu"))];
	assert.ok(blocks.length > occurrence); return blocks[occurrence][1];
};

test("native PHP receiver guides execute from an installed C/Composer release", {
	skip: process.env.LEAN_BRIDGE_OWNED_PHP_RECEIVER_TEST !== "1", timeout: 1800000
}, async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-php-receiver-docs-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const authorGuide = await readFile("docs/publish/php.md", "utf8"), consumerGuide = await readFile("docs/php.md", "utf8");
	const lean = block(authorGuide, "### Export resource-containing values", "lean");
	const base = JSON.parse(block(authorGuide, "### Export resource-containing values", "json"));
	const contract = JSON.parse(block(authorGuide, "### Export methods and properties", "json"));
	const config = canonicalJson({ ...base, ...contract });
	const example = block(consumerGuide, "### Methods and properties", "php");
	const author = join(directory, "author"), project = join(author, "project");
	const producer = join(author, "release"), handoff = join(directory, "handoff");
	await saveLakeFile(project, "Owned.lean", lean);
	await saveLakeFile(project, "lean-bridge.exports.json", config);
	await saveLakeFile(project, "lean-toolchain", "leanprover/lean4:v4.32.2\n");
	await saveLakeFile(project, "lakefile.toml", 'name = "owned-aggregates"\nversion = "1.0.0"\n[[lean_lib]]\nname = "Owned"\n');
	const before = await lakeInputState(project), environment = nativeFixtureEnvironment([]), cli = resolve("scripts/lean-bridge.mjs");
	const invocation = await processBuildRunner.capture({ command: process.execPath
		, args: [cli, "build", "--project", project, "--output", producer, "--target", "c", "--target", "php-native", "--json"]
		, cwd: directory, env: environment, timeoutMs: 1200000 })
		.catch(error => { throw new Error(`${error.message}: ${JSON.stringify(error.details ?? {})}`, { cause: error }); });
	const response = JSON.parse(invocation.stdout);
	assert.equal(response.status, "ok"); assert.deepEqual(response.result.targets, ["c", "php-native"]);
	assert.deepEqual(await lakeInputState(project), before);
	const model = JSON.parse(await readFile(join(producer, "native/component/model.json"), "utf8"));
	assert.equal(model.schemaVersion, 10); assert.equal(model.ownedGraph.inputTransfers, undefined);
	assert.equal(model.ownedGraph.receiverExports.exports.length, 2);
	assert.deepEqual(model.ownedGraph.resultAnchors.exports, [{ bindingId: "lean:Owned.callbackRecord", receiver: true }]);
	const php = response.result.projections.find(projection => projection.ecosystem === "php-native");
	const receipt = await copyPackageSetHandoff(producer, handoff);
	assert.deepEqual([...new Set(receipt.packages.map(pkg => pkg.target))], ["c", "php-native"]);
	await rm(author, { recursive: true }); await assert.rejects(access(author), { code: "ENOENT" });
	const verification = JSON.parse((await processBuildRunner.capture({ command: process.execPath
		, args: [cli, "verify", "--receipt", join(handoff, "package-set-receipt.json"), "--json"]
		, cwd: directory, env: copiedCleanEnvironment })).stdout);
	assert.equal(verification.status, "ok");
	const pkg = php.packages[0];
	const installed = await installOwnedPhpArchive({ root: join(directory, "consumer")
		, archive: join(handoff, "archives", pkg.archive), pkg, environment });
	await rm(handoff, { recursive: true }); await assert.rejects(access(handoff), { code: "ENOENT" });
	const observations = [];
	for(const caller of ["weak", "strict"])
	{
		await saveLakeFile(installed.deployment, "members.php", example.replace("strict_types=1", `strict_types=${caller === "strict" ? 1 : 0}`));
		const observed = await runCopied(installed.php, [...installed.runtimeOptions, "members.php"], installed.deployment, installed.environment);
		assert.equal(observed.stderr, ""); assert.equal(observed.stdout, "42\nexpired\n42\n");
		assert.deepEqual(await runCopied(installed.php, [...installed.runtimeOptions, "members.php"], installed.deployment, installed.environment), observed);
		observations.push({ caller, observed });
	}
	await saveLakeFile("build/owned-php-receiver-packaging", "documentation.json", canonicalJson({
		schemaVersion: 1, planNode: 1219, cliIntegrated: true
		, mixedTargets: ["c", "php-native"], receiverExports: true
		, producerRemoved: true, handoffRemoved: true
		, sourceUnchanged: true, relocated: true
		, sourceHashes: { lean: sha256(lean), config: sha256(config), example: sha256(example) }
		, cliBuild: response, packageSetReceipt: receipt, verification, observations
		, installation: installed.evidence
		, inventory: await ownedPhpInventory(installed.deployment)
	}));
});
