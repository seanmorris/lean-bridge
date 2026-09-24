/**
 * Compare fresh Composer family executions with unchanged historical observations.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { inspectLeanProject } from "../../src/analyze/lean-project.mjs";
import { nativeAllocationGuardHeader } from "../../src/build/native-allocation-guard.mjs";
import { compoundReviewedIr as expandedCompounds } from "./compound-fixture.mjs";
import { compoundReviewedIr as namedCompounds } from "./compound-source-fixture.mjs";
import { phpIsolationFlags } from "./type-corpus-php.mjs";
import { validateBrickMathInstall } from "./brick-math.mjs";

export const phpFamilyBaselines = {
	aliases: "docs/evidence/php-native-aliases-20260921.json"
	, callables: "docs/evidence/php-callables-20260919.json"
	, collections: "docs/evidence/php-native-collections-20260922.json"
	, compounds: "docs/evidence/php-native-compounds-20260920.json"
	, lists: "docs/evidence/php-native-lists-ffi-20260921.json"
	, variants: "docs/evidence/php-native-variants-20260921.json"
};
export const phpFamilyProductionPaths = ["src/backends/php/package-audit.mjs", "src/build/native-php-artifacts.mjs", "src/release/native-composer.mjs"];
const digest = value => sha256(canonicalJson(value));
const without = (value, keys) => Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key)));
const signatures = values => [...values].sort((a, b) => a.name.localeCompare(b.name));
const hash = value => assert.match(value, /^[a-f0-9]{64}$/);
// The older callable receipt retained native/PHP identities but summarized the
// remaining inventory. Require these provenance and license files explicitly.
const callableProvenance = ["README.md", "binding-manifest.json"
	, "composer.json"
	, "lean-bridge/component/artifacts.json"
	, "lean-bridge/component/binding-ir.json", "lean-bridge/component/component.h"
	, "lean-bridge/component/generated.lean", "lean-bridge/component/metadata.json"
	, "lean-bridge/component/model.json"
	, "lean-bridge/component/native-component.json"
	, "lean-bridge/include/callables.h"
	, "lean-bridge/native-c-adapter.json", "lean-bridge/runtime.json"
	, "licenses/Lean-LICENSE", "licenses/Lean-LICENSES"
	, "licenses/LeanBridge-LICENSE", "licenses/source-notices.json"];

/** Reconstruct the independently recorded expanded and named reviewed compound inputs. */
export const phpCompoundSourceTrees = async () => {
	const base = (await inspectLeanProject("tests/fixtures/onboarding/npm-compounds")).inputs.filter(input => input.path !== "lean-bridge.exports.json");
	const configuration = canonicalJson({ schemaVersion: 1, modules: ["Compounds"]
		, targets: { "php-native": { name: "lean-bridge-compounds/api", version: "1.0.0" } } });
	const entry = (path, source) => ({ path, bytes: Buffer.byteLength(source), sha256: sha256(source) });
	return Object.fromEntries([["previous", expandedCompounds()], ["current", namedCompounds()]].map(([name, ir]) => {
		const inputs = [...base, entry("lean-bridge.exports.json", configuration), entry("reviewed.binding-ir.json", canonicalJson(ir))].sort((a, b) => a.path.localeCompare(b.path));
		return [name, { inputs, sourceTreeSha256: sha256(inputs.map(input => `${input.sha256}  ${input.path}\n`).join("")) }];
	}));
};

/**
 * Include compiler, generator, packaging and independent consumer/failure-test sources.
 *
 * @param baselines - Unchanged preceding family receipts.
 */
export const phpFamilyExecutionPaths = baselines => [...new Set([
	...Object.values(baselines).flatMap(record => Object.keys(record.sourceHashes))
		.filter(path => /^(?:src\/(?:analyze|backends|build|release)\/|tests\/)/.test(path))
	, ...phpFamilyProductionPaths
	, "src/backends/c/copied-graph-layout.mjs"
	, "src/backends/c/native-graph-adapters.mjs"
	, "src/build/native-graph-projection.mjs"
	, "src/backends/php/copied-graph-package.mjs"
])].sort();

