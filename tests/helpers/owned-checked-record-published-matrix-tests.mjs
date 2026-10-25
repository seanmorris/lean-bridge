/**
 * Check published owned support against immutable capture identities.
 * Full ZIP/package replay remains a separate required acceptance gate.
 *
 * @file
 */
import assert from "node:assert/strict";
import { createReadStream } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname } from "node:path";
import test from "node:test";
import { typeSurfaceCells } from "../../src/adoption/type-surface.mjs";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { renderReferenceDocuments } from "../../scripts/generate-reference-docs.mjs";
import { ownedCheckedRecordMatrixReference } from "../../scripts/generate-type-docs.mjs";
import { ownedCheckedRecordDocumentationPaths, renderOwnedCheckedRecordDocumentation } from "./owned-checked-record-documentation.mjs";
import { ownedCheckedRecordHostedRoutes } from "./owned-checked-record-hosted-contracts.mjs";
import { assertOwnedCheckedRecordMatrixIndexes } from "./owned-checked-record-hosted-matrix.mjs";
import {
	ownedCheckedRecordPromotionArchiveReferences, ownedCheckedRecordPromotionLimit
	, ownedCheckedRecordPromotionPath, ownedCheckedRecordPromotionProfiles
	, ownedCheckedRecordPromotionSelectionPath, renderOwnedCheckedRecordPromotion
} from "./owned-checked-record-promotion.mjs";
import { gitSourceBytes } from "./source-history-stream.mjs";
import { readPromotionInventory } from "./type-surface-promotion-io.mjs";
import { ownedSubtypeMatrixPublicationImplementation } from "./owned-subtype-matrix-publication-source-history.mjs";

const predecessor = "a9cad3b18a244d7e74918e6e8964455e073e2453";
const selectionSha256 = "8959dae7243d65ad0e5a204091c4cf1fdc99d963bdcd0b061622f82472608f14";
const ownedId = id => /^owned-checked-record-[a-z-]+-hosted-installed$/u.test(id);
const hostTypes = {
	parameter: "borrowed or transferred Booking/Claim payload with a live Ticket owner"
	, result: "leased proof-free Booking/Claim payload; standalone result-only Claim"
	, field: "copied checked Window field inside the resource-bearing owned Booking"
	, "callback-parameter": "proof-free Claim with a live Ticket owner at synchronous host arguments and checked returned-closure inputs"
	, "callback-result": "checked host Claim reply or proof-free returned Lean closure result with the Ticket owner retained"
};
let loaded;
const current = () => loaded ??= (async () => {
	const contracts = {
		irSchema: JSON.parse(await readFile("schema/binding-ir.schema.json", "utf8"))
		, consumers: JSON.parse(await readFile("docs/consumer-support.v1.json", "utf8"))
	};
	const { document } = await readPromotionInventory(createReadStream("docs/type-surface.v1.json"), contracts);
	const { document: before } = await readPromotionInventory(gitSourceBytes(predecessor, "docs/type-surface.v1.json"), contracts);
	// Owned checked-record changes still compare with their original baseline.
	// Other observations must preserve the separately authenticated Subtype publication.
	const { document: independent } = await readPromotionInventory(gitSourceBytes(
		ownedSubtypeMatrixPublicationImplementation, "docs/type-surface.v1.json"), contracts);
	const selected = await readFile(ownedCheckedRecordPromotionSelectionPath);
	assert.equal(sha256(selected), selectionSha256);
	const selection = JSON.parse(selected); assert.equal(selected.toString(), canonicalJson(selection));
	const bytes = [];
	for(const entry of selection.archives) bytes.push(await readFile(entry.index.path));
	const indexes = assertOwnedCheckedRecordMatrixIndexes(selection, bytes);
	const references = indexes.map((index, number) => ({
		lane: index.lane
		, profiles: [...ownedCheckedRecordPromotionProfiles[index.lane]]
		, routes: [...ownedCheckedRecordHostedRoutes]
		, id: `owned-checked-record-${index.lane}-hosted-installed`
		, kind: "installed", revision: index.producerCommit
		, command: `node scripts/check-owned-checked-record-matrix.mjs --selection ${ownedCheckedRecordPromotionSelectionPath}`
		, scope: `GitHub Actions run ${index.hostedRun.runId}, job ${index.hostedRun.job.id}, artifact ${index.hostedRun.artifact.id}: complete committed ${index.lane} archive and four installed package routes independently replayed. ${index.limitations.join(" ")}`
		, ...ownedCheckedRecordPromotionArchiveReferences(index
			, dirname(selection.archives[number].index.path), bytes[number])
	}));
	return { document, before, independent, contracts, references };
})();

