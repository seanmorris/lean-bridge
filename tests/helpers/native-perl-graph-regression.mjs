/**
 * Validate fresh installed regressions before accepting CPAN's shared-build edits.
 * Historical release receipts retain their original source and archive identities.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { inspectLeanProject } from "../../src/analyze/lean-project.mjs";
import { assertSourceRegistrationUpdate } from "./source-registration-history.mjs";
import { assertDotnetGraphSourceTransition } from "./native-dotnet-graph-regression.mjs";
import { compoundReviewedIr as expandedCompounds } from "./compound-fixture.mjs";
import { compoundReviewedIr as namedCompounds } from "./compound-source-fixture.mjs";

const recordPath = "docs/evidence/perl-recursive-regressions-20260923.json";
const shared = ["src/build/native-graph-model.mjs", "src/build/native-graph-projection.mjs", "src/build/native-project.mjs"];
const configurations = ["5.36.3-threaded", "5.36.3-unthreaded", "5.38.2-threaded", "5.38.2-unthreaded"];
const digest = value => sha256(canonicalJson(value));
const same = (actual, expected, keys) => {
	for(const key of keys) assert.deepEqual(actual[key], expected[key], key);
};
const required = (value, keys) => {
	for(const key of keys) assert.equal(value[key], true, key);
};
const executionKey = run => `${run.path}/${run.perl.slice(1)}-${run.threaded ? "threaded" : "unthreaded"}`;
const signaturesDigest = signatures => digest([...signatures].sort((a, b) => a.name.localeCompare(b.name)));

/**
 * Retain exact public contracts while normalizing only declaration listing order.
 *
 * @param family - Existing Perl type-family fixture.
 * @param report - Fresh installed fixture report.
 */
export const perlRegressionExecutions = (family, report) => report.reports.map(({ signatures, contract, ...run }) => ({ ...run
	, ...["aliases", "variants"].includes(family) ? { contractSha256: digest(contract) } : { signaturesSha256: signaturesDigest(signatures) } }));

/** Reconstruct both reviewed source trees around the earlier named-Deep fix. */
export const perlCompoundSourceTrees = async () => {
	const base = (await inspectLeanProject("tests/fixtures/onboarding/npm-compounds")).inputs.filter(input => input.path !== "lean-bridge.exports.json");
	const configuration = canonicalJson({ schemaVersion: 1, modules: ["Compounds"]
		, targets: { cpan: { module: "LeanBridge::Compounds", version: "1.000" } } });
	const entry = (path, source) => ({ path, bytes: Buffer.byteLength(source), sha256: sha256(source) });
	return Object.fromEntries([["previous", expandedCompounds()], ["current", namedCompounds()]].map(([name, ir]) => {
		const inputs = [...base, entry("lean-bridge.exports.json", configuration), entry("reviewed.binding-ir.json", canonicalJson(ir))].sort((a, b) => a.path.localeCompare(b.path));
		return [name, { inputs, sourceTreeSha256: sha256(inputs.map(input => `${input.sha256}  ${input.path}\n`).join("")) }];
	}));
};

/**
 * Compare complete public observations and installed safety checks for Perl.
 * Native binaries have new receipts; their historical hashes are not replaced.
 *
 * @param runs - Fresh executions grouped by existing type family.
 * @param baselines - Immutable original family receipts.
 * @param compoundSourceTrees - Reconstructed original/current reviewed compound inputs.
 */
