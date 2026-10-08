/**
 * Copy the hosted .NET structural Fin reports of run 37736101772 and their job provenance without
 * changing their original bytes (#1441/#1442).
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { sha256 } from "../src/capsule/node.mjs";
import { assertFinDotnetExecution, assertFinDotnetReport, finDotnetDirectory, finDotnetHosted, finDotnetIdentities, finDotnetProvenance, finDotnetRevision, finDotnetRuns, finDotnetSourcePaths } from "../tests/helpers/fin-dotnet-hosted-evidence.mjs";

const { runId, jobId, jobName, artifactId, artifactName, artifactBytes, artifactSha256 } = finDotnetHosted;
const original = path => execFileSync("git", ["show", `${finDotnetRevision}:${path}`], { maxBuffer: 8 * 1024 * 1024 });
const zip = await readFile(finDotnetHosted.artifactPath);
assert.equal(zip.length, finDotnetHosted.artifactBytes); assert.equal(sha256(zip), finDotnetHosted.artifactSha256);
const fetchedAt = (await readFile("build/vo1220-hosted-fin-f9d5ce9/metadata/job-113176414688.fetched-at", "utf8")).trim();
assert.match(fetchedAt, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/u);
const receipt = {
	schemaVersion: 1, planNodes: [1441, 1442], execution: "hosted"
	, revision: finDotnetRevision
	, hosted: { runId, jobId, jobName, jobConclusion: "success"
		, selectionStep: "15 Compare installed NuGet corpus packages with fresh Lean results"
		, jobMetadataFetchedAt: fetchedAt
		, artifact: { id: artifactId, name: artifactName
			, bytes: artifactBytes, sha256: artifactSha256
			, githubDigest: `sha256:${artifactSha256}`, retained: false } }
	, scope: { profiles: ["dotnet"]
		, sourcePaths: ["ordinary-source", "reviewed-ir"]
		, families: ["product", "product-array", "record"], dispatchObserved: false
		, hostedCi: true, binaryArchivesRetained: false
		, wholeRun: "Only this successful .NET job is archived; other jobs of the run are separate and several failed." }
	, environment: {
		printed: { runnerImage: "ubuntu-24.04 Version: 20260927.320.1"
			, node: "22.23.3 (setup-node cache path)"
			, lean: "Lean (version 4.32.2, x86_64-unknown-linux-gnu, commit f3b06c705e6c85f5314019d5d3baab0fec5b580c, Release)"
			, dotnetSdk: "8.0.424 (dotnet-install: Installed version)"
			, ruby: "ruby 3.3.12 (2026-07-16 revision 0581089df9) [x86_64-linux]" }
		, configured: { nodeVersionInput: "22", dotnetVersionInput: "8.0.424"
			, rubyVersionInput: "3.3.12" }
		, nativeGlibcFloor: { override: "absent from the job log"
			, declaredMinimum: "2.38"
			, source: "default in src/build/native-c-projection.mjs at the producer revision" }
		, hostGlibcVersion: "absent: the job never printed it; the declared minimum is not a measurement" }
	, compilerFreePath: "No Lean or producer toolchain on the consumer path. The C# caller still restores the package offline from a local feed and builds with the .NET 8 SDK."
	, sourceIdentityScope: "Selected compiler, package, harness, fixture and caller files at the hosted revision, not a complete dependency closure."
	, sourceTreeCheck: "Each report's sourceTreeSha256 equals the tree rebuilt from the pinned fixture files, the generated lean-bridge.exports.json and, for reviewed runs, the generated api.binding-ir.json, using the formula of src/analyze/lean-project.mjs."
	, sourceFiles: finDotnetSourcePaths.map(path => ({ path, sha256: sha256(original(path)) }))
	, provenance: {}, runs: [], artifacts: []
};
const pending = [];
const keep = (name, bytes, originalPath) => {
	const reference = { path: `${finDotnetDirectory}/${name}`, originalPath, sha256: sha256(bytes), bytes: bytes.length };
	pending.push({ reference, bytes }); receipt.artifacts.push(reference);
	return reference;
};
const texts = {};
for(const [key, expected] of Object.entries(finDotnetProvenance))
{
	const bytes = await readFile(expected.originalPath);
	assert.equal(sha256(bytes), expected.sha256, expected.originalPath);
	receipt.provenance[key] = keep(expected.name, bytes, expected.originalPath);
	texts[key] = bytes.toString();
}
assertFinDotnetExecution(JSON.parse(texts.job), JSON.parse(texts.artifact), texts.log);
for(const expected of finDotnetRuns)
{
	// Report bytes come straight from the hash-checked artifact ZIP member.
	const bytes = execFileSync("/usr/bin/unzip", ["-p", finDotnetHosted.artifactPath, expected.member], { maxBuffer: 8 * 1024 * 1024 });
	assert.equal(sha256(bytes), expected.reportSha256, expected.member);
	const report = keep(`${expected.id}.json`, bytes, `${finDotnetHosted.artifactPath}!${expected.member}`);
	const data = JSON.parse(bytes);
	const run = { id: expected.id, family: expected.family, route: expected.route, member: expected.member, report, identities: finDotnetIdentities(data) };
	await assertFinDotnetReport(data, run, async path => original(path));
	receipt.runs.push(run);
}
// Check everything before writing. Refuse different existing evidence; allow exact reruns.
await mkdir(finDotnetDirectory, { recursive: true });
pending.push({ reference: { path: `${finDotnetDirectory}/receipt.json` }, bytes: Buffer.from(JSON.stringify(receipt, null, 2) + "\n") });
for(const { reference, bytes } of pending)
{
	try
	{ await writeFile(reference.path, bytes, { flag: "wx" }); }
	catch(error)
	{ if(error.code !== "EEXIST") throw error; assert.deepEqual(await readFile(reference.path), bytes, reference.path); }
}
process.stdout.write(`Archived ${receipt.runs.length} hosted reports and ${receipt.artifacts.length - receipt.runs.length} provenance files. Receipt SHA-256 ${sha256(pending.at(-1).bytes)}\n`);
