/**
 * Authenticate the Native Fin container change and preserve all existing support claims.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforeNativeSubtypeSource, nativeSubtypeChangedPaths } from "./native-subtype-source-history.mjs";
import { refinementAuditChangedPaths } from "./refinement-audit-source-history.mjs";
import { browserRefinementsChangedPaths } from "./browser-refinements-source-history.mjs";
import { scalarFinRejectionChangedPaths } from "./scalar-fin-rejection-source-history.mjs";
import { beforeNativeFinContainersSource, nativeFinContainersChangedPaths
	, nativeFinContainersHistoryPath, reverseNativeFinContainersUpdate } from "./native-fin-containers-source-history.mjs";

test("Native Fin container history authenticates exact predecessors and rejects unknown edits", async () => {
	const record = JSON.parse(await readFile(nativeFinContainersHistoryPath, "utf8"));
	assert.equal(record.predecessorCommit, "494c56b4f90d0eca0d114f4d5432a7206b6a5aa1");
	assert.deepEqual(record.updates.map(item => item.path), nativeFinContainersChangedPaths);
	for(const update of record.updates)
	{
		const source = beforeNativeSubtypeSource(update.path, await readFile(update.path, "utf8"));
		assert.equal(sha256(reverseNativeFinContainersUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeNativeFinContainersSource(update.path, source)), update.previousSha256);
		assert.equal(beforeNativeFinContainersSource(update.path, source, update.currentSha256), source);
		assert.equal(sha256(beforeFinRefinementSource(update.path, source, update.previousSha256)), update.previousSha256);
		const changed = source + "\n// unrelated edit\n";
		assert.equal(beforeNativeFinContainersSource(update.path, changed), changed);
		assert.throws(() => reverseNativeFinContainersUpdate(changed, update));
		assert.throws(() => reverseNativeFinContainersUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
	}
});

// Report group, the Fin cell it extends and that cell's profiles. Python waits for its CI report.
const groups = [
	["c-cpp", "native-fin-c-family-ordinary-source", ["c", "cpp"]]
	, ["dotnet", "native-fin-dotnet-ordinary-source", ["dotnet"]]
	, ["java-kotlin", "native-fin-jvm-ordinary-source", ["java", "kotlin"]]
	, ["php-native", "native-fin-php-ordinary-source", ["php-native"]]
	, ["ruby", "native-fin-ruby-ordinary-source", ["ruby"]]
	, ["rust", "native-fin-rust-ordinary-source", ["rust"]]
	, ["wit-wasi", "native-fin-wit-ordinary-source", ["wit-wasi"]]];
// The commit whose tree ran every acceptance.
const acceptedRevision = "f68cf7da2f428be1255fa298d37d5ec65510636e";

// Audit the inventory against its exact predecessor, reconstructed without Git.
test("Native Fin container evidence adds one receipt per host group and extends only the existing Fin cells", async () => {
	const path = "docs/type-surface.v1.json", text = await readFile(path, "utf8");
	const current = JSON.parse(beforeNativeSubtypeSource(path, text)), previous = JSON.parse(beforeNativeFinContainersSource(path, text));
	const added = current.evidence.filter(entry => !previous.evidence.some(item => item.id === entry.id));
	assert.deepEqual(added.map(entry => entry.id), groups.map(([key]) => `native-fin-containers-${key}-installed`));
	assert.deepEqual(current.observations.map(entry => entry.id), previous.observations.map(entry => entry.id));
	for(const [index, [key, observation, profiles]] of groups.entries())
	{
		const evidence = added[index];
		assert.equal(evidence.kind, "installed"); assert.equal(evidence.revision, acceptedRevision);
		assert.equal(evidence.command, `LEAN_BRIDGE_FIN_CONTAINER_PROFILES=${profiles.join(",")} node --test tests/native-fin-containers.test.mjs`);
		for(const file of ["tests/native-fin-containers.test.mjs", "tests/fixtures/onboarding/native-fin-containers/FinContainers.lean", "src/backends/c/native-copied-values.mjs"])
			assert.ok(evidence.files.some(item => item.path === file), `${key}: ${file}`);
		assert.equal(evidence.files.filter(item => item.path.startsWith("tests/fixtures/fin-container-consumers/")).length, profiles.length, key);
		assert.ok(evidence.artifacts.length >= 1 && evidence.artifacts.every(item => item.path.startsWith(`${key}/native-fin-containers/archives/`) && /^[0-9a-f]{64}$/.test(item.sha256)), key);
		// The existing Fin cell keeps its profiles, shapes and positions; its claims widen to containers and cite the new receipt.
		const now = current.observations.find(entry => entry.id === observation), before = previous.observations.find(entry => entry.id === observation);
		assert.deepEqual(now.profiles, profiles); assert.deepEqual(now.shapes, ["fin"]); assert.deepEqual(now.positions, ["parameter", "result"]);
		for(const field of ["profiles", "shapes", "positions", "path", "hostTypes"]) assert.deepEqual(now[field], before[field], `${observation}: ${field}`);
		assert.match(now.scope, /Fin inside Array, List and Option at those sites is checked element by element/);
		assert.ok(now.limitations.some(item => /alone or inside Array, List and Option/.test(item)), observation);
		for(const [stage, value] of Object.entries(now.stages))
		{
			assert.equal(value.state, "passed");
			assert.deepEqual(value.evidence, [...before.stages[stage].evidence, evidence.id], `${observation}: ${stage}`);
		}
		assert.match(now.conversionNotes.fin, /elements of arrays, lists and options/);
	}
	// Every other observation, support classification and receipt is unchanged.
	const extended = new Set(groups.map(([, observation]) => observation));
	assert.deepEqual(current.observations.filter(entry => !extended.has(entry.id)), previous.observations.filter(entry => !extended.has(entry.id)));
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
			assert.ok(nativeFinContainersChangedPaths.includes(file.path) || nativeSubtypeChangedPaths.includes(file.path) || refinementAuditChangedPaths.includes(file.path) || browserRefinementsChangedPaths.includes(file.path) || scalarFinRejectionChangedPaths.includes(file.path), `${entry.id}: ${file.path}`);
			const source = await readFile(file.path, "utf8");
			assert.equal(file.sha256, sha256(beforeNativeFinContainersSource(file.path, source)));
			assert.equal(now.files[index].sha256, sha256(beforeNativeSubtypeSource(file.path, source)));
			++refreshed;
		}
	}
	assert.ok(refreshed > 0);
	process.stdout.write(`# native-fin-containers refreshed inventory pins: ${refreshed}\n`);
});
