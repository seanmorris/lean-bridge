/**
 * Authenticate the Fin module distribution change and preserve all existing support claims.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforePerlFinSource, perlFinChangedPaths } from "./perl-fin-source-history.mjs";
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
import { refinementCiRepairChangedPaths } from "./refinement-ci-repair-source-history.mjs";
import { beforeFinDistributionSource, finDistributionChangedPaths
	, finDistributionHistoryPath, reverseFinDistributionUpdate } from "./fin-distribution-source-history.mjs";

test("Fin module distribution history authenticates exact predecessors and rejects unknown edits", async () => {
	const record = JSON.parse(await readFile(finDistributionHistoryPath, "utf8"));
	assert.equal(record.predecessorCommit, "6b809dc6069da02b5430c1cbb24e7647bd69df17");
	assert.deepEqual(record.updates.map(item => item.path), finDistributionChangedPaths);
	for(const update of record.updates)
	{
		const source = beforePerlFinSource(update.path, await readFile(update.path, "utf8"));
		assert.equal(sha256(reverseFinDistributionUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeFinDistributionSource(update.path, source)), update.previousSha256);
		assert.equal(beforeFinDistributionSource(update.path, source, update.currentSha256), source);
		assert.equal(sha256(beforeFinRefinementSource(update.path, source, update.previousSha256)), update.previousSha256);
		const changed = source + "\n// unrelated edit\n";
		assert.equal(beforeFinDistributionSource(update.path, changed), changed);
		assert.throws(() => reverseFinDistributionUpdate(changed, update));
		assert.throws(() => reverseFinDistributionUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
	}
});

test("Fin module distribution changes only evidence source pins, not support or archives", async () => {
	const path = "docs/type-surface.v1.json", text = await readFile(path, "utf8");
	const current = JSON.parse(beforePerlFinSource(path, text)), previous = JSON.parse(beforeFinDistributionSource(path, text));
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
			assert.ok(finDistributionChangedPaths.includes(file.path) || perlFinChangedPaths.includes(file.path) || hostFinEvidenceChangedPaths.includes(file.path) || nativeSpecializationsChangedPaths.includes(file.path) || nativeFinContainersChangedPaths.includes(file.path) || nativeSubtypeChangedPaths.includes(file.path) || refinementAuditChangedPaths.includes(file.path) || browserRefinementsChangedPaths.includes(file.path) || scalarFinRejectionChangedPaths.includes(file.path) || scalarFinWordingChangedPaths.includes(file.path) || perlRefinementsChangedPaths.includes(file.path) || perlIndexedErrorsChangedPaths.includes(file.path) || refinementCiRepairChangedPaths.includes(file.path), `${entry.id}: ${file.path}`);
			const source = await readFile(file.path, "utf8");
			assert.equal(file.sha256, sha256(beforeFinDistributionSource(file.path, source)));
			assert.equal(now.files[index].sha256, sha256(beforePerlFinSource(file.path, source)));
			++refreshed;
		}
	}
	assert.ok(refreshed > 0);
	process.stdout.write(`# fin-distribution refreshed inventory pins: ${refreshed}\n`);
});
