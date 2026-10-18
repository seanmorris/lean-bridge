#!/usr/bin/env node
/**
 * Freeze one authenticated hosted C/C++ recursive checked-record artifact.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import {
	access, constants, copyFile, mkdir, readFile, readdir, stat, writeFile
} from "node:fs/promises";
import { dirname, join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import {
	checkMutualCheckedRecordNativeCiRecords
} from "../tests/helpers/mutual-checked-record-native-ci-report.mjs";
import {
	mutualCheckedRecordNativeArchiveSources
	, mutualCheckedRecordNativeEvidence
	, mutualCheckedRecordNativeProducerSources
	, mutualCheckedRecordNativeRoutes
} from "../tests/helpers/mutual-checked-record-native-evidence.mjs";

const usage = "Usage: archive-mutual-checked-record-native.mjs --run <id> --job <id> --artifact <id> --api-digest sha256:<hash>";
const allowed = ["run", "job", "artifact", "api-digest"], selected = {};
assert.equal(process.argv.slice(2).length, allowed.length * 2, usage);
for(let index = 2; index < process.argv.length; index += 2)
{
	const flag = process.argv[index], value = process.argv[index + 1];
	assert.ok(flag.startsWith("--") && allowed.includes(flag.slice(2)), usage);
	const key = flag.slice(2);
	assert.ok(!Object.hasOwn(selected, key) && value && !value.startsWith("--"), usage);
	selected[key] = value;
}
assert.deepEqual(Object.keys(selected).sort(), [...allowed].sort(), usage);
for(const key of ["run", "job", "artifact"])
	assert.match(selected[key], /^[1-9][0-9]*$/u, usage);
assert.match(selected["api-digest"], /^sha256:[a-f0-9]{64}$/u, usage);

const hostedRoot = "build/mutual-checked-record-native-hosted";
const artifactZip = join(hostedRoot, "artifact.zip");
const artifactRoot = join(hostedRoot, "artifact");
const recordsRoot = join(artifactRoot, "mutual-checked-record-native-ci");
await assert.rejects(access(mutualCheckedRecordNativeEvidence), { code: "ENOENT" });
assert.doesNotThrow(() => execFileSync("git", ["diff", "--quiet", "HEAD", "--"]
	, { stdio: "ignore" }), "Archive generation requires a clean tracked tree");
const archiveCommit = execFileSync("git", ["rev-parse", "HEAD"]
	, { encoding: "utf8" }).trim();
const digestFile = path => new Promise((resolve, reject) => {
	const hash = createHash("sha256"), stream = createReadStream(path);
	stream.on("data", chunk => hash.update(chunk));
	stream.on("error", reject);
	stream.on("end", () => resolve(hash.digest("hex")));
});
const artifactInformation = await stat(artifactZip);
assert.ok(artifactInformation.isFile() && artifactInformation.size > 0);
const artifactSha256 = await digestFile(artifactZip);
assert.equal(selected["api-digest"], `sha256:${artifactSha256}`);
const descriptors = new Map();
const putBytes = (path, value) => {
	assert.ok(!descriptors.has(path), path);
	const bytes = Buffer.from(value);
	descriptors.set(path, { bytes: bytes.length, sha256: sha256(bytes), value: bytes });
};
const putFile = async (path, source) => {
	assert.ok(!descriptors.has(path), path);
	const information = await stat(source);
	assert.ok(information.isFile(), source);
	descriptors.set(path, {
		bytes: information.size, sha256: await digestFile(source), source
	});
};
const paths = async (root, prefix = "") => {
	const result = [];
	for(const entry of await readdir(root, { withFileTypes: true }))
	{
		const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
		if(entry.isDirectory()) result.push(...await paths(join(root, entry.name), relative));
		else if(entry.isFile()) result.push(relative);
		else assert.fail(`Unexpected hosted record entry: ${relative}`);
	}
	return result.sort();
};

let producerCommit;
const runs = [];
for(const route of mutualCheckedRecordNativeRoutes)
{
	const routeRoot = join(recordsRoot, "records", route);
	const report = JSON.parse(await readFile(join(routeRoot, "report.json")));
	producerCommit ??= report.producerCommit;
	assert.equal(report.producerCommit, producerCommit);
	assert.equal(producerCommit, archiveCommit
		, "Hosted evidence must come from this exact committed revision");
	const tapPath = join(recordsRoot, route, "run.tap");
	const verificationPath = join(recordsRoot, route, "verification.json");
	const checked = await checkMutualCheckedRecordNativeCiRecords({
		route, producer: producerCommit, directory: routeRoot, tap: tapPath
	}, {
		tap: await readFile(tapPath, "utf8")
		, read: path => readFile(join(routeRoot, path))
	});
	const recordPaths = await paths(routeRoot);
	assert.deepEqual(recordPaths, checked.recordPaths);
	for(const path of recordPaths)
		await putFile(`${route}/records/${path}`, join(routeRoot, path));
	await putFile(`${route}/run.tap`, tapPath);
	await putFile(`${route}/verification.json`, verificationPath);
	runs.push({
		route, recordCount: recordPaths.length
		, reportSha256: checked.reportSha256
		, verificationSha256: await digestFile(verificationPath)
		, tapSha256: await digestFile(tapPath)
		, bindingIrSha256: checked.bindingIrSha256
		, independentBuilds: checked.independentBuilds
		, profiles: checked.observations.map(item => ({
			profile: item.profile, checks: item.checks
		}))
		, artifacts: checked.receipt.packages.flatMap(pkg => pkg.artifacts)
	});
}
await putFile("toolchain.log", join(
	artifactRoot, "mutual-checked-record-native-toolchain.log"));
const sourceSnapshots = [
	{ role: "producer", commit: producerCommit
		, paths: mutualCheckedRecordNativeProducerSources() }
	, { role: "archive", commit: archiveCommit
		, paths: [...mutualCheckedRecordNativeArchiveSources] }
];
for(const snapshot of sourceSnapshots) for(const path of snapshot.paths)
	putBytes(`sources/${snapshot.role}/${path}`
		, execFileSync("git", ["show", `${snapshot.commit}:${path}`]
			, { maxBuffer: 64 * 1024 * 1024 }));
const files = [...descriptors].sort(([left], [right]) =>
	left.localeCompare(right)).map(([path, descriptor]) =>
	({ path, bytes: descriptor.bytes, sha256: descriptor.sha256 }));
const index = {
	schemaVersion: 1, kind: "mutual-checked-record-native-hosted-v1"
	, producerCommit, archiveCommit
	, hostedRun: {
		repository: "seanmorris/lean-bridge", runId: Number(selected.run)
		, jobId: Number(selected.job), artifactId: Number(selected.artifact)
		, artifactBytes: artifactInformation.size, artifactSha256
		, apiDigest: selected["api-digest"]
	}
	, runtime: { platform: "linux", arch: "x64", runner: "ubuntu-24.04" }
	, floor: "2.38", runs, sourceSnapshots
	, limitations: [
		"Hosted Ubuntu 24.04 Linux x64 acceptance with a glibc 2.38 package floor; other operating systems and architectures remain separate requirements."
		, "Ordinary source and independently reviewed Binding IR routes reproduce complete C and C++ packages from two isolated author roots, remove author sources, install offline, relocate and replay without consumer sources or compilers."
		, "The immutable C and C++ callers cover mutual records and variants, aliases, arrays and options, active branches, exact Fin and Subtype diagnostics, malformed values, cycles, depth limits, preserved rejected inputs and recovery."
		, "Proof fields are erased, recursive nominal identities stay distinct, and results contain no runtime proof constructors."
		, "Callbacks, owned values, asynchronous calls, retained identity, dependent index kinds, open dependent records and zero-payload records remain separate requirements."
		, "Original package archives, receipts, models, source inputs, caller sources, reports, TAP, checker output, toolchain log and exact producer/archive source closures are retained; external compiler and operating-system distributions remain trusted."
	]
	, files
};
await mkdir(mutualCheckedRecordNativeEvidence);
for(const [path, descriptor] of descriptors)
{
	const target = join(mutualCheckedRecordNativeEvidence, path);
	await mkdir(dirname(target), { recursive: true });
	if(descriptor.source) await copyFile(
		descriptor.source, target, constants.COPYFILE_FICLONE);
	else await writeFile(target, descriptor.value, { flag: "wx" });
	assert.equal((await stat(target)).size, descriptor.bytes, path);
	assert.equal(await digestFile(target), descriptor.sha256, path);
}
const indexBytes = Buffer.from(canonicalJson(index));
await writeFile(join(mutualCheckedRecordNativeEvidence, "index.json")
	, indexBytes, { flag: "wx" });
process.stdout.write(canonicalJson({
	destination: mutualCheckedRecordNativeEvidence, producerCommit, archiveCommit
	, files: files.length + 1
	, bytes: files.reduce((sum, file) => sum + file.bytes, indexBytes.length)
	, indexSha256: sha256(indexBytes), hostedRun: index.hostedRun
}));
