/**
 * Admit only the exact complete hosted direct dependent-signature matrix.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	renderTypeTable, typeGuideProfiles
} from "../../scripts/generate-type-docs.mjs";
import {
	typeSurfaceCells, validateTypeSurface
} from "../../src/adoption/type-surface.mjs";
import {
	dependentSignatureCompleteCells, dependentSignatureCompleteEvidenceId
	, dependentSignatureCompletePaths, dependentSignatureCompletePositions
	, dependentSignatureCompleteProfiles
	, dependentSignatureCompleteReferencePaths
	, promoteDependentSignatureComplete
} from "./dependent-signature-complete-promotion.mjs";
import {
	dependentSignatureHostedLanes
} from "./dependent-signature-hosted-archive.mjs";

const load = async () => {
	const [document, irSchema, consumers] = await Promise.all([
		"docs/type-surface.v1.json", "schema/binding-ir.schema.json"
		, "docs/consumer-support.v1.json"
	].map(async path => JSON.parse(await readFile(path, "utf8"))));
	return { document, contracts: { irSchema, consumers } };
};
const revision = "3".repeat(40);
const reference = Object.freeze({
	id: dependentSignatureCompleteEvidenceId, revision
	, command: "hosted complete dependent-signature command"
	, scope: "hosted complete dependent-signature scope"
	, files: Object.freeze(dependentSignatureCompleteReferencePaths.map(
		(path, index) => ({
			path, sha256: ((index + 1) % 16).toString(16).repeat(64)
		})
	))
	, artifacts: Object.freeze(dependentSignatureHostedLanes.map(
		(lane, index) => ({
			path: `${lane.artifactPrefix}-${revision}.zip`
			, sha256: ((index + 6) % 16).toString(16).repeat(64)
		})
	))
	, limitations: Object.freeze(Array.from({ length: 5 }, (_, index) =>
		`dependent-signature limitation ${index + 1}`))
});
const generatedRow = (source, lean) => source.split("\n").find(line =>
	line.startsWith(`| \`${lean}\` |`));

test("complete dependent-signature promotion owns exactly 34 cells", () => {
	assert.equal(dependentSignatureCompleteCells.length, 34);
	assert.equal(new Set(dependentSignatureCompleteCells).size, 34);
	assert.equal(dependentSignatureCompleteProfiles.length, 17);
	assert.equal(new Set(dependentSignatureCompleteProfiles).size, 17);
	assert.deepEqual(dependentSignatureCompletePaths
		, ["ordinary-source", "reviewed-ir"]);
	assert.deepEqual(dependentSignatureCompletePositions, ["signature"]);
});

test("complete dependent-signature promotion changes only its exact cells", async () => {
	const { document, contracts } = await load();
	const frozen = structuredClone(document);
	const beforeCells = typeSurfaceCells(document, contracts);
	const before = new Map(beforeCells.map(cell => [cell.id, cell]));
	const proposed = promoteDependentSignatureComplete(
		document, contracts, reference);
	assert.deepEqual(document, frozen);
	assert.equal(validateTypeSurface(proposed, contracts), true);
	assert.equal(proposed.evidence.length, document.evidence.length + 1);
	assert.equal(proposed.observations.length, document.observations.length + 2);
	const changed = typeSurfaceCells(proposed, contracts).filter(cell =>
		JSON.stringify(cell) !== JSON.stringify(before.get(cell.id)));
	assert.deepEqual(changed.map(cell => cell.id).sort()
		, [...dependentSignatureCompleteCells].sort());
	for(const cell of changed)
	{
		assert.equal(before.get(cell.id).stages.installedExecution.state
			, "unreviewed", cell.id);
		for(const stage of Object.values(cell.stages))
		{
			assert.equal(stage.state, "passed", cell.id);
			assert.deepEqual(stage.evidence, [reference.id], cell.id);
		}
		assert.match(cell.hostType, /payload < the live earlier bound/u);
		assert.match(cell.conversionNote
			, /no proof value crosses the host boundary/u);
		assert.match(cell.limitations.join(" "), /Dependent results, fields/u);
	}
	assert.deepEqual(proposed.evidence.at(-1).artifacts
		, reference.artifacts.map(artifact => ({
			...artifact, path: `${reference.id}/${artifact.path}`
		}))
	);
});

test("complete dependent-signature promotion refuses partial and overlapping evidence", async () => {
	const { document, contracts } = await load();
	assert.throws(() => promoteDependentSignatureComplete(
		document, contracts, {
			...reference, artifacts: reference.artifacts.slice(1)
		}
	));
	assert.throws(() => promoteDependentSignatureComplete(
		document, contracts, { ...reference, id: "forged" }));
	const forgedFiles = reference.files.map((file, index) => index === 0
		? { ...file, sha256: "forged" } : file);
	assert.throws(() => promoteDependentSignatureComplete(document, contracts, {
		...reference, files: forgedFiles
	}));
	const proposed = promoteDependentSignatureComplete(
		document, contracts, reference);
	assert.throws(() => promoteDependentSignatureComplete(
		proposed, contracts, reference));
});

test("complete dependent-signature promotion renders every consumer guide", async () => {
	const { document, contracts } = await load();
	const proposed = promoteDependentSignatureComplete(
		document, contracts, reference);
	const seenProfiles = new Set();
	for(const [guide, profiles] of Object.entries(typeGuideProfiles))
	{
		profiles.forEach(profile => seenProfiles.add(profile));
		const source = renderTypeTable({
			document: proposed, ...contracts
		}, profiles, "reference/types.md");
		assert.match(source
			, /\[Complete hosted dependent-signature acceptance\]\(evidence\/dependent-signatures-hosted-20261028\/index\.json\)/u
			, guide);
		assert.match(source
			, /explicit `Nat` bound followed by `Fin bound`/u, guide);
		assert.match(source
			, /Dependent results, fields, callbacks, owned values/u, guide);
		const row = generatedRow(source, "Dependent parameters and results");
		assert.ok(row, guide);
		assert.match(row
			, /Ordinary source: Installed checks passed\. Reviewed IR: Installed checks passed/u
			, guide);
		assert.match(row, /payload < the live earlier bound/u, guide);
		assert.match(row, /no proof value crosses the host boundary/u, guide);
	}
	assert.deepEqual([...seenProfiles].sort()
		, [...dependentSignatureCompleteProfiles].sort());
});