const observation = (current, previous, files) => {
	if(Object.hasOwn(previous, "libraries"))
	{
		assert.deepEqual(without(current, ["libraries"]), without(previous, ["libraries"]));
		const prefix = /^\/tmp\/lean-bridge-php-callable-consumer-[A-Za-z0-9]+\/php-native\/relocated\/vendor\/lean-bridge-callables\/api\//;
		for(const path of [...Object.keys(current.libraries), ...Object.keys(previous.libraries)]) assert.match(path, prefix);
		const relative = entries => Object.fromEntries(Object.entries(entries).map(([path, hash]) => [path.replace(prefix, ""), hash]));
		const actual = relative(current.libraries);
		assert.deepEqual(Object.keys(actual), Object.keys(relative(previous.libraries)));
		for(const [path, value] of Object.entries(actual)) assert.equal(value, files[path].sha256, path);
		return;
	}
	assert.deepEqual(without(current, ["api", "native_libraries"]), without(previous, ["api", "native_libraries"]));
	assert.match(current.api, /^\/tmp\/lean-bridge-php-[a-z]+-consumer-[A-Za-z0-9]+\/php-native\/relocated\/vendor\/[a-z-]+\/api\/src\/Api\.php$/);
	assert.deepEqual(Object.keys(current.native_libraries), Object.keys(previous.native_libraries));
	for(const [path, value] of Object.entries(current.native_libraries)) assert.equal(value, files[path].sha256, path);
};
const nativeProbe = (current, previous) => {
	const mutable = ["adapterSha256", "executableSha256", "probeAdapterSha256", "startupLeakBaseline"];
	assert.deepEqual(without(current, mutable), without(previous, mutable));
	for(const key of mutable.slice(0, 3)) hash(current[key]);
	assert.deepEqual(without(current.startupLeakBaseline, ["report"]), without(previous.startupLeakBaseline, ["report"]));
	const normalize = value => value.replace(/\/tmp\/lean-bridge-php-variant-author-[A-Za-z0-9]+/g, "/build/author");
	assert.equal(normalize(current.startupLeakBaseline.report), normalize(previous.startupLeakBaseline.report));
};

/**
 * Require both authoring paths and lexical modes, every original public result,
 * every injected failure and source-free execution. New archives retain their
 * own identities; earlier receipts predate the broker and allocation guard.
 *
 * @param runs - Complete current family reports.
 * @param baselines - Authenticated, unchanged historical family receipts.
 * @param compoundTrees - Independently reconstructed reviewed input identities.
 */
export const assertPhpFamilyExecutions = (runs, baselines, compoundTrees) => {
	assert.deepEqual(Object.keys(runs).sort(), Object.keys(phpFamilyBaselines));
	for(const [family, report] of Object.entries(runs))
	{
		const baseline = baselines[family];
		assert.equal(report.schemaVersion, 1);
		assert.deepEqual(report.reports.map(run => run.path), ["ordinary-source", "reviewed-ir"]);
		for(const run of report.reports)
		{
			const old = baseline.executions.find(item => item.path === run.path), php = run.php;
			assert.equal(run.profile, "php-native"); assert.equal(run.sourceRemovedBeforeInstallation, true);
			if(family !== "callables") assert.equal(run.handoffRemovedBeforeExecution, true);
			for(const flag of phpIsolationFlags) assert.equal(php[flag], true, flag);
			for(const key of ["consumerSources", "requestSha256", "php", "runtimeOptions", "composerSha256", "composerVersion", "composerProbeSha256"])
				assert.deepEqual(php[key], old.php[key], key);
			if(family === "compounds" && run.path === "reviewed-ir")
			{
				assert.equal(old.sourceTreeSha256, compoundTrees.previous.sourceTreeSha256);
				assert.equal(run.sourceTreeSha256, compoundTrees.current.sourceTreeSha256);
			}
			else assert.equal(run.sourceTreeSha256, old.sourceTreeSha256);
			if(run.signatures) assert.deepEqual(signatures(run.signatures), signatures(baseline.signatures));
			if(run.contract) assert.equal(digest(run.contract), old.contractSha256);
			assert.deepEqual(run.faults, old.faults);
			assert.deepEqual(run.catalog, old.catalog); assert.deepEqual(run.documentation, old.documentation);
			const receipt = php.packageReceipt, files = receipt.files;
			assert.equal(php.packageReceiptSha256, digest(receipt));
			assert.equal(receipt.glibcMinimumVersion, "2.38");
			assert.equal(receipt.bindingIrSha256, run.bindingIrSha256); assert.equal(php.bindingIrSha256, run.bindingIrSha256);
			assert.equal(receipt.sourceIdentity.sourceTreeSha256, run.sourceTreeSha256);
			assert.equal(receipt.runtimeIdentity, run.packages[0].runtimeIdentity);
			assert.deepEqual(Object.keys(files).sort(), [...Object.keys(old.php.packageReceipt.files), "lean-bridge/component/allocation-guard.h", ...family === "callables" ? callableProvenance : []].sort());
			assert.equal(files["lean-bridge/component/allocation-guard.h"].sha256, sha256(nativeAllocationGuardHeader));
			assert.equal(files["native/linux-x64/libleanshared.so"].sha256, old.php.packageReceipt.files["native/linux-x64/libleanshared.so"].sha256);
			assert.equal(files["src/Api.php"].sha256, php.declarationsSha256);
			assert.equal(run.packages.length, 1);
			const pkg = run.packages[0], prefix = `vendor/${pkg.name}/`;
			assert.deepEqual(without(pkg, ["artifacts", "runtimeIdentity"]), without(old.packages[0], ["artifacts", "runtimeIdentity"]));
			assert.equal(pkg.artifacts.length, 1); assert.equal(pkg.artifacts[0].sha256, php.archiveSha256);
			assert.equal(pkg.artifacts[0].path, old.packages[0].artifacts[0].path); assert.ok(pkg.artifacts[0].bytes > 0);
			for(const [path, file] of Object.entries(files)) assert.deepEqual(php.deployment[prefix + path], file, path);
			assert.equal(php.deployment[prefix + "lean-bridge/package-receipt.json"].sha256, php.packageReceiptSha256);
			if(family !== "callables") assert.deepEqual(Object.keys(php.deployment).sort(), [...Object.keys(old.php.deployment), prefix + "lean-bridge/component/allocation-guard.h"].sort());
			validateBrickMathInstall(php, php.deployment);
			assert.deepEqual(php.executions.map(run => run.mode), ["weak", "strict"]);
			for(const execution of php.executions)
			{
				const previous = old.php.executions.find(item => item.mode === execution.mode);
				observation(execution.observation, previous.observation, files);
				assert.equal(php.deployment[execution.mode + ".php"].sha256, php.consumerSources[execution.mode]);
			}
			assert.deepEqual(run.observation, php.executions[0].observation);
			if(family === "variants") nativeProbe(run.nativeFaults, old.nativeFaults);
		}
	}
};

