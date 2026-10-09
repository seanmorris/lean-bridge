/**
 * Preserve the four-configuration Perl refinement corpus without treating a later job timeout as a passed job.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { sha256, canonicalJson } from "../../src/capsule/node.mjs";

export const perlRefinementDirectory = "docs/evidence/perl-refinements-hosted-20261009";
export const perlRefinementOriginals = "build/vo1431-1432-hosted-bf89eff";
export const perlRefinementRevision = "bf89effc3735069b1f069482c26ccf296026e7db";
export const perlRefinementRunId = 37847248418;
export const perlRefinementConfigurations = Object.freeze([
	{ name: "5.36.3-unthreaded", job: 113551081838, corpus: 11585293891, abi: 11586156044, conclusion: "success" }
	, { name: "5.36.3-threaded", job: 113551081915, corpus: 11587055294, abi: 11587115271, conclusion: "cancelled" }
	, { name: "5.38.2-unthreaded", job: 113551081818, corpus: 11586428535, abi: 11586059285, conclusion: "cancelled" }
	, { name: "5.38.2-threaded", job: 113551081841, corpus: 11589071939, abi: 11588568648, conclusion: "cancelled" }
]);
export const perlRefinementCases = Object.freeze([
	{ id: "subtype", member: "native-subtype/perl.json"
		, checks: 2017, path: "ordinary-source", component: "Subtypes"
		, caller: "8939a772789f50bd51d0400ef5c4f92e8f817ed2a9396ebf7fb694acd4ab2646"
		, test: "relocated source-free native packages run author-checked constructors at every refined site" }
	, { id: "container", member: "native-fin-containers/perl.json"
		, checks: 2027, path: "ordinary-source", component: "FinContainers"
		, caller: "7851aed00c573e8c2e019a64f052540329c7cf9026a03895e3a2250142499649"
		, test: "relocated source-free native packages check Fin inside arrays, lists and options" }
	, { id: "reviewed-container"
		, member: "native-fin-containers/reviewed-perl.json"
		, checks: 2027, path: "reviewed-ir", component: "FinContainers"
		, caller: "7851aed00c573e8c2e019a64f052540329c7cf9026a03895e3a2250142499649"
		, test: "independently reviewed native packages check container and alias Fin bounds after source-free installation" }
	, { id: "supplemental", member: "perl-refinements/perl.json"
		, checks: 1518, path: "ordinary-source", component: "PerlRefinements"
		, caller: "dcc356a2bb45d7bc164fe821e0cbda728015fbd022722d546c135d56f2df10a2"
		, test: "relocated source-free CPAN packages check an unboxed word subtype and nested Fin 0 shapes" }
]);
export const perlRefinementSourcePaths = Object.freeze([
	".github/workflows/perl-consumer.yml"
	, "scripts/env.sh"
	, "scripts/build-perl-toolchains.mjs"
	, "scripts/test-perl-consumers.mjs"
	, "tests/perl-native.test.mjs"
	, "tests/native-subtype.test.mjs"
	, "tests/native-fin-containers.test.mjs"
	, "tests/perl-fin-containers.test.mjs", "tests/perl-refinements.test.mjs"
	, "tests/helpers/native-subtype-install.mjs"
	, "tests/helpers/fin-container-install.mjs"
	, "tests/helpers/copied-fixture-install.mjs"
	, "tests/helpers/perl-subtype-dispatch.mjs"
	, "tests/helpers/perl-fin-container-dispatch.mjs"
	, "tests/helpers/reviewed-fin-container-fixture.mjs"
	, "tests/helpers/type-corpus-reviewed-ir.mjs"
	, "tests/helpers/package-set.mjs", "tests/helpers/lake-workspace.mjs"
	, "tests/fixtures/subtype-consumers/perl.pl"
	, "tests/fixtures/fin-container-consumers/perl.pl"
	, ...["native-subtype", "native-fin-containers", "perl-refinements"].flatMap((fixture, index) =>
		["LICENSE", "lakefile.toml", "lean-toolchain", "package.json", ["Subtypes.lean", "FinContainers.lean", "PerlRefinements.lean"][index]]
			.map(file => `tests/fixtures/onboarding/${fixture}/${file}`))
	, "src/backends/perl/generate.mjs"
	, "src/release/cpan-install.mjs", "src/release/cpan-package.mjs"
	, "src/build/process-runner.mjs"
]);
const provenance = ["fetched-at.txt", "job.json", "job.log", "corpus-artifact.json", "abi-artifact.json"];
const archivedNames = [...provenance, "abi-acceptance.json", ...perlRefinementCases.map(item => `${item.id}.json`)];
export const perlRefinementArchivePaths = Object.freeze([
	...perlRefinementConfigurations.flatMap(configuration => archivedNames.map(name => `${perlRefinementDirectory}/${configuration.name}/${name}`))
	, ...perlRefinementSourcePaths.map(path => `${perlRefinementDirectory}/source/${path}.source`)
]);
const interpreter = name => `/home/runner/work/lean-bridge/lean-bridge/.toolchains/perl/${name}/bin/perl`;
const escape = text => text.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
const hash = value => assert.match(value, /^[a-f0-9]{64}$/u);
const compareStep = "Compare installed Perl corpus packages with fresh Lean results";

/**
 * Bind the selected tests to their successful corpus step, without upgrading a cancelled whole job.
 *
 * @param configuration - One of the four hosted configurations.
 * @param job - Original GitHub job metadata.
 * @param artifacts - Original corpus and ABI artifact metadata.
 * @param log - Full original job log.
 */
