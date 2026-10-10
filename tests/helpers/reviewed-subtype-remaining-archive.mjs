/**
 * Authenticate original installed Subtype runs without consulting historical absolute paths.
 * The archive preserves failed tool selection separately from successful installed acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import { assertReviewedSubtypeRemainingHostRecords } from "./reviewed-subtype-remaining-host-report.mjs";

export const reviewedSubtypeRemainingRoot = "docs/evidence/reviewed-subtype-remaining-hosts-20261010";
export const reviewedSubtypeRemainingIndexSha256 = "5725f388c44e7650ccae5acae5227a46bc4fcf06307d1d64c2a62224f6a40081";
const firstRevision = "033dc351633fb87f3cef2e072114c05c0c95a028";
const nextRevision = "a0f0ca4f390369a74477588dd96845a3d0f69f57";
const perlRevision = "135617ad60aebf10ecb12cb1589d521d8a5e24ef";

/**
 * Check every original byte and the reproduced, installed, relocated host observations.
 *
 * @param read - Optional byte reader for corruption controls.
 */
export const readReviewedSubtypeRemainingArchive = async (read = readFile) => {
	const indexBytes = await read(`${reviewedSubtypeRemainingRoot}/index.json`);
	assert.equal(sha256(indexBytes), reviewedSubtypeRemainingIndexSha256);
	const index = JSON.parse(indexBytes), files = new Map();
	assert.equal(index.schemaVersion, 1);
	assert.deepEqual(index.scope, { sourcePath: "reviewed-source"
		, glibcFloor: "2.36", dispatch: "not measured"
		, packageBinariesRetained: false, completeToolchainClosure: false });
	assert.equal(index.artifacts.length, 243); assert.equal(index.sources.length, 78);
	for(const artifact of index.artifacts)
	{
		assert.match(artifact.path, /^(?:[A-Za-z0-9_.-]+\/)*[A-Za-z0-9_.-]+$/u);
		assert.ok(artifact.path.split("/").every(part => part !== "." && part !== ".."));
		assert.equal(files.has(artifact.path), false);
		const bytes = await read(`${reviewedSubtypeRemainingRoot}/${artifact.path}`);
		assert.equal(bytes.length, artifact.bytes, artifact.path);
		assert.equal(sha256(bytes), artifact.sha256, artifact.path); files.set(artifact.path, bytes);
	}
	for(const source of index.sources)
	{
		assert.ok([firstRevision, nextRevision, perlRevision].includes(source.revision));
		assert.equal(sha256(files.get(source.archive)), source.sha256);
	}
	const perls = ["5.36.3-threaded", "5.36.3-unthreaded", "5.38.2-threaded", "5.38.2-unthreaded"];
	const expected = [["rust", "rust", firstRevision, 1]
		, ["dotnet", "dotnet", firstRevision, 1]
		, ["php-native", "php-native", firstRevision, 2]
		, ["wit-wasi", "wit-wasi", nextRevision, 1]
		, ...perls.map(abi => ["perl-" + abi, "perl", perlRevision, 3])];
	assert.deepEqual(index.runs, expected.map(([group, profile, revision, version]) => ({ group, profile, revision, runner: `runner-v${version}.mjs.txt` })));
	const reports = [];
	for(const { group, profile, revision, runner } of index.runs)
	{
		const report = await assertReviewedSubtypeRemainingHostRecords({ profiles: [profile], read: path => files.get(`${group}/${path}`) });
		const start = JSON.parse(files.get(`${group}/run.start.json`)), end = JSON.parse(files.get(`${group}/run.end.json`));
		assert.equal(start.revision, revision);
		assert.equal(start.environment.LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR, "2.36");
		assert.equal(start.environment.LEAN_BRIDGE_REVIEWED_SUBTYPE_HOSTS, profile);
		assert.equal(end.code, 0); assert.equal(end.signal, null); assert.equal(end.stoppedForDisk, false);
		assert.ok(start.initialFreeMiB >= 2048); assert.ok(end.minimumFreeMiB >= 768);
		assert.equal(end.tapSha256, sha256(files.get(`${group}/run.tap`)));
		assert.equal(start.runnerSha256, sha256(files.get(runner)));
		const finished = JSON.parse(files.get(`${group}/run.finished.json`));
		assert.equal(finished.revision, revision);
		assert.equal(finished.reportSha256, sha256(files.get(`${group}/report.json`)));
		for(const [name, count] of [["tests", 1], ["pass", 1], ["fail", 0], ["skipped", 0]])
			assert.match(files.get(`${group}/run.tap`).toString(), new RegExp(`^# ${name} ${count}$`, "mu"));
		if(profile === "php-native") assert.equal(start.environment.LEAN_BRIDGE_PHP, "/usr/bin/php");
		if(profile === "perl")
		{
			const abi = group.slice(5), observation = report.reports[0];
			assert.equal(start.environment.LEAN_BRIDGE_CORPUS_PERL, `/app/.toolchains/perl/${abi}/bin/perl`);
			assert.equal(start.environment.LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR, "2.36");
			assert.equal(observation.perl.version, abi.split("-")[0]);
			assert.equal(observation.perl.useithreads, abi.endsWith("-unthreaded") ? null : "define");
		}
		reports.push(report);
	}
	const failedStart = JSON.parse(files.get("php-failed/run.start.json")), failedEnd = JSON.parse(files.get("php-failed/run.end.json"));
	assert.equal(failedStart.revision, firstRevision);
	assert.equal(failedStart.runnerSha256, sha256(files.get("runner-v2.mjs.txt")));
	assert.equal(failedEnd.code, 1); assert.equal(failedEnd.signal, null); assert.equal(failedEnd.stoppedForDisk, false);
	assert.equal(failedEnd.tapSha256, sha256(files.get("php-failed/run.tap")));
	assert.match(files.get("php-failed/run.tap").toString(), /ENOENT: no such file or directory, realpath '[^'\n]+\/ctype\.so'/u);
	for(const [name, count] of [["tests", 1], ["pass", 0], ["fail", 1], ["skipped", 0]])
		assert.match(files.get("php-failed/run.tap").toString(), new RegExp(`^# ${name} ${count}$`, "mu"));
	for(const attempt of [0, 1]) for(const path of ["Subtypes.lean", "lean-bridge.exports.json", "model.json", "package-set-receipt.json", "review.json"])
		assert.equal(sha256(files.get(`php-failed/build-${attempt}/${path}`)), sha256(files.get(`php-native/build-${attempt}/${path}`)), `PHP tool selection preserves ${path}`);
	const perlStart = JSON.parse(files.get("perl-failed/run.start.json")), perlEnd = JSON.parse(files.get("perl-failed/run.end.json"));
	assert.equal(perlStart.revision, nextRevision);
	assert.equal(perlStart.runnerSha256, sha256(files.get("runner-v1.mjs.txt")));
	assert.equal(perlEnd.code, 1); assert.equal(perlEnd.signal, null); assert.equal(perlEnd.stoppedForDisk, false);
	assert.equal(perlEnd.tapSha256, sha256(files.get("perl-failed/run.tap")));
	assert.match(files.get("perl-failed/run.tap").toString(), /Package requires glibc 2\.38 or later/u);
	const countStart = JSON.parse(files.get("perl-count-failed/run.start.json"));
	const countEnd = JSON.parse(files.get("perl-count-failed/run.end.json"));
	assert.equal(countStart.revision, "666dbf04b1d8f90f72a6ba1f4a297f9e6e49ed1e");
	assert.equal(countStart.runnerSha256, sha256(files.get("runner-v3.mjs.txt")));
	assert.equal(countEnd.code, 1); assert.equal(countEnd.signal, null); assert.equal(countEnd.stoppedForDisk, false);
	assert.equal(countEnd.tapSha256, sha256(files.get("perl-count-failed/run.tap")));
	assert.match(files.get("perl-count-failed/run.tap").toString(), /2025 !== 2024/u);
	assert.match(files.get("perl-count-failed/archived-perl-xs.txt").toString(), /"value0 was rejected by Subtypes\.checkedWord"/u);
	for(const [name, count] of [["tests", 1], ["pass", 0], ["fail", 1], ["skipped", 0]])
		assert.match(files.get("perl-failed/run.tap").toString(), new RegExp(`^# ${name} ${count}$`, "mu"));
	return { index, files, reports };
};
