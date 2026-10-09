/**
 * Authenticate the hosted ordinary npm generic-record acceptance of run 37736101772 (#1433): the direct
 * and specialized Node/strict TypeScript reports from the job's artifact, the job metadata and original
 * log, and the producer sources at f9d5ce9.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { genericRecordNodeConsumer } from "./generic-record-packages.mjs";
import { genericRecordSpecializations, specializedGenericRecordCase } from "./generic-record-specializations.mjs";

export const genericNpmDirectory = "docs/evidence/generic-record-npm-hosted-20261008";
export const genericNpmRevision = "f9d5ce96eb04ec800209c6a6863092b3bdea6e85";
const hostedRoot = "build/vo1433-hosted-npm-f9d5ce9";
export const genericNpmHosted = Object.freeze({
	runId: 37736101772
	, jobId: 113176414840
	, jobName: "Node and browser npm consumers"
	, artifactId: 11536871810
	, artifactName: `type-corpus-npm-${genericNpmRevision}`
	, artifactBytes: 40220906
	, artifactSha256: "d41728bf336af16d326a05d97bf468bdc117ff704f58529facedc6bc676debab"
	, artifactPath: `${hostedRoot}/zips/type-corpus-npm-${genericNpmRevision}.zip`
	, fetchedAtPath: `${hostedRoot}/metadata/job-113176414840.fetched-at`
});
const provenanceFile = (name, directory, digest) => ({ name, originalPath: `${hostedRoot}/${directory}/${name}`, sha256: digest });
export const genericNpmProvenance = Object.freeze({
	log: provenanceFile("job-113176414840.log", "logs", "019093cc68c6ff158ba9e319ca0b94d18f087ce386f898334d2e8359d3347000")
	, job: provenanceFile("job-113176414840.json", "metadata", "2354cb6d735a45aa2351291e99349d643d97ab8ae32a42ac2a8867f6fb878922")
	, artifact: provenanceFile("artifact-11536871810.json", "metadata", "b7e6b34caf11608bb52005ccfee6fc95225f18b1df171300692b50b9309c0ccb") });
/**
 * One installed npm report inside the artifact, with its original digest, measured counts and selected test.
 *
 * @param id - Archive name.
 * @param member - Artifact ZIP member.
 * @param reportSha256 - Original report digest.
 * @param checks - Measured checks.
 * @param rejections - Measured rejections.
 * @param name - Selected test that wrote it.
 */
const run = (id, member, reportSha256, checks, rejections, name) => Object.freeze({ id, member, reportSha256, checks, rejections, test: name });
export const genericNpmRuns = Object.freeze([
	run("direct", "generic-records/npm.json", "9f3578da2d3f273b0742b04c6d65cd20922c391a766df2458ba6a7f716694cbf", 1010, 1005
		, "installed npm packages carry alias-named generic records with their instantiation provenance")
	, run("specialized", "generic-records/specialized-npm.json", "a715eb737ae37cbacea0598e21a85421db41bcab7af1dae3253ed15454428dea", 1019, 1010
		, "installed npm packages specialize generic functions over records in two namespaces and Option/List aliases")
]);
/** Selected producer sources at the hosted revision: the selected test, its package and specialization harnesses, fixtures and the workflow. */
export const genericNpmSourcePaths = Object.freeze([
	"tests/generic-records.test.mjs"
	, "tests/helpers/generic-record-packages.mjs"
	, "tests/helpers/generic-record-specializations.mjs"
	, "tests/helpers/copied-fixture-install.mjs"
	, "tests/helpers/lake-workspace.mjs"
	, "tests/fixtures/onboarding/generic-records/GenericRecords.lean"
	, "tests/fixtures/onboarding/generic-records/LICENSE"
	, "tests/fixtures/onboarding/generic-records/lakefile.toml"
	, "tests/fixtures/onboarding/generic-records/lean-toolchain"
	, "tests/fixtures/onboarding/generic-records/package.json"
	, "tests/fixtures/generic-record-specializations.lean"
	, "src/release/component-npm-package.mjs"
	, "src/release/component-package-receipt.mjs"
	, "src/binding-ir/canonical.mjs"
	, "src/build/process-runner.mjs"
	, ".github/workflows/consumer-matrix.yml"
]);
const step = "Compile locked and dependency-free projects and install relocated npm releases offline";
const enforce = "Enforce Node support and the browser corpus";
const escape = text => text.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");

