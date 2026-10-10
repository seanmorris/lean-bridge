/**
 * Validate original installed package records and reject incomplete or substituted CI evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { assertReviewedSubtypeCFamilyRecords } from "./reviewed-subtype-c-family-report.mjs";
import { assertReviewedSubtypeNpmRecords } from "./reviewed-subtype-npm-report.mjs";
import { assertReviewedSubtypePackageTap, parseReviewedSubtypePackageArgs } from "./reviewed-subtype-package-ci-common.mjs";
import { reviewedSubtypePackageTestNames } from "./reviewed-subtype-package-fixture.mjs";
import "./reviewed-subtype-package-ci-shell-tests.mjs";
import "./reviewed-subtype-package-ci-workflow-tests.mjs";
import "./reviewed-subtype-package-ci-history-tests.mjs";

const root = "docs/evidence/reviewed-subtype-package-runs-20261010";
const checkers = { "c-cpp": assertReviewedSubtypeCFamilyRecords, npm: assertReviewedSubtypeNpmRecords };
const args = lane => ["--lane", lane, "--directory", join(root, lane), "--tap", join(root, lane, "run.tap")];
const input = async lane => {
	const directory = join(root, lane), records = new Map();
	for(const path of await readdir(directory, { recursive: true, withFileTypes: true }))
	{
		if(!path.isFile()) continue;
		const name = join(path.parentPath, path.name).slice(directory.length + 1);
		records.set(name, await readFile(join(directory, name)));
	}
	return records;
};
const read = records => async path => { assert.ok(records.has(path), "Missing original " + path); return records.get(path); };
const alter = (original, path, mutate) => {
	const records = new Map(original), value = JSON.parse(records.get(path)); mutate(value);
	records.set(path, Buffer.from(canonicalJson(value))); return records;
};

test("reviewed package acceptance archive authenticates every original and records the controller error", async () => {
	const bytes = await readFile(join(root, "index.json")), index = JSON.parse(bytes);
	assert.equal(sha256(bytes), "63b7b9a064f2d1fd3260882bbf09967b67de5f0b4ee6448bee19b96f4f79c30a");
	assert.equal(index.artifacts.length, 66); assert.equal(index.sources.length, 19);
	for(const artifact of index.artifacts)
	{
		const original = await readFile(join(root, artifact.path));
		assert.equal(original.length, artifact.bytes); assert.equal(sha256(original), artifact.sha256);
		assert.notEqual(sha256(Buffer.concat([original, Buffer.from("changed")])), artifact.sha256);
	}
	for(const source of index.sources)
	{
		assert.equal(source.revision, "5b3f2efaeba2ea8257a6e62b0c6c3722a7713601");
		assert.equal(sha256(await readFile(join(root, source.archive))), source.sha256);
	}
	assert.deepEqual(index.runs.map(run => run.lane), ["c-cpp", "npm"]);
	for(const run of index.runs)
	{
		const start = JSON.parse(await readFile(join(root, run.lane, "run.start.json")));
		const end = JSON.parse(await readFile(join(root, run.lane, "run.end.json")));
		assert.equal(start.revision, run.revision); assert.equal(end.code, 0); assert.equal(end.signal, null);
		assert.equal(start.runnerSha256, sha256(await readFile(join(root, run.runner))));
		assert.equal(end.tapSha256, sha256(await readFile(join(root, run.lane, "run.tap"))));
	}
	assert.match(index.runs[0].controllerPostcheck, /^failed: expected four caller rows/u);
	assert.equal(index.runs[1].controllerPostcheck, "passed");
	assert.equal(index.scope.packageBinariesRetained, false); assert.equal(index.scope.relocatedReplay, false);
});

test("reviewed package CI checker accepts both original installed runs through the CLI", async () => {
	for(const lane of ["c-cpp", "npm"])
	{
		const records = await input(lane);
		assertReviewedSubtypePackageTap(lane, records.get("run.tap").toString());
		const report = await checkers[lane](read(records));
		const actual = spawnSync(process.execPath, ["scripts/check-reviewed-subtype-package-reports.mjs", ...args(lane)], { encoding: "utf8" });
		assert.equal(actual.status, 0, actual.stderr);
		for(const row of lane === "c-cpp" ? report.reports : [report]) assert.ok(actual.stdout.includes(`${row.profile} ${row.checks} checks`));
	}
});

test("reviewed package CI TAP rejects skipped, substituted, failed and duplicated execution", async () => {
	for(const lane of ["c-cpp", "npm"])
	{
		const source = await readFile(join(root, lane, "run.tap"), "utf8"), name = reviewedSubtypePackageTestNames[lane];
		for(const changed of ["", source + source
			, source.replace("ok 1 -", "not ok 1 -")
			, source.replaceAll(name, "source-only fixture check")
			, source.replace(/^ok 1.*\n/mu, "")
			, source.replace(/^ok 1.*$/mu, value => value + " # SKIP")
			, source.replace(/^ok 1.*$/mu, value => value + " # TODO")
			, source.replace("# pass 1", "# pass 0")
			, source.replace("# tests 1", "# tests 0")
			, source.replace("# skipped 0", "# skipped 1")
			, source.replace("# cancelled 0", "# cancelled 1")
			, source.replace("# fail 0", "# fail 1")
			, source.replace("# fail 0", "# fail 0\n# fail 0")
			, source.replace("1..1", "1..0"), source + "1..2\n", source + "Bail out!\n"])
			assert.throws(() => assertReviewedSubtypePackageTap(lane, changed));
		assert.throws(() => assertReviewedSubtypePackageTap(lane === "npm" ? "c-cpp" : "npm", source));
	}
});

test("reviewed package CI selection rejects ambiguous or unknown options before reading records", () => {
	assert.equal(parseReviewedSubtypePackageArgs(args("c-cpp")).lane, "c-cpp");
	for(const changed of [[], args("unknown"), args("npm,npm")
		, args("npm").slice(0, -1), [...args("npm"), "--tap", "another"]
		, args("npm").map(value => value === "--tap" ? "--directory" : value)
		, args("npm").map(value => value === "npm" ? "" : value)
		, args("npm").map(value => value === "--tap" ? "--unknown" : value)])
		assert.throws(() => parseReviewedSubtypePackageArgs(changed));
	const actual = spawnSync(process.execPath, ["scripts/check-reviewed-subtype-package-reports.mjs", ...args("unknown")], { encoding: "utf8" });
	assert.equal(actual.status, 1); assert.match(actual.stderr, /Usage:/u); assert.doesNotMatch(actual.stderr, /ENOENT/u);
});

test("reviewed package CI requires every original record and all installation guarantees", async () => {
	for(const lane of ["c-cpp", "npm"])
	{
		const original = await input(lane), check = checkers[lane];
		for(const path of original.keys())
		{
			if(path.startsWith("run.")) continue;
			const missing = new Map(original); missing.delete(path);
			await assert.rejects(() => check(read(missing)), path);
		}
		for(const mutate of [report => { report.reproducible = false; }
			, report => { report.extra = true; }
			, report => { (report.reports?.[0] ?? report).checks = 1; }
			, report => { (report.reports?.[0] ?? report).sourceRemovedBeforeInstallation = false; }
			, report => { (report.reports?.[0] ?? report).offlineInstall = false; }
			, report => { (report.reports?.[0] ?? report).compilerFreePath = false; }
			, report => { (report.reports?.[0] ?? report).dispatch = "measured"; }
			, report => { (report.reports?.[0] ?? report).consumerSha256 = "0".repeat(64); }])
			await assert.rejects(() => check(read(alter(original, "report.json", mutate))));
		for(const path of ["build-0/Subtypes.lean", lane === "npm" ? "index.d.ts" : "consumer.c"])
		{
			const changed = new Map(original); changed.set(path, Buffer.from("changed source\n"));
			await assert.rejects(() => check(read(changed)), path);
		}
		for(const path of ["build-0/review.json", "build-1/lean-bridge.exports.json"])
			await assert.rejects(() => check(read(alter(original, path, value => { value.changed = true; }))));
	}
});

test("reviewed C-family records reject model substitution even with updated report digests", async () => {
	const original = await input("c-cpp");
	for(const mutate of [model => { model.pointerBits = 32; }
		, model => { model.exports[0].refinements.parameters[0].constructor = "Subtypes.normalizedEven"; }
		, model => { model.exports[0].symbol = "lb_" + "0".repeat(24); }
		, model => { model.exports[0].parameters[0].type.name = "nat"; }
		, model => { model.sourceIdentity.request.contracts = {}; }]) {
		let changed = new Map(original);
		for(const index of [0, 1]) changed = alter(changed, `build-${index}/model.json`, mutate);
		changed = alter(changed, "report.json", report => {
			for(const item of report.reports) item.modelSha256 = sha256(changed.get("build-0/model.json"));
		});
		await assert.rejects(() => assertReviewedSubtypeCFamilyRecords(read(changed)));
		}
});

test("reviewed npm records reject weakened TypeScript, build identity and adapter contracts", async () => {
	const original = await input("npm");
	for(const mutate of [report => { report.typescript.strict = false; }
		, report => { report.typescript.skipLibCheck = true; }
		, report => { report.independentBuilds = 1; }
		, report => { report.rejections = 0; }
		, report => { report.bindingIrFileSha256 = "0".repeat(64); }])
		await assert.rejects(() => assertReviewedSubtypeNpmRecords(read(alter(original, "report.json", mutate))));
	for(const [path, mutate] of [
		["component-build-plan.json", plan => { plan.source.inputs = []; }]
		, ["compiler-adapters.json", plan => { plan.privateAbi.version = 1; }]
		, ["provenance.json", value => { value.sourceTreeSha256 = "0".repeat(64); }]
		, ["component-release-bundle.json", value => { value.files.pop(); }]
		, ["component-package-receipt.json", value => { value.runtime.sha256 = "0".repeat(64); }]])
		await assert.rejects(() => assertReviewedSubtypeNpmRecords(read(alter(original, "build-1/" + path, mutate))));
});
