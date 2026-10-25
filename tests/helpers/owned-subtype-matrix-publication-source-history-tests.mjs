/**
 * Authenticate the exact publication, including all prior evidence bytes.
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
	beforeOwnedSubtypeMatrixPublicationSource
	, ownedSubtypeMatrixPublicationAddedPaths
	, ownedSubtypeMatrixPublicationChangedPaths
	, ownedSubtypeMatrixPublicationCommits
	, ownedSubtypeMatrixPublicationImplementationPaths
	, ownedSubtypeMatrixPublicationHistoryPath
	, ownedSubtypeMatrixPublicationImplementation
	, ownedSubtypeMatrixPublicationIntegrationBase
	, ownedSubtypeMatrixPublicationIntegrationPaths
	, ownedSubtypeMatrixPublicationPins
	, ownedSubtypeMatrixPublicationPredecessor
	, reverseOwnedSubtypeMatrixPublicationUpdate
} from "./owned-subtype-matrix-publication-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { authenticateSourceHistoryReverse, gitSourceBytes } from "./source-history-stream.mjs";
import { readPromotionInventory } from "./type-surface-promotion-io.mjs";
import { typeSurfaceContractsAtProducer } from "./producer-source.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 2 * 1024 * 1024 });
const read = async () => JSON.parse(await readFile(
	ownedSubtypeMatrixPublicationHistoryPath, "utf8"));
const inventoryPath = "docs/type-surface.v1.json";

test("Owned Subtype matrix publication authenticates its wiring and lineage", async () => {
	const record = await read();
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "owned-subtype-matrix-publication-source-v1");
	assert.equal(record.predecessorCommit, ownedSubtypeMatrixPublicationPredecessor);
	assert.equal(record.implementationCommit, ownedSubtypeMatrixPublicationImplementation);
	assert.equal(record.integrationBaseCommit, ownedSubtypeMatrixPublicationIntegrationBase);
	assert.deepEqual(record.implementationCommits, ownedSubtypeMatrixPublicationCommits);
	assert.deepEqual(record.updates.map(item => item.path)
		, ownedSubtypeMatrixPublicationChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, ownedSubtypeMatrixPublicationIntegrationPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, ownedSubtypeMatrixPublicationAddedPaths);
	assert.deepEqual(git(["rev-list", "--reverse"
		, ownedSubtypeMatrixPublicationPredecessor + ".." + ownedSubtypeMatrixPublicationImplementation]).trim().split("\n")
	, ownedSubtypeMatrixPublicationCommits);
	for(const [index, revision] of ownedSubtypeMatrixPublicationCommits.entries())
		assert.equal(git(["show", "-s", "--format=%P", revision]).trim()
			, index === 0 ? ownedSubtypeMatrixPublicationPredecessor : ownedSubtypeMatrixPublicationCommits[index - 1]);
	assert.deepEqual(git(["diff", "--name-only"
		, ownedSubtypeMatrixPublicationPredecessor
		, ownedSubtypeMatrixPublicationImplementation]).trim().split("\n")
	, [...ownedSubtypeMatrixPublicationImplementationPaths].sort());
	const updates = [...record.updates.filter(item => item.path !== inventoryPath)
		, ...record.integrationUpdates];
	for(const update of updates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256, beforeOwnedSubtypeMatrixPublicationSource);
		const prior = record.integrationUpdates.includes(update)
			? ownedSubtypeMatrixPublicationIntegrationBase : ownedSubtypeMatrixPublicationPredecessor;
		const previous = git(["show", prior + ":" + update.path]);
		assert.equal(reverseOwnedSubtypeMatrixPublicationUpdate(
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

test("Owned Subtype matrix publication preserves the exact semantic boundary", async () => {
	const acceptance = JSON.parse(git(["show"
		, ownedSubtypeMatrixPublicationImplementation
		+ ":docs/evidence/owned-subtype-published-matrix-acceptance-20261025.json"]));
	const contracts = typeSurfaceContractsAtProducer(ownedSubtypeMatrixPublicationImplementation);
	const before = await readPromotionInventory(gitSourceBytes(
		ownedSubtypeMatrixPublicationPredecessor, inventoryPath), contracts);
	const after = await readPromotionInventory(gitSourceBytes(
		ownedSubtypeMatrixPublicationImplementation, inventoryPath), contracts);
	assert.deepEqual(before.source, acceptance.before);
	assert.deepEqual(after.source, acceptance.published);
	assert.equal(before.document.evidence.length, 881);
	assert.equal(after.document.evidence.length, 889);
	const pins = new Map(ownedSubtypeMatrixPublicationPins.map(pin => [pin.path, pin]));
	const previousEvidence = before.document.evidence.map(entry => ({
		...entry, files: entry.files.map(file => pins.has(file.path)
			? { ...file, sha256: pins.get(file.path).currentSha256 } : file)
	}));
	assert.deepEqual(after.document.evidence.slice(0, 881), previousEvidence);
	assert.deepEqual(after.document.evidence.slice(881).map(entry => entry.id)
		, acceptance.archives.map(archive => `owned-subtype-${archive.lane}-hosted-installed`));
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
		assert.match(observation.limitations.at(-1), /one selected Nat Subtype field in the tested acyclic Bundle/u);
		assert.ok(!observation.profiles.includes("php-wasm"));
		const route = observation.path === "ordinary-source" ? "ordinary" : "reviewed";
		const archive = acceptance.archives.find(entry => entry.routes.includes(route)
			&& entry.profiles.includes(observation.profiles[0]));
		assert.ok(archive);
		for(const profile of observation.profiles) assert.ok(archive.profiles.includes(profile));
		assert.deepEqual(observation.hostTypes, { ...prior.hostTypes
			, subtype: { ...prior.hostTypes.subtype
				, field: prior.hostTypes.subtype.field
					+ "; the tested acyclic owned Bundle preserves this checked field beside explicit resource identities" } });
		assert.deepEqual(observation.conversionNotes, { ...prior.conversionNotes
			, subtype: prior.conversionNotes.subtype
				+ " In the tested acyclic owned Bundle, the selected constructor validates the checked field before a successful transferred-input handoff; rejection leaves ownership unchanged, and later valid calls recover." });
		assert.deepEqual({ ...observation, scope: prior.scope
			, hostTypes: prior.hostTypes
			, conversionNotes: prior.conversionNotes, stages: prior.stages
			, limitations: prior.limitations }, prior);
		for(const [stage, value] of Object.entries(observation.stages))
		{
			assert.equal(value.state, "passed");
			assert.deepEqual(value.evidence, [...prior.stages[stage].evidence
				, `owned-subtype-${archive.lane}-hosted-installed`]);
			assert.ok(value.note.startsWith(prior.stages[stage].note + " "));
		}
	}
	assert.equal(changed, 22); assert.equal(cells, 32);
	assert.deepEqual({ ...after.document, evidence: before.document.evidence
		, observations: before.document.observations }, before.document);
	assert.deepEqual(acceptance.sourcePins, ownedSubtypeMatrixPublicationPins.map(pin => ({
		path: pin.path, currentSha256: pin.currentSha256, count: pin.count
		, previousSha256: pin.previousSha256
	})));
	assert.equal(acceptance.sourcePins.reduce((sum, pin) => sum + pin.count, 0), 70);
	for(const pin of ownedSubtypeMatrixPublicationPins)
		assert.equal(sha256(git(["show", ownedSubtypeMatrixPublicationImplementation + ":" + pin.path]))
			, pin.currentSha256, pin.path);
});

test("Owned Subtype matrix publication authenticates full streamed inventory endpoints", async () => {
	const update = (await read()).updates.find(item => item.path === inventoryPath);
	const acceptance = JSON.parse(git(["show"
		, ownedSubtypeMatrixPublicationImplementation
		+ ":docs/evidence/owned-subtype-published-matrix-acceptance-20261025.json"]));
	assert.equal(update.previousSha256, acceptance.before.sha256);
	assert.equal(update.currentSha256, acceptance.published.sha256);
	assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(
		ownedSubtypeMatrixPublicationImplementation, inventoryPath), update), true);
});

test("Owned Subtype matrix publication rejects unknown or forged transitions", async () => {
	const update = (await read()).integrationUpdates[0];
	const current = await sourceAtFinHistoryMilestone(update.path
		, update.currentSha256, beforeOwnedSubtypeMatrixPublicationSource);
	assert.equal(beforeOwnedSubtypeMatrixPublicationSource(
		update.path, current, update.currentSha256), current);
	const unknown = current + "\nunknown";
	assert.equal(beforeOwnedSubtypeMatrixPublicationSource(
		update.path, unknown), unknown);
	for(const forged of [{ ...update, previousSha256: "0".repeat(64) }
		, { ...update, currentSha256: "0".repeat(64) }
		, { ...update, edits: [...update.edits, update.edits[0]] }
		, { ...update, edits: [] }, { ...update, path: "unrelated.mjs" }])
		assert.throws(() => reverseOwnedSubtypeMatrixPublicationUpdate(current, forged));
	assert.equal(beforeOwnedSubtypeMatrixPublicationSource(
		"unrelated.mjs", current), current);
});

test("Owned Subtype matrix publication writer refuses another checkout", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-owned-subtype-publication-identity-guard-"));
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
		"scripts/update-owned-subtype-matrix-publication-source-history.mjs")]
	, { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /exact integration base/u);
	assert.deepEqual(await readdir(root), [".git"]);
});

/**
 * Compare original evidence without retaining the 100 MiB inventory.
 *
 * @param input - Exact Git blob bytes.
 */
