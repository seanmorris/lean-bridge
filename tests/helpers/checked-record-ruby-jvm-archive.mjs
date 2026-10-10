/**
 * Authenticate original checked-record Ruby/Java/Kotlin executions without reopening old paths.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import { assertCheckedRecordRubyJvmRecords } from "./checked-record-ruby-jvm-report.mjs";

export const checkedRecordRubyJvmRoot = "docs/evidence/checked-record-ruby-jvm-20261010";
export const checkedRecordRubyJvmIndexSha256 = "c35c6f25d21296610be8a4e9904deee893d7117a93a10e24b4bc3f288fabc1f5";
export const checkedRecordRubyJvmRevision = "71ef6f081bfab86e9556545250a44bb04c420604";
const profiles = ["java", "kotlin", "ruby"];
const routes = ["ordinary-source", "reviewed-ir", "result-only-ordinary-source", "result-only-reviewed-ir"];

/**
 * Check the immutable archive first, then independently validate each recorded route.
 *
 * @param read - Byte reader replaced only by archive-corruption controls.
 */
export const readCheckedRecordRubyJvmArchive = async (read = readFile) => {
	const indexBytes = await read(`${checkedRecordRubyJvmRoot}/index.json`);
	assert.equal(sha256(indexBytes), checkedRecordRubyJvmIndexSha256);
	const index = JSON.parse(indexBytes), files = new Map();
	assert.equal(index.schemaVersion, 1);
	assert.equal(index.revision, checkedRecordRubyJvmRevision);
	assert.equal(index.tree, "51c802ba68c930d8113dca07d301cae1ae25b33e");
	assert.deepEqual(index.scope, { profiles, routes, glibcFloor: "2.36"
		, dispatch: "not measured"
		, packageBinariesRetained: false, completeToolchainClosure: false });
	assert.equal(index.artifacts.length, 120);
	for(const artifact of index.artifacts)
	{
		assert.match(artifact.path, /^(?:[A-Za-z0-9_.-]+\/)*[A-Za-z0-9_.-]+$/u);
		assert.ok(artifact.path.split("/").every(part => part !== "." && part !== ".."));
		assert.equal(files.has(artifact.path), false);
		const bytes = await read(`${checkedRecordRubyJvmRoot}/${artifact.path}`);
		assert.equal(bytes.length, artifact.bytes, artifact.path);
		assert.equal(sha256(bytes), artifact.sha256, artifact.path);
		files.set(artifact.path, bytes);
	}
	assert.equal(index.sources.length, 29);
	assert.equal(new Set(index.sources.map(item => item.path)).size, 29);
	for(const source of index.sources)
	{
		assert.equal(source.revision, index.revision);
		assert.equal(source.archive, `sources/${source.path}.txt`);
		assert.equal(sha256(files.get(source.archive)), source.sha256);
	}
	assert.deepEqual(index.runs.map(run => [run.route, run.archive]), routes.map(route => [route, route]));
	const reports = [];
	for(const { archive, route } of index.runs)
	{
		const report = await assertCheckedRecordRubyJvmRecords({ profiles, route, read: path => files.get(`${archive}/${path}`) });
		const start = JSON.parse(files.get(`${archive}/run.start.json`)), end = JSON.parse(files.get(`${archive}/run.end.json`));
		assert.equal(start.revision, index.revision); assert.equal(start.tree, index.tree);
		assert.equal(start.route, route); assert.equal(start.runnerSha256, sha256(files.get("runner.mjs.txt")));
		assert.equal(start.command, "/usr/bin/taskset");
		assert.deepEqual(start.args, ["-c", "3", "/usr/bin/node", "--test", "--test-concurrency=1", "--test-reporter=tap", "tests/helpers/checked-record-native-installed-tests.mjs"]);
		assert.equal(start.environment.LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR, "2.36");
		assert.equal(start.environment.LEAN_BRIDGE_CHECKED_RECORD_NATIVE_HOSTS, "ruby,java,kotlin");
		assert.equal(start.environment.LEAN_BRIDGE_CHECKED_RECORD_NATIVE_ROUTES, route);
		assert.equal(start.environment.LEAN_BRIDGE_CHECKED_RECORD_NATIVE_OUTPUT, start.output);
		assert.equal(end.code, 0); assert.equal(end.signal, null); assert.equal(end.stoppedForDisk, false);
		assert.ok(start.initialFreeMiB >= 2048); assert.ok(end.minimumFreeMiB >= 768);
		assert.equal(end.tapSha256, sha256(files.get(`${archive}/run.tap`)));
		const finished = JSON.parse(files.get(`${archive}/run.finished.json`));
		assert.equal(finished.revision, index.revision); assert.equal(finished.output, start.output);
		assert.equal(finished.reportSha256, sha256(files.get(`${archive}/report.json`)));
		for(const [name, count] of [["tests", 1], ["pass", 1], ["fail", 0], ["skipped", 0]])
			assert.match(files.get(`${archive}/run.tap`).toString(), new RegExp(`^# ${name} ${count}$`, "mu"));
		reports.push(report);
	}
	return { index, files, reports };
};
