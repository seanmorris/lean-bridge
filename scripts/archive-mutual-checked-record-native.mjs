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
	access, constants, copyFile, mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import {
	assertMutualCheckedRecordNativeCiTap
} from "../tests/helpers/mutual-checked-record-native-ci-report.mjs";
import {
	checkMutualCheckedRecordNativeControls
} from "../tests/helpers/mutual-checked-record-native-controls.mjs";
import {
	mutualCheckedRecordNativeEvidence, mutualCheckedRecordNativeEvidenceSources
	, mutualCheckedRecordNativeOriginal
} from "../tests/helpers/mutual-checked-record-native-evidence.mjs";
import {
	assertMutualCheckedRecordNativeRecordPaths
	, mutualCheckedRecordNativeRecords, mutualCheckedRecordNativeRoutes
} from "../tests/helpers/mutual-checked-record-native-report.mjs";

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
await assert.rejects(access(mutualCheckedRecordNativeEvidence), { code: "ENOENT" });
assert.doesNotThrow(() => execFileSync("git", ["diff", "--quiet", "HEAD", "--"]
	, { stdio: "ignore" }), "Archive generation requires a clean tracked tree");
const archiveCommit = execFileSync("git", ["rev-parse", "HEAD"]
	, { encoding: "utf8" }).trim();
assert.match(archiveCommit, /^[a-f0-9]{40}$/u);

const digestFile = path => new Promise((resolveDigest, reject) => {
	const hash = createHash("sha256"), stream = createReadStream(path);
	stream.on("data", chunk => hash.update(chunk));
	stream.on("error", reject);
	stream.on("end", () => resolveDigest(hash.digest("hex")));
});
const artifactInformation = await stat(artifactZip);
assert.ok(artifactInformation.isFile() && artifactInformation.size > 0);
const artifactSha256 = await digestFile(artifactZip);
assert.equal(selected["api-digest"], `sha256:${artifactSha256}`);

const safeZipPath = path => {
	const value = path.endsWith("/") ? path.slice(0, -1) : path;
	return value.length > 0 && /^[A-Za-z0-9_@.+/-]+$/u.test(value)
		&& !value.startsWith("/") && value.split("/").every(part =>
		part.length > 0 && part !== "." && part !== "..");
};
const zipEntries = execFileSync("unzip", ["-Z1", artifactZip]
	, { encoding: "utf8", maxBuffer: 64 * 1024 ** 2 }).split("\n").filter(Boolean);
assert.ok(zipEntries.length > 0 && new Set(zipEntries).size === zipEntries.length);
for(const path of zipEntries) assert.ok(safeZipPath(path), path);
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

