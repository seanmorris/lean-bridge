/**
 * Authenticate the combined CLI bundle lineage follow-up without changing frozen evidence.
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
import { beforeTestProfileRegistrationSource, testProfileRegistrationChangedPaths } from "./test-profile-registration-source-history.mjs";
import { beforeCombinedLineageSource, combinedLineageChangedPaths
	, combinedLineageHistoryPath, reverseCombinedLineageUpdate } from "./combined-lineage-source-history.mjs";

test("Combined lineage history authenticates predecessors and rejects unrelated edits", async () => {
	const record = JSON.parse(await readFile(combinedLineageHistoryPath, "utf8"));
	assert.equal(record.predecessorCommit, "87949a34dcb66f3de787fb4f8b2074af91eda4c7");
	assert.deepEqual(record.updates.map(item => item.path), combinedLineageChangedPaths);
	for(const update of record.updates)
	{
		const source = beforeTestProfileRegistrationSource(update.path, await readFile(update.path, "utf8"));
		assert.equal(sha256(reverseCombinedLineageUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeCombinedLineageSource(update.path, source)), update.previousSha256);
		assert.equal(sha256(beforeFinRefinementSource(update.path, source, update.previousSha256)), update.previousSha256);
		const changed = source + "\n// unrelated edit\n";
		assert.equal(beforeCombinedLineageSource(update.path, changed), changed);
		assert.throws(() => reverseCombinedLineageUpdate(changed, update));
		assert.throws(() => reverseCombinedLineageUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
	}
});

// The repair adds no support claim: only source pins of this layer's files move.
test("Combined lineage follow-up changes no inventory claim, receipt or archive", async () => {
	const path = "docs/type-surface.v1.json";
	const current = JSON.parse(beforeTestProfileRegistrationSource(path, await readFile(path, "utf8")));
	const previous = JSON.parse(beforeCombinedLineageSource(path, await readFile(path, "utf8")));
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
			assert.ok(combinedLineageChangedPaths.includes(file.path) || testProfileRegistrationChangedPaths.includes(file.path) || runtimeReceiptChangedPaths.includes(file.path) || cpanCliControlChangedPaths.includes(file.path) || pythonFinChangedPaths.includes(file.path) || rustFinChangedPaths.includes(file.path) || rubyFinChangedPaths.includes(file.path) || dotnetFinChangedPaths.includes(file.path) || jvmFinChangedPaths.includes(file.path) || phpFinChangedPaths.includes(file.path) || witFinChangedPaths.includes(file.path) || finDistributionChangedPaths.includes(file.path) || perlFinChangedPaths.includes(file.path) || hostFinEvidenceChangedPaths.includes(file.path) || nativeSpecializationsChangedPaths.includes(file.path) || nativeFinContainersChangedPaths.includes(file.path) || nativeSubtypeChangedPaths.includes(file.path), `${entry.id}: ${file.path}`);
			assert.equal(file.sha256, sha256(beforeCombinedLineageSource(file.path, await readFile(file.path, "utf8"))));
			assert.equal(now.files[index].sha256, sha256(beforeTestProfileRegistrationSource(file.path, await readFile(file.path, "utf8"))));
			++refreshed;
		}
	}
	process.stdout.write(`# combined-lineage refreshed inventory pins: ${refreshed}\n`);
});