export const assertPerlRefinementExecution = (configuration, job, artifacts, log) => {
	assert.deepEqual([job.id, job.run_id, job.head_sha, job.name, job.status, job.conclusion]
		, [configuration.job, perlRefinementRunId, perlRefinementRevision, `Perl / Perl XS (${configuration.name})`, "completed", configuration.conclusion]);
	const step = job.steps.find(item => item.name === compareStep);
	assert.deepEqual([step?.number, step?.status, step?.conclusion], [10, "completed", "success"]);
	assert.equal(job.steps.find(item => item.name === "Test both install paths on this Perl configuration")?.conclusion, "success");
	for(const kind of ["corpus", "abi"])
	{
		const artifact = artifacts[kind];
		assert.deepEqual([artifact.id, artifact.workflow_run.id, artifact.workflow_run.head_sha, artifact.name]
			, [configuration[kind], perlRefinementRunId, perlRefinementRevision, `${kind === "corpus" ? "type-corpus-perl" : "perl-abi"}-${configuration.name}-${perlRefinementRevision}`]);
		assert.ok(Number.isSafeInteger(artifact.size_in_bytes) && artifact.size_in_bytes > 0);
		assert.match(artifact.digest, /^sha256:[a-f0-9]{64}$/u);
	}
	const text = log.replace(/^\d{4}-\d\d-\d\dT[\d:.]+Z /gmu, "");
	for(const line of [`Perl ${configuration.name}`, `  CORPUS_PERL_CONFIGURATION: ${configuration.name}`, `# offline prebuilt installation on ${interpreter(configuration.name)}`, "Image: ubuntu-24.04"])
		assert.ok(text.split("\n").includes(line), line);
	for(const selected of perlRefinementCases)
	{
		assert.ok(text.includes(`test -s build/${selected.member}`), selected.member);
		const result = text.match(new RegExp(`^ok \\d+ - ${escape(selected.test)}$`, "mu"));
		assert.ok(result, `${selected.id}: installed test must pass without SKIP/TODO`);
		const start = text.lastIndexOf("TAP version 13\n", result.index), end = text.indexOf("# duration_ms ", result.index);
		assert.ok(start >= 0 && end > result.index);
		const tap = text.slice(start, end);
		assert.doesNotMatch(tap, /^not ok /mu);
		for(const field of ["fail", "cancelled", "todo"]) assert.match(tap, new RegExp(`^# ${field} 0$`, "mu"));
	}
};

