/**
 * Test-only nominal Subtype entry evidence promotion controls.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { validateTypeSurface } from "../../src/adoption/type-surface.mjs";
import {
	nominalSubtypeEntryDocumentationPaths
	, nominalSubtypeEntryPromotionArchiveReferences
	, nominalSubtypeEntryPromotionRoots, promoteNominalSubtypeEntryEvidence
	, renderNominalSubtypeEntryDocumentation, renderNominalSubtypeEntryPromotion
} from "./nominal-subtype-entry-promotion.mjs";
import { gitSourceBytes } from "./source-history-stream.mjs";
import { readPromotionInventory } from "./type-surface-promotion-io.mjs";

const digest = "0".repeat(64), revision = "0".repeat(40);
const implementation = "8594bc6a43fdf28bf3b80da64d31938226d0f0b9";
const laneProfiles = Object.freeze({
	native: ["c", "cpp"]
	, browser: ["node-javascript", "node-typescript", "browser-javascript"
		, "browser-react", "browser-worker"]
});
const references = Object.entries(laneProfiles).map(([lane, profiles]) => ({
	lane, profiles, id: `nominal-subtype-entry-${lane}-hosted-instrumented`
	, kind: "test", revision
	, command: `Replay retained ${lane} entry evidence.`
	, scope: `GitHub Actions run 1, job 2, artifact 3. Test-only ${lane} evidence.`
	, files: [{ path: `test/${lane}.json`, sha256: digest }]
	, artifacts: [{ path: `test/${lane}.zip`, sha256: digest }]
}));

test("nominal Subtype entry promotion adds evidence without support", async () => {
	const [irSchema, consumers] = await Promise.all([
		readFile("schema/binding-ir.schema.json", "utf8").then(JSON.parse)
		, readFile("docs/consumer-support.v1.json", "utf8").then(JSON.parse)
	]);
	const { document } = await readPromotionInventory(
		gitSourceBytes(implementation, "docs/type-surface.v1.json")
		, { irSchema, consumers });
	const promoted = promoteNominalSubtypeEntryEvidence(document, references);
	assert.equal(validateTypeSurface(promoted, { irSchema, consumers }), true);
	assert.deepEqual(promoted.observations, document.observations);
	assert.deepEqual(promoted.evidence.slice(-2).map(item => item.id)
		, references.map(item => item.id));
	for(const observation of promoted.observations)
		for(const stage of Object.values(observation.stages))
			for(const reference of references)
				assert.ok(!stage.evidence.includes(reference.id));
});

test(
	"nominal Subtype entry archive references bind canonical retained bytes"
	, async () => {
	for(const root of Object.values(nominalSubtypeEntryPromotionRoots))
	{
		const bytes = await readFile(`${root}/index.json`);
		const index = JSON.parse(bytes);
		const result = nominalSubtypeEntryPromotionArchiveReferences(
			index, root, bytes);
		assert.equal(result.files[0].path, `${root}/index.json`);
		assert.deepEqual(
			result.artifacts.map(item => item.path)
			, index.hostedRun.artifact.parts.map(item => `${root}/${item.path}`)
		);
	}
	}
);

test(
	"nominal Subtype entry documentation states the instrumented boundary"
	, async () => {
	const sources = Object.fromEntries(await Promise.all(
		Object.entries(nominalSubtypeEntryDocumentationPaths).map(
			async ([name, path]) => [name, await readFile(path, "utf8")]
		)
	));
	const rendered = renderNominalSubtypeEntryDocumentation(sources);
	for(const text of Object.values(rendered))
	{
		assert.match(text, /instrumented/u);
		assert.match(text, /unmodified/u);
	}
	const receipt = renderNominalSubtypeEntryPromotion(references);
	assert.match(receipt, /C\+\+ executes without entry counters/u);
	assert.match(receipt, /Result-only records explicit nonmeasurement/u);
	}
);
