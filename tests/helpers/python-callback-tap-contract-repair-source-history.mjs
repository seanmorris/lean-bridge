/**
 * Preserve the consecutive Python callback sanitizer and TAP CI repairs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const pythonCallbackTapContractRepairHistoryPath
	= "docs/evidence/python-callback-tap-contract-repair-source-history-20261101.json";
export const pythonCallbackTapContractRepairPredecessor
	= "54e4a5d6dead1d0ba47eede9fa6d115a7d3fe62a";
export const pythonCallbackTapContractRepairSanitizerCommit
	= "50ff74eb948703011169b3a0a47c80872ba69f9b";
export const pythonCallbackTapContractRepairImplementation
	= "d5d7ebbc8d4f7b580ba2d059c7d576b25368437c";
export const pythonCallbackTapContractRepairSanitizerPaths
	= Object.freeze([
		"tests/helpers/owned-python-callback-result-evidence.mjs"
		, "tests/helpers/owned-python-callback-result-sanitizers.mjs"
		, "tests/owned-python-callback-results.test.mjs"
	]);
export const pythonCallbackTapContractRepairTapPaths
	= Object.freeze([
		".github/workflows/consumer-matrix.yml"
		, "docs/type-surface.v1.json"
		, "tests/helpers/owned-python-callback-result-ci.mjs"
		, "tests/owned-python-callback-result-ci.test.mjs"
	]);
export const pythonCallbackTapContractRepairImplementationPaths
	= Object.freeze([
		...pythonCallbackTapContractRepairSanitizerPaths
		, ...pythonCallbackTapContractRepairTapPaths
	]);
export const pythonCallbackTapContractRepairIntegrationPaths
	= Object.freeze([
		"tests/checked-javascript-partition-11.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const pythonCallbackTapContractRepairHistoryAdditions
	= Object.freeze([
		"scripts/update-python-callback-tap-contract-repair-source-history.mjs"
		, "tests/helpers/python-callback-tap-contract-repair-source-history-tests.mjs"
		, "tests/helpers/python-callback-tap-contract-repair-source-history.mjs"
	]);

const historyUrl = new URL(
	"../../" + pythonCallbackTapContractRepairHistoryPath, import.meta.url);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const pythonCallbackTapContractRepairNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl) ? [
			...record().sanitizerUpdates.map(update => update.path)
			, ...record().updates.map(update => update.path)
		]
			: pythonCallbackTapContractRepairImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path) : [])
	])].sort());
const allowedPath = path =>
	pythonCallbackTapContractRepairImplementationPaths.includes(path)
	|| pythonCallbackTapContractRepairIntegrationPaths.includes(path);

/**
 * Require a cardinality-independent TAP success contract and exact live pins.
 *
 * @param sources - Implementation paths mapped to complete source text.
 */
export const assertPythonCallbackTapContractRepair = sources => {
	for(const path of pythonCallbackTapContractRepairImplementationPaths)
		assert.equal(typeof sources[path], "string", path);
	const workflow = sources[".github/workflows/consumer-matrix.yml"];
	const job = workflow.split("  owned-python-callback-results:\n")[1]
		?.split(/\n {2}[a-z][a-z0-9-]*:\n/u)[0];
	assert.ok(job);
	const step = job.split(
		"      - name: Verify Python callback-result lifetimes\n"
	)[1]?.split("      - name: ")[0];
	assert.ok(step);
	assert.doesNotMatch(step, /rg '\^# (?:tests|pass) 13\$'/u);
	for(const marker of [
		`tap_tests="$(sed -n 's/^# tests \\([0-9][0-9]*\\)$/\\1/p' build/owned-python-callback-results.log)"`
		, `tap_pass="$(sed -n 's/^# pass \\([0-9][0-9]*\\)$/\\1/p' build/owned-python-callback-results.log)"`
		, 'test "$tap_tests" -gt 0'
		, 'test "$tap_tests" = "$tap_pass"'
		, "rg '^# todo 0$' build/owned-python-callback-results.log"
	]) assert.ok(step.includes(marker), marker);
	const helper = sources[
		"tests/helpers/owned-python-callback-result-ci.mjs"];
	assert.match(helper
		, /export const ownedPythonCallbackResultSummaryGate = \[/u);
	assert.match(helper, /summary: "nonzero-all-passed"/u);
	assert.doesNotMatch(helper, /tests: 13/u);
	const contract = sources["tests/owned-python-callback-result-ci.test.mjs"];
	assert.match(contract, /ownedPythonCallbackResultSummaryGate/u);
	assert.match(contract, /summary: "nonzero-all-passed"/u);
	assert.doesNotMatch(contract, /tests: 13/u);
	const sanitizers = sources[
		"tests/helpers/owned-python-callback-result-sanitizers.mjs"];
	assert.match(sanitizers
		, /export const comparableOwnedPythonSanitizerBaseline/u);
	assert.match(sanitizers, /cpythonUnicodeStartupLeak/u);
	assert.match(sanitizers
		, /startupLeakBaseline: normalize\(cold[.]stderr\)/u);
	assert.match(sanitizers
		, /sanitizerProbes[.]push\(\{ fault: "tls-live", reachable: true, diagnostic: normalize\(held[.]stderr\) \}\)/u);
	const evidence = sources[
		"tests/helpers/owned-python-callback-result-evidence.mjs"];
	assert.match(evidence, /comparableOwnedPythonSanitizerBaseline/u);
	assert.match(evidence, /assert[.]match\(probe[.]diagnostic, diagnostic\)/u);
	const runtime = sources["tests/owned-python-callback-results.test.mjs"];
	assert.match(runtime
		, /excludes only exact CPython Unicode startup allocations/u);
	assert.match(runtime, /generated_owner binding[.]c:42/u);
	assert.match(runtime, /Direct leak of 73 byte\(s\)/u);
	const inventory = sources["docs/type-surface.v1.json"];
	assert.equal(inventory.split(sha256(workflow)).length - 1, 92);
	return { summary: "nonzero-all-passed", liveWorkflowPins: 92 };
};

/**
 * Reverse one authenticated Python TAP contract transition.
 *
 * @param source - Complete later source.
 * @param update - Authenticated reversible transition.
 */
export const reversePythonCallbackTapContractRepairUpdate = (
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
 * Remove only authenticated Python TAP contract transitions.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping SHA-256.
 */
export const beforePythonCallbackTapContractRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !pythonCallbackTapContractRepairNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [
		record().integrationUpdates, record().updates, record().sanitizerUpdates
	]) {
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reversePythonCallbackTapContractRepairUpdate(current, update);
	}
	return current;
};
