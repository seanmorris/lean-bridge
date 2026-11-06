/**
 * Preserve the complete deferred-workflow history isolation repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const deferredWorkflowHistoryIsolationHistoryPath
	= "docs/evidence/deferred-workflow-history-isolation-source-history-20261106.json";
export const deferredWorkflowHistoryIsolationPredecessor
	= "022cc6171ee7f7b001974b0f48c65ff06a0da447";
export const deferredWorkflowHistoryIsolationImplementation
	= "49fabce2cc1a09c7aca59e3d86a119d9ecbb614c";
export const deferredWorkflowHistoryIsolationImplementationPaths = Object.freeze([
	"tests/fin-container-edges.test.mjs"
	, "tests/helpers/fin-container-late-report-tests.mjs"
	, "tests/helpers/maven-prerequisite-tests.mjs"
	, "tests/native-fin-containers.test.mjs"
	, "tests/native-fin-product-arrays.test.mjs"
	, "tests/native-specializations.test.mjs"
	, "tests/owned-perl-xs.test.mjs"
	, "tests/perl-fin-containers.test.mjs"
	, "tests/perl-fin.test.mjs"
	, "tests/perl-refinements.test.mjs"
	, "tests/retained-contract-tests.test.mjs"
	, "tests/reviewed-npm-packaging.test.mjs"
	, "tests/reviewed-specializations.test.mjs"
]);
export const deferredWorkflowHistoryIsolationIntegrationPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "tests/checked-javascript-partition-11.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const deferredWorkflowHistoryIsolationHistoryAdditions = Object.freeze([
	"scripts/update-deferred-workflow-history-isolation-source-history.mjs"
	, "tests/helpers/deferred-workflow-history-isolation-source-history-tests.mjs"
	, "tests/helpers/deferred-workflow-history-isolation-source-history.mjs"
]);
export const deferredWorkflowHistoryIsolationLoaders = Object.freeze({
	"tests/reviewed-npm-packaging.test.mjs": Object.freeze([
		"./helpers/reviewed-npm-snapshot-source-history-tests.mjs"
	])
	, "tests/reviewed-specializations.test.mjs": Object.freeze([
		"./helpers/reviewed-specialization-archive-source-history-tests.mjs"
		, "./helpers/reviewed-specialization-ci-hotfix-source-history-tests.mjs"
		, "./helpers/reviewed-specialization-admission-source-history-tests.mjs"
	])
	, "tests/native-fin-containers.test.mjs": Object.freeze([
		"./helpers/container-host-dispatch-source-history-tests.mjs"
		, "./helpers/perl-fin-archive-source-history-tests.mjs"
		, "./helpers/perl-fin-xs-audit-source-history-tests.mjs"
		, "./helpers/zero-payload-ordinary-evidence-expectation-source-history-tests.mjs"
		, "./helpers/history-reader-buffer-repair-source-history-tests.mjs"
		, "./helpers/hub-transition-gap-source-history-tests.mjs"
		, "./helpers/history-reader-hub-repair-source-history-tests.mjs"
		, "./helpers/ledger-transition-gap-source-history-tests.mjs"
		, "./helpers/perl-engine-owned-refinement-closure-source-history-tests.mjs"
		, "./helpers/zero-payload-type-surface-gap-source-history-tests.mjs"
	])
	, "tests/helpers/fin-container-late-report-tests.mjs": Object.freeze([
		"./fin-container-late-disk-tests.mjs"
		, "./fin-container-late-native-archive-tests.mjs"
		, "./fin-container-late-wit-report-tests.mjs"
		, "./fin-container-late-ci-history-tests.mjs"
	])
	, "tests/fin-container-edges.test.mjs": Object.freeze([
		"./helpers/fin-container-late-history-tests.mjs"
	])
	, "tests/native-specializations.test.mjs": Object.freeze([
		"./helpers/native-consumer-ci-repair-source-history-tests.mjs"
	])
	, "tests/helpers/maven-prerequisite-tests.mjs": Object.freeze([
		"./maven-prerequisite-history-tests.mjs"
	])
	, "tests/owned-perl-xs.test.mjs": Object.freeze([
		"./helpers/owned-perl-callback-result-history-tests.mjs"
		, "./helpers/owned-perl-callback-result-variant-history-tests.mjs"
	])
	, "tests/perl-fin-containers.test.mjs": Object.freeze([
		"./helpers/perl-container-subtype-ci-history-tests.mjs"
		, "./helpers/perl-history-checkout-history-tests.mjs"
	])
	, "tests/perl-refinements.test.mjs": Object.freeze([
		"./helpers/perl-relocated-consumer-source-history-tests.mjs"
	])
	, "tests/perl-fin.test.mjs": Object.freeze([
		"./helpers/perl-scalar-relocation-source-history-tests.mjs"
	])
	, "tests/native-fin-product-arrays.test.mjs": Object.freeze([
		"./helpers/fin-product-arrays-source-history-tests.mjs"
	])
});
export const deferredWorkflowHistoryIsolationBehavior = Object.freeze({
	workflowJobs: 6, parentEntrypoints: 12, deferredSuites: 28
	, sourceHistorySuites: 25, retainedArchiveSuites: 3
	, nativeLoaders: 126, arrayExpectationRepairs: 2
	, livePinRefreshes: Object.freeze({
		"tests/native-fin-containers.test.mjs": 9
		, "tests/native-specializations.test.mjs": 8
		, "tests/reviewed-specializations.test.mjs": 2
	})
	, changedSupportCells: 0, runtimeSemanticChanges: 0
});

const historyUrl = new URL(
	"../../" + deferredWorkflowHistoryIsolationHistoryPath, import.meta.url);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const deferredWorkflowHistoryIsolationNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl)
			? record().updates.map(update => update.path)
			: deferredWorkflowHistoryIsolationImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path) : [])
	])].sort());
const allowedPath = path => [
	...deferredWorkflowHistoryIsolationImplementationPaths
	, ...deferredWorkflowHistoryIsolationIntegrationPaths
].includes(path);
const count = (source, needle) => source.split(needle).length - 1;

/**
 * Bind every moved suite, the complete workflow guard and both current C names.
 *
 * @param sources - Implementation paths mapped to complete source text.
 */
