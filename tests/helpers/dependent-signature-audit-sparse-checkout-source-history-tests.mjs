/**
 * Authenticate the dependent-signature audit sparse-checkout lineage.
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
	beforeDependentSignatureAuditSparseCheckoutSource
	, dependentSignatureAuditSparseCheckoutHistoryAdditions
	, dependentSignatureAuditSparseCheckoutHistoryPath
	, dependentSignatureAuditSparseCheckoutImplementation
	, dependentSignatureAuditSparseCheckoutImplementationPaths
	, dependentSignatureAuditSparseCheckoutIntegrationPaths
	, dependentSignatureAuditSparseCheckoutPredecessor
	, reverseDependentSignatureAuditSparseCheckoutUpdate
} from "./dependent-signature-audit-sparse-checkout-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	dependentSignatureAuditSparseCheckoutHistoryPath, "utf8"));

test("dependent-signature audit checkout records its exact transaction"
	, async () => {
		const history = await record();
		assert.deepEqual(Object.keys(history).sort(), [
			"archivePattern", "currentSourcePaths", "fetchDepth"
			, "historyAdditions", "implementationCommit"
			, "integrationUpdates", "milestone", "predecessorCommit"
			, "schemaVersion", "scope", "sparseCheckoutConeMode", "updates"
		].sort());
		assert.equal(history.schemaVersion, 1);
		assert.equal(history.milestone
			, "dependent-signature-audit-sparse-checkout-source-v1");
		assert.equal(history.predecessorCommit
			, dependentSignatureAuditSparseCheckoutPredecessor);
		assert.equal(history.implementationCommit
			, dependentSignatureAuditSparseCheckoutImplementation);
		assert.deepEqual(history.updates.map(item => item.path)
			, dependentSignatureAuditSparseCheckoutImplementationPaths);
		assert.deepEqual(history.integrationUpdates.map(item => item.path)
			, dependentSignatureAuditSparseCheckoutIntegrationPaths);
		assert.equal(history.archivePattern
			, "docs/evidence/dependent-signatures-hosted-*/");
		assert.equal(history.fetchDepth, 0);
		assert.equal(history.sparseCheckoutConeMode, false);
		assert.deepEqual(history.currentSourcePaths, []);
	}
);

test("dependent-signature audit checkout reverses every authenticated source"
	, async () => {
		const history = await record();
		for(const update of history.updates)
			assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(
				dependentSignatureAuditSparseCheckoutImplementation, update.path
			), update), true, update.path);
		for(const update of history.integrationUpdates)
		{
			const current = await readFile(update.path, "utf8");
			const previous = git(["show"
				, `${dependentSignatureAuditSparseCheckoutImplementation}:${update.path}`]);
			assert.equal(reverseDependentSignatureAuditSparseCheckoutUpdate(
				current, update), previous, update.path);
			assert.equal(beforeDependentSignatureAuditSparseCheckoutSource(
				update.path, current, update.previousSha256), previous, update.path);
		}
	}
);

test("dependent-signature audit checkout preserves exact audit semantics"
	, async () => {
		const source = git(["show"
			, `${dependentSignatureAuditSparseCheckoutImplementation}`
				+ ":.github/workflows/dependent-signature-complete.yml"]);
		assert.match(source, /fetch-depth: 0/u);
		assert.match(source, /sparse-checkout-cone-mode: false/u);
		assert.match(source, /!\/docs\/evidence\/\*/u);
		assert.match(source
			, /\/docs\/evidence\/dependent-signatures-hosted-\*\//u);
		assert.match(source
			, /tests\/dependent-signature-complete-hosted-evidence\.test\.mjs/u);
		assert.match(source
			, /tests\/dependent-signature-complete-promotion\.test\.mjs/u);
	}
);

test("dependent-signature audit checkout authenticates history controls"
	, async () => {
		const history = await record();
		assert.deepEqual(history.historyAdditions.map(item => item.path)
			, dependentSignatureAuditSparseCheckoutHistoryAdditions);
		for(const addition of history.historyAdditions)
			assert.equal(sha256(await readFile(addition.path)), addition.sha256
				, addition.path);
	}
);

test("dependent-signature audit checkout rejects forged transitions"
	, async () => {
		const update = (await record()).updates[0];
		const current = git(["show"
			, `${dependentSignatureAuditSparseCheckoutImplementation}:${update.path}`]);
		for(const forged of [
			{ ...update, currentSha256: "0".repeat(64) }
			, { ...update, previousSha256: "0".repeat(64) }
			, { ...update, path: "unknown.yml" }
			, { ...update, edits: [] }
		]) assert.throws(() =>
			reverseDependentSignatureAuditSparseCheckoutUpdate(current, forged));
	}
);

test("dependent-signature audit checkout writer refuses another checkout", () => {
	const directory = new URL("../../", import.meta.url);
	const copy = spawnSync(process.execPath, [
		"scripts/update-dependent-signature-audit-sparse-checkout-source-history.mjs"
	], { cwd: directory, encoding: "utf8" });
	assert.notEqual(copy.status, 0);
	assert.match(`${copy.stdout}${copy.stderr}`
		, /dependent-signature-audit-sparse-checkout-source-history-20261029\.json/u);
});