/**
 * Validate the completed job, its artifact and the original log's selection, results and printed tools.
 *
 * @param job - GitHub job metadata.
 * @param artifact - GitHub artifact metadata.
 * @param log - Original job log.
 */
export const assertGenericNpmExecution = (job, artifact, log) => {
	const { runId, jobId, jobName, artifactId, artifactName, artifactBytes, artifactSha256 } = genericNpmHosted;
	assert.deepEqual([job.id, job.run_id, job.head_sha, job.name, job.status, job.conclusion], [jobId, runId, genericNpmRevision, jobName, "completed", "success"]);
	const selection = job.steps.find(item => item.number === 11), enforcement = job.steps.find(item => item.number === 33);
	assert.deepEqual([selection?.name, selection?.status, selection?.conclusion], [step, "completed", "success"]);
	// The enforcement step runs only when a guarded acceptance outcome was not success.
	assert.deepEqual([enforcement?.name, enforcement?.conclusion], [enforce, "skipped"]);
	assert.deepEqual([artifact.id, artifact.name, artifact.size_in_bytes, artifact.digest, artifact.workflow_run.id, artifact.workflow_run.head_sha]
		, [artifactId, artifactName, artifactBytes, `sha256:${artifactSha256}`, runId, genericNpmRevision]);
	const lines = log.split("\n").map(line => line.replace(/^\d{4}-\d\d-\d\dT[\d:.]+Z /u, ""));
	const index = (text, from = 0) => {
		const at = lines.indexOf(text, from);
		assert.ok(at >= 0, text);
		return at;
	};
	// Versions the hosted run printed, as opposed to inputs it was configured with.
	const printed = [
		"Image: ubuntu-24.04"
		, "Version: 20260927.320.1"
		, "Found in cache @ /opt/hostedtoolcache/node/22.23.3/x64"
		, "leanprover/lean4:v4.32.2 installed - Lean (version 4.32.2, x86_64-unknown-linux-gnu, commit f3b06c705e6c85f5314019d5d3baab0fec5b580c, Release)"
	];
	for(const text of printed) index(text);
	const selected = index("\u001b[36;1mnode --test tests/generic-records.test.mjs\u001b[0m");
	assert.deepEqual(lines.slice(selected + 1, selected + 3), ["\u001b[36;1mtest -s build/generic-records/npm.json\u001b[0m", "\u001b[36;1mtest -s build/generic-records/specialized-npm.json\u001b[0m"]);
	let previous = selected;
	for(const selection of genericNpmRuns)
	{
		const at = lines.findIndex((line, position) => position > previous && new RegExp(`^ok \\d+ - ${escape(selection.test)}$`, "u").test(line));
		assert.ok(at > previous, selection.test);
		previous = at;
	}
	const summary = index("# tests 75", previous);
	assert.deepEqual(lines.slice(summary, summary + 7).filter(line => !line.startsWith("# suites")), ["# tests 75", "# pass 67", "# fail 0", "# cancelled 0", "# skipped 8", "# todo 0"]);
	assert.ok(!lines.slice(selected, summary).some(line => line.startsWith("not ok ")), "no failed generic-record test");
};

const keys = ["abi", "archiveSha256", "bindingIrFileSha256", "bindingIrSha256", "checks", "compilerFreePath", "consumerSha256", "dispatch", "independentBuilds", "offlineInstall", "profile", "receipt", "receiptSha256", "rejections", "reproducible", "runtimeArchiveSha256", "schemaVersion", "sourceRemovedBeforeInstallation", "typescript"];

/**
 * Validate one hosted ordinary npm report: isolation, reproduction, counts, caller, receipt relations and,
 * for the specialized run, the nine configured applications.
 *
 * @param report - Original parsed report.
 * @param run - Expected run from genericNpmRuns.
 */
