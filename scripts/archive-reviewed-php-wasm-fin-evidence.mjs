/**
 * Preserve the reviewed PHP-Wasm Fin reports, original execution and side-branch harness (#1443).
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { sha256 } from "../src/capsule/node.mjs";
import { assertReviewedPhpWasmFinExecution, assertReviewedPhpWasmFinReport, reviewedPhpWasmFinDirectory, reviewedPhpWasmFinFiles, reviewedPhpWasmFinHarness, reviewedPhpWasmFinIdentities, reviewedPhpWasmFinRevision, reviewedPhpWasmFinSourcePaths } from "../tests/helpers/reviewed-php-wasm-fin-evidence.mjs";

assert.ok(process.argv.slice(2).every(argument => argument === "--check"), "Only --check is accepted");
const readSource = path => execFileSync("git", ["show", `${reviewedPhpWasmFinRevision}:${path}`], { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
const pending = [];
for(const [name, file] of Object.entries(reviewedPhpWasmFinFiles))
{
	const bytes = await readFile(file.original);
	assert.equal(sha256(bytes), file.sha256, file.original);
	pending.push({ reference: { path: `${reviewedPhpWasmFinDirectory}/${name}`, originalPath: file.original, sha256: file.sha256, bytes: bytes.length }, bytes });
}
const archive = JSON.parse(pending[0].bytes), first = archive.reports[0].phpWasm;
const harness = Buffer.from(readSource(reviewedPhpWasmFinHarness.path));
assert.equal(sha256(harness), reviewedPhpWasmFinHarness.sha256);
const harnessArtifact = {
	path: reviewedPhpWasmFinHarness.archivePath
	, originalPath: `git:${reviewedPhpWasmFinRevision}:${reviewedPhpWasmFinHarness.path}`
	, sha256: sha256(harness), bytes: harness.length
};
pending.push({ reference: harnessArtifact, bytes: harness });
const receipt = {
	schemaVersion: 1
	, planNode: 1443
	, execution: "local"
	, revision: reviewedPhpWasmFinRevision
	, scope: {
		profile: "php-wasm", sourcePath: "reviewed-source", reviewedContracts: true
		, fixtures: [{ name: "products", exports: 11, executions: 12, checksPerExecution: 2039 }
			, { name: "records", exports: 13, executions: 12, checksPerExecution: 2053 }]
		, dispatch: "not measured", hostedCi: false, binaryArchivesRetained: false
		, subtype: false, callbacks: false, ownedOrGraphRefinements: false
	}
	, producerEnvironment: {
		nodeVersion: first.nodeVersion
		, browserVersion: first.browserVersion
		, pins: first.runtime.pins
		, cpu: 3
		, concurrency: 1
		, declaredNativeGlibcFloor: "2.36"
		, measuredHostGlibc: "not measured"
		, scope: "Node and Chromium versions come from the original report. Runtime/compiler source pins are retained from the compiled runtime receipt. The native glibc override is recorded by the queue; it does not establish a PHP-Wasm host floor."
	}
	, sourceIdentityScope: "Twenty selected producer source files, not a complete dependency closure. Nineteen are checked through exact current-source history. The original test root is retained separately because it belongs to a side branch; no claim that the later integrated harness ran in this producer. No whole input-tree reconstruction is claimed."
	, sourceFiles: reviewedPhpWasmFinSourcePaths.map(path => ({
		path
		, sha256: sha256(readSource(path))
		, ...(path === reviewedPhpWasmFinHarness.path ? { archivePath: reviewedPhpWasmFinHarness.archivePath } : {}) }))
	, identities: archive.reports.map(reviewedPhpWasmFinIdentities)
	, artifacts: pending.map(item => item.reference)
	, remaining: [
		"Promote only the exact observed source routes and parameter/result/nominal-field positions in a separate inventory change."
		, "Source and checked-adapter dispatch are not measured by this run."
		, "Subtype, callable, graph/owned and other refined combinations require separate installed acceptance."
		, "Hosted CI and release-floor acceptance are separate from this local producer."
	]
};
await assertReviewedPhpWasmFinReport(archive, receipt, readSource);
assertReviewedPhpWasmFinExecution(pending[1].bytes.toString(), pending[2].bytes.toString());
pending.push({ reference: { path: `${reviewedPhpWasmFinDirectory}/receipt.json` }, bytes: Buffer.from(JSON.stringify(receipt, null, 2) + "\n") });
if(!process.argv.includes("--check"))
{
	await mkdir(reviewedPhpWasmFinDirectory, { recursive: true });
	for(const { reference, bytes } of pending)
	{
		try
		{ await writeFile(reference.path, bytes, { flag: "wx" }); }
		catch(error)
		{ if(error.code !== "EEXIST") throw error; assert.deepEqual(await readFile(reference.path), bytes, reference.path); }
	}
}
process.stdout.write(`${process.argv.includes("--check") ? "Validated" : "Archived"} two reviewed fixtures, original TAP/queue and original test source. Receipt SHA-256 ${sha256(pending.at(-1).bytes)}\n`);
