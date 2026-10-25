/**
 * Bind today's owned Subtype matrix to the complete original index commitments.
 * Metadata checks here do not replace the required full original archive replay.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createReadStream } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { typeSurfaceCells } from "../../src/adoption/type-surface.mjs";
import { renderReferenceDocuments } from "../../scripts/generate-reference-docs.mjs";
import { ownedSubtypeDocumentationPaths } from "./owned-subtype-documentation.mjs";
import {
	ownedSubtypePromotionLimit, ownedSubtypePromotionPath, renderOwnedSubtypePromotion
} from "./owned-subtype-promotion.mjs";
import {
	ownedSubtypePromotionArchives, ownedSubtypePromotionArchiveRoot
	, ownedSubtypePromotionEvidenceId, ownedSubtypePromotionReplayCommand
} from "./owned-subtype-promotion-catalog.mjs";
import { ownedSubtypePromotionArchiveReferences } from "./owned-subtype-promotion-archive-references.mjs";
import { readPromotionInventory } from "./type-surface-promotion-io.mjs";

const validators = [
	"scripts/promote-owned-subtype-evidence.mjs"
	, "scripts/generate-reference-docs.mjs"
	, "scripts/generate-type-docs.mjs"
	, "scripts/check-owned-subtype-hosted-evidence.mjs"
	, "tests/owned-subtype-hosted-ci.test.mjs"
	, "tests/owned-subtype-promotion.test.mjs"
	, "tests/owned-subtype-hosted-promotion.test.mjs"
	, "tests/owned-subtype-retained-packages.test.mjs"
	, "tests/helpers/owned-subtype-hosted-evidence.mjs"
	, "tests/helpers/owned-subtype-hosted-output.mjs"
	, "tests/helpers/owned-subtype-promotion.mjs"
	, "tests/helpers/owned-subtype-documentation.mjs"
	, "tests/helpers/owned-subtype-promotion-catalog.mjs"
	, "tests/helpers/owned-subtype-promotion-archive-references.mjs"
	, "tests/helpers/owned-subtype-promotion-transaction-tests.mjs"
	, "tests/helpers/type-surface-promotion-io.mjs"
	, "tests/helpers/promotion-file-transaction.mjs"
	, "tests/helpers/source-history-stream.mjs"
];
const ownedId = id => /^owned-subtype-[a-z-]+-hosted-installed$/u.test(id);
let loaded;
const current = () => loaded ??= (async () => {
	const contracts = {
		irSchema: JSON.parse(await readFile("schema/binding-ir.schema.json", "utf8"))
		, consumers: JSON.parse(await readFile("docs/consumer-support.v1.json", "utf8"))
	};
	const { document } = await readPromotionInventory(
		createReadStream("docs/type-surface.v1.json"), contracts
		, { retainEvidence: ownedSubtypePromotionArchives.map(item => ownedSubtypePromotionEvidenceId(item.lane)) });
	const references = [];
	for(const item of ownedSubtypePromotionArchives)
	{
		const root = ownedSubtypePromotionArchiveRoot(item.lane), path = `${root}/index.json`;
		// Sparse Core checkouts may omit payload directories. Read the same
		// committed index from Git, never a replacement archive or local fixture.
		const bytes = await readFile(path).catch(error => {
			if(error.code !== "ENOENT") throw error;
			return execFileSync("git", ["show", `HEAD:${path}`], { maxBuffer: 4 * 1024 ** 2 });
		});
		const index = JSON.parse(bytes);
		const compact = ownedSubtypePromotionArchiveReferences(index, root, bytes);
		const files = [...compact.files];
		for(const path of validators) files.push({ path, sha256: sha256(await readFile(path)) });
		references.push({
			lane: item.lane
			, profiles: [...item.profiles]
			, routes: ["ordinary", "reviewed"]
			, id: ownedSubtypePromotionEvidenceId(item.lane)
			, kind: "installed"
			, revision: item.producer
			, command: ownedSubtypePromotionReplayCommand(item.lane)
			, scope: `GitHub Actions run ${index.hostedRun.runId}, job ${index.hostedRun.job.id}, artifact ${index.hostedRun.artifact.id} executes ordinary Lean source and independently reviewed Binding IR through installed ${item.profiles.join(", ")} packages. ${index.limitations.join(" ")}`
			, files, artifacts: compact.artifacts
		});
	}
	return { document, contracts, references };
})();

const assertPublishedMatrix = (document, contracts, references) => {
	const ids = references.map(reference => reference.id);
	assert.equal(ids.length, 8);
	assert.deepEqual(document.evidence.filter(entry => ownedId(entry.id)).map(entry => entry.id), ids);
	for(const reference of references)
	{
		const expected = Object.fromEntries(Object.entries(reference)
			.filter(([key]) => !["lane", "profiles", "routes"].includes(key)));
		assert.deepEqual(document.evidence.find(entry => entry.id === reference.id), expected);
	}
	const targets = new Map();
	for(const reference of references)
		for(const profile of reference.profiles)
			for(const route of reference.routes)
			{
				const path = route === "ordinary" ? "ordinary-source" : "reviewed-ir";
				const id = `${profile}/subtype/${path}/field`;
				assert.ok(!targets.has(id));
				targets.set(id, reference.id);
			}
	assert.equal(targets.size, 32);
	const cells = typeSurfaceCells(document, contracts, cell => targets.has(cell.id));
	assert.equal(cells.length, targets.size);
	for(const cell of cells)
	{
		assert.match(cell.hostType, /tested acyclic owned Bundle/u);
		for(const stage of Object.values(cell.stages))
		{
			assert.equal(stage.state, "passed");
			assert.deepEqual(stage.evidence.filter(ownedId), [targets.get(cell.id)]);
		}
	}
	let observations = 0;
	for(const observation of document.observations)
	{
		if(!Object.values(observation.stages).some(stage => stage.evidence.some(ownedId))) continue;
		observations++;
		assert.deepEqual(observation.shapes, ["subtype"]);
		assert.deepEqual(observation.positions, ["field"]);
		assert.ok(observation.limitations.includes(ownedSubtypePromotionLimit));
		for(const profile of observation.profiles)
		{
			const id = `${profile}/subtype/${observation.path}/field`;
			assert.ok(targets.has(id), id);
			for(const stage of Object.values(observation.stages))
				assert.deepEqual(stage.evidence.filter(ownedId), [targets.get(id)]);
		}
	}
	assert.equal(observations, 22);
	return true;
};

test("published owned Subtype inventory binds eight original archives to exactly 32 field cells", async () => {
	const { document, contracts, references } = await current();
	assert.equal(assertPublishedMatrix(document, contracts, references), true);
});

test("published owned Subtype matrix rejects missing, forged and widened claims", async () => {
	const { document, contracts, references } = await current();
	const first = references[0].id;
	for(const change of [
		entry => ({ ...entry, revision: "0".repeat(40) })
		, entry => ({ ...entry, files: [{ ...entry.files[0], sha256: "0".repeat(64) }, ...entry.files.slice(1)] })
		, entry => ({ ...entry, files: entry.files.slice(0, -1) })
		, entry => ({ ...entry, artifacts: [] })
	]) {
		const evidence = document.evidence.map(entry => entry.id === first ? change(entry) : entry);
		assert.throws(() => assertPublishedMatrix({ ...document, evidence }, contracts, references));
	}
	assert.throws(() => assertPublishedMatrix({ ...document
		, evidence: document.evidence.filter(entry => entry.id !== first) }, contracts, references));
	assert.throws(() => assertPublishedMatrix({ ...document
		, evidence: [...document.evidence, document.evidence.find(entry => entry.id === first)] }, contracts, references));
	const selected = document.observations.find(entry => entry.id === "nominal-subtype-npm-fields-ordinary-source");
	for(const mutate of [
		entry => { entry.profiles.push("php-wasm"); }
		, entry => { entry.positions.push("argument"); }
		, entry => { entry.stages.installedExecution.evidence = entry.stages.installedExecution.evidence.filter(id => id !== first); }
		, entry => { entry.stages.installedExecution.evidence = entry.stages.installedExecution.evidence.map(id => id === first ? references[1].id : id); }
		, entry => { entry.limitations = []; }
	]) {
		const altered = structuredClone(selected); mutate(altered);
		const observations = document.observations.map(entry => entry === selected ? altered : entry);
		assert.throws(() => assertPublishedMatrix({ ...document, observations }, contracts, references));
	}
});

test("published owned Subtype guides and generated references match the current inventory", async () => {
	const { document, contracts, references } = await current();
	const generated = await renderReferenceDocuments({ root: process.cwd(), inventory: { document, ...contracts } });
	for(const [path, expected] of Object.entries(generated))
		assert.equal(await readFile(path, "utf8"), expected, path);
	for(const [name, path] of Object.entries(ownedSubtypeDocumentationPaths))
	{
		const source = await readFile(path, "utf8");
		assert.equal(source.split("[hosted owned-Subtype matrix]").length, 2, path);
		assert.match(source, /tested acyclic/u);
		if(["dotnet", "perl", "python", "ruby"].includes(name))
			assert.match(source, /Owned checked-record fields have \[separate acceptance\]/u, path);
	}
	assert.equal(await readFile(ownedSubtypePromotionPath, "utf8"), renderOwnedSubtypePromotion(references));
});
