/**
 * Authenticate the dependent-signature producer sparse-checkout lineage.
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
	beforeDependentSignatureProducerSparseCheckoutSource
	, dependentSignatureProducerSparseCheckoutHistoryAdditions
	, dependentSignatureProducerSparseCheckoutHistoryPath
	, dependentSignatureProducerSparseCheckoutImplementation
	, dependentSignatureProducerSparseCheckoutImplementationPaths
	, dependentSignatureProducerSparseCheckoutIntegrationPaths
	, dependentSignatureProducerSparseCheckoutPredecessor
	, reverseDependentSignatureProducerSparseCheckoutUpdate
} from "./dependent-signature-producer-sparse-checkout-source-history.mjs";
import { sourceAtFinHistoryMilestone }
	from "./source-at-fin-history-milestone.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	dependentSignatureProducerSparseCheckoutHistoryPath, "utf8"));

test("dependent-signature producer sparse checkout records its exact transaction"
	, async () => {
		const history = await record();
		assert.equal(history.schemaVersion, 1);
		assert.equal(history.milestone
			, "dependent-signature-producer-sparse-checkout-source-v1");
		assert.equal(history.predecessorCommit
			, dependentSignatureProducerSparseCheckoutPredecessor);
		assert.equal(history.implementationCommit
			, dependentSignatureProducerSparseCheckoutImplementation);
		assert.deepEqual(history.updates.map(item => item.path)
			, dependentSignatureProducerSparseCheckoutImplementationPaths);
		assert.deepEqual(history.integrationUpdates.map(item => item.path)
			, dependentSignatureProducerSparseCheckoutIntegrationPaths);
		assert.equal(history.producerWorkflowCount, 11);
		assert.equal(history.excludedPattern, "!/docs/evidence/*");
		assert.deepEqual(history.retainedEvidencePatterns, [
			"/docs/evidence/*.json", "/docs/evidence/*.md"
			, "/docs/evidence/*.xml"
		]);
		assert.equal(history.sparseCheckoutConeMode, false);
		assert.deepEqual(history.currentSourcePaths, []);
	}
);

test("dependent-signature producer sparse checkout reverses every source"
	, async () => {
		const history = await record();
		for(const update of history.updates)
			assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(
				dependentSignatureProducerSparseCheckoutImplementation, update.path
			), update), true, update.path);
		for(const update of history.integrationUpdates)
		{
			const current = await sourceAtFinHistoryMilestone(
				update.path, update.currentSha256);
			const previous = git(["show"
				, `${dependentSignatureProducerSparseCheckoutImplementation}:${update.path}`]);
			assert.equal(reverseDependentSignatureProducerSparseCheckoutUpdate(
				current, update), previous, update.path);
			assert.equal(beforeDependentSignatureProducerSparseCheckoutSource(
				update.path, current, update.previousSha256), previous, update.path);
		}
	}
);

test("dependent-signature producers omit only retained hosted evidence"
	, async () => {
		const workflows = dependentSignatureProducerSparseCheckoutImplementationPaths
			.filter(path => path.startsWith(".github/workflows/"));
		assert.equal(workflows.length, 11);
		for(const path of workflows)
		{
			const source = git(["show"
				, `${dependentSignatureProducerSparseCheckoutImplementation}:${path}`]);
			assert.match(source
				, /fetch-depth: \$\{\{ inputs\.shallow_checkout && 1 \|\| 0 \}\}/u);
			assert.match(source, /sparse-checkout-cone-mode: false/u);
			assert.match(source, /!\/docs\/evidence\/\*/u);
			for(const pattern of ["*.json", "*.md", "*.xml"])
				assert.ok(source.includes(`/docs/evidence/${pattern}`), path);
			for(const directory of [
				".github", "acceptance", "config", "containers", "demos"
				, "nix", "notices", "patches", "poc", "schema", "scripts"
				, "site", "src", "tests", "docs"
			]) assert.ok(source.includes(`            /${directory}/\n`), path);
		}
	}
);

test("dependent-signature producer sparse checkout authenticates history controls"
	, async () => {
		const history = await record();
		assert.deepEqual(history.historyAdditions.map(item => item.path)
			, dependentSignatureProducerSparseCheckoutHistoryAdditions);
		for(const addition of history.historyAdditions)
		{
			const source = await sourceAtFinHistoryMilestone(
				addition.path, addition.sha256);
			assert.equal(sha256(source), addition.sha256, addition.path);
		}
	}
);

test("dependent-signature producer sparse checkout rejects forged transitions"
	, async () => {
		const update = (await record()).updates[0];
		const current = git(["show"
			, `${dependentSignatureProducerSparseCheckoutImplementation}:${update.path}`]);
		for(const forged of [
			{ ...update, currentSha256: "0".repeat(64) }
			, { ...update, previousSha256: "0".repeat(64) }
			, { ...update, path: "unknown.yml" }
			, { ...update, edits: [] }
		]) assert.throws(() =>
			reverseDependentSignatureProducerSparseCheckoutUpdate(current, forged));
	}
);

test("dependent-signature producer sparse checkout writer refuses another checkout"
	, () => {
		const directory = new URL("../../", import.meta.url);
		const copy = spawnSync(process.execPath, [
			"scripts/update-dependent-signature-producer-sparse-checkout-source-history.mjs"
		], { cwd: directory, encoding: "utf8" });
		assert.notEqual(copy.status, 0);
		assert.match(`${copy.stdout}${copy.stderr}`
			, /dependent-signature-producer-sparse-checkout-source-history-20261029\.json/u);
	}
);