export const assertGenericNpmReport = async (report, run) => {
	const specialized = run.id === "specialized";
	assert.deepEqual(Object.keys(report).sort(), [...keys, ...specialized ? ["specializations"] : []].sort());
	// An ordinary-source report carries no reviewed path.
	assert.equal(Object.hasOwn(report, "path"), false);
	assert.deepEqual([report.schemaVersion, report.profile, report.abi, report.dispatch, report.independentBuilds], [1, "npm", 7, "not measured", 2]);
	for(const flag of ["reproducible", "sourceRemovedBeforeInstallation", "offlineInstall", "compilerFreePath"]) assert.equal(report[flag], true, flag);
	assert.deepEqual([report.checks, report.rejections], [run.checks, run.rejections]);
	for(const key of ["archiveSha256", "runtimeArchiveSha256", "bindingIrSha256", "bindingIrFileSha256", "receiptSha256", "consumerSha256"]) assert.match(report[key], /^[a-f0-9]{64}$/u, key);
	assert.equal(report.consumerSha256, sha256(specialized ? await specializedGenericRecordCase.nodeConsumer() : genericRecordNodeConsumer()), "caller");
	assert.deepEqual(Object.keys(report.typescript).sort(), ["declarationsSha256", "skipLibCheck", "sourceSha256", "strict"]);
	assert.deepEqual([report.typescript.strict, report.typescript.skipLibCheck], [true, false]);
	for(const key of ["sourceSha256", "declarationsSha256"]) assert.match(report.typescript[key], /^[a-f0-9]{64}$/u, key);
	assert.equal(report.receiptSha256, sha256(canonicalJson(report.receipt)));
	assert.equal(report.receipt.kind, "lean-bridge-component-package-receipt");
	assert.equal(report.receipt.bindingIrSha256, report.bindingIrSha256);
	assert.equal(report.receipt.package.sha256, report.archiveSha256);
	assert.equal(report.receipt.runtime.sha256, report.runtimeArchiveSha256);
	assert.equal(report.receipt.package.package, "onboarding-small@1.0.0");
	assert.deepEqual(report.receipt.policies, { componentCompiledOnce: true, nativeCallablesOnly: true, runtimeBinaryInComponent: false, runtimeShared: true });
	if(specialized) assert.deepEqual(report.specializations, genericRecordSpecializations("OnboardingSmall"));
};

/**
 * The receipt's fixed statement of scope; artifacts, sources and the fetch time come from the archived bytes.
 *
 * @param root0 - Archived references.
 * @param root0.artifacts - Archived file references.
 * @param root0.sourceFiles - Producer source pins.
 * @param root0.fetchedAt - When the job metadata was fetched.
 */
export const genericNpmReceipt = ({ artifacts, sourceFiles, fetchedAt }) => ({
	schemaVersion: 1
	, planNode: 1433
	, execution: "hosted"
	, revision: genericNpmRevision
	, hosted: {
		runId: genericNpmHosted.runId
		, jobId: genericNpmHosted.jobId
		, jobName: genericNpmHosted.jobName
		, jobConclusion: "success"
		, selectionStep: `11 ${step}`
		, enforcementStep: `33 ${enforce}: skipped, so every guarded acceptance outcome was success`
		, jobMetadataFetchedAt: fetchedAt
		, artifact: {
			id: genericNpmHosted.artifactId
			, name: genericNpmHosted.artifactName
			, bytes: genericNpmHosted.artifactBytes
			, sha256: genericNpmHosted.artifactSha256
			, githubDigest: `sha256:${genericNpmHosted.artifactSha256}`
			, retained: false
		}
	}
	, scope: {
		profiles: ["node-javascript", "node-typescript"]
		, sourcePath: "ordinary-source"
		, cases: ["direct alias-named generic records", "nine configured specializations over record, List and Option aliases in two namespaces"]
		, isolation: "Two author builds reproduce the npm archives; the author and build directories are deleted before offline installation, and Node runs with a Node-only PATH. Strict TypeScript checks the installed declarations with skipLibCheck disabled."
		, engine: "Hosted ubuntu-24.04 runner; the locked Nix component engine and the CI lazy runtime root, not a local producer."
		, dispatch: "not measured"
		, hostedCi: true
		, binaryArchivesRetained: false
		, supersedes: "d5705ff's earlier ordinary npm report, which retained author/build inputs; renamed-directory runs are not deletion evidence."
		, wholeRun: "Only this successful Node job is archived; other jobs of the run are separate and several failed." }
	, sourceIdentityScope: "Selected test, harness, fixture, packaging and workflow files at the hosted revision, not a complete dependency closure."
	, sourceFiles, artifacts
});

