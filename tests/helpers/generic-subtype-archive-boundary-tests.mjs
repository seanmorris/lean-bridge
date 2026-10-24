/**
 * Check archive paths, dated identities and serial replay without large inputs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	checkedRecordValueIndexHostedSafeZipPath
} from "./checked-record-value-index-hosted-archive.mjs";
import { genericSubtypeHostedSafePath } from "./generic-subtype-hosted-output.mjs";
import {
	genericSubtypeHostedContracts, genericSubtypeHostedLaneNames
} from "./generic-subtype-hosted-contracts.mjs";
import {
	genericSubtypePromotionReferences, genericSubtypePromotionRoots
	, genericSubtypePromotionArchiveReferences, renderGenericSubtypePromotion
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
	const apiRecords = Object.fromEntries(["run", "job", "artifact"].map(
		name => [name, { bytes: 10, sha256: sha256(`Synthetic ${name}`) }]
	));
	const part = { path: "hosted/artifact.zip.parts/0000.part"
		, bytes: 20, offset: 0, sha256: "3".repeat(64) };
	return {
		lane, profiles: [...contract.profiles], routes: [...contract.routes]
		, accepted: { profiles: [...contract.profiles], routes: [...contract.routes] }
		, producerCommit: "1".repeat(40)
		, files: [{ path: "report.json", bytes: 10, sha256: "2".repeat(64) }
			, ...Object.entries(apiRecords).map(([name, record]) => ({
				path: `hosted/api/${name}.json`, ...record
			}))
			, { path: part.path, bytes: part.bytes, sha256: part.sha256 }]
		, hostedRun: { runId: 1, job: { id: 2 }, apiRecords
			, artifact: { id: 3, bytes: part.bytes, parts: [part] } }
		, limitations: ["Synthetic metadata for orchestration tests only."]
	};
};
const read = async path => {
	const lane = genericSubtypeHostedLaneNames.find(name =>
		path === `${genericSubtypePromotionRoots[name]}/index.json`);
	return Buffer.from(lane ? canonicalJson(fixture(lane))
		: `Synthetic bytes for ${path}.`);
};

test("generic archive promotion binds a compact complete-manifest index", () => {
	const index = fixture("native"), root = genericSubtypePromotionRoots.native;
	for(let number = 0; number < 2_000; number++) index.files.push({
		path: `sources/producer/source-${number}.mjs`
		, bytes: 10, sha256: "4".repeat(64)
	});
	const bytes = Buffer.from(canonicalJson(index));
	const result = genericSubtypePromotionArchiveReferences(index, root, bytes);
	assert.equal(result.files.length, 5);
	assert.deepEqual(result.files[0]
		, { path: `${root}/index.json`, sha256: sha256(bytes) });
	assert.deepEqual(result.files.slice(1).map(file => file.path), [
		`${root}/hosted/api/artifact.json`, `${root}/hosted/api/job.json`
		, `${root}/hosted/api/run.json`
		, `${root}/hosted/artifact.zip.parts/0000.part`
	]);
	assert.deepEqual(result.artifacts, result.files.slice(-1));
	assert.ok(JSON.stringify(result).length < 1_500);
	assert.equal(index.files.length, 2_005);
});

test("generic archive promotion rejects substituted post-replay index bytes", async () => {
	const index = fixture("native"), root = genericSubtypePromotionRoots.native;
	const bytes = Buffer.from(canonicalJson(index));
	index.files[0].sha256 = "5".repeat(64);
	assert.throws(() => genericSubtypePromotionArchiveReferences(index, root, bytes)
		, /changed after replay/u);
	await assert.rejects(genericSubtypePromotionReferences(async lane => fixture(lane)
		, async path => path.endsWith("/index.json")
			? Buffer.from(canonicalJson(index)) : read(path)), /changed after replay/u);
});

test("generic archive compact references reject missing and forged manifest bindings", () => {
	const mutations = [
		index => { index.files.pop(); }
		, index => { index.files.push(index.files[0]); }
		, index => { index.files[0].path = "../escape"; }
		, index => { index.files[0].sha256 = "not-a-digest"; }
		, index => { index.files[0].bytes = -1; }
		, index => { index.files[0].path = "index.json"; }
		, index => { delete index.hostedRun.apiRecords.run; }
		, index => { index.hostedRun.apiRecords.extra = index.hostedRun.apiRecords.run; }
		, index => { index.hostedRun.apiRecords.run.sha256 = "6".repeat(64); }
		, index => { index.hostedRun.apiRecords.job.bytes++; }
		, index => { index.files = index.files.filter(file => file.path !== "hosted/api/job.json"); }
		, index => { index.hostedRun.artifact.parts = []; }
		, index => { index.hostedRun.artifact.parts.push(index.hostedRun.artifact.parts[0]); }
		, index => { index.hostedRun.artifact.parts[0].path = "../../escape"; }
		, index => { index.hostedRun.artifact.parts[0].sha256 = "7".repeat(64); }
		, index => { index.hostedRun.artifact.parts[0].bytes++; }
		, index => { index.hostedRun.artifact.parts[0].offset++; }
		, index => { index.hostedRun.artifact.bytes++; }
	];
	for(const mutate of mutations)
	{
		const index = fixture("native");
		mutate(index);
		assert.throws(() => genericSubtypePromotionArchiveReferences(index
			, genericSubtypePromotionRoots.native, Buffer.from(canonicalJson(index)))
		, assert.AssertionError, String(mutate));
	}
	const index = fixture("native");
	assert.throws(() => genericSubtypePromotionArchiveReferences(index
		, genericSubtypePromotionRoots.perl, Buffer.from(canonicalJson(index)))
	, assert.AssertionError);
});

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