export const assertPerlInstalledRegressions = (runs, baselines, compoundSourceTrees) => {
	const expected = ["ordinary-source", "reviewed-ir"].flatMap(path => configurations.map(configuration => `${path}/${configuration}`));
	for(const family of ["collections", "compounds", "lists", "aliases", "variants"])
	{
		const baseline = baselines[family], executions = runs[family].executions;
		assert.deepEqual(executions.map(executionKey), expected);
		for(const run of executions)
		{
			const previous = baseline.executions.find(item => executionKey(item) === executionKey(run));
			assert.ok(previous);
			same(run, previous, ["checks", "consumerSha256", "primitives", "perlSha256"]);
			if(family === "compounds" && run.path === "reviewed-ir")
			{
				assert.equal(previous.sourceTreeSha256, compoundSourceTrees.previous.sourceTreeSha256);
				assert.equal(run.sourceTreeSha256, compoundSourceTrees.current.sourceTreeSha256);
			} else same(run, previous, ["sourceTreeSha256"]);
			// Commit 5da8a7b adds one mortal plus one av_push per Array slot.
			// Compound/List: one two-slot Array. Alias: four three-slot Arrays.
			// Variant: the two-slot Packet.modes and three-slot signals input.
			const checkpoints = { collections: 0, compounds: 3, lists: 3, aliases: 16, variants: 7 }[family];
			const faults = { ...previous.faults
				, checks: previous.faults.checks + checkpoints
				, conversion_checkpoints: previous.faults.conversion_checkpoints + checkpoints };
			assert.deepEqual(run.faults, faults);
			for(const key of ["calls", "rejected", "recordTypes", "reentrantArrays", "families", "catalog", "contractSha256", "sourceApiSha256"])
				if(Object.hasOwn(previous, key)) same(run, previous, [key]);
			if(!["aliases", "variants"].includes(family)) assert.equal(run.signaturesSha256, signaturesDigest(baseline.signatures));
			required(run, ["offlineInstall", "compilerFreeExecution", "sourceRemovedBeforeInstallation", "producerHandoffRemoved", "relocatedInstallation", "publicApiOnly", "repeatExecution", "installedFilesUnchanged", "isolatedCompiledFaultProbe"]);
			assert.deepEqual(Object.keys(run.installedFiles), Object.keys(previous.installedFiles));
			assert.deepEqual(run.nativeLibraries, Object.fromEntries(Object.entries(run.installedFiles).filter(([path]) => path.endsWith(".so")).map(([path, value]) => [path, value.sha256])));
			for(const [path, bytes] of Object.entries(run.installedFiles))
			{
				assert.match(bytes.sha256, /^[a-f0-9]{64}$/); assert.ok(Number.isSafeInteger(bytes.bytes) && bytes.bytes >= 0);
				if(path.endsWith("/libleanshared.so")) assert.deepEqual(bytes, previous.installedFiles[path]);
			}
			assert.equal(run.packages.length, 2);
			const runtime = run.packages.find(pkg => pkg.role === "runtime"), component = run.packages.find(pkg => pkg.role === "component");
			assert.ok(runtime && component); assert.equal(component.runtimeIdentity, runtime.runtimeIdentity);
			assert.deepEqual(component.requires, [{ ecosystem: "cpan", name: runtime.name, version: runtime.version }]);
			for(const pkg of run.packages)
			{
				assert.equal(pkg.ecosystem, "cpan"); assert.equal(pkg.artifacts.length, 1);
				assert.match(pkg.artifacts[0].sha256, /^[a-f0-9]{64}$/); assert.ok(pkg.artifacts[0].bytes > 0);
			}
		}
	}
	assert.deepEqual(runs.callables.executions.map(run => `${run.path}/${run.configuration}`).sort(), [...expected].sort());
	for(const run of runs.callables.executions)
	{
		const previous = baselines.callables.executions.find(item => item.path === run.path && item.configuration === run.configuration);
		assert.ok(previous);
		same(run, previous, ["checks", "consumerSha256", "sourceTreeSha256", "result"]);
		assert.equal(run.signaturesSha256, signaturesDigest(baselines.callables.signatures));
		required(run, ["offlineInstall", "compilerFreePath", "sourceRemovedBeforeInstallation"]);
	}
};

const assertSharedRegressions = (runs, baselines) => {
	assert.deepEqual(runs.c.executions.map(run => `${run.path}/${run.profile}`), ["ordinary-source/c", "ordinary-source/cpp", "reviewed-ir/c", "reviewed-ir/cpp"]);
	for(const run of runs.c.executions)
	{
		const previous = baselines.c.reports.find(item => item.path === run.path && item.profile === run.profile);
		same(run, previous, ["checks", "consumerSha256", "layoutSha256", "binarySha256", "sourceTreeSha256", "installedLibraries", "rejected", "packages"]);
		required(run, ["offlineInstall", "compilerFreePath", "sourceRemovedBeforeInstallation", "handoffRemovedBeforeExecution", "headersRemovedBeforeExecution"]);
		assert.equal(run.sourceFreeChecks, run.checks);
	}
	assert.deepEqual(runs.rust.executions.map(run => run.reviewed), [false, true]);
	for(const run of runs.rust.executions)
	{
		const previous = baselines.rust.report.observations.find(item => item.reviewed === run.reviewed);
		same(run, previous, ["package", "binarySha256", "layoutSha256", "checks", "checkpoints", "rejected", "publicSourceSha256", "conversionSourceSha256", "loaderSourceSha256", "compiledProjectionSha256", "consumerSourceSha256", "lockSha256", "linkerSha256", "rustc", "faultProbeSha256"]);
		same(run.documentation, previous.documentation, ["sourceSha256"]);
		same(run.composition, previous.composition, ["package", "consumerSha256", "componentCount"]);
		// The earlier Python receipt separately reproduced Cargo embedding its
		// offline vendor location in client executables, with identical sources.
		assert.equal(baselines.pythonRegression.rustClientBuildPaths.observation.sameSources, true);
		for(const hash of [run.executableSha256, run.documentation.executableSha256, run.composition.executableSha256]) assert.match(hash, /^[a-f0-9]{64}$/);
		required(run, ["offline", "emptyCargoHome", "linkOnly", "installedSourcesRemoved", "authorSourcesRemoved", "handoffRemoved", "compilerFreeExecution", "sharedRuntime", "forkRejection", "crossCrateRetirement", "rejectsTamperedAssets", "rejectsRegeneratedSourceDrift", "deterministicReassembly"]);
	}
	assert.deepEqual(runs.python.executions, baselines.python.report.observations);
	assert.equal(runs.ruby.environment.LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR, baselines.ruby.packageGlibcFloor);
	assert.deepEqual(runs.ruby.executions, baselines.ruby.report.observations);
	assert.deepEqual(runs.jvm.executions.map(run => `${run.path}/${run.profile}`), ["ordinary-source/java", "ordinary-source/kotlin", "reviewed-ir/java", "reviewed-ir/kotlin"]);
	for(const run of runs.jvm.executions)
	{
		const previous = baselines.jvm.executions.find(item => item.path === run.path && item.profile === run.profile);
		same(run, previous, ["checks", "calls", "rejected", "signaturesSha256", "observationSha256", "sourceTreeSha256", "sourceApiSha256", "installedFiles", "packages", "faults"]);
		assert.equal(run.sourceRemovedBeforeInstallation, true);
		required(run.jvm, ["offline", "emptyRepository", "emptyUserHome", "installedSourcesRemoved", "compilerFreeExecution", "runtimeOnlyExecution", "repeatExecution", "localLibraries", "publicApiOnly", "handoffRemovedBeforeExecution"]);
		same(run.jvm, previous.jvm, ["nativeLibraries", "declarationsSha256", "consumerSourceSha256", "signaturesSha256", "resolvedDependencies", "runtimeModules"]);
	}
};

