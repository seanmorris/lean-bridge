/**
 * Check archive paths, dated identities and serial replay without large inputs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	checkedRecordValueIndexHostedSafeZipPath
} from "./checked-record-value-index-hosted-archive.mjs";
import { genericSubtypeHostedSafePath } from "./generic-subtype-hosted-output.mjs";
import {
	genericSubtypeHostedContracts, genericSubtypeHostedLaneNames
} from "./generic-subtype-hosted-contracts.mjs";
import {
	genericSubtypePromotionReferences, genericSubtypePromotionRoots
	, renderGenericSubtypePromotion
} from "./generic-subtype-promotion.mjs";

test("generic archive paths accept only the literal NuGet metadata basename", () => {
	for(const path of ["[Content_Types].xml", "package/[Content_Types].xml"
		, "records/ordinary/full/package/[Content_Types].xml"
		, "package/_rels/.rels", "ordinary/report.json"]) {
		assert.equal(checkedRecordValueIndexHostedSafeZipPath(path), true, path);
		assert.equal(genericSubtypeHostedSafePath(path), path);
		}
	assert.equal(checkedRecordValueIndexHostedSafeZipPath("package/"), true);
	assert.throws(() => genericSubtypeHostedSafePath("package/"));
});

test("generic archive paths retain traversal and nonliteral-name refusals", () => {
	for(const path of ["", ".", "..", "/[Content_Types].xml"
		, "../[Content_Types].xml", "package/../[Content_Types].xml"
		, "package/./[Content_Types].xml", "package//[Content_Types].xml"
		, "package\\[Content_Types].xml", "C:/package/[Content_Types].xml"
		, "[Content_Types].xml/", "[Content_Types].xml/file.json"
		, "package/[Content_Types].xml/", "package/[Content_Types].xml/file.json"
		, "package/[Content_Types].xml.bak", "package/[content_types].xml"
		, "package/[Other].xml", "package/Content_Types.xml[0]"
		, "package/[Content_Types]*.xml", "package/%2e%2e/[Content_Types].xml"
		, "package/[Content_Types].xml\n", "package/[Content_Types].xml\0"
		, "package/ [Content_Types].xml", "package/[Content_Types].xml;true"]) {
		assert.equal(checkedRecordValueIndexHostedSafeZipPath(path), false, path);
		assert.throws(() => genericSubtypeHostedSafePath(path), undefined, path);
		}
});

test("generic archive promotion selects twelve exact dated roots", () => {
	assert.equal(Object.isFrozen(genericSubtypePromotionRoots), true);
	assert.deepEqual(Object.keys(genericSubtypePromotionRoots)
		, genericSubtypeHostedLaneNames);
	assert.equal(new Set(Object.values(genericSubtypePromotionRoots)).size, 12);
	const managed = new Set(["dotnet", "jvm", "php-native", "wit-wasi"]);
	for(const lane of genericSubtypeHostedLaneNames)
		assert.equal(genericSubtypePromotionRoots[lane]
			, `docs/evidence/generic-subtype-${lane}-hosted-${managed.has(lane)
				? "20261024" : "20261023"}`);
});

const fixture = lane => {
	const contract = genericSubtypeHostedContracts[lane];
	return {
		lane, profiles: [...contract.profiles], routes: [...contract.routes]
		, accepted: { profiles: [...contract.profiles], routes: [...contract.routes] }
		, producerCommit: "1".repeat(40)
		, files: [{ path: "report.json", sha256: "2".repeat(64) }]
		, hostedRun: { runId: 1, job: { id: 2 }
			, artifact: { id: 3
				, parts: [{ path: "artifact.zip.parts/0000.part", sha256: "3".repeat(64) }] } }
		, limitations: ["Synthetic metadata for orchestration tests only."]
	};
};
const read = async path => Buffer.from(`Synthetic bytes for ${path}.`);

test("generic archive promotion replays one lane at a time in closed order", async () => {
	let active = 0, maximum = 0;
	const visited = [];
	const references = await genericSubtypePromotionReferences(async (lane, root) => {
		assert.equal(root, genericSubtypePromotionRoots[lane]);
		visited.push(lane);
		active++;
		maximum = Math.max(maximum, active);
		await new Promise(resolve => setImmediate(resolve));
		active--;
		return fixture(lane);
	}, read);
	assert.equal(active, 0);
	assert.equal(maximum, 1);
	assert.deepEqual(visited, genericSubtypeHostedLaneNames);
	assert.deepEqual(references.map(reference => reference.lane), visited);
	for(const reference of references)
		assert.equal(reference.files[0].path
			, `${genericSubtypePromotionRoots[reference.lane]}/index.json`);
	const rendered = renderGenericSubtypePromotion(references);
	for(const root of Object.values(genericSubtypePromotionRoots))
		assert.ok(rendered.includes(`[archive index](${root
			.slice("docs/evidence/".length)}/index.json)`));
});

test("generic archive promotion stops at the first failed replay", async () => {
	const visited = [], failure = new Error("Missing retained evidence");
	await assert.rejects(genericSubtypePromotionReferences(async lane => {
		visited.push(lane);
		if(lane === "dotnet") throw failure;
		return fixture(lane);
	}, read), error => error === failure);
	assert.deepEqual(visited, genericSubtypeHostedLaneNames.slice(0, 9));
});

test("generic archive promotion rejects substituted lane and route identities", async () => {
	for(const mutate of [
		index => { index.lane = "php-native"; }
		, index => { index.profiles = ["php-wasm"]; }
		, index => { index.routes = ["reviewed"]; }
		, index => { index.accepted.profiles = ["php-wasm"]; }
		, index => { index.accepted.routes = ["reviewed"]; }
	]) {
		const visited = [];
		await assert.rejects(genericSubtypePromotionReferences(async lane => {
			visited.push(lane);
			const index = fixture(lane);
			mutate(index);
			return index;
		}, read), assert.AssertionError);
		assert.deepEqual(visited, ["npm-ordinary"]);
	}
});

test("generic archive availability uses the same closed root table", async () => {
	const source = await readFile("tests/helpers/generic-subtype-promotion-tests.mjs", "utf8");
	assert.match(source, /existsSync\(`\$\{genericSubtypePromotionRoots\[lane\]\}\/index\.json`\)/u);
	assert.doesNotMatch(source, /generic-subtype-\$\{lane\}-hosted-20261023/u);
});
