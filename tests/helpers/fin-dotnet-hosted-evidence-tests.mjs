/**
 * Keep the archived hosted .NET structural Fin runs tied to their completed job, artifact and original bytes.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { assertFinDotnetExecution, assertFinDotnetReport, finDotnetDirectory, finDotnetFixture, finDotnetHosted, finDotnetProvenance, finDotnetRevision, finDotnetRuns, finDotnetSourcePaths } from "./fin-dotnet-hosted-evidence.mjs";

const receipt = async () => {
	const bytes = await readFile(`${finDotnetDirectory}/receipt.json`);
	assert.equal(sha256(bytes), "12f88711ff9cba2950e7133d62b6274e87e6df14d40591af130fdb5355732124");
	return JSON.parse(bytes);
};
const readOriginal = async reference => {
	const bytes = await readFile(reference.path);
	assert.equal(bytes.length, reference.bytes);
	assert.equal(sha256(bytes), reference.sha256, reference.path);
	return bytes;
};
/**
 * Read only pinned sources, after rewinding recorded later edits and proving the hosted revision's bytes.
 *
 * @param record - Authenticated receipt.
 */
const pinnedReader = async record => {
	const sources = new Map();
	for(const source of record.sourceFiles)
	{
		const bytes = beforeFinRefinementSource(source.path, await readFile(source.path), source.sha256);
		assert.equal(sha256(bytes), source.sha256, source.path); sources.set(source.path, bytes);
	}
	return async path => { assert.ok(sources.has(path), `${path} is not pinned`); return sources.get(path); };
};
const provenance = async record => Object.fromEntries(await Promise.all(Object.entries(record.provenance)
	.map(async ([key, reference]) => [key, (await readOriginal(reference)).toString()])));

test("hosted .NET evidence authenticates six original reports, the completed job and its artifact", async () => {
	const record = await receipt();
	assert.equal(record.schemaVersion, 1); assert.deepEqual(record.planNodes, [1441, 1442]);
	assert.equal(record.execution, "hosted"); assert.equal(record.revision, finDotnetRevision);
	const { runId, jobId, artifactId, artifactName, artifactBytes, artifactSha256 } = finDotnetHosted;
	assert.deepEqual([record.hosted.runId, record.hosted.jobId, record.hosted.jobConclusion], [runId, jobId, "success"]);
	assert.deepEqual(record.hosted.artifact, { id: artifactId, name: artifactName
		, bytes: artifactBytes, sha256: artifactSha256
		, githubDigest: `sha256:${artifactSha256}`, retained: false });
	assert.deepEqual(record.scope, { profiles: ["dotnet"]
		, sourcePaths: ["ordinary-source", "reviewed-ir"]
		, families: ["product", "product-array", "record"], dispatchObserved: false
		, hostedCi: true, binaryArchivesRetained: false
		, wholeRun: "Only this successful .NET job is archived; other jobs of the run are separate and several failed." });
	// Printed versions, configured inputs and absent facts stay distinct.
	assert.equal(record.environment.printed.dotnetSdk, "8.0.424 (dotnet-install: Installed version)");
	assert.deepEqual(record.environment.configured, { nodeVersionInput: "22", dotnetVersionInput: "8.0.424", rubyVersionInput: "3.3.12" });
	assert.equal(record.environment.nativeGlibcFloor.declaredMinimum, "2.38");
	assert.match(record.environment.hostGlibcVersion, /^absent/u);
	assert.match(record.compilerFreePath, /\.NET 8 SDK/u);
	assert.match(record.sourceIdentityScope, /not a complete dependency closure/u);
	assert.deepEqual(record.sourceFiles.map(file => file.path), finDotnetSourcePaths);
	const read = await pinnedReader(record);
	const texts = await provenance(record);
	for(const [key, expected] of Object.entries(finDotnetProvenance))
		assert.deepEqual([record.provenance[key].path, record.provenance[key].sha256], [`${finDotnetDirectory}/${expected.name}`, expected.sha256]);
	assertFinDotnetExecution(JSON.parse(texts.job), JSON.parse(texts.artifact), texts.log);
	assert.deepEqual(record.runs.map(run => run.id), finDotnetRuns.map(run => run.id));
	for(const [index, expected] of finDotnetRuns.entries())
	{
		const run = record.runs[index];
		assert.deepEqual([run.family, run.route, run.member], [expected.family, expected.route, expected.member]);
		assert.equal(run.report.sha256, expected.reportSha256);
		assert.equal(run.report.originalPath, `${finDotnetHosted.artifactPath}!${expected.member}`);
		await assertFinDotnetReport(JSON.parse(await readOriginal(run.report)), run, read);
	}
	assert.deepEqual(record.artifacts, [...Object.values(record.provenance), ...record.runs.map(run => run.report)]);
});

