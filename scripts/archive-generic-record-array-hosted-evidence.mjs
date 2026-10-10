/**
 * Retain the original hosted native Array reports, artifact ZIPs and producer sources for #1439.
 * This one-shot writer neither rebuilds packages nor changes older evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { assertHostedArrayArchive } from "../tests/helpers/generic-record-array-hosted-evidence.mjs";
import { strictArtifactZipMembers } from "../tests/helpers/hosted-specialization-evidence.mjs";

const revision = "ff71335c762628da47887bfd4f208e62c39b94b7", runId = 37969725049;
const directory = "docs/evidence/generic-record-array-hosted-20261010";
const options = process.argv.slice(2);
assert.ok(options.every(option => option === "--check" || option.startsWith("--from=")), "Only --check and --from=<original download directory> are accepted");
assert.ok(options.filter(option => option.startsWith("--from=")).length <= 1);
const originalRoot = options.find(option => option.startsWith("--from="))?.slice(7) ?? "build/vo1439-hosted-ff71335";
const selected = [
	["c-family", 113952962715], ["python", 113952963002], ["rust", 113952962816]
	, ["ruby", 113952963054], ["dotnet", 113952962674], ["jvm", 113952962820]
	, ["php-native", 113952962703], ["wit-wasi", 113952962913]
	, ["perl-5.36.3-threaded", 113952963338]
	, ["perl-5.36.3-unthreaded", 113952963292]
	, ["perl-5.38.2-threaded", 113952963297]
	, ["perl-5.38.2-unthreaded", 113952963331]
];
const pending = new Map(), files = [], groups = [];
const add = (name, bytes, original) => {
	const path = `${directory}/${name}`;
	assert.ok(!pending.has(path)); pending.set(path, bytes);
	files.push({ path, bytes: bytes.length, sha256: sha256(bytes), original });
	return bytes;
};
const take = async name => add(name, await readFile(join(originalRoot, name)), `download:${name}`);
const artifactsBytes = await take("artifacts.json"), jobsBytes = await take("jobs.json");
assert.equal(sha256(artifactsBytes), "50d59648cbaa183c2506c975d5d2b21baf18771b074956620cae188590884536");
assert.equal(sha256(jobsBytes), "de7fcfaa80c7c571369d1d7dadc215019fef1e4f2fecdce4a85dfb1e43d71a56");
const artifacts = JSON.parse(artifactsBytes).artifacts;
await take("fetched-at.txt");
for(const id of [runId, 37969723940, 37969723919]) await take(`run-${id}.json`);
const retainZip = async (name, artifactName, members) => {
	const artifact = artifacts.find(item => item.name === `${artifactName}-${revision}`);
	assert.ok(artifact && !artifact.expired, artifactName);
	const zip = await take(`${name}.zip`);
	assert.equal(zip.length, artifact.size_in_bytes); assert.equal(`sha256:${sha256(zip)}`, artifact.digest);
	assert.equal(artifact.workflow_run.id, runId); assert.equal(artifact.workflow_run.head_sha, revision);
	const reports = [];
	for(const [member, bytes] of strictArtifactZipMembers(zip, members))
	{
		add(`${name}/${member}`, bytes, `artifact:${artifact.id}!${member}`);
		reports.push({ member, sha256: sha256(bytes), bytes: bytes.length });
	}
	return { name, artifactId: artifact.id, reports };
};
for(const [name, jobId] of selected)
{
	const job = JSON.parse(await take(`job-${jobId}.json`));
	assert.deepEqual([job.id, job.run_id, job.head_sha, job.conclusion], [jobId, runId, revision, "success"]);
	await take(`job-${jobId}.log`);
	const suffixes = name === "python" ? ["python", "python312"] : [name === "c-family" ? "c-cpp" : name === "jvm" ? "java-kotlin" : name.startsWith("perl-") ? "perl" : name];
	const members = suffixes.flatMap(suffix => ["", "specialized-", "array-"].map(prefix => `generic-records/${prefix}${suffix}.json`));
	groups.push({ ...await retainZip(name, `type-corpus-${name}`, members), jobId });
}
const perlAbi = [];
for(const [name] of selected.filter(([name]) => name.startsWith("perl-")))
{
	const configuration = name.slice(5), id = `perl-abi-${configuration}`;
	perlAbi.push(await retainZip(id, id, ["acceptance.json", "benchmark.json"].map(file => `${configuration}/${file}`)));
}
const sourcePaths = [
	".github/workflows/consumer-matrix.yml", ".github/workflows/perl-consumer.yml"
	, "tests/generic-records.test.mjs", "tests/generic-record-arrays.test.mjs"
	, "tests/helpers/generic-record-arrays.mjs"
	, "tests/helpers/generic-record-packages.mjs"
	, "tests/helpers/generic-record-specializations.mjs"
	, "tests/helpers/generic-record-browser.mjs"
	, "tests/helpers/generic-record-rust.mjs"
	, "tests/helpers/generic-record-managed-types.mjs"
	, "tests/helpers/copied-fixture-install.mjs", "tests/helpers/package-set.mjs"
	, "tests/helpers/lake-workspace.mjs"
	, "tests/fixtures/generic-record-browser/GenericRecordArrays.lean"
	, "tests/fixtures/generic-record-specializations.lean"
	, "scripts/build-perl-toolchains.mjs", "scripts/test-perl-consumers.mjs"
	, "src/build/native-c-projection.mjs", "src/build/cpan-projection.mjs"
];
for(const path of ["tests/fixtures/onboarding/generic-records", "tests/fixtures/generic-record-consumers", "tests/fixtures/generic-record-specialization-consumers", "tests/fixtures/generic-record-array-consumers"])
	sourcePaths.push(...execFileSync("git", ["ls-tree", "-r", "--name-only", revision, "--", path], { encoding: "utf8" }).trim().split("\n"));
assert.equal(new Set(sourcePaths).size, sourcePaths.length);
for(const path of sourcePaths)
	add(`sources/${path}.txt`, execFileSync("git", ["show", `${revision}:${path}`], { maxBuffer: 8 * 1024 * 1024 }), `git:${revision}:${path}`);
const receipt = { schemaVersion: 1, kind: "hosted-generic-record-arrays"
	, planNode: 1439, revision, runId
	, groups, perlAbi
	, scope: {
		path: "ordinary-source", nativeProfiles: 11
		, arraySelections: 13, arrayObservations: 15
		, genericReportFiles: 39, genericObservations: 45
		, distribution: "Configured distribution packages on hosted ubuntu-24.04, with no local glibc-floor override. This does not measure execution on the minimum-libc machine."
		, retained: "Original GitHub artifact ZIPs, logs and metadata; selected reports and exact Git source snapshots. Package archive bytes and complete original model/receipt documents are not in these GitHub artifacts; their digests remain report fields."
		, sources: "Selected producer, consumer, fixture and workflow files, not a full build dependency closure."
		, supportPromotion: false
		, excluded: ["reviewed IR", "browser", "PHP-Wasm", "open generic dispatch", "inherited generic records", "indexed generic records", "refined generic arguments", "callback/resource generic arguments"] }
	, files };
const bytes = Buffer.from(canonicalJson(receipt));
pending.set(`${directory}/receipt.json`, bytes);
await assertHostedArrayArchive(receipt, async path => pending.get(path));
if(!options.includes("--check")) for(const [path, content] of pending)
{
	await mkdir(dirname(path), { recursive: true });
	try
	{ await writeFile(path, content, { flag: "wx" }); }
	catch(error)
	{
		if(error.code !== "EEXIST") throw error;
		assert.ok((await readFile(path)).equals(content), `${path} already holds different bytes`);
	}
}
console.log(JSON.stringify({ files: files.length, sourceSnapshots: sourcePaths.length, receiptSha256: sha256(bytes) }));
