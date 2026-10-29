/**
 * Close only the 50 JavaScript/browser HostNull cells backed by the hosted
 * archive; signatures and every other host remain untouched.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { typeSurfaceCells } from "../../src/adoption/type-surface.mjs";
import {
	hostNullJavaScriptPromotionCells
	, hostNullJavaScriptPromotionEvidenceId
	, hostNullJavaScriptPromotionPaths
	, hostNullJavaScriptPromotionPositions
	, hostNullJavaScriptPromotionProfiles
	, promoteHostNullJavaScript
} from "./host-null-javascript-promotion.mjs";

const load = async () => {
	const [document, irSchema, consumers] = await Promise.all([
		"docs/type-surface.v1.json", "schema/binding-ir.schema.json"
		, "docs/consumer-support.v1.json"
	].map(async path => JSON.parse(await readFile(path, "utf8"))));
	return { document, contracts: { irSchema, consumers } };
};
const reference = Object.freeze({
	id: hostNullJavaScriptPromotionEvidenceId
	, revision: "1d13d30f174d0f4750061cd601a6aebde3f3d69b"
	, command: "hosted HostNull command", scope: "hosted HostNull scope"
	, files: Object.freeze([{
		path: "docs/evidence/host-null-javascript-browser-20261029/index.json"
		, sha256: "1".repeat(64)
	}])
	, artifacts: Object.freeze([{
		path: "host-null-node-browser.zip", sha256: "2".repeat(64)
	}])
	, limitations: Object.freeze(["hosted limitation"])
});

test("HostNull JavaScript promotion target is exactly five profiles, two paths and five positions", () => {
	assert.equal(hostNullJavaScriptPromotionCells.length, 50);
	assert.equal(new Set(hostNullJavaScriptPromotionCells).size, 50);
	assert.deepEqual(hostNullJavaScriptPromotionProfiles, [
		"node-javascript", "node-typescript", "browser-javascript"
		, "browser-react", "browser-worker"
	]);
	assert.deepEqual(hostNullJavaScriptPromotionPaths
		, ["ordinary-source", "reviewed-ir"]);
	assert.deepEqual(hostNullJavaScriptPromotionPositions, [
		"parameter", "result", "field", "callback-parameter"
		, "callback-result"
	]);
	assert.ok(hostNullJavaScriptPromotionCells.every(id =>
		!id.endsWith("/signature")));
});

test("HostNull JavaScript promotion changes exactly 50 unreviewed cells", async () => {
	const { document, contracts } = await load();
	const beforeCells = typeSurfaceCells(document, contracts);
	const before = new Map(beforeCells.map(cell => [cell.id, cell]));
	const proposed = promoteHostNullJavaScript(
		document, contracts, reference);
	assert.equal(proposed.evidence.length, document.evidence.length + 1);
	assert.equal(proposed.observations.length, document.observations.length + 2);
	assert.deepEqual(proposed.evidence.at(-1), {
		id: reference.id, kind: "installed", revision: reference.revision
		, command: reference.command, scope: reference.scope
		, files: reference.files
		, artifacts: [{
			...reference.artifacts[0]
			, path: `${reference.id}/${reference.artifacts[0].path}`
		}]
	});
	const afterCells = typeSurfaceCells(proposed, contracts);
	const changed = afterCells.filter(cell => JSON.stringify(cell.stages)
		!== JSON.stringify(before.get(cell.id).stages));
	assert.deepEqual(changed.map(cell => cell.id).sort()
		, [...hostNullJavaScriptPromotionCells].sort());
	for(const cell of changed)
	{
		assert.equal(before.get(cell.id).stages.installedExecution.state
			, "unreviewed");
		for(const stage of Object.values(cell.stages))
		{
			assert.equal(stage.state, "passed", cell.id);
			assert.deepEqual(stage.evidence, [reference.id], cell.id);
		}
	}
	const observations = proposed.observations.slice(-2);
	assert.deepEqual(observations.map(item => item.path)
		, hostNullJavaScriptPromotionPaths);
	for(const observation of observations)
	{
		assert.deepEqual(observation.profiles
			, hostNullJavaScriptPromotionProfiles);
		assert.deepEqual(observation.positions
			, hostNullJavaScriptPromotionPositions);
		assert.deepEqual(observation.shapes, ["host-null"]);
		for(const text of Object.values(observation.hostTypes["host-null"]))
			assert.equal(text
				, "null | T, with Option remaining a separate tagged value");
		assert.match(observation.conversionNotes["host-null"]
			, /omitted parameter remains a separate API decision/u);
	}
	assert.equal(afterCells.find(cell =>
		cell.id === "php-native/host-null/ordinary-source/parameter")
		.stages.installedExecution.state, "unreviewed");
});

test("HostNull JavaScript promotion refuses overlap", async () => {
	const { document, contracts } = await load();
	const proposed = promoteHostNullJavaScript(
		document, contracts, reference);
	assert.throws(() => promoteHostNullJavaScript(
		proposed, contracts, reference));
});