/**
 * Require the complete six-gate log and current source snapshots before comparison.
 *
 * @param record - Fresh current-source family executions.
 */
export const assertPhpFamilyRegressionEvidence = async record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, "php-current-family-regressions"); assert.equal(record.finalAcceptance, false);
	assert.equal(record.wordBits, 64); assert.equal(record.packageGlibcFloor, "2.38");
	assert.deepEqual(Object.keys(record.baselines).sort(), Object.keys(phpFamilyBaselines));
	const baselines = {};
	for(const [family, entry] of Object.entries(record.baselines))
	{
		assert.equal(entry.path, phpFamilyBaselines[family]);
		const bytes = await readFile(entry.path); assert.equal(sha256(bytes), entry.sha256);
		baselines[family] = JSON.parse(bytes);
	}
	assert.deepEqual(Object.keys(record.sourceHashes).sort(), phpFamilyExecutionPaths(baselines));
	for(const [path, hash] of Object.entries(record.sourceHashes)) assert.equal(sha256(await readFile(path)), hash, path);
	assert.deepEqual(Object.keys(record.verifierSources), ["tests/helpers/php-installed-regressions.mjs"]);
	for(const [path, hash] of Object.entries(record.verifierSources)) assert.equal(sha256(await readFile(path)), hash, path);
	assert.equal(record.predecessor.path, "docs/evidence/php-recursive-packages-20260923.json");
	const predecessorBytes = await readFile(record.predecessor.path);
	assert.equal(sha256(predecessorBytes), record.predecessor.sha256);
	const predecessor = JSON.parse(predecessorBytes);
	assert.deepEqual(Object.keys(record.predecessorSources).sort(), phpFamilyProductionPaths);
	for(const path of phpFamilyProductionPaths)
	{
		assert.deepEqual(record.predecessorSources[path], predecessor.preComposerSources[path]);
		assert.equal(sha256(record.predecessorSources[path].text), record.predecessorSources[path].sha256);
		assert.equal(record.sourceHashes[path], predecessor.sourceHashes[path]);
	}
	assert.equal(record.runsSha256, digest(record.runs));
	assert.deepEqual(record.compoundSourceTrees, await phpCompoundSourceTrees());
	assertPhpFamilyExecutions(record.runs, baselines, record.compoundSourceTrees);
	assert.equal(sha256(record.log.text), record.log.sha256);
	assert.match(record.log.text, /# tests 6\n# suites 0\n# pass 6\n# fail 0\n# cancelled 0\n# skipped 0/);
	for(const [index, family] of Object.keys(phpFamilyBaselines).entries())
		assert.match(record.log.text, new RegExp(`ok ${index + 1} - installed native PHP ${family} `));
	return { record, baselines };
};