/** Require real passing logs, exact sources and original installed observations. */
export const assertPerlGraphRegressions = async () => {
	const record = JSON.parse(await readFile(recordPath));
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	for(const [path, hash] of Object.entries(record.sourceHashes))
	{
		const source = await readFile(path, "utf8");
		if(sha256(source) !== hash) assert.equal(await assertDotnetGraphSourceTransition(path, source, hash) || await assertSourceRegistrationUpdate(path, source, hash), true, `Changed regression source: ${path}`);
	}
	const baselines = {};
	for(const [name, entry] of Object.entries(record.baselines))
	{
		const bytes = await readFile(entry.path); assert.equal(sha256(bytes), entry.sha256);
		baselines[name] = JSON.parse(bytes);
	}
	assert.deepEqual(Object.keys(record.runs).sort(), ["aliases", "c", "callables", "collections", "compounds", "jvm", "lists", "native", "python", "ruby", "rust", "variants"]);
	for(const run of Object.values(record.runs))
	{
		assert.equal(digest(run.executions), run.executionsSha256);
		assert.ok(run.logs.length > 0);
		for(const log of run.logs)
		{
			assert.equal(sha256(log.text), log.sha256);
			assert.match(log.text, /# pass [1-9][0-9]*\n# fail 0\n# cancelled 0/);
		}
	}
	assert.deepEqual(record.compoundReviewedSource, await perlCompoundSourceTrees());
	assertPerlInstalledRegressions(record.runs, baselines, record.compoundReviewedSource);
	assertSharedRegressions(record.runs, baselines);
	assert.match(record.runs.native.logs[0].text, /ok \d+ - Perl installs ordinary Lean packages through prebuilt and XS-only paths\n/);
	assert.match(record.runs.native.logs[0].text, /ok \d+ - CPAN completes every runtime ABI before pinning components and reproduces reversed selections\n/);
	return { record, baselines };
};

/**
 * Accept only explicit shared-build transitions backed by fresh installed runs.
 * Test-only instrumentation exports and verifier edits reconstruct their old bytes.
 *
 * @param path - Source file from an immutable historical receipt.
 * @param source - Complete current source text.
 * @param expected - The receipt's original digest, never rewritten.
 */
export const assertPerlGraphSourceTransition = async (path, source, expected) => {
	if(path === "tests/helpers/perl-native-graphs.mjs")
	{
		for(const name of ["nativeHooks", "nativeProbes", "nativeXs"])
		{
			const declaration = `export const ${name} = `;
			assert.equal(source.split(declaration).length, 2);
			source = source.replace(declaration, `const ${name} = `);
		}
		assert.equal(sha256(source), expected, path); return true;
	}
	if(path === "tests/helpers/native-ruby-graph-regression.mjs")
	{
		const current = "await assertAdministrativeSourceUpdate(path, record.sourceHashes[path]);";
		assert.equal(source.split(current).length, 2);
		source = source.replace(current, "assert.equal(sha256(source), record.sourceHashes[path], path);");
		assert.equal(sha256(source), expected, path); return true;
	}
	if(!shared.includes(path)) return false;
	const { record, baselines } = await assertPerlGraphRegressions();
	assert.equal(baselines.sharedBaseline.sourceHashes[path], expected, `Unknown CPAN shared-build baseline: ${path}`);
	if(sha256(source) !== record.sourceHashes[path]) assert.equal(await assertDotnetGraphSourceTransition(path, source, record.sourceHashes[path]), true, path);
	return true;
};