const assertPublished = (document, before, contracts, references, independent) => {
	assert.equal(references.length, 11);
	assert.deepEqual(document.evidence.filter(entry => ownedId(entry.id)).map(entry => entry.id), references.map(entry => entry.id));
	for(const reference of references)
	{
		const expected = Object.fromEntries(Object.entries(reference).filter(([key]) => !["lane", "profiles", "routes"].includes(key)));
		expected.files = expected.files.slice(0, 1); expected.artifacts = expected.artifacts.slice(0, 1);
		assert.deepEqual(document.evidence.find(entry => entry.id === reference.id), expected);
	}
	const targets = new Map();
	for(const reference of references)
		for(const profile of reference.profiles)
			for(const path of ["ordinary-source", "reviewed-ir"])
				for(const position of Object.keys(hostTypes))
				{
					const id = `${profile}/checked-record/${path}/${position}`;
					assert.ok(!targets.has(id)); targets.set(id, reference.id);
				}
	assert.equal(targets.size, 170);
	const cells = typeSurfaceCells(document, contracts, cell => targets.has(cell.id));
	assert.equal(cells.length, 170);
	for(const cell of cells)
		for(const stage of Object.values(cell.stages))
		{
			assert.equal(stage.state, "passed"); assert.ok(stage.evidence.includes(targets.get(cell.id)));
		}
	assert.equal(document.observations.length, before.observations.length);
	assert.deepEqual(independent.observations.map(item => item.id)
		, before.observations.map(item => item.id));
	let changed = 0, count = 0;
	for(const [index, observation] of document.observations.entries())
	{
		const prior = before.observations[index];
		if(!Object.values(observation.stages).some(stage => stage.evidence.some(ownedId)))
		{
			assert.deepEqual(observation, independent.observations[index]); continue;
		}
		changed++; count += observation.profiles.length * observation.positions.length;
		for(const field of ["id", "profiles", "positions", "path", "shapes"]) assert.deepEqual(observation[field], prior[field]);
		assert.deepEqual(observation.shapes, ["checked-record"]);
		assert.deepEqual(observation.limitations, [...prior.limitations, ownedCheckedRecordPromotionLimit]);
		assert.ok(observation.scope.startsWith(prior.scope + " "));
		assert.ok(observation.conversionNotes["checked-record"].startsWith(prior.conversionNotes["checked-record"] + " "));
		for(const position of observation.positions)
			assert.equal(observation.hostTypes["checked-record"][position], prior.hostTypes["checked-record"][position] + "; " + hostTypes[position]);
		const ids = references.filter(reference => reference.profiles.some(profile => observation.profiles.includes(profile))).map(reference => reference.id);
		for(const [stage, value] of Object.entries(observation.stages))
		{
			assert.equal(value.state, prior.stages[stage].state);
			assert.deepEqual(value.evidence, [...prior.stages[stage].evidence, ...ids]);
			assert.ok(value.note.startsWith(prior.stages[stage].note + " "));
		}
	}
	assert.equal(changed, 114); assert.equal(count, 170);
	assert.match(ownedCheckedRecordMatrixReference(document), /exactly 170 cells/u);
	return true;
};

test("published owned checked-record support binds eleven captures to exactly 170 cells", async () => {
	const { document, before, independent, contracts, references } = await current();
	assert.equal(assertPublished(document, before, contracts, references, independent), true);
});