const extracted = await mkdtemp(join(tmpdir(), "lean-bridge-recursive-native-artifact-"));
try
{
	execFileSync("unzip", ["-q", artifactZip, "-d", extracted]);
	const zipFiles = zipEntries.filter(path => !path.endsWith("/")).sort();
	for(const directory of zipEntries.filter(path => path.endsWith("/")))
		assert.ok(zipFiles.some(path => path.startsWith(directory)), directory);
	assert.deepEqual(await paths(extracted), zipFiles
		, "Every extracted byte must come from the authenticated ZIP");
	assert.deepEqual((await readdir(extracted)).sort(), [
		"mutual-checked-record-native-ci"
		, "mutual-checked-record-native-toolchain.log"
	]);
	const recordsRoot = join(extracted, "mutual-checked-record-native-ci");
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
	let producerCommit, runtime, floor;
	const runs = [];
	for(const route of mutualCheckedRecordNativeRoutes)
	{
		const routeRoot = join(recordsRoot, "records", route);
		const reportBytes = await readFile(join(routeRoot, "report.json"));
		const report = JSON.parse(reportBytes);
		assert.equal(reportBytes.toString(), canonicalJson(report));
		producerCommit ??= report.producerCommit;
		assert.equal(report.producerCommit, producerCommit);
		floor ??= report.declaredGlibcFloor;
		assert.equal(report.declaredGlibcFloor, floor);
		const observed = {
			platform: report.runtime.platform, arch: report.runtime.arch
			, glibc: report.runtime.glibc.stdout.trim().split(" ")[1]
		};
		runtime ??= observed;
		assert.deepEqual(observed, runtime);
		const tapPath = join(recordsRoot, route, "run.tap");
		const verificationPath = join(recordsRoot, route, "verification.json");
		const tap = await readFile(tapPath, "utf8");
		assertMutualCheckedRecordNativeCiTap(tap, route);
		const read = path => readFile(join(routeRoot, path));
		const checked = await checkMutualCheckedRecordNativeControls(read, {
			route, producerCommit, runtime, floor
		});
		const receipt = JSON.parse(await read("build-0/package-set-receipt.json"));
		const records = [...mutualCheckedRecordNativeRecords(route, receipt)
			, "controls.json"].sort();
		assertMutualCheckedRecordNativeRecordPaths(
			await paths(routeRoot), route, receipt);
		const verification = await readFile(verificationPath);
		assert.equal(verification.toString(), canonicalJson(checked));
		assert.equal((await read("controls.json")).toString(), canonicalJson(checked));
		for(const path of records)
			await putFile(`${route}/records/${path}`, join(routeRoot, path));
		await putFile(`${route}/run.tap`, tapPath);
		await putFile(`${route}/verification.json`, verificationPath);
		runs.push({
			route, recordCount: records.length
			, reportSha256: checked.reportSha256
			, verificationSha256: sha256(verification), tapSha256: sha256(tap)
			, bindingIrSha256: checked.bindingIrSha256
			, independentBuilds: checked.independentBuilds
			, profiles: checked.profiles, controls: checked.controls
			, artifacts: checked.artifacts
		});
	}
	assert.match(producerCommit, /^[a-f0-9]{40}$/u);
	assert.deepEqual(Object.keys(runtime).sort(), ["arch", "glibc", "platform"]);
	assert.equal(floor, "2.38");
	await putFile("toolchain.log", join(extracted
		, "mutual-checked-record-native-toolchain.log"));
	const revisions = {
		producer: producerCommit, checker: producerCommit, archiver: archiveCommit
	};
	const selectedSources = mutualCheckedRecordNativeEvidenceSources(revisions);
	for(const { role, revision, path } of selectedSources)
		putBytes(`sources/${role}/${path}`
			, mutualCheckedRecordNativeOriginal(revision, path));
	const files = [...descriptors].sort(([left], [right]) =>
		left.localeCompare(right)).map(([path, descriptor]) => ({
		path, bytes: descriptor.bytes, sha256: descriptor.sha256
		}));
	const index = {
		schemaVersion: 1, kind: "mutual-checked-record-native-hosted-v1"
		, producerCommit, checkerCommit: producerCommit, archiveCommit
		, hostedRun: {
			repository: "seanmorris/lean-bridge", runId: Number(selected.run)
			, jobId: Number(selected.job), artifactId: Number(selected.artifact)
			, artifactBytes: artifactInformation.size, artifactSha256
			, apiDigest: selected["api-digest"]
		}
		, runtime, floor, runs, selectedSources, files
		, limitations: [
			"Hosted Ubuntu 24.04 Linux x64 acceptance records the observed glibc runtime and enforces a glibc 2.38 package floor; other operating systems and architectures remain separate requirements."
			, "Ordinary source and independently reviewed Binding IR routes reproduce complete C and C++ packages from two isolated author roots, remove author sources, install offline, relocate and replay without consumer sources or compilers."
			, "The immutable C and C++ callers cover mutual records and variants, aliases, arrays and options, active branches, exact Fin and Subtype diagnostics, malformed values, cycles, depth limits, preserved rejected inputs and recovery."
			, "Proof fields are erased, recursive nominal identities stay distinct, and results contain no runtime proof constructors."
			, "Callbacks, owned values, asynchronous calls, retained identity, dependent index kinds, open dependent records and zero-payload records remain separate requirements."
			, "Original package archives, receipts, models, source inputs, caller sources, reports, controls, TAP, checker output, toolchain log and exact producer, checker and archiver source closures are retained; external compiler and operating-system distributions remain trusted."
		]
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
		destination: mutualCheckedRecordNativeEvidence, producerCommit
		, checkerCommit: producerCommit, archiveCommit, files: files.length + 1
		, bytes: files.reduce((sum, file) => sum + file.bytes, indexBytes.length)
		, indexSha256: sha256(indexBytes), hostedRun: index.hostedRun
	}));
}
finally
{
	await rm(extracted, { recursive: true });
}
