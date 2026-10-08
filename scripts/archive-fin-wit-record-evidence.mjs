/**
 * Archive the original local WIT record passes and retain the earlier failures separately.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { sha256 } from "../src/capsule/node.mjs";
import { assertFinWitRecordExecution, assertFinWitRecordReport, finWitRecordArtifacts, finWitRecordDirectory, finWitRecordEnvironment, finWitRecordFixture, finWitRecordIdentities, finWitRecordRevision, finWitRecordRuns, finWitRecordScope, finWitRecordSourcePaths } from "../tests/helpers/fin-wit-record-evidence.mjs";

const sourceBytes = new Map(finWitRecordSourcePaths.map(path => [path, execFileSync("git", ["show", `${finWitRecordRevision}:${path}`], { maxBuffer: 8 * 1024 * 1024 })]));
const readSource = async path => { assert.ok(sourceBytes.has(path), path); return sourceBytes.get(path); };
const receipt = {
	schemaVersion: 1
	, planNodes: [1442, 1448]
	, execution: "local"
	, revision: finWitRecordRevision
	, scope: finWitRecordScope, producerEnvironment: finWitRecordEnvironment
	, sourceIdentityScope: "Selected compiler, installer, fixture and consumer identities, not a complete dependency closure; the runner checked the Git revision and a clean tracked tree before each selection."
	, sourceFiles: [...sourceBytes].map(([path, bytes]) => ({ path, sha256: sha256(bytes) }))
	, priorFailures: {
		local: { artifact: "canonical-wit-baseline.log"
			, outcome: "failure"
			, tool: "wasm-tools 1.245.1"
			, meaning: "The unmodified assertions accept compact generator text and reject the actual canonical WIT output. This log is not an installed consumer pass." }
		, hosted: { artifact: "hosted-f9d5ce9-failure.log", outcome: "failure"
			, revision: "f9d5ce96eb04ec800209c6a6863092b3bdea6e85"
			, runId: 37736101772
			, jobId: 113176414728
			, url: "https://github.com/seanmorris/lean-bridge/actions/runs/37736101772/job/113176414728"
			, meaning: "Both record selections failed before consumer execution; the local repaired passes are separate observations." }
	}
	, runs: [], artifacts: []
};
const pending = [];
for(const artifact of finWitRecordArtifacts)
{
	const bytes = await readFile(artifact.originalPath);
	assert.equal(sha256(bytes), artifact.sha256, artifact.originalPath);
	const reference = { path: `${finWitRecordDirectory}/${artifact.name}`, originalPath: artifact.originalPath, sha256: artifact.sha256, bytes: bytes.length };
	pending.push({ reference, bytes }); receipt.artifacts.push(reference);
}
const content = name => pending.find(item => item.reference.path === `${finWitRecordDirectory}/${name}`);
assertFinWitRecordExecution(content("execution.queue").bytes.toString(), content("execution.tap").bytes.toString());
for(const expected of finWitRecordRuns)
{
	const { reference, bytes } = content(`${expected.id}.json`), report = JSON.parse(bytes);
	const run = { id: expected.id, route: expected.route, report: reference
		, identities: finWitRecordIdentities(report)
		, fixture: await finWitRecordFixture(expected.route, readSource) };
	await assertFinWitRecordReport(report, run, readSource);
	receipt.runs.push(run);
}
// Validate all original artifacts before writing; reruns may only repeat identical bytes.
pending.push({ reference: { path: `${finWitRecordDirectory}/receipt.json` }, bytes: Buffer.from(JSON.stringify(receipt, null, 2) + "\n") });
await mkdir(finWitRecordDirectory, { recursive: true });
for(const { reference, bytes } of pending)
{
	try
	{ await writeFile(reference.path, bytes, { flag: "wx" }); }
	catch(error)
	{ if(error.code !== "EEXIST") throw error; assert.deepEqual(await readFile(reference.path), bytes, reference.path); }
}
process.stdout.write(`Archived two local WIT record passes and five provenance/failure artifacts. Receipt SHA-256 ${sha256(pending.at(-1).bytes)}\n`);