export const assertDeferredWorkflowHistoryIsolation = sources => {
	for(const path of deferredWorkflowHistoryIsolationImplementationPaths)
		assert.equal(typeof sources[path], "string", path);
	let deferred = 0;
	for(const [parent, modules] of Object.entries(
		deferredWorkflowHistoryIsolationLoaders)) {
		const source = sources[parent];
		for(const module of modules)
		{
			assert.equal(count(source, `import "${module}";`), 0, module);
			assert.equal(count(source, `() => import("${module}")`), 1, module);
			deferred += 1;
		}
		}
	assert.equal(deferred
		, deferredWorkflowHistoryIsolationBehavior.deferredSuites);
	const guard = sources["tests/retained-contract-tests.test.mjs"];
	for(const marker of [
		"const deferredWorkflowJobs = Object.freeze(["
		, '[".github/workflows/consumer-matrix.yml", "node-consumers"]'
		, '[".github/workflows/consumer-matrix.yml", "php-consumers"]'
		, '[".github/workflows/consumer-matrix.yml", "native-consumers"]'
		, '[".github/workflows/consumer-matrix.yml", "managed-consumers"]'
		, '[".github/workflows/consumer-matrix.yml", "wasi-consumer"]'
		, '[".github/workflows/perl-consumer.yml", "perl"]'
		, "const sourceHistoryTestModule = path =>"
		, "const allTestEntries = job =>"
		, "const assertNoEagerHistory = closure =>"
		, "assert.equal(loaders.length, 126);"
		, "every deferred workflow keeps exact history outside its complete eager closure"
		, "assertRetainedReferences(closure, helpers, directories);"
	]) assert.ok(guard.includes(marker), marker);
	const arrays = sources["tests/native-fin-product-arrays.test.mjs"];
	for(const marker of ["lean_object *_lb_checked = "
		, "_check(arg0, &_lb_budget)"])
		assert.ok(arrays.includes(marker), marker);
	return {
		...deferredWorkflowHistoryIsolationBehavior
		, livePinRefreshes: {
			...deferredWorkflowHistoryIsolationBehavior.livePinRefreshes
		}
	};
};

/**
 * Reverse one authenticated isolation transition.
 *
 * @param source - Complete later source.
 * @param update - Authenticated reversible transition.
 */
export const reverseDeferredWorkflowHistoryIsolationUpdate = (
	source, update
) => {
	assert.ok(allowedPath(update.path), update.path);
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0;
	const parts = [];
	for(const edit of update.edits)
	{
		assert.deepEqual(Object.keys(edit).sort()
			, ["current", "previous", "start"]);
		assert.ok(Number.isSafeInteger(edit.start)
			&& edit.start >= cursor && edit.start <= source.length);
		assert.notEqual(edit.previous, edit.current);
		assert.equal(source.slice(edit.start
			, edit.start + edit.current.length), edit.current, update.path);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor));
	const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Remove only authenticated deferred-workflow isolation transitions.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping SHA-256.
 */
export const beforeDeferredWorkflowHistoryIsolationSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !deferredWorkflowHistoryIsolationNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseDeferredWorkflowHistoryIsolationUpdate(
				current, update);
	}
	return current;
};
