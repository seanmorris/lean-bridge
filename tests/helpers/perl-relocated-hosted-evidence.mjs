/**
 * Preserve the four hosted Perl XS selections that moved each installed consumer tree after its first full run
 * (VO #1431, #1432). Each report must equal its original bf89eff acceptance plus the relocation fields alone.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { assertPerlRefinementArchive, assertPerlRefinementReport, perlRefinementArchivePaths, perlRefinementCases, perlRefinementDirectory, perlRefinementSourcePaths } from "./perl-refinement-hosted-evidence.mjs";

export const perlRelocatedDirectory = "docs/evidence/perl-relocated-hosted-20261009";
export const perlRelocatedOriginals = "build/vo1431-perl-relocation-93c60a0";
export const perlRelocatedRevision = "93c60a0487d0b2acc0b6d562cd72a3876738a666";
export const perlRelocatedRunId = 37873560469;
export const perlRelocatedConfigurations = Object.freeze([
	{ name: "5.36.3-unthreaded", job: 113636828081, corpus: 11596726119, abi: 11596721187, conclusion: "success" }
	, { name: "5.36.3-threaded", job: 113636828019, corpus: 11595406237, abi: 11594363424, conclusion: "success" }
	, { name: "5.38.2-unthreaded", job: 113636828211, corpus: 11598038706, abi: 11598038710, conclusion: "success" }
	, { name: "5.38.2-threaded", job: 113636828016, corpus: 11597085761, abi: 11597010951, conclusion: "success" }
]);
// The original acceptance is authenticated through its own reader before any comparison.
export const perlRelocatedOriginalReceipt = Object.freeze({ path: `${perlRefinementDirectory}/receipt.json`, sha256: "e8c7408fdb4430554c2e59c81bcc4303d874ab082a97a183d285f00d23a2639c" });
export const perlRelocatedSourcePaths = Object.freeze([...perlRefinementSourcePaths, "tests/helpers/perl-relocated-consumer.mjs"]);
const provenance = ["fetched-at.txt", "job.json", "job.log", "corpus-artifact.json", "abi-artifact.json"];
const archivedNames = [...provenance, "abi-acceptance.json", ...perlRefinementCases.map(item => `${item.id}.json`)];
export const perlRelocatedArchivePaths = Object.freeze([
	...perlRelocatedConfigurations.flatMap(configuration => archivedNames.map(name => `${perlRelocatedDirectory}/${configuration.name}/${name}`))
	, ...perlRelocatedSourcePaths.map(path => `${perlRelocatedDirectory}/source/${path}.source`)
]);
const originalReport = path => path.endsWith(".json") && !path.includes("/source/");
/**
 * Every path the archive reader reads, in order: the original receipt, the original archive through its own
 * reader, its authenticated reports again for comparison, then this archive.
 */
export const perlRelocatedReadPaths = Object.freeze([perlRelocatedOriginalReceipt.path, ...perlRefinementArchivePaths, ...perlRefinementArchivePaths.filter(originalReport), ...perlRelocatedArchivePaths]);
const interpreter = name => `/home/runner/work/lean-bridge/lean-bridge/.toolchains/perl/${name}/bin/perl`;
const escape = text => text.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
const hash = value => assert.match(value, /^[a-f0-9]{64}$/u);
const compareStep = "Compare installed Perl corpus packages with fresh Lean results";
// Codex fetched each corpus artifact under its original name; this archive keeps the names of the earlier one.
const originalName = name => name === "corpus-artifact.json" ? "artifact.json" : name;
const corpusZip = "artifact.zip";

/**
 * Bind the selected tests to a successful job at the relocation revision.
 *
 * @param configuration - One of the four hosted configurations.
 * @param job - Original GitHub job metadata.
 * @param artifacts - Original corpus and ABI artifact metadata.
 * @param log - Full original job log.
 */
