#!/usr/bin/env node
/**
 * Record the Core aggregate and native-PHP history-input repairs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { typeSurfaceEvidenceFiles }
	from "../src/adoption/type-surface-evidence-receipt.mjs";
import {
	authenticateCorePhpCiInputs
	, corePhpCiInputRepairHistoryAdditions
	, corePhpCiInputRepairHistoryPath
	, corePhpCiInputRepairImplementation
	, corePhpCiInputRepairImplementationPaths
	, corePhpCiInputRepairIntegrationPaths
	, corePhpCiInputRepairPredecessor
} from "../tests/helpers/core-php-ci-input-repair-source-history.mjs";
import { gitSourceHistoryTransition }
	from "../tests/helpers/source-history-stream.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-core-php-ci-input-repair-source-history.mjs");
assert.equal(existsSync(corePhpCiInputRepairHistoryPath), false
	, corePhpCiInputRepairHistoryPath + " already exists");
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, corePhpCiInputRepairImplementation);
assert.equal(git(["rev-parse", corePhpCiInputRepairImplementation + "^"]).trim()
	, corePhpCiInputRepairPredecessor);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, corePhpCiInputRepairPredecessor, corePhpCiInputRepairImplementation, "--"])
, [...corePhpCiInputRepairImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, corePhpCiInputRepairPredecessor, corePhpCiInputRepairImplementation, "--"])
, []);
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, corePhpCiInputRepairImplementation + ":" + corePhpCiInputRepairHistoryPath]
, { stdio: "ignore" }).status, 0);
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--", ...corePhpCiInputRepairIntegrationPaths])
, [...corePhpCiInputRepairIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...corePhpCiInputRepairHistoryAdditions])
, [...corePhpCiInputRepairHistoryAdditions].sort());

const inventoryPath = "docs/type-surface.v1.json";
const beforeInventory = JSON.parse(git(["show"
	, corePhpCiInputRepairImplementation + ":" + inventoryPath]));
const afterInventory = JSON.parse(await readFile(inventoryPath, "utf8"));
const restoredInventory = structuredClone(afterInventory);
const currentSourcePins = [];
for(const path of corePhpCiInputRepairImplementationPaths)
{
	const previous = sha256(git(["show"
		, corePhpCiInputRepairPredecessor + ":" + path]));
	const current = sha256(await readFile(path));
	currentSourcePins.push({ path, count: 0, previous, current });
}
assert.equal(currentSourcePins[0].path
	, ".github/workflows/consumer-matrix.yml");
assert.equal(currentSourcePins[0].previous
	, "3a55ee717d569321316e3436803196a0573a1c6c1cefa7b704b494c4945adca4");
assert.equal(currentSourcePins[0].current
	, "590d2fec07ca0be92ef92038324ea5570f3dad3273b18f7e43b70af5faccfe69");
assert.equal(currentSourcePins[1].path, ".github/workflows/quality.yml");
assert.equal(currentSourcePins[1].previous
	, "12ace5225ca3fa1b2a175b4166a4a2440cca765ec16036bd750fe3a9c9da06f6");
assert.equal(currentSourcePins[1].current
	, "08e1fd557be56500622c45716705992d3f4ce76fde22f78a516c286f417cef72");
assert.equal(beforeInventory.evidence.length, afterInventory.evidence.length);
for(const [evidenceIndex, beforeEvidence] of beforeInventory.evidence.entries())
{
	const afterEvidence = afterInventory.evidence[evidenceIndex];
	assert.equal(afterEvidence.id, beforeEvidence.id);
	assert.equal(afterEvidence.files.length, beforeEvidence.files.length);
	for(const [fileIndex, beforeFile] of beforeEvidence.files.entries())
	{
		const afterFile = afterEvidence.files[fileIndex];
		assert.equal(afterFile.path, beforeFile.path);
		const pin = currentSourcePins.find(item => item.path === beforeFile.path);
		if(pin === undefined) continue;
		assert.equal(beforeFile.sha256, pin.previous, beforeFile.path);
		assert.equal(afterFile.sha256, pin.current, beforeFile.path);
		restoredInventory.evidence[evidenceIndex].files[fileIndex].sha256
			= pin.previous;
		pin.count++;
	}
}
assert.deepEqual(currentSourcePins.map(item => item.count), [92, 1]);
assert.deepEqual(restoredInventory, beforeInventory);

const liveFiles = typeSurfaceEvidenceFiles(afterInventory).filter(file =>
	!file.path.startsWith("docs/evidence/"));
const mismatches = [];
for(let offset = 0; offset < liveFiles.length; offset += 16)
{
	const batch = liveFiles.slice(offset, offset + 16);
	const actual = await Promise.all(batch.map(async file => {
		try
		{
			return createHash("sha256").update(
				await readFile(file.path)).digest("hex");
		}
		catch(error)
		{ return `missing:${error.code}`; }
	}));
	for(const [index, file] of batch.entries())
		if(actual[index] !== file.sha256)
			mismatches.push({ path: file.path
				, actual: actual[index], expected: file.sha256 });
}
assert.equal(liveFiles.length, 2661);
assert.deepEqual(mismatches, []);

const exactModelPath = "docs/evidence/vo1220-exact-type-surface-v1.json";
const exactModel = git(["show"
	, corePhpCiInputRepairImplementation + ":" + exactModelPath]);
assert.equal(sha256(exactModel)
	, "1cb3a48a20d25345634fdcab7007970efbef27427344be5a7028b3a033a8c82f");
assert.equal(Buffer.byteLength(exactModel), 16916757);
const exact = JSON.parse(exactModel);
assert.equal(exact.model.length, 1054);
assert.equal(exact.stageEntries, 5270);

const workflows = authenticateCorePhpCiInputs(
	await readFile(".github/workflows/consumer-matrix.yml", "utf8")
	, await readFile(".github/workflows/quality.yml", "utf8"));
const historicalInputs = [
	{ commit: "e5f7ae3dbc9ee8e85a5fd65a4fb68743aeccb0ed"
		, path: "tests/helpers/owned-php-callback-result-runtime-sources.mjs" }
	, { commit: "ad185d927673df87d1e40112ed9ccb41e299dfe3"
		, path: "docs/type-surface.v1.json" }
	, { commit: "fa51434d712136f38b6b0f88d9361494a32eda3a"
		, path: "docs/evidence/owned-perl-callback-result-variants-20261003.json" }
];
for(const input of historicalInputs)
	git(["cat-file", "-e", input.commit + ":" + input.path]);

const updates = [];
for(const path of corePhpCiInputRepairImplementationPaths)
	updates.push(await gitSourceHistoryTransition(path
		, corePhpCiInputRepairPredecessor, corePhpCiInputRepairImplementation));
const directory = await mkdtemp(join(tmpdir(), "lean-core-php-ci-input-repair-"));
try
{
	const environment = {
		...process.env, GIT_INDEX_FILE: join(directory, "index")
		, GIT_AUTHOR_NAME: "Lean Bridge history writer"
		, GIT_AUTHOR_EMAIL: "history@example.invalid"
		, GIT_COMMITTER_NAME: "Lean Bridge history writer"
		, GIT_COMMITTER_EMAIL: "history@example.invalid"
		, GIT_AUTHOR_DATE: "2000-01-01T00:00:00Z"
		, GIT_COMMITTER_DATE: "2000-01-01T00:00:00Z"
	};
	const temporaryGit = (arguments_, options = {}) => execFileSync(
		"git", arguments_, {
			encoding: "utf8", maxBuffer: 512 * 1024 * 1024
			, env: environment, ...options
		}
	);
	temporaryGit(["read-tree", corePhpCiInputRepairImplementation]);
	temporaryGit(["add", "--sparse", "--"
		, ...corePhpCiInputRepairIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit([
		"commit-tree", tree, "-p", corePhpCiInputRepairImplementation
	], { input: "Authenticate Core and PHP CI inputs\n" }).trim();
	const integrationUpdates = [];
	for(const path of corePhpCiInputRepairIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(
			path, corePhpCiInputRepairImplementation, integrationCommit
			, { maximumEditBytes: 128 * 1024 * 1024 }));
	const historyAdditions = [];
	for(const path of corePhpCiInputRepairHistoryAdditions)
		historyAdditions.push({ path, sha256: sha256(await readFile(path)) });
	await writeFile(corePhpCiInputRepairHistoryPath, canonicalJson({
		schemaVersion: 1
		, milestone: "core-php-ci-input-repair-source-v1"
		, predecessorCommit: corePhpCiInputRepairPredecessor
		, implementationCommit: corePhpCiInputRepairImplementation
		, failedRuns: [
			{ workflow: 41181273663, job: 124497352329
				, step: "Authenticate the complete contract partition" }
			, { workflow: 41181254244, job: 124481867574
				, step: "Verify frozen native PHP callback acceptance" }
		]
		, failures: {
			core: "Merged artifacts retained their core-shards/ and core-evidence/ directories beneath the configured download target, so downloading into build/core-shards duplicated the manifest directory."
			, php: "The native-PHP frozen-evidence job used a depth-one checkout while its authenticated receipt resolves three immutable historical revisions."
		}
		, scope: "Restore the actual Core artifact root and the native-PHP evidence history input; authenticate both workflow cells independently; refresh all 93 affected live citations; preserve every evidence identity and stage plus the frozen 1,054-cell/5,270-stage #1220 model."
		, runtimeChanged: false, workflows
		, artifactArchivePaths: [
			"core-shards/core-shard-3.json"
			, "core-evidence/core-shard-3-evidence.json"
		]
		, historicalInputs, liveSourcePins: 93, currentSourcePins
		, liveFiles: liveFiles.length, remainingLiveSourceMismatches: 0
		, exactModel: {
			sha256: sha256(exactModel), bytes: Buffer.byteLength(exactModel)
			, cells: exact.model.length, stageEntries: exact.stageEntries
		}
		, updates, integrationUpdates, historyAdditions
	}), { flag: "wx" });
	process.stdout.write("Recorded " + updates.length
		+ " implementation transitions, " + integrationUpdates.length
		+ " integration transitions and 93 refreshed live citations.\n");
}
finally
{ await rm(directory, { recursive: true, force: true }); }
