/**
 * Verify the nominal Subtype entry publication and its exact source lineage.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson } from "../../src/capsule/node.mjs";
import { nativeArtifactPaths } from "../../src/build/native-artifacts.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import {
	beforeNominalSubtypeEntryPublicationSource
	, nominalSubtypeEntryPublicationArchiveRoots
	, nominalSubtypeEntryPublicationCommit
	, nominalSubtypeEntryPublicationCommits
	, nominalSubtypeEntryPublicationHistoryPath
	, nominalSubtypeEntryPublicationIntegrationPaths
	, nominalSubtypeEntryPublicationIntroductions
	, nominalSubtypeEntryPublicationPredecessor
	, nominalSubtypeEntryPublicationTransitions
	, reverseNominalSubtypeEntryPublicationUpdate
} from "./nominal-subtype-entry-publication-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone }
	from "./source-at-fin-history-milestone.mjs";
import {
	authenticateSourceHistoryReverse, gitSourceBytes
} from "./source-history-stream.mjs";
import { readPromotionInventory } from "./type-surface-promotion-io.mjs";

const inventoryPath = "docs/type-surface.v1.json";
const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const readRecord = async () => JSON.parse(await readFile(
	nominalSubtypeEntryPublicationHistoryPath, "utf8"));
const gitJson = async (revision, path) => {
	const chunks = [];
	for await(const chunk of gitSourceBytes(revision, path)) chunks.push(chunk);
	return JSON.parse(Buffer.concat(chunks).toString("utf8"));
};

test("nominal Subtype entry publication authenticates every source transition"
	, async () => {
		const record = await readRecord();
		assert.equal(record.schemaVersion, 1);
		assert.equal(record.milestone
			, "nominal-subtype-entry-publication-source-v1");
		assert.equal(record.predecessorCommit
			, nominalSubtypeEntryPublicationPredecessor);
		assert.equal(record.publicationCommit
			, nominalSubtypeEntryPublicationCommit);
		assert.deepEqual(record.commits, nominalSubtypeEntryPublicationCommits);
		assert.deepEqual(record.updates.map(item => item.path)
			, nominalSubtypeEntryPublicationTransitions.map(item => item.path));
		assert.deepEqual(record.integrationUpdates.map(item => item.path)
			, nominalSubtypeEntryPublicationIntegrationPaths);
		assert.deepEqual(git(["rev-list", "--reverse", "--first-parent"
			, `${record.predecessorCommit}..${record.publicationCommit}`])
			.trim().split("\n"), record.commits);
		assert.equal(git(["show", "-s", "--format=%P"
			, record.integrationCommit]).trim(), record.publicationCommit);
		for(const [index, update] of record.updates.entries())
		{
			const transition = nominalSubtypeEntryPublicationTransitions[index];
			assert.equal(await authenticateSourceHistoryReverse(
				gitSourceBytes(transition.current, update.path), update), true);
			if(update.path === inventoryPath) continue;
			const current = await sourceAtFinHistoryMilestone(
				update.path, update.currentSha256
				, beforeNominalSubtypeEntryPublicationSource);
			assert.equal(reverseNominalSubtypeEntryPublicationUpdate(
				current, update), git(["show"
				, `${transition.previous}:${update.path}`]), update.path);
			assert.equal(beforeFinRefinementSource(
				update.path, current, update.previousSha256)
			, git(["show", `${transition.previous}:${update.path}`]));
			assert.ok(finRefinementNormalizationPaths.includes(update.path));
		}
		for(const update of record.integrationUpdates)
		{
			assert.equal(await authenticateSourceHistoryReverse(
				gitSourceBytes(record.integrationCommit, update.path), update), true);
			if(update.path === inventoryPath) continue;
			const current = await sourceAtFinHistoryMilestone(
				update.path, update.currentSha256
				, beforeNominalSubtypeEntryPublicationSource);
			assert.equal(reverseNominalSubtypeEntryPublicationUpdate(current, update)
				, git(["show", `${record.publicationCommit}:${update.path}`]));
		}
	}
);

test("nominal Subtype entry archives bind their complete evidence commits"
	, async () => {
		const record = await readRecord();
		assert.equal(record.archives.length, 2);
		for(const archived of record.archives)
		{
			const contract = nominalSubtypeEntryPublicationArchiveRoots[archived.lane];
			assert.deepEqual(archived, {
				lane: archived.lane
				, ...contract
				, producerCommit: archived.producerCommit
			});
			const indexBytes = await readFile(`${contract.root}/index.json`);
			const index = JSON.parse(indexBytes);
			assert.equal(indexBytes.toString(), canonicalJson(index));
			assert.equal(sha256(indexBytes), contract.indexSha256);
			assert.equal(index.producerCommit, archived.producerCommit);
			assert.equal(index.files.length, contract.manifestFiles);
			assert.equal((await nativeArtifactPaths(contract.root)).length
				, contract.committedFiles);
			const parent = git(["show", "-s", "--format=%P"
				, contract.commit]).trim();
			const changed = names(["diff", "--name-only", parent, contract.commit]);
			assert.equal(changed.length, contract.committedFiles);
			assert.ok(changed.every(path => path.startsWith(`${contract.root}/`)));
		}
	}
);

test("nominal Subtype entry publication preserves every support observation"
	, async () => {
		const beforeCommit = nominalSubtypeEntryPublicationCommits.at(-2);
		const afterCommit = nominalSubtypeEntryPublicationCommits.at(-1);
		const [beforeIrSchema, beforeConsumers, afterIrSchema, afterConsumers]
			= await Promise.all([
				gitJson(beforeCommit, "schema/binding-ir.schema.json")
				, gitJson(beforeCommit, "docs/consumer-support.v1.json")
				, gitJson(afterCommit, "schema/binding-ir.schema.json")
				, gitJson(afterCommit, "docs/consumer-support.v1.json")
			]);
		const before = await readPromotionInventory(gitSourceBytes(
			beforeCommit, inventoryPath)
		, { irSchema: beforeIrSchema, consumers: beforeConsumers });
		// The publication's own inventory: later promotions change other observations.
		const after = await readPromotionInventory(gitSourceBytes(
			afterCommit, inventoryPath)
		, { irSchema: afterIrSchema, consumers: afterConsumers });
		assert.deepEqual(after.document.observations, before.document.observations);
		const ids = ["nominal-subtype-entry-native-hosted-instrumented"
			, "nominal-subtype-entry-browser-hosted-instrumented"];
		assert.deepEqual(after.document.evidence.slice(-2).map(item => item.id), ids);
		assert.ok(after.document.evidence.slice(-2).every(item => item.kind === "test"));
		for(const observation of after.document.observations)
			for(const stage of Object.values(observation.stages))
				for(const id of ids) assert.ok(!stage.evidence.includes(id));
	}
);

test("nominal Subtype entry publication additions retain exact identities"
	, async () => {
		const record = await readRecord();
		for(const introduction of nominalSubtypeEntryPublicationIntroductions)
		{
			const addition = record.additions.find(item =>
				item.path === introduction.path);
			assert.ok(addition);
			assert.equal(addition.commit, introduction.commit);
			assert.equal(sha256(git(["show"
				, `${nominalSubtypeEntryPublicationCommit}:${addition.path}`]))
				, addition.currentSha256, addition.path);
		}
	}
);

test("nominal Subtype entry publication rejects forged transitions"
	, async () => {
		const update = (await readRecord()).updates[0];
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeNominalSubtypeEntryPublicationSource);
		for(const forged of [{ ...update, currentSha256: "0".repeat(64) }
			, { ...update, previousSha256: "0".repeat(64) }
			, { ...update, path: "unknown.mjs" }
			, { ...update, edits: [] }])
			assert.throws(() => reverseNominalSubtypeEntryPublicationUpdate(
				current, forged));
		assert.equal(beforeNominalSubtypeEntryPublicationSource(
			update.path, `${current}unknown`), `${current}unknown`);
	}
);

test("nominal Subtype entry publication writer refuses another checkout"
	, async t => {
		const root = await mkdtemp(join(
			tmpdir(), "lean-nominal-entry-publication-history-"));
		t.after(() => rm(root, { recursive: true, force: true }));
		const environment = Object.fromEntries(Object.entries(process.env)
			.filter(([key]) => !key.startsWith("GIT_")));
		const localGit = arguments_ => execFileSync("git", arguments_
			, { cwd: root, env: environment, stdio: "pipe" });
		localGit(["init", "--quiet"]);
		localGit(["-c", "user.name=Test", "-c"
			, "user.email=test@example.invalid", "-c", "commit.gpgsign=false"
			, "commit", "--allow-empty", "--quiet", "-m", "unrelated"]);
		const result = spawnSync(process.execPath, [resolve(
			"scripts/update-nominal-subtype-entry-publication-source-history.mjs")
			, "--record"], { cwd: root, env: environment, encoding: "utf8" });
		assert.equal(result.status, 1);
		assert.match(result.stderr, /integration child/u);
		assert.deepEqual(await readdir(root), [".git"]);
	}
);