const columns = {
	subtype: ["validator:Subtypes.mix", "adapter:Subtypes.mix", "l_Subtypes_mix", "l_Subtypes_half"]
	, container: ["l_FinContainers_mirrorAll", "l_FinContainers_orDefault", "adapter:FinContainers.mirrorAll", "adapter:FinContainers.orDefault"]
};
const counts = {
	subtype: [["valid-mix", [1, 1, 1, 0]], ["fin-before-constructor", [0, 0, 0, 0]], ["constructor-rejects", [1, 0, 0, 0]], ["invalid-then-valid", [2, 1, 1, 1]]]
	, container: [["valid-mirror", [1, 0, 1, 0]], ["valid-absent", [0, 1, 0, 1]], ["invalid-only", [0, 0, 0, 0]], ["invalid-then-valid", [1, 0, 1, 0]]]
};
const reportKeys = ["bindingIrSha256", "checks", "compilerFreePath", "consumerSha256", "modelSha256", "offlineInstall", "packages", "path", "profile", "receiptSha256", "refinements", "sourceRemovedBeforeInstallation", "sourceTreeSha256"];
const refinementDigests = {
	subtype: "39543f54156141d4340ba830c60f1b97a534cad8f1290f2b2dabae120b7cad0f"
	, container: "221680293afa2f3f1371fbb28d0ab223967f52744dbfa68365598e0d98b6eb72"
	, supplemental: "a7b4e65e5a073d115fb0d982560f147c07d56ba2eb0ed644b514e432c15e9adb"
};

/**
 * Validate measured counts, scoped dispatch, package relationships and the precise repetition fields.
 *
 * @param data - One original JSON report.
 * @param selected - One fixed report selection.
 * @param configuration - Selected hosted interpreter configuration.
 * @param refinements - Independently audited expected refinement tree.
 */
export const assertPerlRefinementReport = (data, selected, configuration, refinements) => {
	assert.deepEqual(Object.keys(data).sort(), ["archives", "reports", "reproducible", "schemaVersion"]);
	assert.equal(data.schemaVersion, 1); assert.equal(data.reproducible, true); assert.equal(data.reports.length, 1);
	const report = data.reports[0], supplemental = selected.id === "supplemental", reviewed = selected.path === "reviewed-ir";
	assert.deepEqual(Object.keys(report).sort(), [...reportKeys, ...supplemental ? ["perl", "repeatExecution"] : ["dispatch"], ...reviewed ? ["reviewedSourceSha256"] : []].sort());
	assert.deepEqual([report.profile, report.path, report.checks, report.consumerSha256], ["perl", selected.path, selected.checks, selected.caller]);
	for(const flag of ["compilerFreePath", "offlineInstall", "sourceRemovedBeforeInstallation"]) assert.equal(report[flag], true, flag);
	for(const field of ["bindingIrSha256", "modelSha256", "receiptSha256", "sourceTreeSha256"]) hash(report[field]);
	assert.deepEqual(report.refinements, refinements);
	assert.equal(report.packages.length, 2);
	const component = report.packages.find(item => item.role === "component"), runtime = report.packages.find(item => item.role === "runtime");
	assert.equal(component.name, `LeanBridge-${selected.component}`); assert.equal(component.version, "1.000");
	assert.equal(runtime.name, "LeanBridge-Runtime"); hash(runtime.runtimeIdentity);
	assert.equal(component.runtimeIdentity, runtime.runtimeIdentity);
	assert.equal(component.runtimeDelivery, "dependency"); assert.equal(runtime.runtimeDelivery, "provided");
	assert.deepEqual(component.requires, [{ ecosystem: "cpan", name: runtime.name, version: runtime.version }]);
	assert.deepEqual(runtime.requires, []);
	for(const pkg of report.packages)
	{
		assert.deepEqual([pkg.target, pkg.ecosystem, pkg.profile], ["cpan", "cpan", "native-library-v1"]);
		assert.equal(pkg.artifacts.length, 1);
		const artifact = pkg.artifacts[0]; hash(artifact.sha256);
		assert.equal(artifact.path, `archives/${pkg.name}-${pkg.version}.tar.gz`);
		assert.ok(Number.isSafeInteger(artifact.bytes) && artifact.bytes > 0);
	}
	assert.deepEqual(data.archives, Object.fromEntries(report.packages.flatMap(pkg => pkg.artifacts.map(item => [item.path, item.sha256]))));
	if(supplemental)
	{ assert.equal(report.perl, interpreter(configuration.name)); assert.equal(report.repeatExecution, true); }
	else
	{
		const kind = selected.id === "subtype" ? "subtype" : "container";
		assert.deepEqual(Object.keys(report.dispatch).sort(), ["columns", "interposer", "observed", "positiveControl"]);
		assert.equal(report.dispatch.interposer, "LD_PRELOAD");
		assert.deepEqual(report.dispatch.columns, columns[kind]); assert.deepEqual(report.dispatch.observed, counts[kind]);
		assert.equal(report.dispatch.positiveControl, kind === "subtype"
			? "a valid public call increments validator, adapter and source; direct adapter calls are counted in the C package probe"
			: "valid public calls increment the adapter and source counts; direct adapter calls are counted in the C package probe");
	}
	if(reviewed) assert.equal(report.reviewedSourceSha256, "f118669910537d41255cd615c7fcf7ebce8b031ac5f4abce9f639b7d8a20c1be");
};

