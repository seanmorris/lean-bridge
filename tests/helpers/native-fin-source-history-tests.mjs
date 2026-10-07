/**
 * Authenticate the checked native Fin admission without changing frozen installed evidence.
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
import { rubyFinChangedPaths } from "./ruby-fin-source-history.mjs";
import { dotnetFinChangedPaths } from "./dotnet-fin-source-history.mjs";
import { jvmFinChangedPaths } from "./jvm-fin-source-history.mjs";
import { phpFinChangedPaths } from "./php-fin-source-history.mjs";
import { witFinChangedPaths } from "./wit-fin-source-history.mjs";
import { finDistributionChangedPaths } from "./fin-distribution-source-history.mjs";
import { perlFinChangedPaths } from "./perl-fin-source-history.mjs";
import { hostFinEvidenceChangedPaths } from "./host-fin-evidence-source-history.mjs";
import { nativeSpecializationsChangedPaths } from "./native-specializations-source-history.mjs";
import { nativeFinContainersChangedPaths } from "./native-fin-containers-source-history.mjs";
import { nativeSubtypeChangedPaths } from "./native-subtype-source-history.mjs";
import { refinementAuditChangedPaths } from "./refinement-audit-source-history.mjs";
import { browserRefinementsChangedPaths } from "./browser-refinements-source-history.mjs";
import { scalarFinRejectionChangedPaths } from "./scalar-fin-rejection-source-history.mjs";
import { scalarFinWordingChangedPaths } from "./scalar-fin-wording-source-history.mjs";
import { perlRefinementsChangedPaths } from "./perl-refinements-source-history.mjs";
import { perlIndexedErrorsChangedPaths } from "./perl-indexed-errors-source-history.mjs";
import { beforeNpmFinDiagnosticsSource, npmFinDiagnosticsChangedPaths } from "./npm-fin-diagnostics-source-history.mjs";
import { diagnosticFollowupChangedPaths } from "./diagnostic-followup-source-history.mjs";
import { combinedLineageChangedPaths } from "./combined-lineage-source-history.mjs";
import { testProfileRegistrationChangedPaths } from "./test-profile-registration-source-history.mjs";
import { beforeNativeFinSource, nativeFinChangedPaths
	, nativeFinHistoryPath, reverseNativeFinUpdate } from "./native-fin-source-history.mjs";

test("native Fin history authenticates predecessors and rejects unrelated edits", async () => {
	const record = JSON.parse(await readFile(nativeFinHistoryPath, "utf8"));
	assert.equal(record.predecessorCommit, "e00a3eed70d08ea2e261b7908345bbd3b03b1490");
	assert.deepEqual(record.updates.map(item => item.path), nativeFinChangedPaths);
	for(const update of record.updates)
	{
		const source = beforeNpmFinDiagnosticsSource(update.path, await readFile(update.path, "utf8"));
		assert.equal(sha256(reverseNativeFinUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeNativeFinSource(update.path, source)), update.previousSha256);
		assert.equal(sha256(beforeFinRefinementSource(update.path, source, update.previousSha256)), update.previousSha256);
		const bytes = Buffer.from(source);
		assert.equal(beforeFinRefinementSource(update.path, bytes, update.currentSha256), bytes);
		const changed = source + "\n// unrelated edit\n";
		assert.equal(beforeNativeFinSource(update.path, changed), changed);
		assert.throws(() => reverseNativeFinUpdate(changed, update));
		assert.throws(() => reverseNativeFinUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
	}
});

// Audit the refreshed inventory against its exact predecessor, reconstructed without Git.
test("native Fin inventory changes only source pins and the four evidenced C-family cells", async () => {
	const path = "docs/type-surface.v1.json";
	const current = JSON.parse(beforeNpmFinDiagnosticsSource(path, await readFile(path, "utf8")));
	const previous = JSON.parse(beforeNativeFinSource(path, await readFile(path, "utf8")));
	const added = current.evidence.filter(entry => !previous.evidence.some(item => item.id === entry.id));
	assert.deepEqual(added.map(entry => entry.id), ["native-fin-installed"]);
	const observation = current.observations.filter(entry => !previous.observations.some(item => item.id === entry.id));
	assert.deepEqual(observation.map(entry => entry.id), ["native-fin-c-family-ordinary-source"]);
	assert.deepEqual(observation[0].profiles, ["c", "cpp"]); assert.deepEqual(observation[0].shapes, ["fin"]);
	assert.deepEqual(observation[0].positions, ["parameter", "result"]); assert.equal(observation[0].path, "ordinary-source");
	// Every existing observation, support classification and receipt is unchanged.
	assert.deepEqual(current.observations.filter(entry => entry !== observation[0]), previous.observations);
	for(const key of Object.keys(previous).filter(key => !["evidence", "observations"].includes(key)))
		assert.deepEqual(current[key], previous[key], key);
	let refreshed = 0;
	const predecessors = new Map();
	for(const entry of previous.evidence)
	{
		const now = current.evidence.find(item => item.id === entry.id);
		const strip = value => ({ ...value, files: value.files.map(file => file.path) });
		assert.deepEqual(strip(now), strip(entry), entry.id);
		assert.deepEqual(now.artifacts, entry.artifacts, entry.id);
		for(const [index, file] of entry.files.entries())
		{
			if(now.files[index].sha256 === file.sha256) continue;
			// Only branch-changed sources move, and only to their exact authenticated successor.
			// Later layers may also refresh pins; each still reconstructs its exact predecessor.
			assert.ok(nativeFinChangedPaths.includes(file.path) || npmFinDiagnosticsChangedPaths.includes(file.path) || diagnosticFollowupChangedPaths.includes(file.path) || combinedLineageChangedPaths.includes(file.path) || testProfileRegistrationChangedPaths.includes(file.path) || runtimeReceiptChangedPaths.includes(file.path) || cpanCliControlChangedPaths.includes(file.path) || pythonFinChangedPaths.includes(file.path) || rustFinChangedPaths.includes(file.path) || rubyFinChangedPaths.includes(file.path) || dotnetFinChangedPaths.includes(file.path) || jvmFinChangedPaths.includes(file.path) || phpFinChangedPaths.includes(file.path) || witFinChangedPaths.includes(file.path) || finDistributionChangedPaths.includes(file.path) || perlFinChangedPaths.includes(file.path) || hostFinEvidenceChangedPaths.includes(file.path) || nativeSpecializationsChangedPaths.includes(file.path) || nativeFinContainersChangedPaths.includes(file.path) || nativeSubtypeChangedPaths.includes(file.path) || refinementAuditChangedPaths.includes(file.path) || browserRefinementsChangedPaths.includes(file.path) || scalarFinRejectionChangedPaths.includes(file.path) || scalarFinWordingChangedPaths.includes(file.path) || perlRefinementsChangedPaths.includes(file.path) || perlIndexedErrorsChangedPaths.includes(file.path), `${entry.id}: ${file.path}`);
			if(!predecessors.has(file.path))
				predecessors.set(file.path, sha256(beforeNativeFinSource(file.path, await readFile(file.path, "utf8"))));
			assert.equal(file.sha256, predecessors.get(file.path), `${entry.id}: ${file.path} predecessor`);
			assert.equal(now.files[index].sha256, sha256(beforeNpmFinDiagnosticsSource(file.path, await readFile(file.path, "utf8"))), `${entry.id}: ${file.path} current`);
			++refreshed;
		}
	}
	assert.ok(refreshed > 0);
	process.stdout.write(`# native-fin refreshed inventory pins: ${refreshed} across ${predecessors.size} sources\n`);
});
