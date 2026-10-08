/**
 * Copy already completed #1441/#1442 evidence without changing its original bytes.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { sha256 } from "../src/capsule/node.mjs";
import { assertFinPythonRubyExecution, assertFinPythonRubyReport, finPythonRubyDirectory, finPythonRubyIdentities, finPythonRubyRevision, finPythonRubyRuntimes, finPythonRubySourcePaths, finPythonRubySteps } from "../tests/helpers/fin-python-ruby-evidence.mjs";

const receipt = {
	schemaVersion: 1, planNodes: [1441, 1442], execution: "local"
	, revision: finPythonRubyRevision
	, scope: { profiles: ["python", "ruby"]
		, sourcePaths: ["ordinary-source", "reviewed-ir"]
		, families: ["product", "product-array", "record"], dispatchObserved: false
		, hostedCi: false, binaryArchivesRetained: false }
	, producerEnvironment: { nodeVersion: "v22.23.2", hostGlibcVersion: "2.36"
		, nativeGlibcFloor: "2.36", cpu: 3, concurrency: 1, minimumFreeMiB: 2048
		, leanToolchain: "leanprover/lean4:v4.32.2"
		, leanThreads: 1, ompThreads: 1, makeJobs: 1 }
	, sourceFiles: finPythonRubySourcePaths.map(path => ({ path, sha256: sha256(execFileSync("git", ["show", `${finPythonRubyRevision}:${path}`], { maxBuffer: 8 * 1024 * 1024 })) }))
	, runtimes: [], runs: [], artifacts: []
};
const pending = [];
const collect = async (original, name, digest) => {
	const bytes = await readFile(original);
	assert.equal(sha256(bytes), digest, original);
	const reference = { path: `${finPythonRubyDirectory}/${name}`, originalPath: original, sha256: digest, bytes: bytes.length };
	pending.push({ reference, bytes }); receipt.artifacts.push(reference);
	return reference;
};
for(const runtime of finPythonRubyRuntimes)
{
	const prefix = `build/vo1441-${runtime.id}`;
	const tap = await collect(`${prefix}-72c5e27.tap`, `${runtime.id}.tap`, runtime.tap);
	const queue = await collect(`${prefix}-72c5e27.queue`, `${runtime.id}.queue`, runtime.queue);
	const runner = await collect(`${prefix}-queue-72c5e27.mjs`, `${runtime.id}.runner.mjs.txt`, runtime.runner);
	assertFinPythonRubyExecution(runtime, await readFile(queue.originalPath, "utf8"), await readFile(tap.originalPath, "utf8"));
	receipt.runtimes.push({ id: runtime.id, profile: runtime.profile, version: runtime.version, tap, queue, runner });
	for(const [index, step] of finPythonRubySteps.entries())
	{
		const report = await collect(`${prefix}-${step.id}-72c5e27.json`, `${runtime.id}-${step.id}.json`, runtime.reports[index]);
		const data = JSON.parse(await readFile(report.originalPath, "utf8"));
		const run = { id: `${runtime.id}-${step.id}`, runtime: runtime.id
			, profile: runtime.profile, family: step.family, route: step.route
			, report, identities: finPythonRubyIdentities(data) };
		await assertFinPythonRubyReport(data, run);
		receipt.runs.push(run);
	}
}
// Check every source and report before writing. Refuse different existing evidence; allow exact reruns.
await mkdir(finPythonRubyDirectory, { recursive: true });
pending.push({ reference: { path: `${finPythonRubyDirectory}/receipt.json` }, bytes: Buffer.from(JSON.stringify(receipt, null, 2) + "\n") });
for(const { reference, bytes } of pending)
{
	try
	{ await writeFile(reference.path, bytes, { flag: "wx" }); }
	catch(error)
	{ if(error.code !== "EEXIST") throw error; assert.deepEqual(await readFile(reference.path), bytes, reference.path); }
}
process.stdout.write(`Archived ${receipt.runs.length} reports and ${receipt.artifacts.length - receipt.runs.length} execution artifacts. Receipt SHA-256 ${sha256(pending.at(-1).bytes)}\n`);
