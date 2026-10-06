/**
 * Authenticate the locked-engine Fin diagnostic repair without changing frozen evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { runtimeReceiptChangedPaths } from "./runtime-receipt-source-history.mjs";
import { cpanCliControlChangedPaths } from "./cpan-cli-control-source-history.mjs";
import { pythonFinChangedPaths } from "./python-fin-source-history.mjs";
import { rustFinChangedPaths } from "./rust-fin-source-history.mjs";
import { beforeDiagnosticFollowupSource, diagnosticFollowupChangedPaths } from "./diagnostic-followup-source-history.mjs";
import { combinedLineageChangedPaths } from "./combined-lineage-source-history.mjs";
import { testProfileRegistrationChangedPaths } from "./test-profile-registration-source-history.mjs";
import { beforeNpmFinDiagnosticsSource, npmFinDiagnosticsChangedPaths
	, npmFinDiagnosticsHistoryPath, reverseNpmFinDiagnosticsUpdate } from "./npm-fin-diagnostics-source-history.mjs";

test("Fin diagnostic history authenticates predecessors and rejects unrelated edits", async () => {
	const record = JSON.parse(await readFile(npmFinDiagnosticsHistoryPath, "utf8"));
	assert.equal(record.predecessorCommit, "dcc2724af3ee64dc453a68fb72f5cc6675cc8636");
	assert.deepEqual(record.updates.map(item => item.path), npmFinDiagnosticsChangedPaths);
	for(const update of record.updates)
	{
		const source = beforeDiagnosticFollowupSource(update.path, await readFile(update.path, "utf8"));
		assert.equal(sha256(reverseNpmFinDiagnosticsUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeNpmFinDiagnosticsSource(update.path, source)), update.previousSha256);
		assert.equal(sha256(beforeFinRefinementSource(update.path, source, update.previousSha256)), update.previousSha256);
		const changed = source + "\n// unrelated edit\n";
		assert.equal(beforeNpmFinDiagnosticsSource(update.path, changed), changed);
		assert.throws(() => reverseNpmFinDiagnosticsUpdate(changed, update));
		assert.throws(() => reverseNpmFinDiagnosticsUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
	}
});

// The repair adds no support claim: only source pins of this layer's files move.
test("Fin diagnostic repair changes no inventory claim, receipt or archive", async () => {
	const path = "docs/type-surface.v1.json";
	const current = JSON.parse(await readFile(path, "utf8"));
	const previous = JSON.parse(beforeNpmFinDiagnosticsSource(path, await readFile(path, "utf8")));
	assert.deepEqual(current.observations, previous.observations);
	for(const key of Object.keys(previous).filter(key => key !== "evidence")) assert.deepEqual(current[key], previous[key], key);
	assert.deepEqual(current.evidence.map(entry => entry.id), previous.evidence.map(entry => entry.id));
	let refreshed = 0;
	for(const [position, entry] of previous.evidence.entries())
	{
		const now = current.evidence[position];
		const strip = value => ({ ...value, files: value.files.map(file => file.path) });
		assert.deepEqual(strip(now), strip(entry), entry.id);
		for(const [index, file] of entry.files.entries())
		{
			if(now.files[index].sha256 === file.sha256) continue;
			assert.ok(npmFinDiagnosticsChangedPaths.includes(file.path) || diagnosticFollowupChangedPaths.includes(file.path) || combinedLineageChangedPaths.includes(file.path) || testProfileRegistrationChangedPaths.includes(file.path) || runtimeReceiptChangedPaths.includes(file.path) || cpanCliControlChangedPaths.includes(file.path) || pythonFinChangedPaths.includes(file.path) || rustFinChangedPaths.includes(file.path), `${entry.id}: ${file.path}`);
			assert.equal(file.sha256, sha256(beforeNpmFinDiagnosticsSource(file.path, await readFile(file.path, "utf8"))));
			assert.equal(now.files[index].sha256, sha256(await readFile(file.path)));
			++refreshed;
		}
	}
	process.stdout.write(`# npm-fin-diagnostics refreshed inventory pins: ${refreshed}\n`);
});