export const assertPerlRelocatedExecution = (configuration, job, artifacts, log) => {
	assert.deepEqual([job.id, job.run_id, job.head_sha, job.name, job.status, job.conclusion]
		, [configuration.job, perlRelocatedRunId, perlRelocatedRevision, `Perl / Perl XS (${configuration.name})`, "completed", configuration.conclusion]);
	for(const [number, name] of [[9, "Test both install paths on this Perl configuration"], [10, compareStep], [11, "Verify owned Perl values and installed CPAN archives"]])
	{
		const step = job.steps.find(item => item.name === name);
		assert.deepEqual([step?.number, step?.status, step?.conclusion], [number, "completed", "success"], name);
	}
	for(const kind of ["corpus", "abi"])
	{
		const artifact = artifacts[kind];
		assert.deepEqual([artifact.id, artifact.workflow_run.id, artifact.workflow_run.head_sha, artifact.name]
			, [configuration[kind], perlRelocatedRunId, perlRelocatedRevision, `${kind === "corpus" ? "type-corpus-perl" : "perl-abi"}-${configuration.name}-${perlRelocatedRevision}`]);
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

/**
 * A relocated report is its original acceptance plus relocatedInstallation, and repeatExecution where the
 * original did not already repeat; nothing else may differ, including package archive digests.
 *
 * @param data - One new original JSON report.
 * @param original - The same configuration's report from the authenticated bf89eff archive.
 * @param selected - One fixed report selection.
 * @param configuration - Selected hosted interpreter configuration.
 * @param refinements - The original archive's audited refinement tree.
 */
export const assertPerlRelocatedReport = (data, original, selected, configuration, refinements) => {
	assert.deepEqual(Object.keys(data).sort(), Object.keys(original).sort());
	const report = data.reports?.[0], before = original.reports[0];
	assert.equal(data.reports.length, 1);
	const added = Object.hasOwn(before, "repeatExecution") ? ["relocatedInstallation"] : ["relocatedInstallation", "repeatExecution"];
	assert.deepEqual(Object.keys(report).sort(), [...Object.keys(before), ...added].sort());
	for(const field of added) assert.equal(report[field], true, field);
	const kept = { ...report };
	for(const field of added) delete kept[field];
	assert.deepEqual({ ...data, reports: [kept] }, original, `${configuration.name}/${selected.id}: unchanged original acceptance`);
	// The original reader's own checks still hold, independently of the equality above.
	assertPerlRefinementReport({ ...data, reports: [kept] }, selected, configuration, refinements);
};

/**
 * Fixed scope, with original artifact identities and selected Git source snapshots supplied by the writer.
 *
 * @param files - Exact archived file descriptors.
 */
export const perlRelocatedReceipt = files => ({
	schemaVersion: 1, planNodes: [1431, 1432], execution: "hosted"
	, revision: perlRelocatedRevision, runId: perlRelocatedRunId
	, configurations: perlRelocatedConfigurations
	, original: { receipt: perlRelocatedOriginalReceipt, revision: "bf89effc3735069b1f069482c26ccf296026e7db" }
	, scope: {
		profile: "perl", ecosystem: "cpan", selection: compareStep
		, ordinary: ["Array/List/Option Fin", "top-level checked Subtype", "unboxed UInt32 Subtype and nested Fin 0"]
		, reviewed: ["Array/List/Option Fin"]
		, relocation: "After its first full run, each selected consumer's installed tree is renamed to a fresh sibling and the unchanged consumer.pl reruns once with PERL5LIB at the moved prefix only. The rerun must print exactly the first run's success line and check count, and the old tree must stay absent. Subtype and container counters then run in the moved tree."
		, comparison: "Every report equals the same configuration's bf89eff report, including checks, caller, refinements, dispatch counts and package archive digests, except for relocatedInstallation on all four and repeatExecution on the Subtype and container reports. The first-run repetition and counter scope are those of the original receipt."
		, reproduction: "Two independent author builds per report reproduce archives within that interpreter configuration. No cross-ABI archive equality is claimed. Author/build directories are deleted before offline, compiler-free execution."
		, interpreter: "The workflow, selected toolchain builder, install harness, log and supplemental report identify each configured interpreter. Raw Perl Config output is not retained. The base-package ABI receipt supplies context, not refinement-package identity."
		, identities: "Reports retain source-tree, model, Binding IR and package-set receipt digests. Their complete original model and receipt files are not present, so those digests are not independently recomputed here."
		, sourceIdentity: "Selected producer sources are exact snapshots from the hosted Git revision, not a complete dependency closure or a claim about current source."
		, scalar: "Scalar native-fin Perl reports from this run predate the later 63ae7b1 relocation of scalar consumers and are not selected."
		, wholeRun: "All four Perl XS jobs completed successfully. Other jobs in the workflow are not claimed by this archive."
		, binaryArchivesRetained: false, supportPromotion: false
	}
	, files
});

/**
 * Authenticate the original archive and every path of this one before reading it, then check every byte and
 * compare each relocated report with its original acceptance.
 *
 * @param receipt - Parsed, digest-pinned receipt.
 * @param read - Read a repository-relative archived path.
 */
export const assertPerlRelocatedArchive = async (receipt, read) => {
	assert.deepEqual(receipt, perlRelocatedReceipt(receipt.files));
	assert.deepEqual(receipt.files.map(item => item.path), perlRelocatedArchivePaths, "exact ordered archive paths");
	for(const file of receipt.files)
	{
		assert.deepEqual(Object.keys(file).sort(), ["bytes", "originalPath", "path", "sha256"]);
		hash(file.sha256); assert.ok(Number.isSafeInteger(file.bytes) && file.bytes > 0);
	}
	const originalBytes = await read(perlRelocatedOriginalReceipt.path);
	assert.equal(sha256(originalBytes), perlRelocatedOriginalReceipt.sha256, "original receipt");
	const originalReceipt = JSON.parse(originalBytes);
	await assertPerlRefinementArchive(originalReceipt, read);
	const originals = new Map();
	for(const file of originalReceipt.files) if(originalReport(file.path))
		originals.set(file.path.slice(perlRefinementDirectory.length + 1), JSON.parse(await read(file.path)));
	const files = new Map();
	for(const file of receipt.files)
	{
		const path = file.path.slice(perlRelocatedDirectory.length + 1);
		const [configuration, name] = path.split("/");
		let originalPath;
		if(path.startsWith("source/")) originalPath = `git:${perlRelocatedRevision}:${path.slice(7, -7)}`;
		else if(provenance.includes(name)) originalPath = `${perlRelocatedOriginals}/${configuration}/${originalName(name)}`;
		else if(name === "abi-acceptance.json") originalPath = `${perlRelocatedOriginals}/${configuration}/abi.zip!${configuration}/acceptance.json`;
		else originalPath = `${perlRelocatedOriginals}/${configuration}/${corpusZip}!${perlRefinementCases.find(item => `${item.id}.json` === name).member}`;
		assert.equal(file.originalPath, originalPath);
		const bytes = await read(file.path); assert.equal(bytes.length, file.bytes, file.path); assert.equal(sha256(bytes), file.sha256, file.path);
		files.set(path, bytes.toString());
	}
	const fingerprints = new Set();
	for(const configuration of perlRelocatedConfigurations)
	{
		const get = name => files.get(`${configuration.name}/${name}`), json = name => JSON.parse(get(name));
		assert.match(get("fetched-at.txt"), /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z\n$/u);
		assertPerlRelocatedExecution(configuration, json("job.json"), { corpus: json("corpus-artifact.json"), abi: json("abi-artifact.json") }, get("job.log"));
		const context = json("abi-acceptance.json");
		assert.deepEqual([context.schemaVersion, context.perl, context.glibcMinimumVersion], [1, interpreter(configuration.name), "2.38"]);
		hash(context.nativeLibrarySha256); assert.equal(context.packages.length, 3);
		const fingerprint = context.packages[0].abiVariants[0]; hash(fingerprint);
		assert.ok(!fingerprints.has(fingerprint), "four distinct base ABI contexts"); fingerprints.add(fingerprint);
		for(const pkg of context.packages)
		{ assert.deepEqual(pkg.abiVariants, [fingerprint]); assert.equal(pkg.compilerAccess, false); assert.equal(pkg.runtimeIdentity, context.packages[0].runtimeIdentity); }
		for(const selected of perlRefinementCases)
		{
			const original = originals.get(`${configuration.name}/${selected.id}.json`);
			assert.ok(original, `${configuration.name}/${selected.id}: original report`);
			const tree = originalReceipt.refinements[selected.id === "reviewed-container" ? "container" : selected.id];
			assertPerlRelocatedReport(json(`${selected.id}.json`), original, selected, configuration, tree);
		}
	}
	return { originalReceipt, refinementDigests: Object.fromEntries(Object.entries(originalReceipt.refinements).map(([kind, tree]) => [kind, sha256(canonicalJson(tree))])) };
};

/**
 * Keep original bytes once; never overwrite a different artifact or receipt.
 *
 * @param path - Exact destination.
 * @param bytes - Original bytes to retain.
 */
export const writePerlRelocatedArtifact = async (path, bytes) => {
	await mkdir(dirname(path), { recursive: true });
	try
	{ await writeFile(path, bytes, { flag: "wx" }); }
	catch(error)
	{
		if(error.code !== "EEXIST") throw error;
		assert.ok((await readFile(path)).equals(bytes), `${path} already holds different bytes`);
	}
};