test("hosted .NET report checks refuse changed counts, routes, trees, identities, flags and invented dispatch", async () => {
	const record = await receipt(), read = await pinnedReader(record);
	const mutations = [
		["wrong count", report => { report.reports[0].checks++; }]
		, ["wrong host", report => { report.reports[0].profile = "ruby"; }]
		, ["wrong route", report => { report.reports[0].path = report.reports[0].path === "reviewed-ir" ? "ordinary-source" : "reviewed-ir"; }]
		, ["changed bound", report => { report.reports[0].refinements = JSON.parse(JSON.stringify(report.reports[0].refinements).replace(/"bound":"\d+"/u, '"bound":"987654321"')); }]
		, ["not reproducible", report => { report.reproducible = false; }]
		, ...["offlineInstall", "compilerFreePath", "sourceRemovedBeforeInstallation"].map(flag => [`false ${flag}`, report => { report.reports[0][flag] = false; }])
		, ...["consumerSha256", "modelSha256", "bindingIrSha256", "sourceTreeSha256", "receiptSha256"].map(key => [key, report => { report.reports[0][key] = "f".repeat(64); }])
		, ["invented dispatch", report => { report.reports[0].dispatch = { observed: true }; }]
		, ["invented measurement", report => { report.measuredGlibc = "2.39"; }]
		, ["missing selection", report => { report.reports = []; }]
		, ["extra archive", report => { report.archives["archives/extra.nupkg"] = "a".repeat(64); }]
		, ["wrong package format", report => { report.reports[0].packages[0].artifacts[0].path = report.reports[0].packages[0].artifacts[0].path.replace(".nupkg", ".zip"); }]
		, ["wrong runtime bytes", report => { report.reports[0].packages[0].runtimeIdentity = "a".repeat(64); }]
		, ["invented or wrong review", report => { report.reports[0].reviewedSourceSha256 = "a".repeat(64); }]
	];
	for(const run of record.runs)
	{
		const original = JSON.parse(await readOriginal(run.report));
		for(const [label, edit] of mutations)
		{
			const changed = structuredClone(original); edit(changed);
			await assert.rejects(() => assertFinDotnetReport(changed, run, read), assert.AssertionError, `${run.id}: ${label}`);
		}
		// The recorded tree belongs to this route and these exact fixture bytes.
		const tree = await finDotnetFixture(run.family, run.route, read);
		assert.notEqual((await finDotnetFixture(run.family, run.route === "reviewed" ? "ordinary" : "reviewed", read)).sha256, tree.sha256);
		const changedFixture = async path => path.endsWith("lakefile.toml") ? Buffer.concat([await read(path), Buffer.from("\n")]) : read(path);
		await assert.rejects(() => assertFinDotnetReport(original, run, changedFixture), assert.AssertionError, `${run.id}: fixture`);
		const config = tree.inputs.find(input => input.path === "lean-bridge.exports.json");
		const changedConfig = tree.inputs.map(input => input === config ? { ...input, sha256: sha256(canonicalJson({})) } : input);
		assert.notEqual(sha256(changedConfig.map(input => `${input.sha256}  ${input.path}\n`).join("")), original.reports[0].sourceTreeSha256);
	}
});

test("hosted .NET execution checks refuse a different job, artifact, tool, floor claim or selection outcome", async () => {
	const record = await receipt(), texts = await provenance(record);
	const job = JSON.parse(texts.job), artifact = JSON.parse(texts.artifact), log = texts.log;
	assertFinDotnetExecution(job, artifact, log);
	const failedStep = structuredClone(job); failedStep.steps.find(step => step.number === 15).conclusion = "failure";
	const changes = [
		["failed job", { ...job, conclusion: "failure" }, artifact, log]
		, ["other revision", { ...job, head_sha: "a".repeat(40) }, artifact, log]
		, ["other job", { ...job, id: job.id + 1 }, artifact, log]
		, ["failed selection step", failedStep, artifact, log]
		, ["other artifact digest", job, { ...artifact, digest: `sha256:${"a".repeat(64)}` }, log]
		, ["artifact from another run", job, { ...artifact, workflow_run: { ...artifact.workflow_run, id: 1 } }, log]
		, ["other SDK", job, artifact, log.replace("Installed version is 8.0.424", "Installed version is 8.0.400")]
		, ["other Lean", job, artifact, log.replace("installed - Lean (version 4.32.2", "installed - Lean (version 4.31.0")]
		, ["claimed floor override", job, artifact, log.replace("##[group]Run ruby/setup-ruby@v1", "LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36\n##[group]Run ruby/setup-ruby@v1")]
		, ["failed selection", job, artifact, log.replace(/^(\S+ )ok (\d+ - relocated source-free native packages check Fin inside record fields)/mu, "$1not ok $2")]
		, ["skipped selection", job, artifact, log.replace(/^(\S+ ok \d+ - independently reviewed native packages check array-of-product bounds after source-free installation)$/mu, "$1 # SKIP")]
		, ["missing consumer", job, artifact, log.replaceAll("# installing and checking dotnet", "# installing and checking ruby")]
		, ["extra skip", job, artifact, log.replaceAll("# skipped 1", "# skipped 2")]
	];
	for(const [label, changedJob, changedArtifact, changedLog] of changes)
	{
		assert.ok(changedJob !== job || changedArtifact !== artifact || changedLog !== log, label);
		if(changedLog !== log) assert.notEqual(changedLog, log, label);
		assert.throws(() => assertFinDotnetExecution(changedJob, changedArtifact, changedLog), assert.AssertionError, label);
	}
});
