/**
 * Refusal and scheduling controls for the exact hosted promotion catalog.
 * Synthetic indices below test metadata only, never installed acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import {
	collectCoreContractTestPaths, coreContractShardLabels, coreContractShardManifest
	, verifyCoreContractShardManifests
} from "../scripts/core-contract-shards.mjs";
import {
	assertOwnedSubtypePromotionIndex, mapOwnedSubtypePromotionLanes
	, ownedSubtypePromotionArchiveRoot, ownedSubtypePromotionArchives
	, ownedSubtypePromotionEvidenceId, ownedSubtypePromotionLanes
	, ownedSubtypePromotionReplayArgs, ownedSubtypePromotionReplayCommand
} from "./helpers/owned-subtype-promotion-catalog.mjs";
import {
	ownedSubtypeJavaScriptPromotionReference, renderOwnedSubtypePromotion
} from "./helpers/owned-subtype-promotion.mjs";

const fixture = item => ({
	kind: `owned-subtype-${item.lane}-hosted-v1`, lane: item.lane
	, profiles: [...item.profiles], producerCommit: item.producer
	, hostedRun: { runId: item.run, job: { id: item.job }
		, createdAt: `${item.date.slice(0, 4)}-${item.date.slice(4, 6)}-${item.date.slice(6)}T00:00:00Z` }
	, accepted: {
		kind: "owned-subtype-hosted-replay", lane: item.lane
		, profiles: [...item.profiles], producerCommit: item.producer
		, ...item.lane === "javascript" ? { tests: 12 } : {}
		, accepted: item.lane === "javascript"
			? { schemaVersion: 2, profile: "installed-owned-subtype-javascript"
				, routes: ["ordinary", "reviewed"].map(route => ({
					route, archives: 2, archiveBytes: 1, browserExecutions: 12
				}))
			}
			: { routes: ["ordinary", "reviewed"] }
	}
});

test("owned Subtype live catalog binds eight hosted lanes and sixteen profiles", () => {
	assert.deepEqual(ownedSubtypePromotionArchives.map(item => [item.lane, item.date]), [
		["javascript", "20261025"], ["native", "20261023"], ["perl", "20261023"]
		, ["languages", "20261023"], ["dotnet", "20261024"], ["jvm", "20261024"]
		, ["php-native", "20261024"], ["wit-wasi", "20261024"]
	]);
	const profiles = ownedSubtypePromotionLanes.flatMap(item => item.profiles);
	assert.equal(profiles.length, 16);
	assert.equal(new Set(profiles).size, 16);
	assert.ok(!profiles.includes("php-wasm"));
	for(const item of ownedSubtypePromotionArchives)
	{
		assert.equal(ownedSubtypePromotionArchiveRoot(item.lane)
			, `docs/evidence/owned-subtype-${item.lane}-hosted-${item.date}`);
		assert.equal(ownedSubtypePromotionEvidenceId(item.lane)
			, `owned-subtype-${item.lane}-hosted-installed`);
		assert.equal(Object.isFrozen(item), true);
		assert.equal(Object.isFrozen(item.profiles), true);
	}
	for(const unknown of ["php-wasm", "__proto__", "../native", "", null])
		for(const action of [ownedSubtypePromotionArchiveRoot
			, ownedSubtypePromotionEvidenceId, ownedSubtypePromotionReplayArgs])
			assert.throws(() => action(unknown));
});

test("owned Subtype promotion rejects altered producer identities and coverage", () => {
	for(const item of ownedSubtypePromotionArchives)
	{
		assert.doesNotThrow(() => assertOwnedSubtypePromotionIndex(item.lane, fixture(item)));
		for(const mutate of [
			index => { index.kind = "local-qualification"; }
			, index => { index.lane = "different"; }
			, index => { index.profiles.push("php-wasm"); }
			, index => { index.producerCommit = "0".repeat(40); }
			, index => { index.hostedRun.runId++; }
			, index => { index.hostedRun.job.id++; }
			, index => { index.hostedRun.createdAt = "2000-01-01T00:00:00Z"; }
			, index => { index.accepted.kind = "local-qualification"; }
			, index => { index.accepted.lane = "different"; }
			, index => { index.accepted.profiles = ["php-wasm"]; }
			, index => { index.accepted.producerCommit = "0".repeat(40); }
			, index => { index.accepted.accepted.routes.pop(); }
			, index => { index.accepted.accepted.routes[1] = index.accepted.accepted.routes[0]; }
		]) {
			const changed = fixture(item); mutate(changed);
			assert.throws(() => assertOwnedSubtypePromotionIndex(item.lane, changed));
		}
	}
});

test("owned Subtype hosted promotion controls appear exactly once in Core", async () => {
	const paths = await collectCoreContractTestPaths();
	const manifests = coreContractShardLabels.map(label => coreContractShardManifest(paths, label));
	const verified = verifyCoreContractShardManifests(paths, manifests);
	assert.equal(verified.contractFiles, paths.length);
	const path = "tests/owned-subtype-hosted-promotion.test.mjs";
	assert.ok(paths.includes(path));
	assert.equal(manifests.filter(manifest => manifest.selection.files.includes(path)).length, 1);
});

test("owned Subtype npm promotion requires complete hosted package and browser coverage", () => {
	const item = ownedSubtypePromotionArchives[0];
	for(const mutate of [
		index => { index.accepted.tests--; }
		, index => { index.accepted.accepted.schemaVersion = 1; }
		, index => { index.accepted.accepted.profile = "installed-owned-subtype-javascript-transfer"; }
		, index => { index.accepted.accepted.routes[0].archives = 1; }
		, index => { index.accepted.accepted.routes[0].archiveBytes = 0; }
		, index => { index.accepted.accepted.routes[0].browserExecutions = 9; }
	]) {
		const changed = fixture(item); mutate(changed);
		assert.throws(() => assertOwnedSubtypePromotionIndex("javascript", changed));
	}
});

test("owned Subtype replay runs serially and stops before later lanes after failure", async () => {
	let active = 0, peak = 0;
	const seen = [];
	const values = await mapOwnedSubtypePromotionLanes(async lane => {
		active++; peak = Math.max(peak, active); seen.push(lane);
		await new Promise(accept => setImmediate(accept));
		active--; return lane;
	});
	assert.equal(peak, 1);
	assert.equal(active, 0);
	assert.deepEqual(values, ownedSubtypePromotionLanes.map(item => item.lane));
	assert.deepEqual(seen, values);
	const failed = [];
	await assert.rejects(mapOwnedSubtypePromotionLanes(async lane => {
		failed.push(lane);
		if(lane === "native") throw new Error("invalid original archive");
		return lane;
	}), /invalid original archive/u);
	assert.deepEqual(failed, ["javascript", "native"]);
});

test("owned Subtype published replay commands fail on missing evidence instead of skipping", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-subtype-replay-required-"));
	t.after(() => rm(root, { recursive: true }));
	for(const { lane } of ownedSubtypePromotionLanes)
	{
		const args = ownedSubtypePromotionReplayArgs(lane);
		assert.equal(ownedSubtypePromotionReplayCommand(lane), `node ${args.join(" ")}`);
		assert.deepEqual(args, ["scripts/check-owned-subtype-hosted-evidence.mjs", "--lane", lane]);
		const child = spawnSync(process.execPath, ["--max-old-space-size=256", resolve(args[0]), ...args.slice(1)]
		, { cwd: root, encoding: "utf8", timeout: 20_000, maxBuffer: 1024 * 1024 });
		assert.notEqual(child.status, 0);
		assert.equal(child.stdout, "");
		assert.match(child.stderr, /ENOENT/u);
		assert.ok(child.stderr.includes(ownedSubtypePromotionArchiveRoot(lane)));
	}
	assert.deepEqual(await readdir(root), []);
	for(const args of [[], ["--lane", "php-wasm"], ["--lane", "native", "--skip"]])
	{
		const child = spawnSync(process.execPath, ["--max-old-space-size=256"
			, resolve("scripts/check-owned-subtype-hosted-evidence.mjs"), ...args]
		, { cwd: root, encoding: "utf8", timeout: 20_000, maxBuffer: 1024 * 1024 });
		assert.equal(child.status, 2);
		assert.match(child.stderr, /Usage:/u);
	}
});

test("owned Subtype live promotion cannot use the historical JavaScript qualification", async t => {
	const historical = await ownedSubtypeJavaScriptPromotionReference();
	assert.equal(historical.id, "owned-subtype-javascript-local-installed");
	assert.notEqual(historical.id, ownedSubtypePromotionEvidenceId("javascript"));
	const root = await mkdtemp(join(tmpdir(), "lean-subtype-no-local-fallback-"));
	t.after(() => rm(root, { recursive: true }));
	await mkdir(join(root, "docs/evidence"), { recursive: true });
	for(const suffix of ["acceptance-20261020.json", "source-history-20261020.json"])
	{
		const path = `docs/evidence/owned-subtype-javascript-transfer-${suffix}`;
		await cp(path, join(root, path));
	}
	const url = pathToFileURL(resolve("tests/helpers/owned-subtype-promotion.mjs")).href;
	const child = spawnSync(process.execPath, [
		"--max-old-space-size=256", "--input-type=module", "-e"
		, `import {ownedSubtypePromotionReferences as replay} from ${JSON.stringify(url)}; await replay();`]
	, { cwd: root, encoding: "utf8", timeout: 20_000, maxBuffer: 1024 * 1024 });
	assert.notEqual(child.status, 0);
	assert.equal(child.stdout, "");
	assert.match(child.stderr, /owned-subtype-javascript-hosted-20261025/u);
	const source = await readFile("tests/helpers/owned-subtype-promotion.mjs", "utf8");
	assert.match(source, /mapOwnedSubtypePromotionLanes\(hostedPromotionReference\)/u);
});

test("owned Subtype promotion documentation links every actual hosted archive date", () => {
	const references = ownedSubtypePromotionArchives.map(item => ({
		lane: item.lane, profiles: item.profiles, routes: ["ordinary", "reviewed"]
		, revision: item.producer
	}));
	const source = renderOwnedSubtypePromotion(references);
	for(const { lane } of references)
		assert.ok(source.includes(`${ownedSubtypePromotionArchiveRoot(lane).slice("docs/evidence/".length)}/index.json`));
	assert.doesNotMatch(source, /javascript-transfer-acceptance-20261020/u);
	assert.match(source, /exactly 32 existing cells/u);
});
