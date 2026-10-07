/**
 * Authenticate the Rust scalar Fin change and preserve all existing support claims.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforeRubyFinSource, rubyFinChangedPaths } from "./ruby-fin-source-history.mjs";
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
import { refinementCiRepairChangedPaths } from "./refinement-ci-repair-source-history.mjs";
import { pythonRefinementEvidenceChangedPaths } from "./python-refinement-evidence-source-history.mjs";
import { beforeRustFinSource, rustFinChangedPaths
	, rustFinHistoryPath, reverseRustFinUpdate } from "./rust-fin-source-history.mjs";

test("Rust scalar Fin history authenticates exact predecessors and rejects unknown edits", async () => {
	const record = JSON.parse(await readFile(rustFinHistoryPath, "utf8"));
	assert.equal(record.predecessorCommit, "cc2991fd80d286d849e3eb185b49aceb0a17f048");
	assert.deepEqual(record.updates.map(item => item.path), rustFinChangedPaths);
	for(const update of record.updates)
	{
		const source = beforeRubyFinSource(update.path, await readFile(update.path, "utf8"));
		assert.equal(sha256(reverseRustFinUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeRustFinSource(update.path, source)), update.previousSha256);
		assert.equal(beforeRustFinSource(update.path, source, update.currentSha256), source);
		assert.equal(sha256(beforeFinRefinementSource(update.path, source, update.previousSha256)), update.previousSha256);
		const changed = source + "\n// unrelated edit\n";
		assert.equal(beforeRustFinSource(update.path, changed), changed);
		assert.throws(() => reverseRustFinUpdate(changed, update));
		assert.throws(() => reverseRustFinUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
	}
});

test("Rust scalar Fin changes only evidence source pins, not support or archives", async () => {
	const path = "docs/type-surface.v1.json", text = await readFile(path, "utf8");
	const current = JSON.parse(beforeRubyFinSource(path, text)), previous = JSON.parse(beforeRustFinSource(path, text));
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
			assert.ok(rustFinChangedPaths.includes(file.path) || rubyFinChangedPaths.includes(file.path) || dotnetFinChangedPaths.includes(file.path) || jvmFinChangedPaths.includes(file.path) || phpFinChangedPaths.includes(file.path) || witFinChangedPaths.includes(file.path) || finDistributionChangedPaths.includes(file.path) || perlFinChangedPaths.includes(file.path) || hostFinEvidenceChangedPaths.includes(file.path) || nativeSpecializationsChangedPaths.includes(file.path) || nativeFinContainersChangedPaths.includes(file.path) || nativeSubtypeChangedPaths.includes(file.path) || refinementAuditChangedPaths.includes(file.path) || browserRefinementsChangedPaths.includes(file.path) || scalarFinRejectionChangedPaths.includes(file.path) || scalarFinWordingChangedPaths.includes(file.path) || perlRefinementsChangedPaths.includes(file.path) || perlIndexedErrorsChangedPaths.includes(file.path) || refinementCiRepairChangedPaths.includes(file.path) || pythonRefinementEvidenceChangedPaths.includes(file.path), `${entry.id}: ${file.path}`);
			const source = await readFile(file.path, "utf8");
			assert.equal(file.sha256, sha256(beforeRustFinSource(file.path, source)));
			assert.equal(now.files[index].sha256, sha256(beforeRubyFinSource(file.path, source)));
			++refreshed;
		}
	}
	assert.ok(refreshed > 0);
	process.stdout.write(`# rust-fin refreshed inventory pins: ${refreshed}\n`);
});
