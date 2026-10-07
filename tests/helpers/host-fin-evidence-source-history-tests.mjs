/**
 * Authenticate the Host Fin evidence change and preserve all existing support claims.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforeNativeSpecializationsSource, nativeSpecializationsChangedPaths } from "./native-specializations-source-history.mjs";
import { nativeFinContainersChangedPaths } from "./native-fin-containers-source-history.mjs";
import { beforeHostFinEvidenceSource, hostFinEvidenceChangedPaths
	, hostFinEvidenceHistoryPath, reverseHostFinEvidenceUpdate } from "./host-fin-evidence-source-history.mjs";

test("Host Fin evidence history authenticates exact predecessors and rejects unknown edits", async () => {
	const record = JSON.parse(await readFile(hostFinEvidenceHistoryPath, "utf8"));
	assert.equal(record.predecessorCommit, "052aae796f73b0b328396cfe84298842267465cf");
	assert.deepEqual(record.updates.map(item => item.path), hostFinEvidenceChangedPaths);
	for(const update of record.updates)
	{
		const source = beforeNativeSpecializationsSource(update.path, await readFile(update.path, "utf8"));
		assert.equal(sha256(reverseHostFinEvidenceUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeHostFinEvidenceSource(update.path, source)), update.previousSha256);
		assert.equal(beforeHostFinEvidenceSource(update.path, source, update.currentSha256), source);
		assert.equal(sha256(beforeFinRefinementSource(update.path, source, update.previousSha256)), update.previousSha256);
		const changed = source + "\n// unrelated edit\n";
		assert.equal(beforeHostFinEvidenceSource(update.path, changed), changed);
		assert.throws(() => reverseHostFinEvidenceUpdate(changed, update));
		assert.throws(() => reverseHostFinEvidenceUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
	}
});

// Evidence key and the inventory profiles each new cell covers. Java and Kotlin share one JAR.
const hosts = [["rust", ["rust"]], ["ruby", ["ruby"]], ["dotnet", ["dotnet"]], ["jvm", ["java", "kotlin"]], ["php", ["php-native"]], ["wit", ["wit-wasi"]]];
// The commit whose tree ran every acceptance; this layer also records its one test change.
const acceptedRevision = "d6d6eb4b6cd1c6f2367899ea7954a279f75e2836";

// Audit the inventory against its exact predecessor, reconstructed without Git.
test("Host Fin evidence adds six installed receipts and six top-level Fin cells, and changes no other claim", async () => {
	const path = "docs/type-surface.v1.json", text = await readFile(path, "utf8");
	const current = JSON.parse(beforeNativeSpecializationsSource(path, text)), previous = JSON.parse(beforeHostFinEvidenceSource(path, text));
	const added = current.evidence.filter(entry => !previous.evidence.some(item => item.id === entry.id));
	assert.deepEqual(added.map(entry => entry.id), hosts.map(([key]) => `${key}-fin-installed`));
	const cells = current.observations.filter(entry => !previous.observations.some(item => item.id === entry.id));
	assert.deepEqual(cells.map(entry => entry.id), hosts.map(([key]) => `native-fin-${key}-ordinary-source`));
	for(const [index, [key, profiles]] of hosts.entries())
	{
		const evidence = added[index], cell = cells[index];
		assert.equal(evidence.kind, "installed"); assert.equal(evidence.revision, acceptedRevision);
		assert.match(evidence.command, new RegExp(`^LEAN_BRIDGE_${key.toUpperCase()}_FIN_TEST=1 node --test tests/${key}-fin\\.test\\.mjs$`));
		assert.ok(evidence.files.some(file => file.path === `tests/${key}-fin.test.mjs`), key);
		assert.ok(evidence.artifacts.length >= 2 && evidence.artifacts.every(item => item.path.startsWith(`${profiles[0]}/native-fin/archives/`) && /^[0-9a-f]{64}$/.test(item.sha256)), key);
		// One package, one shape, top-level positions only, each stage backed by this host's own receipt.
		assert.deepEqual(cell.profiles, profiles); assert.deepEqual(cell.shapes, ["fin"]);
		assert.deepEqual(cell.positions, ["parameter", "result"]); assert.equal(cell.path, "ordinary-source");
		assert.deepEqual(Object.keys(cell.hostTypes), ["fin"]); assert.deepEqual(Object.keys(cell.hostTypes.fin), ["parameter", "result"]);
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
			assert.ok(hostFinEvidenceChangedPaths.includes(file.path) || nativeSpecializationsChangedPaths.includes(file.path) || nativeFinContainersChangedPaths.includes(file.path), `${entry.id}: ${file.path}`);
			const source = await readFile(file.path, "utf8");
			assert.equal(file.sha256, sha256(beforeHostFinEvidenceSource(file.path, source)));
			assert.equal(now.files[index].sha256, sha256(beforeNativeSpecializationsSource(file.path, source)));
			++refreshed;
		}
	}
	assert.ok(refreshed > 0);
	process.stdout.write(`# host-fin-evidence refreshed inventory pins: ${refreshed}\n`);
});
