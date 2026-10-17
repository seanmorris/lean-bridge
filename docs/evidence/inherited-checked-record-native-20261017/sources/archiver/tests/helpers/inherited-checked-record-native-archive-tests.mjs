/**
 * Tests for the immutable hosted inherited checked-record C/C++ acceptance archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	checkInheritedCheckedRecordNativeArchive, inheritedCheckedRecordNativeArchiveSha256
} from "./inherited-checked-record-native-archive.mjs";
import {
	inheritedCheckedRecordNativeArchiver, inheritedCheckedRecordNativeEvidence
	, inheritedCheckedRecordNativePinnedRevisions, inheritedCheckedRecordNativeProducer
} from "./inherited-checked-record-native-evidence.mjs";

const pinned = inheritedCheckedRecordNativeArchiveSha256 !== null;
const script = "scripts/archive-inherited-checked-record-native-evidence.mjs";

test("the inherited native archive fails closed until its index is pinned"
	, { skip: pinned && "Pinned archive is authenticated below" }, async () => {
	await assert.rejects(checkInheritedCheckedRecordNativeArchive(), /Pin the inherited native archive index first/u);
	if(inheritedCheckedRecordNativeArchiver === null)
		assert.throws(() => inheritedCheckedRecordNativePinnedRevisions(), /Pin the inherited native producer, checker and archiver/u);
	for(const args of [[], ["relative/root"], ["/absolute/root", "extra"]])
	{
		const run = spawnSync(process.execPath, [script, ...args], { encoding: "utf8", env: { PATH: "/usr/bin:/bin" } });
		assert.notEqual(run.status, 0); assert.match(run.stderr, /Usage: archive-inherited-checked-record-native-evidence/u);
	}
	}
);

test("the inherited native archive retains four exact hosted selections"
	, { skip: !pinned && "Runs once the archive index is pinned", timeout: 900_000 }, async () => {
	const checked = await checkInheritedCheckedRecordNativeArchive();
	assert.equal(checked.producerCommit, inheritedCheckedRecordNativeProducer);
	assert.equal(checked.checkerCommit, inheritedCheckedRecordNativeProducer);
	assert.equal(checked.archiveCommit, inheritedCheckedRecordNativeArchiver);
	assert.deepEqual(checked.installedProfiles, ["c", "cpp"]);
	assert.deepEqual(checked.runs.map(run => [run.route, run.mode]), [
		["ordinary", "full"], ["reviewed", "full"]
		, ["ordinary", "result-only"], ["reviewed", "result-only"]
	]);
	assert.ok(checked.runs.every(run => run.reportControls > 0 && run.resourceControls > 0
		&& run.modelControls > 0 && run.packageControls > 0 && run.recordControls > 0));
	assert.equal(checked.supportPromoted, false); assert.equal(checked.hostedAcceptance, true);
	}
);

test("the inherited native archive rejects changed, truncated and substituted originals"
	, { skip: !pinned && "Runs once the archive index is pinned", timeout: 1_800_000 }, async () => {
	const evidence = inheritedCheckedRecordNativeEvidence;
	const indexText = await readFile(`${evidence}/index.json`, "utf8");
	const source = role => indexText.match(new RegExp(`"sources/${role}/[^"]+"`, "u"))[0].slice(1, -1);
	const controls = [
		["index.json", bytes => Buffer.concat([bytes, Buffer.from("\n")])]
		, ["ordinary-full/run.tap", bytes => Buffer.concat([bytes, Buffer.from("# extra\n")])]
		, ["reviewed-full/verification.json", bytes => bytes.subarray(0, bytes.length - 1)]
		, ["ordinary-result-only/records/report.json", bytes => Buffer.from(bytes.toString().replace("\"result-only\"", "\"full\""))]
		, ["reviewed-result-only/records/build-1/model.json", bytes => Buffer.concat([bytes, Buffer.from(" ")])]
		, [source("producer"), bytes => Buffer.concat([bytes, Buffer.from("changed")])]
		, [source("checker"), bytes => Buffer.concat([bytes, Buffer.from("changed")])]
		, [source("archiver"), bytes => Buffer.concat([bytes, Buffer.from("changed")])]
	];
	for(const [target, mutate] of controls)
		await assert.rejects(checkInheritedCheckedRecordNativeArchive(async path => {
			const bytes = await readFile(path);
			return path === `${evidence}/${target}` ? mutate(bytes) : bytes;
		}), undefined, target);
	await assert.rejects(checkInheritedCheckedRecordNativeArchive(async path => {
		if(path === `${evidence}/reviewed-full/records/c/report.json`) throw Object.assign(new Error("missing"), { code: "ENOENT" });
		return readFile(path);
	}), undefined, "missing C report");
	}
);
