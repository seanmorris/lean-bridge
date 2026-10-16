#!/usr/bin/env node
/**
 * Freeze the two accepted recursive checked-record Maven records once.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
	access, mkdir, readFile, readdir, writeFile
} from "node:fs/promises";
import { dirname, join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import {
	mutualCheckedRecordJvmArchiveRoutes, mutualCheckedRecordJvmCheckerSources
	, mutualCheckedRecordJvmEvidence, mutualCheckedRecordJvmOriginal
	, mutualCheckedRecordJvmProducer, mutualCheckedRecordJvmProducerSources
	, mutualCheckedRecordJvmRecordRoots
} from "../tests/helpers/mutual-checked-record-jvm-provenance.mjs";
import {
	checkMutualCheckedRecordJvmReport
} from "../tests/helpers/mutual-checked-record-jvm-report.mjs";

assert.equal(process.argv.length, 2, "The frozen archive takes no arguments");
await assert.rejects(access(mutualCheckedRecordJvmEvidence), { code: "ENOENT" });
assert.doesNotThrow(() => execFileSync("git", ["diff", "--quiet", "HEAD", "--"], {
	stdio: "ignore"
}), "Archive generation requires a clean tracked source tree");
const archiveCommit = execFileSync("git", ["rev-parse", "HEAD"], {
	encoding: "utf8"
}).trim();
const runtime = {
	node: process.version, platform: process.platform, arch: process.arch
};
const files = new Map();
const put = (path, bytes) => {
	assert.ok(!files.has(path), path); files.set(path, Buffer.from(bytes));
};
const paths = async (root, prefix = "") => {
	const result = [];
	for(const entry of await readdir(root, { withFileTypes: true }))
	{
		const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
		if(entry.isDirectory()) result.push(...await paths(join(root, entry.name), relative));
		else if(entry.isFile()) result.push(relative);
		else assert.fail(`Unexpected retained record entry: ${relative}`);
	}
	return result.sort();
};

const runs = [];
for(const route of mutualCheckedRecordJvmArchiveRoutes)
{
	const root = mutualCheckedRecordJvmRecordRoots[route];
	const checked = await checkMutualCheckedRecordJvmReport(
		path => readFile(join(root, path)), {
			route, producerCommit: mutualCheckedRecordJvmProducer
		}
	);
	const recordPaths = await paths(root);
	assert.deepEqual(recordPaths, checked.recordPaths);
	for(const path of recordPaths)
		put(`${route}/records/${path}`, await readFile(join(root, path)));
	runs.push({
		route, recordCount: recordPaths.length
		, reportSha256: checked.reportSha256, packages: checked.packages
		, runtimeIdentity: checked.runtimeIdentity
		, bindingIrSha256: checked.bindingIrSha256
		, layoutSha256: checked.layoutSha256
		, jdkVersion: checked.jdkVersion
		, kotlinVersion: checked.kotlinVersion, results: checked.results
		, executions: checked.executions
		, independentBuilds: checked.independentBuilds
	});
}

const sourceSnapshots = [
	{ role: "producer", commit: mutualCheckedRecordJvmProducer
		, paths: mutualCheckedRecordJvmProducerSources() }
	, { role: "checker", commit: archiveCommit
		, paths: mutualCheckedRecordJvmCheckerSources(archiveCommit) }
];
for(const snapshot of sourceSnapshots) for(const path of snapshot.paths)
	put(`sources/${snapshot.role}/${path}`
		, mutualCheckedRecordJvmOriginal(snapshot.commit, path));
const index = {
	schemaVersion: 1, kind: "mutual-checked-record-jvm-installed-v1"
	, producerCommit: mutualCheckedRecordJvmProducer, archiveCommit, runtime
	, runs, sourceSnapshots
	, limitations: [
		"The archive authenticates local Linux x64/glibc 2.36 acceptance; it does not claim hosted-runner acceptance or promote support before the whole recursive-record matrix closes."
		, "Both ordinary source and independently reviewed Binding IR routes reproduce complete Maven packages from two isolated author roots, remove author sources, install offline, relocate, and replay without consumer sources."
		, "Each route runs the unchanged typed Java caller and route-bound Kotlin caller three times. Java records 590 checks, 72 native rejections, five host rejections, 290 calls and snapshots, 77 recoveries and 64 rounds per execution; Kotlin records 593 checks, 72 native rejections, six host rejections, 292 calls and snapshots, 78 recoveries and 64 rounds."
		, "The fixture covers mutually recursive records and variants, transparent aliases, active Option and variant branches, exact Subtype and Fin failures, null carriers, cycles, depth limits, immutable callers, and constructor-free results."
		, "Kotlin additionally proves three compile-time non-null rejections through positive and negative compiler controls; Java proves its record carriers refuse cycle construction before runtime traversal."
		, "The original JARs and POMs, receipts, generated-source identities, nullability diagnostics, execution records, and selected producer/checker sources are retained. The complete JDK and Kotlin distribution remain trusted external tools represented by recorded identities."
	]
	, files: [...files].sort(([left], [right]) => left.localeCompare(right))
		.map(([path, bytes]) => ({
			path, bytes: bytes.length, sha256: sha256(bytes)
		}))
};
for(const [path, bytes] of files)
{
	const target = join(mutualCheckedRecordJvmEvidence, path);
	await mkdir(dirname(target), { recursive: true });
	await writeFile(target, bytes, { flag: "wx" });
	assert.deepEqual(await readFile(target), bytes);
}
const indexBytes = Buffer.from(canonicalJson(index));
await writeFile(join(mutualCheckedRecordJvmEvidence, "index.json"), indexBytes, {
	flag: "wx"
});
process.stdout.write(canonicalJson({
	destination: mutualCheckedRecordJvmEvidence, files: files.size
	, bytes: [...files.values()].reduce((sum, value) => sum + value.length, 0)
	, producerCommit: mutualCheckedRecordJvmProducer, archiveCommit
	, indexSha256: sha256(indexBytes)
}) + "\n");
