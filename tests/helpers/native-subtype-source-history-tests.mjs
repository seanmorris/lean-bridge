/**
 * Authenticate the Native Subtype change and preserve all existing support claims.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforeRefinementAuditSource, refinementAuditChangedPaths } from "./refinement-audit-source-history.mjs";
import { browserRefinementsChangedPaths } from "./browser-refinements-source-history.mjs";
import { scalarFinRejectionChangedPaths } from "./scalar-fin-rejection-source-history.mjs";
import { scalarFinWordingChangedPaths } from "./scalar-fin-wording-source-history.mjs";
import { perlRefinementsChangedPaths } from "./perl-refinements-source-history.mjs";
import { perlIndexedErrorsChangedPaths } from "./perl-indexed-errors-source-history.mjs";
import { refinementCiRepairChangedPaths } from "./refinement-ci-repair-source-history.mjs";
import { pythonRefinementEvidenceChangedPaths } from "./python-refinement-evidence-source-history.mjs";
import { beforeNativeSubtypeSource, nativeSubtypeChangedPaths
	, nativeSubtypeHistoryPath, reverseNativeSubtypeUpdate } from "./native-subtype-source-history.mjs";

test("Native Subtype history authenticates exact predecessors and rejects unknown edits", async () => {
	const record = JSON.parse(await readFile(nativeSubtypeHistoryPath, "utf8"));
	assert.equal(record.predecessorCommit, "9d31ef7416bcd2352721330232b8ba7fb3e067c3");
	assert.deepEqual(record.updates.map(item => item.path), nativeSubtypeChangedPaths);
	for(const update of record.updates)
	{
		const source = beforeRefinementAuditSource(update.path, await readFile(update.path, "utf8"));
		assert.equal(sha256(reverseNativeSubtypeUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeNativeSubtypeSource(update.path, source)), update.previousSha256);
		assert.equal(beforeNativeSubtypeSource(update.path, source, update.currentSha256), source);
		assert.equal(sha256(beforeFinRefinementSource(update.path, source, update.previousSha256)), update.previousSha256);
		const changed = source + "\n// unrelated edit\n";
		assert.equal(beforeNativeSubtypeSource(update.path, changed), changed);
		assert.throws(() => reverseNativeSubtypeUpdate(changed, update));
		assert.throws(() => reverseNativeSubtypeUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
	}
});

// Report group and the inventory profiles each new cell covers. Python waits for its CI report.
const groups = [
	["c-cpp", ["c", "cpp"]]
	, ["dotnet", ["dotnet"]]
	, ["java-kotlin", ["java", "kotlin"]]
	, ["php-native", ["php-native"]]
	, ["ruby", ["ruby"]]
	, ["rust", ["rust"]]
	, ["wit-wasi", ["wit-wasi"]]];
// The commit whose tree ran every acceptance.
const acceptedRevision = "8ff62bf224300418a4748dd3209bb607e963f140";

// Audit the inventory against its exact predecessor, reconstructed without Git.
test("Native Subtype evidence adds one receipt and one Subtype cell per host group, and changes no other claim", async () => {
	const path = "docs/type-surface.v1.json", text = await readFile(path, "utf8");
	const current = JSON.parse(beforeRefinementAuditSource(path, text)), previous = JSON.parse(beforeNativeSubtypeSource(path, text));
	const added = current.evidence.filter(entry => !previous.evidence.some(item => item.id === entry.id));
	assert.deepEqual(added.map(entry => entry.id), groups.map(([key]) => `native-subtype-${key}-installed`));
	const cells = current.observations.filter(entry => !previous.observations.some(item => item.id === entry.id));
	assert.deepEqual(cells.map(entry => entry.id), groups.map(([key]) => `native-subtype-${key}-ordinary-source`));
	for(const [index, [key, profiles]] of groups.entries())
	{
		const evidence = added[index], cell = cells[index];
		assert.equal(evidence.kind, "installed"); assert.equal(evidence.revision, acceptedRevision);
		assert.equal(evidence.command, `LEAN_BRIDGE_SUBTYPE_PROFILES=${profiles.join(",")} node --test tests/native-subtype.test.mjs`);
		for(const file of ["tests/native-subtype.test.mjs", "tests/fixtures/onboarding/native-subtype/Subtypes.lean", "src/analyze/NativeExports.lean", "src/release/cpan-package.mjs"])
			assert.ok(evidence.files.some(item => item.path === file), `${key}: ${file}`);
		assert.equal(evidence.files.filter(item => item.path.startsWith("tests/fixtures/subtype-consumers/")).length, profiles.length, key);
		assert.ok(evidence.artifacts.length >= 1 && evidence.artifacts.every(item => item.path.startsWith(`${key}/native-subtype/archives/`) && /^[0-9a-f]{64}$/.test(item.sha256)), key);
		// Top-level Subtype cells only, each stage backed by this group's own receipt.
		assert.deepEqual(cell.profiles, profiles); assert.deepEqual(cell.shapes, ["subtype"]);
		assert.deepEqual(cell.positions, ["parameter", "result"]); assert.equal(cell.path, "ordinary-source");
		assert.deepEqual(Object.keys(cell.hostTypes), ["subtype"]); assert.deepEqual(Object.keys(cell.hostTypes.subtype), ["parameter", "result"]);
		for(const stage of Object.values(cell.stages))
		{
			assert.equal(stage.state, "passed"); assert.deepEqual(stage.evidence, [evidence.id]);
		}
	}
	// Every existing observation, support classification and receipt is unchanged.
	assert.deepEqual(current.observations.filter(entry => !cells.includes(entry)), previous.observations);
	for(const key of Object.keys(previous).filter(key => !["evidence", "observations"].includes(key)))
		assert.deepEqual(current[key], previous[key], key);
	let refreshed = 0;
	for(const entry of previous.evidence)
	{
		const now = current.evidence.find(item => item.id === entry.id);
		const strip = value => ({ ...value, files: value.files.map(file => file.path) });
		assert.deepEqual(strip(now), strip(entry), entry.id);
		for(const [index, file] of entry.files.entries())
		{
			if(now.files[index].sha256 === file.sha256) continue;
			assert.ok(nativeSubtypeChangedPaths.includes(file.path) || refinementAuditChangedPaths.includes(file.path) || browserRefinementsChangedPaths.includes(file.path) || scalarFinRejectionChangedPaths.includes(file.path) || scalarFinWordingChangedPaths.includes(file.path) || perlRefinementsChangedPaths.includes(file.path) || perlIndexedErrorsChangedPaths.includes(file.path) || refinementCiRepairChangedPaths.includes(file.path) || pythonRefinementEvidenceChangedPaths.includes(file.path), `${entry.id}: ${file.path}`);
			const source = await readFile(file.path, "utf8");
			assert.equal(file.sha256, sha256(beforeNativeSubtypeSource(file.path, source)));
			assert.equal(now.files[index].sha256, sha256(beforeRefinementAuditSource(file.path, source)));
			++refreshed;
		}
	}
	assert.ok(refreshed > 0);
	process.stdout.write(`# native-subtype refreshed inventory pins: ${refreshed}\n`);
});
