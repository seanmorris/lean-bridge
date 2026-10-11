/**
 * Authenticate original Perl checked-record runs without reopening their old paths.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import { assertCheckedRecordPerlCiRecords } from "./checked-record-perl-ci-report.mjs";
import { checkedRecordPerlRoutes } from "./checked-record-perl-fixture.mjs";
import { checkedRecordPerlConfigurations, checkedRecordPerlModes } from "./checked-record-perl-install.mjs";

export const checkedRecordPerlArchiveRoot = "docs/evidence/checked-record-perl-installed-20261011";
export const checkedRecordPerlArchiveDigest = "171f18d750b99629387f84ec49f284dc7136199256263157fecf274ce0c17c50";
const ordinaryRevision = "0f0baca890a48ae2a0e1170746a39c1e13f3c5f4";
const revision = "761ffefc9d3c5bdf8cadcc30018ed1c74584400a";
const trees = new Map([
	[ordinaryRevision, "987a336d5ecf683bce8c2e2108b56d7a8579f906"]
	, [revision, "2e339776aae5ab273cdce8167a128f16b37dce3e"]
]);

/**
 * Authenticate every immutable artifact before checking each independently recorded route.
 *
 * @param read - Byte reader, replaced only by missing/corrupted archive controls.
 */
export const readCheckedRecordPerlArchive = async (read = readFile) => {
	const bytes = await read(`${checkedRecordPerlArchiveRoot}/index.json`);
	assert.equal(sha256(bytes), checkedRecordPerlArchiveDigest);
	const index = JSON.parse(bytes), files = new Map();
	assert.equal(index.schemaVersion, 1); assert.equal(index.kind, "checked-record-perl-installed");
	assert.deepEqual(index.scope, {
		routes: checkedRecordPerlRoutes
		, configurations: checkedRecordPerlConfigurations
		, modes: checkedRecordPerlModes, glibcFloor: "2.36", dispatch: "not measured"
		, packageBinariesRetained: false, completeToolchainClosure: false
	});
	for(const artifact of index.artifacts)
	{
		assert.match(artifact.path, /^(?:[A-Za-z0-9_.:-]+\/)*[A-Za-z0-9_.:-]+$/u);
		assert.ok(artifact.path.split("/").every(part => part !== "." && part !== ".."));
		assert.equal(files.has(artifact.path), false);
		const original = await read(`${checkedRecordPerlArchiveRoot}/${artifact.path}`);
		assert.equal(original.length, artifact.bytes, artifact.path);
		assert.equal(sha256(original), artifact.sha256, artifact.path);
		files.set(artifact.path, original);
	}
	assert.equal(index.sources.length, 27);
	assert.equal(new Set(index.sources.map(source => source.path)).size, 27);
	for(const source of index.sources)
	{
		assert.deepEqual(source.revisions, [ordinaryRevision, revision]);
		assert.equal(source.archive, `sources/${source.path}.txt`);
		assert.equal(sha256(files.get(source.archive)), source.sha256);
	}
	assert.deepEqual(index.runs.map(run => run.route), checkedRecordPerlRoutes);
	const reports = [];
	for(const run of index.runs)
	{
		assert.equal(run.revision, run.route === "ordinary-source" ? ordinaryRevision : revision);
		assert.equal(run.tree, trees.get(run.revision));
		const get = path => files.get(`${run.route}/${path}`), json = path => JSON.parse(get(path));
		const tap = get("run.tap").toString();
		const report = await assertCheckedRecordPerlCiRecords({ route: run.route, tap, glibc: "2.36", read: get });
		const start = json("run.start.json"), end = json("run.end.json"), finished = json("run.finished.json");
		assert.equal(start.revision, run.revision); assert.equal(start.tree, run.tree);
		assert.equal(start.route, run.route); assert.equal(start.runnerSha256, sha256(files.get("runner.mjs.txt")));
		assert.equal(start.cwd, "/app"); assert.equal(start.command, "/usr/bin/taskset");
		assert.deepEqual(start.args, ["-c", "3", "/usr/bin/node", "--test", "--test-concurrency=1", "--test-reporter=tap", "tests/helpers/checked-record-perl-installed-tests.mjs"]);
		assert.equal(start.environment.LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR, "2.36");
		assert.equal(start.environment.LEAN_BRIDGE_CHECKED_RECORD_PERL_TEST, "1");
		assert.equal(start.environment.LEAN_BRIDGE_CHECKED_RECORD_PERL_ROUTES, run.route);
		assert.equal(start.environment.LEAN_BRIDGE_CHECKED_RECORD_PERL_OUTPUT, start.output);
		assert.deepEqual([end.code, end.signal, end.stoppedForDisk], [0, null, false]);
		assert.ok(start.initialFreeMiB >= 2048); assert.ok(end.minimumFreeMiB >= 768);
		assert.equal(end.tapSha256, sha256(get("run.tap"))); assert.equal(run.tapSha256, end.tapSha256);
		assert.equal(finished.revision, run.revision); assert.equal(finished.output, start.output);
		assert.equal(finished.reportSha256, sha256(get("report.json")));
		assert.equal(run.reportSha256, finished.reportSha256);
		assert.deepEqual(json("mutations.json"), {
			route: run.route, files: run.route.endsWith("reviewed-ir") ? 110 : 108
			, original: "accepted", mutationsRefused: 37
		});
		reports.push(report);
	}
	return { index, files, reports };
};