/** The archive's exact path set besides its receipt. */
export const genericNpmArchivePaths = Object.freeze([
	...Object.values(genericNpmProvenance).map(file => `${genericNpmDirectory}/${file.name}`)
	, ...genericNpmRuns.map(run => `${genericNpmDirectory}/${run.id}.json`)
]);

/**
 * Write archived bytes once; an existing file, receipt included, must already hold exactly these bytes.
 *
 * @param path - Archive path.
 * @param bytes - Exact bytes.
 */
export const writeGenericNpmArtifact = async (path, bytes) => {
	await mkdir(dirname(path), { recursive: true });
	try
	{ await writeFile(path, bytes, { flag: "wx" }); }
	catch(error)
	{
		if(error.code !== "EEXIST") throw error;
		assert.ok((await readFile(path)).equals(bytes), `${path} already holds different bytes`);
	}
};

/**
 * Authenticate the archive: the exact path set before any read, every digest and provenance path, the fixed
 * receipt, the job and log, both reports and, unless disabled, the current sources at their pins.
 *
 * @param receipt - Parsed receipt.
 * @param read - Read archived or repository bytes for a repository-relative path.
 * @param options - Validation options.
 * @param options.currentSources - Also require the current sources to reach their hosted digests.
 */
export const assertGenericNpmArchive = async (receipt, read, { currentSources = true } = {}) => {
	assert.ok(Array.isArray(receipt.artifacts) && Array.isArray(receipt.sourceFiles));
	const paths = receipt.artifacts.map(artifact => artifact?.path);
	assert.deepEqual([...paths].sort(), [...genericNpmArchivePaths].sort(), "the exact archive path set");
	assert.equal(new Set(paths).size, paths.length);
	assert.deepEqual(receipt.sourceFiles.map(file => file?.path), genericNpmSourcePaths);
	assert.match(receipt.hosted?.jobMetadataFetchedAt ?? "", /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/u);
	assert.deepEqual(receipt, genericNpmReceipt({ artifacts: receipt.artifacts, sourceFiles: receipt.sourceFiles, fetchedAt: receipt.hosted.jobMetadataFetchedAt }));
	const files = {};
	for(const artifact of receipt.artifacts)
	{
		const bytes = await read(artifact.path);
		assert.equal(bytes.length, artifact.bytes, artifact.path); assert.equal(sha256(bytes), artifact.sha256, artifact.path);
		files[artifact.path.split("/").at(-1)] = bytes.toString();
	}
	for(const file of Object.values(genericNpmProvenance))
	{
		const artifact = receipt.artifacts.find(item => item.path === `${genericNpmDirectory}/${file.name}`);
		assert.deepEqual([artifact.originalPath, artifact.sha256], [file.originalPath, file.sha256], file.name);
	}
	assertGenericNpmExecution(JSON.parse(files["job-113176414840.json"]), JSON.parse(files["artifact-11536871810.json"]), files["job-113176414840.log"]);
	for(const run of genericNpmRuns)
	{
		const artifact = receipt.artifacts.find(item => item.path === `${genericNpmDirectory}/${run.id}.json`);
		assert.deepEqual([artifact.originalPath, artifact.sha256], [`${genericNpmHosted.artifactPath}!${run.member}`, run.reportSha256], run.id);
		await assertGenericNpmReport(JSON.parse(files[`${run.id}.json`]), run);
	}
	for(const file of currentSources ? receipt.sourceFiles : [])
		assert.equal(sha256(beforeFinRefinementSource(file.path, await read(file.path), file.sha256)), file.sha256, file.path);
};
