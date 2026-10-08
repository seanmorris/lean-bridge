/**
 * Preserve the original reviewed callback-Fin C/C++ and npm executions from #1445.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { sha256 } from "../src/capsule/node.mjs";
import { assertReviewedCallbackFinExecution, assertReviewedCallbackFinReport, reviewedCallbackFinEvidenceDirectory, reviewedCallbackFinEvidenceFiles, reviewedCallbackFinEvidenceRevision, reviewedCallbackFinEvidenceSourcePaths, reviewedCallbackFinNativeCallers, reviewedCallbackFinNpmCallers, reviewedCallbackFinNpmFixture, reviewedCallbackFinReportIdentities } from "../tests/helpers/reviewed-callback-fin-evidence.mjs";

assert.ok(process.argv.slice(2).every(argument => argument === "--check"), "Only --check is accepted");
const readSource = path => execFileSync("git", ["show", `${reviewedCallbackFinEvidenceRevision}:${path}`], { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
const receipt = {
	schemaVersion: 1, planNodes: [1445], execution: "local"
	, revision: reviewedCallbackFinEvidenceRevision
	, scope: {
		hosts: ["c", "cpp", "node-javascript", "node-typescript"]
		, sourcePath: "reviewed-source"
		, nativeReview: "R1", npmReviews: ["R1", "R2"]
		, checkedBounds: ["3", "5", "10"]
		, nativeHostProducedRefinedReplies: false
		, npmHostProducedRefinedReplies: "R2 only"
		, slice: "The ReviewedCallbacks fixture's leased-closure arguments, Lean-produced results and arguments to host callbacks; R2 additionally exercises a scalar Fin 3 host reply through npm. This archive does not establish other hosts, recursive callbacks, Subtype, Fin 0 or bounds wider than a machine word."
		, dispatch: "not measured", hostedCi: false, binaryArchivesRetained: false
		, typescript: "Strict declaration checking with skipLibCheck false; runtime behavior uses the same Node consumer, not an independent TypeScript runtime."
	}
	, producerEnvironment: {
		node: "v22.23.3", cpu: 3, concurrency: 1
		, measurementSource: "The original queue records the Node version, CPU, concurrency and environment settings."
		, nativeGlibcFloor: { override: "2.36", declaredMinimum: "2.36", measuredHostGlibc: "not measured" }
		, unmeasuredVersions: ["host glibc", "Lean executable", "C compiler", "C++ compiler", "npm", "TypeScript"]
		, toolchainDeclaration: { path: "tests/fixtures/onboarding/reviewed-callback-fin/lean-toolchain", value: readSource("tests/fixtures/onboarding/reviewed-callback-fin/lean-toolchain").trim() }
		, nativeRuntimeRoot: "/app/build/lean-runtime"
		, npmRuntimeRoot: "/app/build/lean-link-spike/lazy"
	}
	, runner: "The original aggregate TAP and queue record three sequential node:test selections; no separate runner source is retained."
	, sourceIdentityScope: "Selected compiler, adapter, harness, caller and fixture source files, not a complete dependency closure. npm analyzed input trees are independently reconstructed from the fixture plus the harness-generated configuration and review. No native input-tree reconstruction is claimed."
	, sourceFiles: reviewedCallbackFinEvidenceSourcePaths.map(path => ({ path, sha256: sha256(readSource(path)) }))
	, reconstructed: {
		nativeCallers: await reviewedCallbackFinNativeCallers(readSource)
		, npmCallers: { ...reviewedCallbackFinNpmCallers(), scope: "Derived from the pinned harness; the original npm reports do not record caller hashes." }
		, npmInputTrees: { r1: await reviewedCallbackFinNpmFixture(false, readSource), r2: await reviewedCallbackFinNpmFixture(true, readSource) }
	}
	, runs: [], artifacts: []
};
const pending = [];
for(const [name, pinned] of Object.entries(reviewedCallbackFinEvidenceFiles))
{
	const bytes = await readFile(pinned.original);
	assert.equal(sha256(bytes), pinned.sha256, pinned.original);
	const reference = { path: `${reviewedCallbackFinEvidenceDirectory}/${name}`, originalPath: pinned.original, bytes: bytes.length, sha256: pinned.sha256 };
	receipt.artifacts.push(reference); pending.push({ reference, bytes });
	if(!name.endsWith(".json")) continue;
	const report = JSON.parse(bytes), id = name.slice(0, -5);
	const run = { id, report: reference, identities: reviewedCallbackFinReportIdentities(id, report) };
	await assertReviewedCallbackFinReport(report, run, readSource);
	receipt.runs.push(run);
}
assertReviewedCallbackFinExecution(pending.find(item => item.reference.path.endsWith(".tap")).bytes.toString(), pending.find(item => item.reference.path.endsWith(".queue")).bytes.toString());
pending.push({ reference: { path: `${reviewedCallbackFinEvidenceDirectory}/receipt.json` }, bytes: Buffer.from(JSON.stringify(receipt, null, 2) + "\n") });
// Validate everything before writing. Original evidence is immutable, including on repeat runs.
if(!process.argv.includes("--check"))
{
	await mkdir(reviewedCallbackFinEvidenceDirectory, { recursive: true });
	for(const { reference, bytes } of pending)
	{
		try
		{ await writeFile(reference.path, bytes, { flag: "wx" }); }
		catch(error)
		{ if(error.code !== "EEXIST") throw error; assert.deepEqual(await readFile(reference.path), bytes, reference.path); }
	}
}
process.stdout.write(`${process.argv.includes("--check") ? "Validated" : "Archived"} ${receipt.runs.length} reports, two execution artifacts and ${receipt.sourceFiles.length} source pins. Receipt SHA-256 ${sha256(pending.at(-1).bytes)}\n`);