test("published owned checked-record support rejects missing, substituted and widened claims", async () => {
	const { document, before, independent, contracts, references } = await current();
	const first = references[0].id;
	for(const change of [
		entry => ({ ...entry, revision: "0".repeat(40) })
		, entry => ({ ...entry, files: [{ ...entry.files[0], sha256: "0".repeat(64) }] })
	]) {
		const evidence = document.evidence.map(entry => entry.id === first ? change(entry) : entry);
		assert.throws(() => assertPublished({ ...document, evidence }, before, contracts, references, independent));
	}
	assert.throws(() => assertPublished({ ...document, evidence: document.evidence.filter(entry => entry.id !== first) }, before, contracts, references, independent));
	const selected = document.observations.find(entry => entry.id === "checked-record-c-ordinary-source-parameter"); assert.ok(selected);
	for(const mutate of [
		entry => { entry.profiles.push("php-wasm"); }
		, entry => { entry.positions.push("field"); }
		, entry => { entry.stages.installedExecution.evidence = entry.stages.installedExecution.evidence.filter(id => id !== first); }
		, entry => { entry.stages.installedExecution.evidence.push("owned-checked-record-javascript-hosted-installed"); }
		, entry => { entry.hostTypes["checked-record"].parameter += "; arbitrary Grant"; }
		, entry => { entry.limitations = []; }
	]) {
		const altered = structuredClone(selected); mutate(altered);
		const observations = document.observations.map(entry => entry === selected ? altered : entry);
		assert.throws(() => assertPublished({ ...document, observations }, before, contracts, references, independent));
	}
});

test("published owned checked-record support preserves independently accepted and unrelated observations", async () => {
	const { document, before, independent, contracts, references } = await current();
	const subtypeId = id => /^owned-subtype-[a-z-]+-hosted-installed$/u.test(id);
	const selected = independent.observations.filter(observation =>
		Object.values(observation.stages).some(stage => stage.evidence.some(subtypeId)));
	assert.equal(selected.length, 22);
	assert.equal(selected.reduce((sum, item) => sum + item.profiles.length * item.positions.length, 0), 32);
	const unrelated = document.observations.find(observation =>
		!Object.values(observation.stages).some(stage => stage.evidence.some(value => ownedId(value) || subtypeId(value))));
	assert.ok(unrelated);
	for(const id of [selected[0].id, unrelated.id])
	{
		const original = document.observations.find(item => item.id === id);
		for(const mutate of [
			entry => { entry.scope += " unsupported claim"; }
			, entry => { entry.stages.installedExecution.evidence = []; }
			, entry => { entry.limitations.push("unsupported claim"); }
		]) {
			const altered = structuredClone(original); mutate(altered);
			const observations = document.observations.map(entry => entry.id === id ? altered : entry);
			assert.throws(() => assertPublished({ ...document, observations }
				, before, contracts, references, independent), assert.AssertionError, id);
		}
	}
});

test("published owned checked-record guides and generated references match the current inventory", async () => {
	const { document, contracts, references } = await current();
	const generated = await renderReferenceDocuments({ root: process.cwd(), inventory: { document, ...contracts } });
	for(const [path, expected] of Object.entries(generated)) assert.equal(sha256(await readFile(path)), sha256(expected), path);
	const sources = {}, originals = {};
	for(const [name, path] of Object.entries(ownedCheckedRecordDocumentationPaths))
	{
		const source = await readFile(path, "utf8"); originals[name] = source;
		const heading = "## Owned checked records\n"; assert.equal(source.split(heading).length, 2, path);
		const marker = name === "existingPackage" ? "## Choose downstream languages\n"
			: name === "exportDecisions" ? "## Check each consumer representation\n" : "## Start from a raw Lean package\n";
		const start = source.indexOf(heading), end = source.indexOf(marker, start); assert.ok(end > start, path);
		sources[name] = source.slice(0, start) + source.slice(end);
		if(name === "existingPackage") sources[name] = sources[name].replace(
			"the separately archived owned Booking/Window and Ticket/Claim forms are documented below; unarchived combinations remain separate |"
			, "owned and unarchived combinations remain separate |"
		);
	}
	const expected = renderOwnedCheckedRecordDocumentation(sources);
	for(const name of Object.keys(originals)) assert.equal(sha256(originals[name]), sha256(expected[name]), name);
	assert.equal(await readFile(ownedCheckedRecordPromotionPath, "utf8"), renderOwnedCheckedRecordPromotion(references));
});
