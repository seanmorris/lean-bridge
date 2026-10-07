/**
 * Authenticate the Native specialization change and preserve all existing support claims.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforeNativeFinContainersSource, nativeFinContainersChangedPaths } from "./native-fin-containers-source-history.mjs";
import { nativeSubtypeChangedPaths } from "./native-subtype-source-history.mjs";
import { beforeNativeSpecializationsSource, nativeSpecializationsChangedPaths
	, nativeSpecializationsHistoryPath, reverseNativeSpecializationsUpdate } from "./native-specializations-source-history.mjs";

test("Native specialization history authenticates exact predecessors and rejects unknown edits", async () => {
	const record = JSON.parse(await readFile(nativeSpecializationsHistoryPath, "utf8"));
	assert.equal(record.predecessorCommit, "2ad2ba57d880d1f2c331ff7698f9778c43c87655");
	assert.deepEqual(record.updates.map(item => item.path), nativeSpecializationsChangedPaths);
	for(const update of record.updates)
	{
		const source = beforeNativeFinContainersSource(update.path, await readFile(update.path, "utf8"));
		assert.equal(sha256(reverseNativeSpecializationsUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeNativeSpecializationsSource(update.path, source)), update.previousSha256);
		assert.equal(beforeNativeSpecializationsSource(update.path, source, update.currentSha256), source);
		assert.equal(sha256(beforeFinRefinementSource(update.path, source, update.previousSha256)), update.previousSha256);
		const changed = source + "\n// unrelated edit\n";
		assert.equal(beforeNativeSpecializationsSource(update.path, changed), changed);
		assert.throws(() => reverseNativeSpecializationsUpdate(changed, update));
		assert.throws(() => reverseNativeSpecializationsUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
	}
});

// Report group and the inventory profiles each new cell covers. Java and Kotlin share one JAR; C and C++ share one build.
const groups = [["c-cpp", ["c", "cpp"]], ["dotnet", ["dotnet"]], ["java-kotlin", ["java", "kotlin"]], ["php-native", ["php-native"]], ["ruby", ["ruby"]], ["rust", ["rust"]], ["wit-wasi", ["wit-wasi"]]];
// The commit whose tree ran every acceptance.
const acceptedRevision = "78955d7f25c08dd3606c07807cf525435daae250";

// Audit the inventory against its exact predecessor, reconstructed without Git.
test("Native specialization adds one installed receipt and one signature cell per native host, and changes no other claim", async () => {
	const path = "docs/type-surface.v1.json", text = await readFile(path, "utf8");
	const current = JSON.parse(beforeNativeFinContainersSource(path, text)), previous = JSON.parse(beforeNativeSpecializationsSource(path, text));
	const added = current.evidence.filter(entry => !previous.evidence.some(item => item.id === entry.id));
	assert.deepEqual(added.map(entry => entry.id), groups.map(([key]) => `native-specializations-${key}-installed`));
	const cells = current.observations.filter(entry => !previous.observations.some(item => item.id === entry.id));
	assert.deepEqual(cells.map(entry => entry.id), groups.map(([key]) => `native-specializations-${key}-ordinary-source`));
	for(const [index, [key, profiles]] of groups.entries())
	{
		const evidence = added[index], cell = cells[index];
		assert.equal(evidence.kind, "installed"); assert.equal(evidence.revision, acceptedRevision);
		assert.equal(evidence.command, `LEAN_BRIDGE_SPECIALIZATION_PROFILES=${profiles.join(",")} node --test tests/native-specializations.test.mjs`);
		for(const file of ["tests/native-specializations.test.mjs", "tests/fixtures/onboarding/native-specializations/Specialized.lean"])
			assert.ok(evidence.files.some(item => item.path === file), `${key}: ${file}`);
		assert.equal(evidence.files.filter(item => item.path.startsWith("tests/fixtures/specialization-consumers/")).length, profiles.length, key);
		assert.ok(evidence.artifacts.length >= 1 && evidence.artifacts.every(item => item.path.startsWith(`${key}/native-specializations/archives/`) && /^[0-9a-f]{64}$/.test(item.sha256)), key);
		// Signature-only generic cells, each stage backed by this group's own receipt.
		assert.deepEqual(cell.profiles, profiles); assert.deepEqual(cell.shapes, ["generic", "implicit", "instance"]);
		assert.deepEqual(cell.positions, ["signature"]); assert.equal(cell.path, "ordinary-source");
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
			assert.ok(nativeSpecializationsChangedPaths.includes(file.path) || nativeFinContainersChangedPaths.includes(file.path) || nativeSubtypeChangedPaths.includes(file.path), `${entry.id}: ${file.path}`);
			const source = await readFile(file.path, "utf8");
			assert.equal(file.sha256, sha256(beforeNativeSpecializationsSource(file.path, source)));
			assert.equal(now.files[index].sha256, sha256(beforeNativeFinContainersSource(file.path, source)));
			++refreshed;
		}
	}
	assert.ok(refreshed > 0);
	process.stdout.write(`# native-specializations refreshed inventory pins: ${refreshed}\n`);
});
