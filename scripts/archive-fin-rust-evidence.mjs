/**
 * Copy the completed #1441/#1442 Rust evidence without changing its original bytes; receipt-v2 adds
 * the rebuilt source trees and their fixture inputs to the unchanged first receipt.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { sha256 } from "../src/capsule/node.mjs";
import { assertFinRustExecution, assertFinRustReport, finRustDirectory, finRustIdentities, finRustMeasured, finRustRevision, finRustRuntime, finRustSourcePaths, finRustSteps } from "../tests/helpers/fin-rust-evidence.mjs";

const original = path => execFileSync("git", ["show", `${finRustRevision}:${path}`], { maxBuffer: 8 * 1024 * 1024 });
const receipt = {
	schemaVersion: 2, planNodes: [1441, 1442], execution: "local"
	, revision: finRustRevision
	, priorReceipt: { path: `${finRustDirectory}/receipt.json`
		, sha256: "9a50368ec2676347dc3744ce5b2c33a41e627fb9f2bf04a95d64c6b65eac3421"
		, reason: "Rebuild each run's analyzed source tree from the original fixture inputs and pin those inputs." }
	, scope: { profiles: ["rust"]
		, sourcePaths: ["ordinary-source", "reviewed-ir"]
		, families: ["product", "product-array", "record"], dispatchObserved: false
		, hostedCi: false, binaryArchivesRetained: false }
	, producerEnvironment: { measured: { ...finRustMeasured }
		, measurementSource: "runner process.version and --version of the configured cargo, rustc, Lean, ldd and cc before any selection"
		, nativeGlibcFloor: "2.36"
		, nativeGlibcFloorSource: "configured LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR"
		, configuredCargo: "/app/.toolchains/rust-1.90.0/bin/cargo"
		, configuredRustc: "/app/.toolchains/rust-1.90.0/bin/rustc"
		, configuredLeanPrefix: "/app/.toolchains/elan/toolchains/leanprover--lean4---v4.32.2"
		, cpu: 3, concurrency: 1, minimumFreeMiB: 2048
		, leanThreads: 1, ompThreads: 1, makeJobs: 1 }
	, compilerFreePath: "No Lean or producer toolchain on the consumer path. The Rust consumer itself still runs cargo build --offline with the configured rustc and the system linker on PATH /usr/bin:/bin, from the vendored dependency archive."
	, sourceIdentityScope: "Selected compiler, installer, fixture and consumer files, not a complete dependency closure; the runner checked the recorded Git revision and a clean tracked tree before each selection."
	, sourceTreeCheck: "Each report's sourceTreeSha256 equals the tree rebuilt from the pinned fixture files, the generated lean-bridge.exports.json and, for reviewed runs, the generated api.binding-ir.json, using the formula of src/analyze/lean-project.mjs."
	, sourceFiles: finRustSourcePaths.map(path => ({ path, sha256: sha256(original(path)) }))
	, runtime: null, runs: [], artifacts: []
};
assert.equal(sha256(await readFile(receipt.priorReceipt.path)), receipt.priorReceipt.sha256);
const pending = [];
const collect = async (original, name, digest) => {
	const bytes = await readFile(original);
	assert.equal(sha256(bytes), digest, original);
	const reference = { path: `${finRustDirectory}/${name}`, originalPath: original, sha256: digest, bytes: bytes.length };
	pending.push({ reference, bytes }); receipt.artifacts.push(reference);
	return reference;
};
const runtime = finRustRuntime, prefix = `build/vo1441-${runtime.profile}`;
const tap = await collect(`${prefix}-78a4d3d.tap`, `${runtime.id}.tap`, runtime.tap);
const queue = await collect(`${prefix}-78a4d3d.queue`, `${runtime.id}.queue`, runtime.queue);
const runner = await collect(`${prefix}-queue-78a4d3d.mjs`, `${runtime.id}.runner.mjs.txt`, runtime.runner);
assertFinRustExecution(await readFile(queue.originalPath, "utf8"), await readFile(tap.originalPath, "utf8"));
receipt.runtime = { id: runtime.id, profile: runtime.profile, tap, queue, runner };
for(const [index, step] of finRustSteps.entries())
{
	const report = await collect(`${prefix}-${step.id}-78a4d3d.json`, `${runtime.id}-${step.id}.json`, runtime.reports[index]);
	const data = JSON.parse(await readFile(report.originalPath, "utf8"));
	const run = { id: `${runtime.id}-${step.id}`, profile: runtime.profile
		, family: step.family, route: step.route
		, report, identities: finRustIdentities(data) };
	await assertFinRustReport(data, run, async path => original(path));
	receipt.runs.push(run);
}
// Check every source and report before writing. Refuse different existing evidence; allow exact reruns.
await mkdir(finRustDirectory, { recursive: true });
pending.push({ reference: { path: `${finRustDirectory}/receipt-v2.json` }, bytes: Buffer.from(JSON.stringify(receipt, null, 2) + "\n") });
for(const { reference, bytes } of pending)
{
	try
	{ await writeFile(reference.path, bytes, { flag: "wx" }); }
	catch(error)
	{ if(error.code !== "EEXIST") throw error; assert.deepEqual(await readFile(reference.path), bytes, reference.path); }
}
process.stdout.write(`Archived ${receipt.runs.length} reports and ${receipt.artifacts.length - receipt.runs.length} execution artifacts. Receipt SHA-256 ${sha256(pending.at(-1).bytes)}\n`);
