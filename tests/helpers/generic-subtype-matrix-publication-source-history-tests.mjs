/**
 * Check the exact producer pin refresh without parsing the large inventory.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import {
	beforeGenericSubtypeMatrixPublicationSource
	, genericSubtypeMatrixPublicationAddedPaths
	, genericSubtypeMatrixPublicationChangedPaths
	, genericSubtypeMatrixPublicationCommits
	, genericSubtypeMatrixPublicationImplementationPaths
	, genericSubtypeMatrixPublicationHistoryPath
	, genericSubtypeMatrixPublicationImplementation
	, genericSubtypeMatrixPublicationIntegrationBase
	, genericSubtypeMatrixPublicationIntegrationPaths
	, genericSubtypeMatrixPublicationPins
	, genericSubtypeMatrixPublicationPredecessor
	, reverseGenericSubtypeMatrixPublicationUpdate
} from "./generic-subtype-matrix-publication-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { authenticateSourceHistoryReverse, gitSourceBytes } from "./source-history-stream.mjs";
import { readPromotionInventory } from "./type-surface-promotion-io.mjs";
import { typeSurfaceContractsAtProducer } from "./producer-source.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 2 * 1024 * 1024 });
const read = async () => JSON.parse(await readFile(
	genericSubtypeMatrixPublicationHistoryPath, "utf8"));
const inventoryPath = "docs/type-surface.v1.json";

test("Generic Subtype matrix publication authenticates its wiring and lineage", async () => {
	const record = await read();
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "generic-subtype-matrix-publication-source-v1");
	assert.equal(record.predecessorCommit, genericSubtypeMatrixPublicationPredecessor);
	assert.equal(record.implementationCommit, genericSubtypeMatrixPublicationImplementation);
	assert.equal(record.integrationBaseCommit, genericSubtypeMatrixPublicationIntegrationBase);
	assert.deepEqual(record.implementationCommits, genericSubtypeMatrixPublicationCommits);
	assert.deepEqual(record.updates.map(item => item.path)
		, genericSubtypeMatrixPublicationChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, genericSubtypeMatrixPublicationIntegrationPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, genericSubtypeMatrixPublicationAddedPaths);
	assert.deepEqual(git(["rev-list", "--reverse"
		, genericSubtypeMatrixPublicationPredecessor + ".." + genericSubtypeMatrixPublicationImplementation]).trim().split("\n")
	, genericSubtypeMatrixPublicationCommits);
	for(const [index, revision] of genericSubtypeMatrixPublicationCommits.entries())
		assert.equal(git(["show", "-s", "--format=%P", revision]).trim()
			, index === 0 ? genericSubtypeMatrixPublicationPredecessor : genericSubtypeMatrixPublicationCommits[index - 1]);
	assert.deepEqual(git(["diff", "--name-only"
		, genericSubtypeMatrixPublicationPredecessor
		, genericSubtypeMatrixPublicationImplementation]).trim().split("\n")
	, [...genericSubtypeMatrixPublicationImplementationPaths].sort());
	const updates = [...record.updates.filter(item => item.path !== inventoryPath)
		, ...record.integrationUpdates];
	for(const update of updates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256, beforeGenericSubtypeMatrixPublicationSource);
		const prior = record.integrationUpdates.includes(update)
			? genericSubtypeMatrixPublicationIntegrationBase : genericSubtypeMatrixPublicationPredecessor;
		const previous = git(["show", prior + ":" + update.path]);
		assert.equal(reverseGenericSubtypeMatrixPublicationUpdate(
			current, update), previous);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	assert.ok(finRefinementNormalizationPaths.includes(inventoryPath));
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256)), addition.currentSha256);
});

test("Generic Subtype matrix publication preserves the exact semantic boundary", async () => {
	const acceptance = JSON.parse(git(["show"
		, genericSubtypeMatrixPublicationImplementation
		+ ":docs/evidence/generic-subtype-published-matrix-acceptance-20261024.json"]));
	const contracts = typeSurfaceContractsAtProducer(genericSubtypeMatrixPublicationImplementation);
	const before = await readPromotionInventory(gitSourceBytes(
		genericSubtypeMatrixPublicationPredecessor, inventoryPath), contracts);
	const after = await readPromotionInventory(gitSourceBytes(
		genericSubtypeMatrixPublicationImplementation, inventoryPath), contracts);
	assert.deepEqual(before.source, acceptance.before);
	assert.deepEqual(after.source, acceptance.published);
	assert.equal(before.document.evidence.length, 857);
	assert.equal(after.document.evidence.length, 869);
	const pins = new Map(genericSubtypeMatrixPublicationPins.map(pin => [pin.path, pin]));
	const previousEvidence = before.document.evidence.map(entry => ({
		...entry, files: entry.files.map(file => pins.has(file.path)
			? { ...file, sha256: pins.get(file.path).currentSha256 } : file)
	}));
	assert.deepEqual(after.document.evidence.slice(0, 857), previousEvidence);
	assert.deepEqual(after.document.evidence.slice(857).map(entry => entry.id)
		, acceptance.archives.map(archive => `generic-subtype-${archive.lane}-hosted-installed`));
	assert.equal(after.document.observations.length, 655);
	let changed = 0, cells = 0;
	for(const [index, observation] of after.document.observations.entries())
	{
		const prior = before.document.observations[index];
		if(JSON.stringify(observation) === JSON.stringify(prior)) continue;
		changed++; cells += observation.profiles.length;
		for(const field of ["id", "profiles", "shapes", "positions", "path"])
			assert.deepEqual(observation[field], prior[field]);
		assert.deepEqual(observation.shapes, ["subtype"]);
		assert.deepEqual(observation.positions, ["field"]);
		assert.ok(observation.scope.startsWith(prior.scope + " "));
		assert.deepEqual(observation.limitations.slice(0, -1), prior.limitations);
		assert.match(observation.limitations.at(-1), /closed GenericNat alias/u);
		assert.ok(!observation.profiles.includes("php-wasm"));
		const route = observation.path === "ordinary-source" ? "ordinary" : "reviewed";
		const archive = acceptance.archives.find(entry => entry.routes.includes(route)
			&& entry.profiles.includes(observation.profiles[0]));
		assert.ok(archive);
		for(const profile of observation.profiles) assert.ok(archive.profiles.includes(profile));
		for(const [stage, value] of Object.entries(observation.stages))
		{
			assert.equal(value.state, prior.stages[stage].state);
			assert.deepEqual(value.evidence, [...prior.stages[stage].evidence
				, "generic-subtype-foundation-hosted-installed"
				, `generic-subtype-${archive.lane}-hosted-installed`]);
			assert.ok(value.note.startsWith(prior.stages[stage].note + " "));
		}
	}
	assert.equal(changed, 22); assert.equal(cells, 32);
	assert.deepEqual({ ...after.document, evidence: before.document.evidence
		, observations: before.document.observations }, before.document);
	assert.deepEqual(acceptance.sourcePins, genericSubtypeMatrixPublicationPins.map(pin => ({
		path: pin.path, currentSha256: pin.currentSha256, count: pin.count
		, previousSha256: pin.previousSha256
	})));
	assert.equal(acceptance.sourcePins.reduce((sum, pin) => sum + pin.count, 0), 81);
	for(const pin of genericSubtypeMatrixPublicationPins)
		assert.equal(sha256(git(["show", genericSubtypeMatrixPublicationImplementation + ":" + pin.path]))
			, pin.currentSha256, pin.path);
});

test("Generic Subtype matrix publication authenticates full streamed inventory endpoints", async () => {
	const update = (await read()).updates.find(item => item.path === inventoryPath);
	const acceptance = JSON.parse(git(["show"
		, genericSubtypeMatrixPublicationImplementation
		+ ":docs/evidence/generic-subtype-published-matrix-acceptance-20261024.json"]));
	assert.equal(update.previousSha256, acceptance.before.sha256);
	assert.equal(update.currentSha256, acceptance.published.sha256);
	assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(
		genericSubtypeMatrixPublicationImplementation, inventoryPath), update), true);
});

test("Generic Subtype matrix publication rejects unknown or forged transitions", async () => {
	const update = (await read()).integrationUpdates[0];
	const current = await sourceAtFinHistoryMilestone(update.path
		, update.currentSha256, beforeGenericSubtypeMatrixPublicationSource);
	assert.equal(beforeGenericSubtypeMatrixPublicationSource(
		update.path, current, update.currentSha256), current);
	const unknown = current + "\nunknown";
	assert.equal(beforeGenericSubtypeMatrixPublicationSource(
		update.path, unknown), unknown);
	for(const forged of [{ ...update, previousSha256: "0".repeat(64) }
		, { ...update, currentSha256: "0".repeat(64) }
		, { ...update, edits: [...update.edits, update.edits[0]] }
		, { ...update, edits: [] }, { ...update, path: "unrelated.mjs" }])
		assert.throws(() => reverseGenericSubtypeMatrixPublicationUpdate(current, forged));
	assert.equal(beforeGenericSubtypeMatrixPublicationSource(
		"unrelated.mjs", current), current);
});

test("Generic Subtype matrix publication writer refuses another checkout", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-owned-npm-source-identity-guard-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const environment = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const run = arguments_ => execFileSync("git", arguments_
		, { cwd: root, env: environment, stdio: "pipe" });
	run(["init", "--quiet"]);
	run(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c", "commit.gpgsign=false", "commit", "--allow-empty"
		, "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-generic-subtype-matrix-publication-source-history.mjs")]
	, { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /exact integration base/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
