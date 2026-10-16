#!/usr/bin/env node
/**
 * Freeze the two accepted recursive checked-record NuGet records once.
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
	mutualCheckedRecordDotnetCheckerSources, mutualCheckedRecordDotnetEvidence
	, mutualCheckedRecordDotnetOriginal, mutualCheckedRecordDotnetProducer
	, mutualCheckedRecordDotnetProducerSources, mutualCheckedRecordDotnetRecordRoots
	, mutualCheckedRecordDotnetRoutes
} from "../tests/helpers/mutual-checked-record-dotnet-provenance.mjs";
import {
	checkMutualCheckedRecordDotnetReport
} from "../tests/helpers/mutual-checked-record-dotnet-report.mjs";

assert.equal(process.argv.length, 2, "The frozen archive takes no arguments");
await assert.rejects(access(mutualCheckedRecordDotnetEvidence), { code: "ENOENT" });
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
for(const route of mutualCheckedRecordDotnetRoutes)
{
	const root = mutualCheckedRecordDotnetRecordRoots[route];
	const checked = await checkMutualCheckedRecordDotnetReport(
		path => readFile(join(root, path)), {
			route, producerCommit: mutualCheckedRecordDotnetProducer
		}
	);
	const recordPaths = await paths(root);
	assert.deepEqual(recordPaths, checked.recordPaths);
	for(const path of recordPaths)
		put(`${route}/records/${path}`, await readFile(join(root, path)));
	runs.push({
		route, recordCount: recordPaths.length, reportSha256: checked.reportSha256
		, package: checked.package, runtimeIdentity: checked.runtimeIdentity
		, bindingIrSha256: checked.bindingIrSha256
		, layoutSha256: checked.layoutSha256, sdkVersion: checked.sdkVersion
		, frameworkVersion: checked.frameworkVersion
		, checks: checked.result.checks, rejections: checked.result.rejections
		, hostRejections: checked.result.hostRejections, calls: checked.result.calls
		, snapshots: checked.result.snapshots, recoveries: checked.result.recoveries
		, rounds: checked.result.rounds, executions: checked.executions
		, independentBuilds: checked.independentBuilds
	});
}

const sourceSnapshots = [
	{ role: "producer", commit: mutualCheckedRecordDotnetProducer
		, paths: mutualCheckedRecordDotnetProducerSources() }
	, { role: "checker", commit: archiveCommit
		, paths: mutualCheckedRecordDotnetCheckerSources(archiveCommit) }
];
for(const snapshot of sourceSnapshots) for(const path of snapshot.paths)
	put(`sources/${snapshot.role}/${path}`
		, mutualCheckedRecordDotnetOriginal(snapshot.commit, path));
const index = {
	schemaVersion: 1, kind: "mutual-checked-record-dotnet-installed-v1"
	, producerCommit: mutualCheckedRecordDotnetProducer, archiveCommit, runtime
	, runs, sourceSnapshots
	, limitations: [
		"The archive authenticates local Linux x64/glibc 2.38 acceptance; it does not claim hosted-runner acceptance or promote support before the whole recursive-record matrix closes."
		, "Both ordinary source and independently reviewed Binding IR routes reproduce complete NuGet packages from two isolated author roots, remove author sources, install offline, relocate, and replay without consumer sources."
		, "Each route runs the unchanged typed C# caller three times with 1,359 checks, 136 rejected calls, 134 host-side rejections, 676 native calls, 676 input snapshots, 142 recoveries, and 128 repeated rounds."
		, "The fixture covers mutually recursive records and variants, transparent aliases, active Option and variant branches, exact Subtype and Fin failures, null carriers, cycles, depth limits, immutable callers, and constructor-free results."
		, "Refined callbacks, owned values, asynchronous calls, retained identity, dependent types, and broader generic recursive forms remain separate requirements."
		, "The original NuGet packages, receipts, generated C# sources, build identities, execution records, and selected producer/checker sources are retained. The complete .NET SDK and shared framework remain trusted external tools represented by recorded identities."
	]
	, files: [...files].sort(([left], [right]) => left.localeCompare(right))
		.map(([path, bytes]) => ({ path, bytes: bytes.length, sha256: sha256(bytes) }))
};
for(const [path, bytes] of files)
{
	const target = join(mutualCheckedRecordDotnetEvidence, path);
	await mkdir(dirname(target), { recursive: true });
	await writeFile(target, bytes, { flag: "wx" });
	assert.deepEqual(await readFile(target), bytes);
}
const indexBytes = Buffer.from(canonicalJson(index));
await writeFile(join(mutualCheckedRecordDotnetEvidence, "index.json"), indexBytes, {
	flag: "wx"
});
process.stdout.write(canonicalJson({
	destination: mutualCheckedRecordDotnetEvidence, files: files.size
	, bytes: [...files.values()].reduce((sum, value) => sum + value.length, 0)
	, producerCommit: mutualCheckedRecordDotnetProducer, archiveCommit
	, indexSha256: sha256(indexBytes)
}) + "\n");
