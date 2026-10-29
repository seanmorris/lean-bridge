/**
 * Authenticate the bounded dependent-signature producer graph lineage.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	authenticateSourceHistoryReverse, gitSourceBytes
} from "./source-history-stream.mjs";
import {
	beforeDependentSignatureProducerConcurrencySource
	, dependentSignatureProducerConcurrencyHistoryAdditions
	, dependentSignatureProducerConcurrencyHistoryPath
	, dependentSignatureProducerConcurrencyImplementation
	, dependentSignatureProducerConcurrencyImplementationPaths
	, dependentSignatureProducerConcurrencyIntegrationPaths
	, dependentSignatureProducerConcurrencyPredecessor
	, reverseDependentSignatureProducerConcurrencyUpdate
} from "./dependent-signature-producer-concurrency-source-history.mjs";
import { sourceAtFinHistoryMilestone }
	from "./source-at-fin-history-milestone.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	dependentSignatureProducerConcurrencyHistoryPath, "utf8"));

test("bounded dependent-signature producers record their exact transaction"
	, async () => {
		const history = await record();
		assert.equal(history.schemaVersion, 1);
		assert.equal(history.milestone
			, "dependent-signature-producer-concurrency-source-v1");
		assert.equal(history.predecessorCommit
			, dependentSignatureProducerConcurrencyPredecessor);
		assert.equal(history.implementationCommit
			, dependentSignatureProducerConcurrencyImplementation);
		assert.deepEqual(history.updates.map(item => item.path)
			, dependentSignatureProducerConcurrencyImplementationPaths);
		assert.deepEqual(history.integrationUpdates.map(item => item.path)
			, dependentSignatureProducerConcurrencyIntegrationPaths);
		assert.equal(history.producerCount, 11);
		assert.equal(history.rootProducerCount, 3);
		assert.equal(history.maximumProducerConcurrency, 3);
		assert.equal(history.dependencyCount, 8);
		assert.deepEqual(history.currentSourcePaths, []);
	}
);

test("bounded dependent-signature producers reverse every source", async () => {
	const history = await record();
	for(const update of history.updates)
		assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(
			dependentSignatureProducerConcurrencyImplementation, update.path
		), update), true, update.path);
	for(const update of history.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = git(["show"
			, `${dependentSignatureProducerConcurrencyImplementation}:${update.path}`]);
		assert.equal(reverseDependentSignatureProducerConcurrencyUpdate(
			current, update), previous, update.path);
		assert.equal(beforeDependentSignatureProducerConcurrencySource(
			update.path, current, update.previousSha256), previous, update.path);
	}
});

test("bounded dependent-signature producer graph retains all lanes", async () => {
	const source = git(["show"
		, `${dependentSignatureProducerConcurrencyImplementation}`
			+ ":.github/workflows/dependent-signature-complete.yml"]);
	const edges = [
		["python", "javascript"], ["rust", "native"], ["dotnet", "perl"]
		, ["jvm", "python"], ["ruby", "rust"], ["php-native", "dotnet"]
		, ["php-wasm", "jvm"], ["wit", "ruby"]
	];
	const producers = source.slice(source.indexOf("  javascript:\n")
		, source.indexOf("  receipt:\n"));
	assert.equal((producers.match(/^ {6}shallow_checkout: true$/gmu) ?? []).length
		, 11);
	assert.equal((producers.match(/^ {4}needs: /gmu) ?? []).length, 8);
	assert.equal((producers.match(
		/^ {4}if: always\(\) && inputs\.suite == 'produce'$/gmu) ?? []).length
		, 8);
	for(const [job, dependency] of edges)
		assert.match(producers, new RegExp(
			`^  ${job}:\\n[\\s\\S]*?^    needs: ${dependency}$`, "mu"));
});

test("bounded dependent-signature producers authenticate history controls"
	, async () => {
		const history = await record();
	assert.deepEqual(history.historyAdditions.map(item => item.path)
		, dependentSignatureProducerConcurrencyHistoryAdditions);
	for(const addition of history.historyAdditions)
	{
		const source = await sourceAtFinHistoryMilestone(
			addition.path, addition.sha256);
		assert.equal(sha256(source), addition.sha256, addition.path);
	}
	}
);

test("bounded dependent-signature producers reject forged transitions"
	, async () => {
		const update = (await record()).updates[0];
		const current = git(["show"
			, `${dependentSignatureProducerConcurrencyImplementation}:${update.path}`]);
		for(const forged of [
			{ ...update, currentSha256: "0".repeat(64) }
			, { ...update, previousSha256: "0".repeat(64) }
			, { ...update, path: "unknown.yml" }
			, { ...update, edits: [] }
		]) assert.throws(() =>
			reverseDependentSignatureProducerConcurrencyUpdate(current, forged));
	}
);

test("bounded dependent-signature producer writer refuses another checkout", () => {
	const directory = new URL("../../", import.meta.url);
	const copy = spawnSync(process.execPath, [
		"scripts/update-dependent-signature-producer-concurrency-source-history.mjs"
	], { cwd: directory, encoding: "utf8" });
	assert.notEqual(copy.status, 0);
	assert.match(`${copy.stdout}${copy.stderr}`
		, /dependent-signature-producer-concurrency-source-history-20261029\.json/u);
});
