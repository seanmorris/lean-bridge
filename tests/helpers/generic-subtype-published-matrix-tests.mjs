/**
 * Check the current published generic matrix, independently of baseline tests.
 * Complete archive replay remains a separate required promotion/contract gate.
 *
 * @file
 */
import assert from "node:assert/strict";
import { createReadStream } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { typeSurfaceCells } from "../../src/adoption/type-surface.mjs";
import { renderReferenceDocuments } from "../../scripts/generate-reference-docs.mjs";
import { genericSubtypeMatrixReference } from "../../scripts/generate-type-docs.mjs";
import { genericSubtypeDocumentationPaths } from "./generic-subtype-documentation.mjs";
import {
	genericSubtypePromotionLimit, genericSubtypePromotionPath
	, genericSubtypePromotionReferences, renderGenericSubtypePromotion
} from "./generic-subtype-promotion.mjs";
import { readPromotionInventory } from "./type-surface-promotion-io.mjs";

const genericId = id => /^generic-subtype-[a-z-]+-hosted-installed$/u.test(id);
let loaded;
const current = () => loaded ??= (async () => {
	const contracts = {
		irSchema: JSON.parse(await readFile("schema/binding-ir.schema.json", "utf8"))
		, consumers: JSON.parse(await readFile("docs/consumer-support.v1.json", "utf8"))
	};
	const { document } = await readPromotionInventory(
		createReadStream("docs/type-surface.v1.json"), contracts);
	// This check binds today's inventory to the original index digests. It does
	// not replace the separate full replay of every retained archive file.
	const references = await genericSubtypePromotionReferences(async (_lane, root) =>
		JSON.parse(await readFile(`${root}/index.json`, "utf8")));
	return { document, contracts, references };
})();

const assertPublishedMatrix = (document, contracts, references) => {
	const ids = references.map(reference => reference.id);
	assert.equal(ids.length, 12);
	assert.deepEqual(document.evidence.filter(entry => genericId(entry.id))
		.map(entry => entry.id), ids);
	for(const reference of references)
	{
		const expected = Object.fromEntries(Object.entries(reference)
			.filter(([key]) => !["lane", "profiles", "routes"].includes(key)));
		expected.files = expected.files.slice(0, 1);
		expected.artifacts = expected.artifacts.slice(0, 1);
		assert.deepEqual(document.evidence.find(entry => entry.id === reference.id), expected);
	}
	const foundation = references.find(reference => reference.lane === "foundation").id;
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
		assert.match(cell.hostType, /closed GenericNat record/u);
		for(const stage of Object.values(cell.stages))
		{
			assert.equal(stage.state, "passed");
			assert.deepEqual(stage.evidence.filter(genericId), [foundation, targets.get(cell.id)]);
		}
	}
	let observations = 0;
	for(const observation of document.observations)
	{
		if(!Object.values(observation.stages).some(stage => stage.evidence.some(genericId))) continue;
		observations++;
		assert.deepEqual(observation.shapes, ["subtype"]);
		assert.deepEqual(observation.positions, ["field"]);
		assert.ok(observation.limitations.includes(genericSubtypePromotionLimit));
		for(const profile of observation.profiles)
		{
			const id = `${profile}/subtype/${observation.path}/field`;
			assert.ok(targets.has(id), id);
			for(const stage of Object.values(observation.stages))
				assert.deepEqual(stage.evidence.filter(genericId), [foundation, targets.get(id)]);
		}
	}
	assert.equal(observations, 22);
	assert.match(genericSubtypeMatrixReference(document), /exactly 32 Subtype field cells/u);
	return true;
};

test("published generic Subtype inventory binds twelve archives to exactly 32 field cells", async () => {
	const { document, contracts, references } = await current();
	assert.equal(assertPublishedMatrix(document, contracts, references), true);
});

test("published generic Subtype matrix rejects missing, substituted or widened claims", async () => {
	const { document, contracts, references } = await current();
	const first = references[0].id;
	for(const change of [
		entry => ({ ...entry, revision: "0".repeat(40) })
		, entry => ({ ...entry, files: [{ ...entry.files[0], sha256: "0".repeat(64) }] })
	]) {
		const evidence = document.evidence.map(entry => entry.id === first ? change(entry) : entry);
		assert.throws(() => assertPublishedMatrix({ ...document, evidence }, contracts, references));
	}
	assert.throws(() => assertPublishedMatrix({ ...document
		, evidence: document.evidence.filter(entry => entry.id !== first) }, contracts, references));
	const selected = document.observations.find(entry =>
		entry.id === "nominal-subtype-npm-fields-ordinary-source");
	for(const mutate of [
		entry => { entry.profiles.push("php-wasm"); }
		, entry => { entry.positions.push("argument"); }
		, entry => { entry.stages.installedExecution.evidence = entry.stages.installedExecution.evidence
			.filter(id => id !== "generic-subtype-foundation-hosted-installed"); }
		, entry => { entry.stages.installedExecution.evidence = entry.stages.installedExecution.evidence
			.map(id => id === first ? "generic-subtype-npm-reviewed-hosted-installed" : id); }
		, entry => { entry.limitations = []; }
	]) {
		const altered = structuredClone(selected); mutate(altered);
		const observations = document.observations.map(entry => entry === selected ? altered : entry);
		assert.throws(() => assertPublishedMatrix({ ...document, observations }, contracts, references));
	}
});

test("published generic Subtype guides and generated references match the current inventory", async () => {
	const { document, contracts, references } = await current();
	const generated = await renderReferenceDocuments({ root: process.cwd()
		, inventory: { document, ...contracts } });
	for(const [path, expected] of Object.entries(generated))
		assert.equal(await readFile(path, "utf8"), expected, path);
	for(const path of Object.values(genericSubtypeDocumentationPaths))
	{
		const source = await readFile(path, "utf8");
		assert.equal(source.split("[hosted generic-Subtype matrix]").length, 2, path);
		assert.match(source, /closed `GenericNat` alias/u);
		assert.match(source, /`plusOne` and `plusTwo`/u);
	}
	assert.equal(await readFile(genericSubtypePromotionPath, "utf8")
		, renderGenericSubtypePromotion(references));
});
