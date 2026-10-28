/**
 * Authenticate the PHP-Wasm corpus lane split, its resource sampling and its pin refresh.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	authenticateSourceHistoryReverse, gitSourceBytes
} from "./source-history-stream.mjs";
import {
	beforePhpWasmCorpusLaneSplitSource
	, phpWasmCorpusLaneSplitAddedPaths
	, phpWasmCorpusLaneSplitCommits
	, phpWasmCorpusLaneSplitHistoryPath
	, phpWasmCorpusLaneSplitImplementation
	, phpWasmCorpusLaneSplitImplementationPaths
	, phpWasmCorpusLaneSplitIntegrationPaths
	, phpWasmCorpusLaneSplitPinCount
	, phpWasmCorpusLaneSplitPredecessor
	, phpWasmCorpusLaneSplitTypeSurfacePath
	, phpWasmCorpusLaneSplitWorkflowCommit
	, phpWasmCorpusLaneSplitWorkflowPath
	, reversePhpWasmCorpusLaneSplitUpdate
} from "./php-wasm-corpus-lane-split-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { phpWasmPartitionJob, phpWasmPartitionStep } from "./php-wasm-corpus-partition.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	phpWasmCorpusLaneSplitHistoryPath, "utf8"
));
const digestPattern = /[0-9a-f]{64}/gu;
const workflowAt = commit => git(["show", `${commit}:${phpWasmCorpusLaneSplitWorkflowPath}`]);
const prologue = "          set -euo pipefail\n          source scripts/env.sh\n";
const telemetry = `          mkdir -p build
          sampler() { while sleep 30; do date -u +%T; free -m | sed -n 2p; ps -eo rss,etimes,comm --sort=-rss | head -3; df -h / | tail -1; done; }
          sampler >> build/php-wasm-corpus-samples.log 2>&1 &
          LEAN_BRIDGE_CORPUS_SAMPLER=$!
          trap 'kill "$LEAN_BRIDGE_CORPUS_SAMPLER" 2>/dev/null || true' EXIT
          trap 'printf "%s %s\\n" "$(date -u +%T)" "$BASH_COMMAND" >> build/php-wasm-corpus-samples.log' DEBUG
`;
const commands = step => {
	const match = /^ {8}run: \|\n((?: {10}.*\n|\n)*)/mu.exec(step);
	assert.ok(match); return match[1];
};
const paths = step => /^ {10}path: \|\n((?: {12}.*\n)+)/mu.exec(step)[1].trim().split("\n").map(line => line.trim());
const unbounded = text => text.replaceAll("node --test --test-concurrency=1 tests/php-wasm-", "node --test tests/php-wasm-");
const boundedLines = [
	"LEAN_BRIDGE_PHP_WASM_CALLABLE_TEST=1 node --test --test-concurrency=1 tests/php-wasm-callables.test.mjs tests/php-wasm-callable-contract.test.mjs"
	, "LEAN_BRIDGE_PHP_WASM_COMPOUND_TEST=1 node --test --test-concurrency=1 tests/php-wasm-compounds.test.mjs tests/php-wasm-compound-contract.test.mjs tests/php-wasm-compound-zend.test.mjs"
	, "LEAN_BRIDGE_PHP_WASM_LIST_TEST=1 node --test --test-concurrency=1 tests/php-wasm-lists.test.mjs tests/php-wasm-list-contract.test.mjs tests/php-wasm-list-zend.test.mjs"
];

test("PHP-Wasm corpus lane split records its exact source range", async () => {
	const value = await record();
	assert.equal(value.schemaVersion, 1);
	assert.equal(value.milestone, "php-wasm-corpus-lane-split-source-v1");
	assert.equal(value.predecessorCommit, phpWasmCorpusLaneSplitPredecessor);
	assert.equal(value.implementationCommit, phpWasmCorpusLaneSplitImplementation);
	assert.deepEqual(value.updates.map(update => update.path)
		, phpWasmCorpusLaneSplitImplementationPaths);
	assert.deepEqual(value.integrationUpdates.map(update => update.path)
		, phpWasmCorpusLaneSplitIntegrationPaths);
	assert.deepEqual(value.additions.map(addition => addition.path)
		, phpWasmCorpusLaneSplitAddedPaths);
	const range = `${phpWasmCorpusLaneSplitPredecessor}..${phpWasmCorpusLaneSplitImplementation}`;
	assert.deepEqual(git(["rev-list", "--reverse", range]).trim().split("\n")
	, phpWasmCorpusLaneSplitCommits);
	assert.deepEqual(git(["diff", "--name-only", phpWasmCorpusLaneSplitPredecessor
		, phpWasmCorpusLaneSplitWorkflowCommit]).trim().split("\n")
	, [phpWasmCorpusLaneSplitWorkflowPath]);
	assert.deepEqual(git(["diff", "--name-only"
		, phpWasmCorpusLaneSplitWorkflowCommit
		, phpWasmCorpusLaneSplitImplementation]).trim().split("\n")
	, [phpWasmCorpusLaneSplitTypeSurfacePath]);
});

test("PHP-Wasm corpus lane split reverses every source transition", async () => {
	const value = await record();
	for(const update of value.updates)
	{
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
		if(update.path === phpWasmCorpusLaneSplitTypeSurfacePath)
		{
			assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(
				phpWasmCorpusLaneSplitImplementation, update.path), update), true);
			continue;
		}
		const current = git(["show"
			, `${phpWasmCorpusLaneSplitImplementation}:${update.path}`]);
		const previous = git(["show"
			, `${phpWasmCorpusLaneSplitPredecessor}:${update.path}`]);
		assert.equal(reversePhpWasmCorpusLaneSplitUpdate(current, update)
			, previous, update.path);
		assert.equal(beforePhpWasmCorpusLaneSplitSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	for(const update of value.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = git(["show"
			, `${phpWasmCorpusLaneSplitImplementation}:${update.path}`]);
		assert.equal(reversePhpWasmCorpusLaneSplitUpdate(current, update)
			, previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	for(const addition of value.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
		, addition.currentSha256, addition.path);
});

test("PHP-Wasm corpus lane split refreshes only the workflow pins to the split workflow", async () => {
	const update = (await record()).updates.find(item =>
		item.path === phpWasmCorpusLaneSplitTypeSurfacePath);
	const before = sha256(workflowAt(phpWasmCorpusLaneSplitPredecessor));
	const after = sha256(workflowAt(phpWasmCorpusLaneSplitImplementation));
	assert.notEqual(before, after);
	let pins = 0;
	for(const edit of update.edits)
	{
		assert.equal(edit.current.replace(digestPattern, "")
			, edit.previous.replace(digestPattern, ""));
		for(const digest of edit.current.match(digestPattern))
		{
			assert.equal(digest, after);
			++pins;
		}
		for(const digest of edit.previous.match(digestPattern)) assert.equal(digest, before);
	}
	assert.equal(pins, phpWasmCorpusLaneSplitPinCount);
});

test("PHP-Wasm corpus lane split preserves every corpus command and evidence path across values and values-graph", () => {
	const previous = phpWasmPartitionJob(workflowAt(phpWasmCorpusLaneSplitPredecessor), "php-wasm-corpus");
	const current = phpWasmPartitionJob(workflowAt(phpWasmCorpusLaneSplitImplementation), "php-wasm-corpus");
	assert.match(previous, /^ {8}profile: \[values, refinements\]$/mu);
	assert.match(current, /^ {8}profile: \[values, values-graph, refinements\]$/mu);
	const values = "Compare installed PHP-Wasm value packages with the shared Lean corpus";
	const graph = "Compare installed PHP-Wasm graph packages with the shared Lean corpus";
	const refinements = "Compare installed PHP-Wasm refinements with the shared Lean corpus";
	const oldValues = commands(phpWasmPartitionStep(previous, values));
	assert.ok(oldValues.startsWith(prologue));
	const currentSteps = Object.fromEntries([values, graph, refinements].map(name =>
		[name, commands(phpWasmPartitionStep(current, name))]));
	for(const [name, body] of Object.entries(currentSteps))
		assert.ok(body.startsWith(prologue + telemetry), name);
	const valueBody = currentSteps[values].slice((prologue + telemetry).length);
	const graphBody = currentSteps[graph].slice((prologue + telemetry).length);
	const corpusChecks = [
		"          test -s build/type-corpus/php-wasm.json\n"
		, "          test -s build/type-corpus/reviewed-wasm-php-wasm.json\n"
	].join("");
	assert.ok(valueBody.endsWith(corpusChecks));
	assert.ok(oldValues.endsWith(corpusChecks));
	assert.equal(unbounded(valueBody.slice(0, -corpusChecks.length) + graphBody)
		, unbounded(oldValues.slice(prologue.length, -corpusChecks.length)));
	for(const line of boundedLines)
	{
		assert.ok((valueBody + graphBody).includes(`          ${line}\n`), line);
		assert.ok(!oldValues.includes(`          ${line}\n`), line);
	}
	assert.equal(currentSteps[refinements].slice((prologue + telemetry).length)
		, commands(phpWasmPartitionStep(previous, refinements)).slice(prologue.length));
	const graphStep = phpWasmPartitionStep(current, graph);
	assert.match(graphStep, /^ {8}id: type_corpus_php_wasm_graph$/mu);
	assert.match(graphStep, /^ {8}if: matrix\.profile == 'values-graph'$/mu);
	assert.match(graphStep, /^ {8}continue-on-error: true$/mu);
	assert.match(phpWasmPartitionStep(current, values), /^ {8}id: type_corpus_php_wasm$/mu);
	const oldPaths = paths(phpWasmPartitionStep(previous, "Upload PHP-Wasm value corpus evidence"));
	const valuePaths = paths(phpWasmPartitionStep(current, "Upload PHP-Wasm value corpus evidence"));
	const graphUpload = phpWasmPartitionStep(current, "Upload PHP-Wasm graph corpus evidence");
	const graphPaths = paths(graphUpload);
	assert.deepEqual([...valuePaths, ...graphPaths].sort(), [...oldPaths].sort());
	assert.equal(new Set([...valuePaths, ...graphPaths]).size, oldPaths.length);
	assert.ok(valuePaths.includes("build/recursive/wasm32-transport.json"));
	assert.ok(graphPaths.includes("build/recursive/php-wasm-zend.json"));
	assert.match(graphUpload, /^ {8}if: always\(\) && matrix\.profile == 'values-graph'$/mu);
	assert.match(graphUpload, /^ {10}name: type-corpus-php-wasm-values-graph-\$\{\{ github\.sha \}\}$/mu);
	for(const name of ["Upload PHP-Wasm refinement corpus evidence", "Upload owned wasm32 transport evidence"])
		assert.equal(phpWasmPartitionStep(current, name), phpWasmPartitionStep(previous, name), name);
	const diagnostics = phpWasmPartitionStep(current, "Preserve corpus bootstrap diagnostics");
	assert.equal(diagnostics, phpWasmPartitionStep(previous, "Preserve corpus bootstrap diagnostics")
		.replace("            build/php-wasm-corpus-runtime.log\n"
			, "            build/php-wasm-corpus-runtime.log\n            build/php-wasm-corpus-samples.log\n"));
	const enforce = phpWasmPartitionStep(current, "Enforce PHP-Wasm corpus");
	assert.ok(enforce.includes("(matrix.profile == 'values-graph' && steps.type_corpus_php_wasm_graph.outcome != 'success')"));
	assert.ok(enforce.includes("(matrix.profile == 'values' && steps.type_corpus_php_wasm.outcome != 'success')"));
	assert.ok(enforce.includes("(matrix.profile == 'refinements' && steps.refinements_php_wasm.outcome != 'success')"));
});

test("PHP-Wasm corpus lane split changes no record, support inventory, test or product source", () => {
	for(const path of ["docs/evidence", "src", "scripts", "tests"
		, "docs/consumer-support.v1.json", "package.json"])
		assert.equal(git(["rev-parse", `${phpWasmCorpusLaneSplitPredecessor}:${path}`])
			, git(["rev-parse", `${phpWasmCorpusLaneSplitImplementation}:${path}`]), path);
});

test("PHP-Wasm corpus lane split rejects forged transitions", async () => {
	const update = (await record()).updates.find(item =>
		item.path === phpWasmCorpusLaneSplitWorkflowPath);
	const current = workflowAt(phpWasmCorpusLaneSplitImplementation);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.mjs" }
		, { ...update, edits: [] }
	]) assert.throws(() => reversePhpWasmCorpusLaneSplitUpdate(current, forged));
	assert.equal(beforePhpWasmCorpusLaneSplitSource(
		update.path, `${current}unknown\n`), `${current}unknown\n`);
});