async function* inventoryLines(input)
{
	const decoder = new TextDecoder("utf8", { fatal: true, ignoreBOM: true });
	let pending = "";
	for await(const chunk of input)
	{
		pending += decoder.decode(chunk, { stream: true });
		let newline;
		while((newline = pending.indexOf("\n")) >= 0)
		{
			yield pending.slice(0, newline);
			pending = pending.slice(newline + 1);
		}
		assert.ok(pending.length < 1024 * 1024);
	}
	pending += decoder.decode();
	assert.equal(pending, "");
}

test("Owned Subtype matrix publication preserves every previous header and evidence byte", async () => {
	const acceptance = JSON.parse(git(["show"
		, ownedSubtypeMatrixPublicationImplementation
		+ ":docs/evidence/owned-subtype-published-matrix-acceptance-20261025.json"]));
	const selected = new Map(ownedSubtypeMatrixPublicationPins.map(pin =>
		[pin.path, { ...pin, observed: 0 }]));
	const previousLines = inventoryLines(gitSourceBytes(
		ownedSubtypeMatrixPublicationPredecessor, inventoryPath));
	const publishedLines = inventoryLines(gitSourceBytes(
		ownedSubtypeMatrixPublicationImplementation, inventoryPath));
	let mode, pending, entries = 0, evidence = false, comparedLines = 0;
	try
	{
		while(true)
		{
			const previous = await previousLines.next();
			const current = await publishedLines.next();
			assert.equal(previous.done, false);
			assert.equal(current.done, false);
			const line = previous.value;
			let expected = line;
			if(line === '  "evidence": [') evidence = true;
			if(evidence && line === '      "files": [') mode = "files";
			if(evidence && line === '      "artifacts": [') mode = "artifacts";
			if(line === "      ]," || line === "      ]") mode = undefined;
			if(pending)
			{
				assert.equal(line, '          "sha256": "' + pending.previousSha256 + '"');
				expected = '          "sha256": "' + pending.currentSha256 + '"';
				pending.observed++;
			}
			const match = /^ {10}"path": "([^"]+)",$/u.exec(line);
			pending = mode === "files" && match ? selected.get(match[1]) : undefined;
			if(evidence && (line === "    }," || line === "    }"))
			{
				entries++;
				if(entries === 881)
				{
					assert.equal(line, "    }");
					expected = "    },";
				}
			}
			assert.equal(current.value, expected
				, "Previous inventory bytes changed at line " + (comparedLines + 1));
			comparedLines++;
			if(entries === 881) break;
		}
		assert.equal((await previousLines.next()).value, "  ],");
		assert.equal((await publishedLines.next()).value, "    {");
	}
	finally
	{
		await previousLines.return();
		await publishedLines.return();
	}
	assert.equal(entries, acceptance.preservedOriginalEvidence.entries);
	assert.equal(comparedLines, acceptance.preservedOriginalEvidence.comparedLines);
	for(const pin of selected.values()) assert.equal(pin.observed, pin.count, pin.path);
	assert.equal([...selected.values()].reduce((sum, pin) => sum + pin.observed, 0), 70);
});
