/**
 * Close only the 20 PHP HostNull cells backed by exact hosted references.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
	typeSurfaceCells, validateTypeSurface
} from "../../src/adoption/type-surface.mjs";
import {
	hostNullPhpPromotionCells, hostNullPhpPromotionPaths
	, hostNullPhpPromotionPositions, hostNullPhpPromotionProfiles
	, promoteHostNullPhp
} from "./host-null-php-promotion.mjs";
import {
	loadHostNullPrePromotionInventory
} from "./host-null-pre-promotion-inventory.mjs";

const load = loadHostNullPrePromotionInventory;
const reference = profile => Object.freeze({
	id: `hosted-host-null-${profile}-installed`, profile
	, revision: (profile === "php-native" ? "1" : "2").repeat(40)
	, command: `hosted ${profile} HostNull command`
	, scope: `hosted ${profile} HostNull scope`
	, files: Object.freeze([{
		path: `docs/evidence/host-null-${profile}-20261029/index.json`
		, sha256: "3".repeat(64)
	}])
	, artifacts: Object.freeze([{
		path: `host-null-${profile}.zip`, sha256: "4".repeat(64)
	}])
	, limitations: Object.freeze([`${profile} hosted limitation`])
});
const references = hostNullPhpPromotionProfiles.map(reference);

test("PHP HostNull promotion target is exactly two profiles, two paths and five positions", () => {
	assert.equal(hostNullPhpPromotionCells.length, 20);
	assert.equal(new Set(hostNullPhpPromotionCells).size, 20);
	assert.deepEqual(hostNullPhpPromotionProfiles
		, ["php-native", "php-wasm"]);
	assert.deepEqual(hostNullPhpPromotionPaths
		, ["ordinary-source", "reviewed-ir"]);
	assert.deepEqual(hostNullPhpPromotionPositions, [
		"parameter", "result", "field", "callback-parameter"
		, "callback-result"
	]);
});

test("PHP HostNull promotion changes exactly 20 unreviewed cells", async () => {
	const { document, contracts } = await load();
	const frozen = structuredClone(document);
	const beforeCells = typeSurfaceCells(document, contracts);
	const before = new Map(beforeCells.map(cell => [cell.id, cell]));
	const proposed = promoteHostNullPhp(document, contracts, references);
	assert.deepEqual(document, frozen);
	assert.equal(validateTypeSurface(proposed, contracts), true);
	assert.equal(proposed.evidence.length, document.evidence.length + 2);
	assert.equal(proposed.observations.length
		, document.observations.length + 4);
	const changed = typeSurfaceCells(proposed, contracts).filter(cell =>
		JSON.stringify(cell) !== JSON.stringify(before.get(cell.id)));
	assert.deepEqual(changed.map(cell => cell.id).sort()
		, [...hostNullPhpPromotionCells].sort());
	for(const cell of changed)
	{
		assert.equal(before.get(cell.id).stages.installedExecution.state
			, "unreviewed", cell.id);
		assert.match(cell.conversionNote
			, /HostNull \(Option T\).*Option \(HostNull T\)/u);
	}
	assert.equal(typeSurfaceCells(proposed, contracts).find(cell =>
		cell.id === "node-javascript/host-null/ordinary-source/parameter")
		.stages.installedExecution.state, "unreviewed");
});

test("PHP HostNull promotion rejects incomplete, forged and overlapping references", async () => {
	const { document, contracts } = await load();
	assert.throws(() => promoteHostNullPhp(
		document, contracts, references.slice(1)));
	assert.throws(() => promoteHostNullPhp(document, contracts, [
		{ ...references[0], id: "forged" }, references[1]
	]));
	const proposed = promoteHostNullPhp(document, contracts, references);
	assert.throws(() => promoteHostNullPhp(
		proposed, contracts, references), /Already promoted/u);
});