/**
 * Fixed scope, with original artifact identities and selected Git source snapshots supplied by the writer.
 *
 * @param files - Exact archived file descriptors.
 * @param refinements - Independently audited fixture trees.
 */
export const perlRefinementReceipt = (files, refinements) => ({
	schemaVersion: 1, planNodes: [1431, 1432], execution: "hosted"
	, revision: perlRefinementRevision, runId: perlRefinementRunId
	, configurations: perlRefinementConfigurations
	, scope: {
		profile: "perl", ecosystem: "cpan", selection: compareStep
		, ordinary: ["Array/List/Option Fin", "top-level checked Subtype", "unboxed UInt32 Subtype and nested Fin 0"]
		, reviewed: ["Array/List/Option Fin"]
		, repetition: "Each Subtype/container consumer runs once with 1000 rejection/recovery cycles, followed by four separate counter processes. The supplemental consumer runs twice, each with 500 mixed rejection/recovery cycles."
		, dispatch: "Only the named columns in each report are measured. Container countNone is not a measured column. Supplemental dispatch is not measured. Direct typed-adapter controls belong to the separate C probe."
		, reproduction: "Two independent author builds per report reproduce archives within that interpreter configuration. No cross-ABI archive equality is claimed. Author/build directories are deleted before offline, compiler-free execution. All four report kinds relocate the handoff archives; none moves the installed tree before another execution."
		, interpreter: "The workflow, selected toolchain builder, install harness, log and supplemental report identify each configured interpreter. Raw Perl Config output is not retained. The base-package ABI receipt supplies context, not refinement-package identity."
		, identities: "Reports retain source-tree, model, Binding IR and package-set receipt digests. Their complete original model and receipt files are not present, so those digests are not independently recomputed here."
		, sourceIdentity: "Selected producer sources are exact snapshots from the hosted Git revision, not a complete dependency closure or a claim about current source."
		, wholeRun: "All four Compare steps passed. One complete Perl job passed; three timed out later during owned-value verification. Neither those jobs nor the whole workflow are claimed green."
		, binaryArchivesRetained: false, supportPromotion: false
	}
	, refinements, files
});

