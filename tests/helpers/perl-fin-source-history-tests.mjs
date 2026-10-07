/**
 * Authenticate the Perl scalar Fin change and preserve all existing support claims.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforeHostFinEvidenceSource, hostFinEvidenceChangedPaths } from "./host-fin-evidence-source-history.mjs";
import { nativeSpecializationsChangedPaths } from "./native-specializations-source-history.mjs";
import { nativeFinContainersChangedPaths } from "./native-fin-containers-source-history.mjs";
import { nativeSubtypeChangedPaths } from "./native-subtype-source-history.mjs";
import { refinementAuditChangedPaths } from "./refinement-audit-source-history.mjs";
import { browserRefinementsChangedPaths } from "./browser-refinements-source-history.mjs";
import { scalarFinRejectionChangedPaths } from "./scalar-fin-rejection-source-history.mjs";
import { scalarFinWordingChangedPaths } from "./scalar-fin-wording-source-history.mjs";
import { perlRefinementsChangedPaths } from "./perl-refinements-source-history.mjs";
import { beforePerlFinSource, perlFinChangedPaths
	, perlFinHistoryPath, reversePerlFinUpdate } from "./perl-fin-source-history.mjs";

test("Perl scalar Fin history authenticates exact predecessors and rejects unknown edits", async () => {
	const record = JSON.parse(await readFile(perlFinHistoryPath, "utf8"));
	assert.equal(record.predecessorCommit, "df2063443d48f2cd38ab6494126521e103bf0f07");
	assert.deepEqual(record.updates.map(item => item.path), perlFinChangedPaths);
	for(const update of record.updates)
	{
		const source = beforeHostFinEvidenceSource(update.path, await readFile(update.path, "utf8"));
		assert.equal(sha256(reversePerlFinUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforePerlFinSource(update.path, source)), update.previousSha256);
		assert.equal(beforePerlFinSource(update.path, source, update.currentSha256), source);
		assert.equal(sha256(beforeFinRefinementSource(update.path, source, update.previousSha256)), update.previousSha256);
		const changed = source + "\n// unrelated edit\n";
		assert.equal(beforePerlFinSource(update.path, changed), changed);
		assert.throws(() => reversePerlFinUpdate(changed, update));
		assert.throws(() => reversePerlFinUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
	}
});

test("Perl scalar Fin changes only evidence source pins, not support or archives", async () => {
	const path = "docs/type-surface.v1.json", text = await readFile(path, "utf8");
	const current = JSON.parse(beforeHostFinEvidenceSource(path, text)), previous = JSON.parse(beforePerlFinSource(path, text));
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
			assert.ok(perlFinChangedPaths.includes(file.path) || hostFinEvidenceChangedPaths.includes(file.path) || nativeSpecializationsChangedPaths.includes(file.path) || nativeFinContainersChangedPaths.includes(file.path) || nativeSubtypeChangedPaths.includes(file.path) || refinementAuditChangedPaths.includes(file.path) || browserRefinementsChangedPaths.includes(file.path) || scalarFinRejectionChangedPaths.includes(file.path) || scalarFinWordingChangedPaths.includes(file.path) || perlRefinementsChangedPaths.includes(file.path), `${entry.id}: ${file.path}`);
			const source = await readFile(file.path, "utf8");
			assert.equal(file.sha256, sha256(beforePerlFinSource(file.path, source)));
			assert.equal(now.files[index].sha256, sha256(beforeHostFinEvidenceSource(file.path, source)));
			++refreshed;
		}
	}
	assert.ok(refreshed > 0);
	process.stdout.write(`# perl-fin refreshed inventory pins: ${refreshed}\n`);
});
