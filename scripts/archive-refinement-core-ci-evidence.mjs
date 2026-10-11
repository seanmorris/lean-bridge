/**
 * Retain the original Core failure and its local reproduction without replacing evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { sha256 } from "../src/capsule/node.mjs";

const destination = "docs/evidence/refinement-core-ci-20261011";
const inputs = [
	["hosted-failure.log", "build/vo1220-core-c9d11f7-failed.log", "2fc744a9fcb9a4b6db42ca918f6593adb2033f5104ec1002875c5c2b6e2d0586"]
	, ["hosted-run.json", "build/vo1220-core-c9d11f7-run.json", "68fa7d6dbd860bede988d7f8447578bbbffaf47c621a291f785c1c8b44173ebd"]
	, ["hosted-job.json", "build/vo1220-core-c9d11f7-job.json", "6c4979785fe3f81ec5d142d19ec0825f022e23666c34ed0fbbc6dd781f78427c"]
	, ["local-analysis.json", "build/vo1220-core-analyze-current-r1.json", "8581c93fb9fbf9a7c4b651de4e4d7c903b63359b281a23e36e86c6fc2422a1f4"]
	, ["local-analysis.stderr", "build/vo1220-core-analyze-current-r1.stderr", "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"]
	, ["local-reproduced.tap", "build/vo1220-core-c9d11f7-reproduced-r1.tap", "c3ec21d17bf1aaa31dd72e3299527e1f05858e53b98ff8983a5be18bcdab0f2d"]
	, ["local-fixed.tap", "build/vo1220-core-followup-fixed-r1.tap", "4d4080304069b1efaafaed6a70d0ac79e58df569d04bc143b8f9334d58771a27"]
];
const records = await Promise.all(inputs.map(async ([path, source, digest]) => {
	const bytes = await readFile(source);
	assert.equal(sha256(bytes), digest, source);
	return { path, source, sha256: digest, bytes };
}));
const run = JSON.parse(records.find(record => record.path === "hosted-run.json").bytes);
const job = JSON.parse(records.find(record => record.path === "hosted-job.json").bytes);
assert.equal(run.id, 38095922167); assert.equal(job.id, 114341673721);
assert.equal(job.run_id, run.id); assert.equal(job.head_sha, run.head_sha);
assert.equal(run.head_sha, "c9d11f7ac8fd76d13bcc48f6f679eb22fd86b722");
assert.equal(run.conclusion, "failure"); assert.equal(job.conclusion, "failure");
const index = {
	schemaVersion: 1, kind: "refinement-core-ci-repair"
	, hosted: { runId: run.id, jobId: job.id, commit: run.head_sha, conclusion: run.conclusion }
	, localPredecessor: "08eb94ef6321b8a58ea4c57b9e13dfa7522ee49b"
	, scope: "Original hosted Core failure, local reproduction and focused repair. No hosted repair pass or installed consumer acceptance is claimed."
	, records: records.map(({ bytes, ...record }) => ({ ...record, byteLength: bytes.length }))
};
const outputs = [...records, { path: "index.json", bytes: Buffer.from(JSON.stringify(index, null, 2) + "\n") }];
// Validate every destination before writing any bytes; reruns may only reproduce this archive.
for(const record of outputs)
{
	const existing = await readFile(join(destination, record.path)).catch(error => {
		if(error.code === "ENOENT") return null;
		throw error;
	});
	if(existing) assert.deepEqual(existing, record.bytes, `Refuse to replace ${record.path}`);
}
await mkdir(destination, { recursive: true });
for(const record of outputs) await writeFile(join(destination, record.path), record.bytes, { flag: "wx" }).catch(error => {
	if(error.code !== "EEXIST") throw error;
});
for(const record of outputs) assert.deepEqual(await readFile(join(destination, record.path)), record.bytes, record.path);
process.stdout.write(`Authenticated ${records.length} original artifacts; index SHA256 ${sha256(outputs.at(-1).bytes)}\n`);
