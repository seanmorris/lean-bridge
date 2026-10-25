/**
 * Check the exact owned publication without buffering the large inventory.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createInterface } from "node:readline";
import { Readable } from "node:stream";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import {
	beforeOwnedCheckedRecordMatrixPublicationSource
	, ownedCheckedRecordMatrixPublicationAddedPaths
	, ownedCheckedRecordMatrixPublicationChangedPaths
	, ownedCheckedRecordMatrixPublicationCommits
	, ownedCheckedRecordMatrixPublicationImplementationPaths
	, ownedCheckedRecordMatrixPublicationHistoryPath
	, ownedCheckedRecordMatrixPublicationImplementation
	, ownedCheckedRecordMatrixPublicationIntegrationBase
	, ownedCheckedRecordMatrixPublicationIntegrationPaths
	, ownedCheckedRecordMatrixPublicationPins
	, ownedCheckedRecordMatrixPublicationPredecessor
	, reverseOwnedCheckedRecordMatrixPublicationUpdate
} from "./owned-checked-record-matrix-publication-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { authenticateSourceHistoryReverse, gitSourceBytes } from "./source-history-stream.mjs";
import { readPromotionInventory } from "./type-surface-promotion-io.mjs";
import { typeSurfaceContractsAtProducer } from "./producer-source.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 2 * 1024 * 1024 });
const read = async () => JSON.parse(await readFile(
	ownedCheckedRecordMatrixPublicationHistoryPath, "utf8"));
const inventoryPath = "docs/type-surface.v1.json";

test("Owned checked-record matrix publication authenticates its wiring and lineage", async () => {
	const record = await read();
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "owned-checked-record-matrix-publication-source-v1");
	assert.equal(record.predecessorCommit, ownedCheckedRecordMatrixPublicationPredecessor);
	assert.equal(record.implementationCommit, ownedCheckedRecordMatrixPublicationImplementation);
	assert.equal(record.integrationBaseCommit, ownedCheckedRecordMatrixPublicationIntegrationBase);
	assert.deepEqual(record.implementationCommits, ownedCheckedRecordMatrixPublicationCommits);
	assert.deepEqual(record.updates.map(item => item.path)
		, ownedCheckedRecordMatrixPublicationChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, ownedCheckedRecordMatrixPublicationIntegrationPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, ownedCheckedRecordMatrixPublicationAddedPaths);
	assert.deepEqual(git(["rev-list", "--reverse"
		, ownedCheckedRecordMatrixPublicationPredecessor + ".." + ownedCheckedRecordMatrixPublicationImplementation]).trim().split("\n")
	, ownedCheckedRecordMatrixPublicationCommits);
	for(const [index, revision] of ownedCheckedRecordMatrixPublicationCommits.entries())
		assert.equal(git(["show", "-s", "--format=%P", revision]).trim()
			, index === 0 ? ownedCheckedRecordMatrixPublicationPredecessor : ownedCheckedRecordMatrixPublicationCommits[index - 1]);
	assert.deepEqual(git(["diff", "--name-only"
		, ownedCheckedRecordMatrixPublicationPredecessor
		, ownedCheckedRecordMatrixPublicationImplementation]).trim().split("\n")
	, [...ownedCheckedRecordMatrixPublicationImplementationPaths].sort());
	const updates = [...record.updates.filter(item => item.path !== inventoryPath)
		, ...record.integrationUpdates];
	for(const update of updates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256, beforeOwnedCheckedRecordMatrixPublicationSource);
		const prior = record.integrationUpdates.includes(update)
			? ownedCheckedRecordMatrixPublicationIntegrationBase : ownedCheckedRecordMatrixPublicationPredecessor;
		const previous = git(["show", prior + ":" + update.path]);
		assert.equal(reverseOwnedCheckedRecordMatrixPublicationUpdate(
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

test("Owned checked-record matrix publication preserves the exact semantic boundary", async () => {
	const acceptance = JSON.parse(git(["show"
		, ownedCheckedRecordMatrixPublicationImplementation
		+ ":docs/evidence/owned-checked-record-published-matrix-acceptance-20261025.json"]));
	const contracts = typeSurfaceContractsAtProducer(ownedCheckedRecordMatrixPublicationImplementation);
	const before = await readPromotionInventory(gitSourceBytes(
		ownedCheckedRecordMatrixPublicationPredecessor, inventoryPath), contracts);
	const after = await readPromotionInventory(gitSourceBytes(
		ownedCheckedRecordMatrixPublicationImplementation, inventoryPath), contracts);
	assert.deepEqual(before.source, acceptance.before);
	assert.deepEqual(after.source, acceptance.published);
	assert.equal(before.document.evidence.length, 869);
	assert.equal(after.document.evidence.length, 880);
	const pins = new Map(ownedCheckedRecordMatrixPublicationPins.map(pin => [pin.path, pin]));
	const previousEvidence = before.document.evidence.map(entry => ({
		...entry, files: entry.files.map(file => pins.has(file.path)
			? { ...file, sha256: pins.get(file.path).currentSha256 } : file)
	}));
	assert.deepEqual(after.document.evidence.slice(0, 869), previousEvidence);
	assert.deepEqual(after.document.evidence.slice(869).map(entry => entry.id)
		, acceptance.archives.map(archive => `owned-checked-record-${archive.lane}-hosted-installed`));
	assert.equal(after.document.observations.length, 655);
	let changed = 0, cells = 0;
	const positions = ["parameter", "result", "field", "callback-parameter", "callback-result"];
	const profiles = new Set(acceptance.archives.flatMap(archive => archive.profiles));
	assert.equal(profiles.size, 17);
	assert.equal(acceptance.archives.length, 11);
	for(const archive of acceptance.archives)
		assert.deepEqual(archive.routes, ["ordinary-full", "ordinary-result-only", "reviewed-full", "reviewed-result-only"]);
	for(const [index, observation] of after.document.observations.entries())
	{
		const prior = before.document.observations[index];
		if(JSON.stringify(observation) === JSON.stringify(prior)) continue;
		changed++; cells += observation.profiles.length * observation.positions.length;
		for(const field of ["id", "profiles", "shapes", "positions", "path"])
			assert.deepEqual(observation[field], prior[field]);
		assert.deepEqual(observation.shapes, ["checked-record"]);
		assert.ok(["ordinary-source", "reviewed-ir"].includes(observation.path));
		for(const profile of observation.profiles) assert.ok(profiles.has(profile));
		for(const position of observation.positions) assert.ok(positions.includes(position));
		assert.ok(observation.scope.startsWith(prior.scope + " "));
		assert.deepEqual(observation.limitations.slice(0, -1), prior.limitations);
		assert.match(observation.limitations.at(-1), /acyclic Booking/u);
		assert.ok(observation.conversionNotes["checked-record"]
			.startsWith(prior.conversionNotes["checked-record"] + " "));
		for(const position of observation.positions)
			assert.ok(observation.hostTypes["checked-record"][position]
				.startsWith(prior.hostTypes["checked-record"][position] + "; "));
		const archives = acceptance.archives.filter(archive =>
			archive.profiles.some(profile => observation.profiles.includes(profile)));
		assert.ok(archives.length > 0);
		for(const [stage, value] of Object.entries(observation.stages))
		{
			assert.equal(value.state, prior.stages[stage].state);
			assert.deepEqual(value.evidence, [...prior.stages[stage].evidence
				, ...archives.map(archive => `owned-checked-record-${archive.lane}-hosted-installed`)]);
			assert.ok(value.note.startsWith(prior.stages[stage].note + " "));
		}
	}
	assert.equal(changed, 114); assert.equal(cells, 170);
	assert.deepEqual({ ...after.document, evidence: before.document.evidence
		, observations: before.document.observations }, before.document);
	assert.deepEqual(acceptance.sourcePins, ownedCheckedRecordMatrixPublicationPins.map(pin => ({
		path: pin.path, currentSha256: pin.currentSha256, count: pin.count
		, previousSha256: pin.previousSha256
	})));
	assert.equal(acceptance.sourcePins.reduce((sum, pin) => sum + pin.count, 0), 81);
	for(const pin of ownedCheckedRecordMatrixPublicationPins)
		assert.equal(sha256(git(["show", ownedCheckedRecordMatrixPublicationImplementation + ":" + pin.path]))
			, pin.currentSha256, pin.path);
});


test("Owned checked-record matrix publication refreshes only named pins after staging", async () => {
	const acceptance = JSON.parse(git(["show"
		, ownedCheckedRecordMatrixPublicationImplementation
		+ ":docs/evidence/owned-checked-record-published-matrix-acceptance-20261025.json"]));
	const pins = new Map(ownedCheckedRecordMatrixPublicationPins
		.map(pin => [pin.path, { ...pin, actual: 0 }]));
	const digest = createHash("sha256");
	let bytes = 0, pending;
	const input = Readable.from(gitSourceBytes(
		ownedCheckedRecordMatrixPublicationImplementation, inventoryPath));
	for await(const source of createInterface({ input, crlfDelay: Infinity }))
	{
		let line = source;
		if(pending)
		{
			assert.equal(line, '          "sha256": "' + pending.currentSha256 + '"');
			line = '          "sha256": "' + pending.previousSha256 + '"';
			pending.actual++;
		}
		const match = source.match(/^ {10}"path": "([^"]+)",$/u);
		pending = match ? pins.get(match[1]) : undefined;
		const chunk = Buffer.from(line + "\n"); digest.update(chunk); bytes += chunk.length;
	}
	for(const pin of pins.values()) assert.equal(pin.actual, pin.count, pin.path);
	assert.deepEqual({ bytes, sha256: digest.digest("hex") }, acceptance.staged);
	assert.equal([...pins.values()].reduce((sum, pin) => sum + pin.actual, 0), 81);
});

test("Owned checked-record matrix publication authenticates full streamed inventory endpoints", async () => {
	const update = (await read()).updates.find(item => item.path === inventoryPath);
	const acceptance = JSON.parse(git(["show"
		, ownedCheckedRecordMatrixPublicationImplementation
		+ ":docs/evidence/owned-checked-record-published-matrix-acceptance-20261025.json"]));
	assert.equal(update.previousSha256, acceptance.before.sha256);
	assert.equal(update.currentSha256, acceptance.published.sha256);
	assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(
		ownedCheckedRecordMatrixPublicationImplementation, inventoryPath), update), true);
});

test("Owned checked-record matrix publication rejects unknown or forged transitions", async () => {
	const update = (await read()).integrationUpdates[0];
	const current = await sourceAtFinHistoryMilestone(update.path
		, update.currentSha256, beforeOwnedCheckedRecordMatrixPublicationSource);
	assert.equal(beforeOwnedCheckedRecordMatrixPublicationSource(
		update.path, current, update.currentSha256), current);
	const unknown = current + "\nunknown";
	assert.equal(beforeOwnedCheckedRecordMatrixPublicationSource(
		update.path, unknown), unknown);
	for(const forged of [{ ...update, previousSha256: "0".repeat(64) }
		, { ...update, currentSha256: "0".repeat(64) }
		, { ...update, edits: [...update.edits, update.edits[0]] }
		, { ...update, edits: [] }, { ...update, path: "unrelated.mjs" }])
		assert.throws(() => reverseOwnedCheckedRecordMatrixPublicationUpdate(current, forged));
	assert.equal(beforeOwnedCheckedRecordMatrixPublicationSource(
		"unrelated.mjs", current), current);
});

test("Owned checked-record matrix publication writer refuses another checkout", async t => {
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
		"scripts/update-owned-checked-record-matrix-publication-source-history.mjs")]
	, { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /exact integration base/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
