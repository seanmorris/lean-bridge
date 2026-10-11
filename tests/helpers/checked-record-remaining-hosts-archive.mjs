/**
 * Authenticate original checked-record Rust/.NET/native PHP/WIT executions without reopening old paths.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import { assertCheckedRecordRemainingHostRecords } from "./checked-record-remaining-host-report.mjs";

export const checkedRecordRemainingHostsRoot = "docs/evidence/checked-record-remaining-hosts-20261010";
export const checkedRecordRemainingHostsIndexSha256 = "787affd873d405b9ad25ba695cea970f203611b4ac1a0b9740a0514f4cec73eb";
export const checkedRecordRemainingHostsRevision = "c9d11f7ac8fd76d13bcc48f6f679eb22fd86b722";
const profiles = ["dotnet", "php-native", "rust", "wit-wasi"];
const routes = ["ordinary-source", "reviewed-ir", "result-only-ordinary-source", "result-only-reviewed-ir"];

/**
 * Check the immutable archive first, then independently validate each recorded route.
 *
 * @param read - Byte reader replaced only by archive-corruption controls.
 */
export const readCheckedRecordRemainingHostsArchive = async (read = readFile) => {
	const indexBytes = await read(`${checkedRecordRemainingHostsRoot}/index.json`);
	assert.equal(sha256(indexBytes), checkedRecordRemainingHostsIndexSha256);
	const index = JSON.parse(indexBytes), files = new Map();
	assert.equal(index.schemaVersion, 1);
	assert.equal(index.revision, checkedRecordRemainingHostsRevision);
	assert.equal(index.tree, "9a2b8568f2209ad570925447932ccfff21eb50d4");
	assert.deepEqual(index.scope, { profiles, routes, glibcFloor: "2.36"
		, dispatch: "not measured"
		, packageBinariesRetained: false, completeToolchainClosure: false });
	assert.equal(index.artifacts.length, 152);
	for(const artifact of index.artifacts)
	{
		assert.match(artifact.path, /^(?:[A-Za-z0-9_.-]+\/)*[A-Za-z0-9_.-]+$/u);
		assert.ok(artifact.path.split("/").every(part => part !== "." && part !== ".."));
		assert.equal(files.has(artifact.path), false);
		const bytes = await read(`${checkedRecordRemainingHostsRoot}/${artifact.path}`);
		assert.equal(bytes.length, artifact.bytes, artifact.path);
		assert.equal(sha256(bytes), artifact.sha256, artifact.path);
		files.set(artifact.path, bytes);
	}
	assert.equal(index.sources.length, 37);
	assert.equal(new Set(index.sources.map(item => item.path)).size, 37);
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
		const report = await assertCheckedRecordRemainingHostRecords({ profiles, route, read: path => files.get(`${archive}/${path}`) });
		const start = JSON.parse(files.get(`${archive}/run.start.json`)), end = JSON.parse(files.get(`${archive}/run.end.json`));
		assert.equal(start.revision, index.revision); assert.equal(start.tree, index.tree);
		assert.equal(start.route, route); assert.equal(start.runnerSha256, sha256(files.get("runner.mjs.txt")));
		assert.equal(start.command, "/usr/bin/taskset");
		assert.deepEqual(start.args, ["-c", "3", "/usr/bin/node", "--test", "--test-concurrency=1", "--test-reporter=tap", "tests/helpers/checked-record-native-installed-tests.mjs"]);
		assert.equal(start.environment.LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR, "2.36");
		assert.equal(start.environment.LEAN_BRIDGE_PHP, "/usr/bin/php");
		assert.equal(start.environment.LEAN_BRIDGE_CHECKED_RECORD_NATIVE_HOSTS, "dotnet,php-native,rust,wit-wasi");
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
	assert.deepEqual(index.failedAttempts, [{
		revision: "aed50e1a6e16da3856931cf035d70d673fd2cb95"
		, archive: "failed-php-tool"
		, route: "ordinary-source"
		, reason: "PHP tool selection missing ctype.so; no completed combined report"
	}]);
	const failed = path => files.get("failed-php-tool/" + path);
	const start = JSON.parse(failed("run.start.json")), end = JSON.parse(failed("run.end.json"));
	assert.equal(start.revision, index.failedAttempts[0].revision);
	assert.equal(start.tree, "c6dac38b0500ed768471d9f6293c5917ab537715");
	assert.equal(start.route, "ordinary-source");
	assert.equal(start.runnerSha256, sha256(files.get("runner.mjs.txt")));
	assert.equal(start.environment.LEAN_BRIDGE_PHP, "/app/.toolchains/php-8.5.10-ffi/bin/php");
	assert.equal(end.code, 1); assert.equal(end.signal, null); assert.equal(end.stoppedForDisk, false);
	assert.equal(end.tapSha256, sha256(failed("run.tap")));
	assert.equal(files.has("failed-php-tool/run.finished.json"), false);
	assert.equal(files.has("failed-php-tool/partial/report.json"), false);
	assert.match(failed("run.tap").toString(), /ENOENT[^\n]*ctype\.so/u);
	for(const [name, count] of [["tests", 1], ["pass", 0], ["fail", 1], ["skipped", 0]])
		assert.match(failed("run.tap").toString(), new RegExp("^# " + name + " " + count + "$", "mu"));
	return { index, files, reports };
};
