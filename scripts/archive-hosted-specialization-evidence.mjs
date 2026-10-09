/**
 * Retain the audited hosted native specialization reports and their original ZIPs (VO #1426/#1439).
 * Existing receipts and captures are immutable. This writer does not build or publish a package.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";

const revision = "93c60a0487d0b2acc0b6d562cd72a3876738a666";
const originalRoot = "build/vo1439-hosted-specializations-93c60a0";
const directory = "docs/evidence/hosted-specializations-20261009";
const options = process.argv.slice(2);
assert.ok(options.every(option => option === "--check"), "Only --check is accepted");
const captureBytes = await readFile(join(originalRoot, "capture.json"));
assert.equal(sha256(captureBytes), "68d30a0e0104c48067140f65534f3a283b9a71be1e7345b7b16d64873abd72bc");
const capture = JSON.parse(captureBytes);
assert.deepEqual([capture.revision, capture.run, capture.captures.length], [revision, 37873560469, 12]);
const pending = new Map(), files = [];
const add = (path, bytes, originalPath) => {
	assert.ok(!pending.has(path));
	pending.set(path, bytes);
	files.push({ path, bytes: bytes.length, sha256: sha256(bytes), originalPath });
};
add(`${directory}/capture.json`, captureBytes, `${originalRoot}/capture.json`);
let reports = 0, observations = 0;
for(const item of capture.captures)
{
	const original = join(originalRoot, item.name), target = `${directory}/${item.name}`;
	const artifactBytes = await readFile(join(original, "artifact.json")), artifact = JSON.parse(artifactBytes);
	const jobBytes = await readFile(join(original, "job.json")), job = JSON.parse(jobBytes);
	const zip = await readFile(join(original, "artifact.zip")), log = await readFile(join(original, "job.log"));
	assert.deepEqual([artifact.id, artifact.workflow_run.id, artifact.workflow_run.head_sha, artifact.name]
		, [item.artifact, capture.run, revision, `type-corpus-${item.name}-${revision}`]);
	assert.deepEqual([job.id, job.run_id, job.head_sha, job.status, job.conclusion]
		, [item.job, capture.run, revision, "completed", item.name === "c-family" ? "cancelled" : "success"]);
	assert.equal(zip.length, item.bytes); assert.equal(zip.length, artifact.size_in_bytes);
	assert.equal(sha256(zip), item.sha256); assert.equal(artifact.digest, `sha256:${item.sha256}`);
	assert.equal(sha256(log), item.logSha256);
	for(const [name, bytes] of [["artifact.json", artifactBytes], ["job.json", jobBytes], ["artifact.zip", zip], ["job.log", log]])
		add(`${target}/${name}`, bytes, `${original}/${name}`);
	for(const member of item.reports)
	{
		const bytes = await readFile(join(original, "reports", member.member));
		assert.equal(bytes.length, member.bytes); assert.equal(sha256(bytes), member.sha256);
		const extracted = execFileSync("/usr/bin/unzip", ["-p", join(original, "artifact.zip"), member.member], { maxBuffer: 1024 * 1024 });
		assert.ok(bytes.equals(extracted), "the original report is its ZIP member");
		add(`${target}/${member.member}`, bytes, `${original}/artifact.zip!${member.member}`);
		reports++; observations += JSON.parse(bytes).reports.length;
	}
}
assert.equal(reports, 38); assert.equal(observations, 44);
const sourcePaths = [
	".github/workflows/consumer-matrix.yml"
	, "tests/native-specializations.test.mjs"
	, "tests/generic-records.test.mjs"
	, "tests/helpers/native-specialization-install.mjs"
	, "tests/helpers/generic-record-packages.mjs"
	, "tests/helpers/generic-record-specializations.mjs"
	, "tests/fixtures/generic-record-specializations.lean"
	, "tests/helpers/generic-record-rust.mjs"
	, "tests/helpers/generic-record-managed-types.mjs"
	, "tests/helpers/copied-fixture-install.mjs"
	, "tests/helpers/type-corpus-rust.mjs"
	, "tests/helpers/package-set.mjs"
	, "tests/helpers/lake-workspace.mjs"
	, "scripts/build-perl-toolchains.mjs"
	, "src/release/cpan-package.mjs"
	, "src/release/cpan-install.mjs"
];
for(const path of ["tests/fixtures/onboarding/native-specializations", "tests/fixtures/onboarding/generic-records", "tests/fixtures/specialization-consumers", "tests/fixtures/generic-record-consumers", "tests/fixtures/generic-record-specialization-consumers"])
	sourcePaths.push(...execFileSync("git", ["ls-tree", "-r", "--name-only", revision, "--", path], { encoding: "utf8" }).trim().split("\n"));
assert.equal(new Set(sourcePaths).size, sourcePaths.length);
for(const path of sourcePaths)
	add(`${directory}/sources/${path}.txt`, execFileSync("git", ["show", `${revision}:${path}`], { maxBuffer: 8 * 1024 * 1024 }), `git:${revision}:${path}`);
const receipt = {
	schemaVersion: 1
	, kind: "hosted-native-specializations"
	, planNodes: [1426, 1439]
	, revision
	, runId: capture.run
	, captureSha256: sha256(captureBytes)
	, reportFiles: reports
	, observations
	, scope: {
		path: "ordinary-source"
		, selections: ["ten finite function specializations and plain", "ten direct generic-record exports", "nine configured generic-record specializations with both namespaces and Option/List aliases"]
		, profiles: ["c", "cpp", "python", "rust", "ruby", "dotnet", "java", "kotlin", "php-native", "wit-wasi", "perl"]
		, python: "The generic-record selections run on Python 3.11 and 3.12, identified by the original workflow and log; the common function-specialization selection runs on the default Python 3.11."
		, perl: "Four independently built and installed configurations: 5.36.3 and 5.38.2, threaded and unthreaded. No cross-ABI archive equality is claimed."
		, reproduction: "Each selected test compares package archive hashes from two unrelated author roots, removes author/build inputs, and installs offline with a compiler-free consumer PATH. Package archive bytes and complete original model/receipt documents are not retained in these GitHub artifacts. Their digests remain original report fields."
		, distribution: "These are the configured hosted distribution packages, without a local glibc-floor override. The reports do not claim execution on a machine running the minimum supported libc version."
		, jobConclusion: "Every selected test completed successfully. The C-family job was cancelled later; the parent workflow and that job are not claimed as successful. The other eleven selected jobs succeeded."
		, sources: "Selected exact Git producer/fixture/consumer snapshots, not a complete build dependency closure. Historical reports, receipts and support states are unchanged."
		, excluded: ["reviewed IR", "browser profiles", "PHP-Wasm", "open generic dispatch", "refined generic arguments", "callback/resource generic arguments"]
		, supportPromotion: false
	}
	, files
};
const receiptBytes = Buffer.from(canonicalJson(receipt));
pending.set(`${directory}/receipt.json`, receiptBytes);
if(!options.includes("--check")) for(const [path, bytes] of pending)
{
	await mkdir(dirname(path), { recursive: true });
	try
	{ await writeFile(path, bytes, { flag: "wx" }); }
	catch(error)
	{
		if(error.code !== "EEXIST") throw error;
		assert.ok((await readFile(path)).equals(bytes), `${path} already holds different bytes`);
	}
}
console.log(JSON.stringify({ artifacts: files.length, sourceSnapshots: sourcePaths.length, reports, observations, receiptSha256: sha256(receiptBytes) }));