/**
 * Authenticate all archive paths before reading, then check every byte and each configuration's observations.
 *
 * @param receipt - Parsed, digest-pinned receipt.
 * @param read - Read a repository-relative archived path.
 */
export const assertPerlRefinementArchive = async (receipt, read) => {
	assert.deepEqual(receipt, perlRefinementReceipt(receipt.files, receipt.refinements));
	assert.deepEqual(receipt.files.map(item => item.path), perlRefinementArchivePaths, "exact ordered archive paths");
	assert.deepEqual(Object.keys(receipt.refinements), ["subtype", "container", "supplemental"]);
	for(const [kind, digest] of Object.entries(refinementDigests)) assert.equal(sha256(canonicalJson(receipt.refinements[kind])), digest, kind);
	const files = new Map();
	for(const file of receipt.files)
	{
		assert.deepEqual(Object.keys(file).sort(), ["bytes", "originalPath", "path", "sha256"]);
		hash(file.sha256); assert.ok(Number.isSafeInteger(file.bytes) && file.bytes > 0);
		const path = file.path.slice(perlRefinementDirectory.length + 1);
		const [configuration, name] = path.split("/");
		const source = path.startsWith("source/");
		let originalPath;
		if(source) originalPath = `git:${perlRefinementRevision}:${path.slice(7, -7)}`;
		else if(provenance.includes(name)) originalPath = `${perlRefinementOriginals}/${configuration}/${name}`;
		else if(name === "abi-acceptance.json") originalPath = `${perlRefinementOriginals}/${configuration}/abi.zip!${configuration}/acceptance.json`;
		else originalPath = `${perlRefinementOriginals}/${configuration}/corpus.zip!${perlRefinementCases.find(item => `${item.id}.json` === name).member}`;
		assert.equal(file.originalPath, originalPath);
		const bytes = await read(file.path); assert.equal(bytes.length, file.bytes, file.path); assert.equal(sha256(bytes), file.sha256, file.path);
		files.set(path, bytes.toString());
	}
	const fingerprints = new Set();
	for(const configuration of perlRefinementConfigurations)
	{
		const get = name => files.get(`${configuration.name}/${name}`), json = name => JSON.parse(get(name));
		assert.match(get("fetched-at.txt"), /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z\n$/u);
		assertPerlRefinementExecution(configuration, json("job.json"), { corpus: json("corpus-artifact.json"), abi: json("abi-artifact.json") }, get("job.log"));
		const context = json("abi-acceptance.json");
		assert.deepEqual([context.schemaVersion, context.perl, context.glibcMinimumVersion], [1, interpreter(configuration.name), "2.38"]);
		hash(context.nativeLibrarySha256); assert.equal(context.packages.length, 3);
		const fingerprint = context.packages[0].abiVariants[0]; hash(fingerprint);
		assert.ok(!fingerprints.has(fingerprint), "four distinct base ABI contexts"); fingerprints.add(fingerprint);
		for(const pkg of context.packages)
		{ assert.deepEqual(pkg.abiVariants, [fingerprint]); assert.equal(pkg.compilerAccess, false); assert.equal(pkg.runtimeIdentity, context.packages[0].runtimeIdentity); }
		for(const selected of perlRefinementCases)
			assertPerlRefinementReport(json(`${selected.id}.json`), selected, configuration, receipt.refinements[selected.id === "reviewed-container" ? "container" : selected.id]);
	}
};

/**
 * Keep original bytes once; never overwrite a different artifact or receipt.
 *
 * @param path - Exact destination.
 * @param bytes - Original bytes to retain.
 */
export const writePerlRefinementArtifact = async (path, bytes) => {
	await mkdir(dirname(path), { recursive: true });
	try
	{ await writeFile(path, bytes, { flag: "wx" }); }
	catch(error)
	{
		if(error.code !== "EEXIST") throw error;
		assert.ok((await readFile(path)).equals(bytes), `${path} already holds different bytes`);
	}
};
