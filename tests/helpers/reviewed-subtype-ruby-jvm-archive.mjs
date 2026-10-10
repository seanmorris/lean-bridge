/**
 * Authenticate the frozen installed Ruby/Java/Kotlin reviewed Subtype observations.
 * Recorded producer paths remain provenance and are never opened by this reader.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import { assertReviewedSubtypeRubyJvmRecords } from "./reviewed-subtype-ruby-jvm-report.mjs";

export const reviewedSubtypeRubyJvmRoot = "docs/evidence/reviewed-subtype-ruby-jvm-hosts-20261010";
export const reviewedSubtypeRubyJvmIndexSha256 = "71bc6109a5a14d6d25530947bcd00f95ea9c053394b59038b204b0216ff9021f";

/**
 * Check every original record and all three complete installed host selections.
 *
 * @param read - Optional byte reader for archive-corruption controls.
 */
export const readReviewedSubtypeRubyJvmArchive = async (read = readFile) => {
	const indexBytes = await read(`${reviewedSubtypeRubyJvmRoot}/index.json`);
	assert.equal(sha256(indexBytes), reviewedSubtypeRubyJvmIndexSha256);
	const index = JSON.parse(indexBytes), files = new Map();
	assert.equal(index.schemaVersion, 1);
	assert.equal(index.revision, "274b8685d25caebb422ac4d31be09c2948fef84c");
	assert.deepEqual(index.scope, { profiles: ["ruby", "java", "kotlin"]
		, sourcePath: "reviewed-source", glibcFloor: "2.36"
		, dispatch: "not measured", packageBinariesRetained: false
		, completeToolchainClosure: false });
	assert.equal(index.artifacts.length, 53);
	for(const artifact of index.artifacts)
	{
		assert.match(artifact.path, /^(?:[A-Za-z0-9_.-]+\/)*[A-Za-z0-9_.-]+$/u);
		assert.ok(artifact.path.split("/").every(part => part !== "." && part !== ".."));
		assert.equal(files.has(artifact.path), false);
		const bytes = await read(`${reviewedSubtypeRubyJvmRoot}/${artifact.path}`);
		assert.equal(bytes.length, artifact.bytes, artifact.path);
		assert.equal(sha256(bytes), artifact.sha256, artifact.path);
		files.set(artifact.path, bytes);
	}
	assert.equal(index.sources.length, 19);
	for(const source of index.sources)
	{
		assert.equal(sha256(files.get(source.archive)), source.sha256);
		assert.equal(source.revision, index.revision);
	}
	const reports = [];
	for(const [group, profiles] of [["ruby", ["ruby"]], ["jvm", ["java", "kotlin"]]])
	{
		const report = await assertReviewedSubtypeRubyJvmRecords({ profiles, read: path => files.get(`${group}/${path}`) });
		const start = JSON.parse(files.get(`${group}/run.start.json`)), end = JSON.parse(files.get(`${group}/run.end.json`));
		assert.equal(start.revision, index.revision);
		assert.equal(start.environment.LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR, "2.36");
		assert.equal(start.environment.LEAN_BRIDGE_REVIEWED_SUBTYPE_HOSTS, profiles.join(","));
		assert.equal(end.code, 0); assert.equal(end.signal, null); assert.equal(end.stoppedForDisk, false);
		assert.ok(start.initialFreeMiB >= 2048); assert.ok(end.minimumFreeMiB >= 768);
		assert.equal(end.tapSha256, sha256(files.get(`${group}/run.tap`)));
		assert.equal(start.runnerSha256, sha256(files.get("runner.mjs.txt")));
		const finished = JSON.parse(files.get(`${group}/run.finished.json`));
		assert.equal(finished.revision, index.revision);
		assert.equal(finished.reportSha256, sha256(files.get(`${group}/report.json`)));
		for(const [name, count] of [["tests", 1], ["pass", 1], ["fail", 0], ["skipped", 0]])
			assert.match(files.get(`${group}/run.tap`).toString(), new RegExp(`^# ${name} ${count}$`, "mu"));
		reports.push(report);
	}
	return { index, files, reports };
};
