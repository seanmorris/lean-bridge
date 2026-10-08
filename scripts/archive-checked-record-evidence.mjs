/**
 * Copy the completed #1446 checked-record C/C++ and npm evidence without changing its original bytes.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { sha256 } from "../src/capsule/node.mjs";
import { assertCheckedRecordEvidenceExecution, assertCheckedRecordEvidenceReport, checkedRecordEvidenceDirectory, checkedRecordEvidenceHosts, checkedRecordEvidenceIdentities, checkedRecordEvidenceRevision, checkedRecordEvidenceRoutes, checkedRecordEvidenceSourcePaths } from "../tests/helpers/checked-record-evidence.mjs";

const receipt = {
	schemaVersion: 1, planNodes: [1446], execution: "local"
	, revision: checkedRecordEvidenceRevision
	, scope: { hosts: ["c", "cpp", "npm"], routes: checkedRecordEvidenceRoutes
		, sourcePaths: ["ordinary-source", "reviewed-source"]
		, slice: "First checked-record slice only: the fixture's records, constructors and Nat literal indices in C, C++ and npm packages; other hosts, shapes and indices remain."
		, hostedCi: false, binaryArchivesRetained: false
		, dispatch: { measured: "C ordinary and reviewed packages: nine LD_PRELOAD rows over public entry, pre-validator, constructor, adapter and source columns"
			, unmeasured: ["C++ (it calls the same C entries)", "result-only C and C++", "npm", "resident memory"] } }
	, producerEnvironment: {
		measured: { node: "v22.23.3"
			, lean: "Lean (version 4.32.2, x86_64-unknown-linux-gnu, commit f3b06c705e6c85f5314019d5d3baab0fec5b580c, Release)"
			, glibc: "ldd (Debian GLIBC 2.36-9+deb12u14) 2.36"
			, cc: "cc (Debian 12.2.0-14+deb12u1) 12.2.0"
			, typescript: "Version 5.9.3", npm: "10.9.9" }
		, measurementSource: "Each queue's tool lines, written before its selections; cc is recorded in the C/C++ queue and TypeScript and npm in the npm queue."
		, nativeGlibcFloor: { override: "unset", declaredMinimum: "2.38"
			, source: "default in src/build/native-c-projection.mjs at the producer revision; the C/C++ packages declare it in README.md and package metadata"
			, measuredHostGlibc: "2.36" }
		, npmEngine: "local pinned engine of the frozen tree (in-process executeComponentEngineRequest, backend native-nix); LEAN_BRIDGE_LAKE_ENGINE unset"
		, npmRuntimeListingSha256: "5e0429eb56c23e82c4a83b77b8b82e1dad8780ffc8dab812cb8d92ef2b7bc8b6"
		, cpu: 3, concurrency: 1, leanThreads: 1, ompThreads: 1
		, minimumFreeMiB: 2048 }
	, runner: "Each selection ran a shell command recorded verbatim in its host queue; there is no separate runner file."
	, compilerFreePath: {
		"c-cpp": "No Lean or producer toolchain on the consumer path; the C and C++ callers still compile against the installed package with the system compiler."
		, npm: "Installation and the Node caller run with a Node-only PATH; strict TypeScript runs from the engine checkout's tsc." }
	, sourceIdentityScope: "Selected compiler, package, harness, fixture and caller files, not a complete dependency closure."
	, sourceFiles: checkedRecordEvidenceSourcePaths.map(path => ({ path, sha256: sha256(execFileSync("git", ["show", `${checkedRecordEvidenceRevision}:${path}`], { maxBuffer: 8 * 1024 * 1024 })) }))
	, hosts: [], runs: [], artifacts: []
};
const pending = [];
const collect = async (original, name, digest) => {
	const bytes = await readFile(original);
	assert.equal(sha256(bytes), digest, original);
	const reference = { path: `${checkedRecordEvidenceDirectory}/${name}`, originalPath: original, sha256: digest, bytes: bytes.length };
	pending.push({ reference, bytes }); receipt.artifacts.push(reference);
	return reference;
};
for(const [host, expected] of Object.entries(checkedRecordEvidenceHosts))
{
	const prefix = "build/vo1446-checked-records";
	const queue = await collect(`${prefix}-${host}-78a4d3d.queue`, `${host}.queue`, expected.queue);
	const taps = {};
	for(const route of checkedRecordEvidenceRoutes)
		taps[route] = await collect(`${prefix}-${route}-${host}-78a4d3d.tap`, `${route}-${host}.tap`, expected.taps[route]);
	const tapText = Object.fromEntries(await Promise.all(Object.entries(taps).map(async ([route, reference]) => [route, await readFile(reference.originalPath, "utf8")])));
	assertCheckedRecordEvidenceExecution(host, await readFile(queue.originalPath, "utf8"), tapText);
	receipt.hosts.push({ id: host, queue, taps });
	for(const route of checkedRecordEvidenceRoutes)
	{
		const id = `${route}-${host}`;
		const report = await collect(`${prefix}-${id}-78a4d3d.json`, `${id}.json`, expected.reports[route]);
		const data = JSON.parse(await readFile(report.originalPath, "utf8"));
		const run = { id, host, route, report, identities: checkedRecordEvidenceIdentities(data) };
		assertCheckedRecordEvidenceReport(data, run);
		receipt.runs.push(run);
	}
}
// Check every source and report before writing. Refuse different existing evidence; allow exact reruns.
await mkdir(checkedRecordEvidenceDirectory, { recursive: true });
pending.push({ reference: { path: `${checkedRecordEvidenceDirectory}/receipt.json` }, bytes: Buffer.from(JSON.stringify(receipt, null, 2) + "\n") });
for(const { reference, bytes } of pending)
{
	try
	{ await writeFile(reference.path, bytes, { flag: "wx" }); }
	catch(error)
	{ if(error.code !== "EEXIST") throw error; assert.deepEqual(await readFile(reference.path), bytes, reference.path); }
}
process.stdout.write(`Archived ${receipt.runs.length} reports and ${receipt.artifacts.length - receipt.runs.length} execution artifacts. Receipt SHA-256 ${sha256(pending.at(-1).bytes)}\n`);
