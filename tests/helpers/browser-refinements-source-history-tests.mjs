/**
 * Authenticate the Browser refinements change and preserve all existing support claims.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforeBrowserRefinementsSource, browserRefinementsChangedPaths
	, browserRefinementsHistoryPath, reverseBrowserRefinementsUpdate } from "./browser-refinements-source-history.mjs";

test("Browser refinements history authenticates exact predecessors and rejects unknown edits", async () => {
	const record = JSON.parse(await readFile(browserRefinementsHistoryPath, "utf8"));
	assert.equal(record.predecessorCommit, "799367f");
	assert.deepEqual(record.updates.map(item => item.path), browserRefinementsChangedPaths);
	for(const update of record.updates)
	{
		const source = await readFile(update.path, "utf8");
		assert.equal(sha256(reverseBrowserRefinementsUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeBrowserRefinementsSource(update.path, source)), update.previousSha256);
		assert.equal(beforeBrowserRefinementsSource(update.path, source, update.currentSha256), source);
		assert.equal(sha256(beforeFinRefinementSource(update.path, source, update.previousSha256)), update.previousSha256);
		const changed = source + "\n// unrelated edit\n";
		assert.equal(beforeBrowserRefinementsSource(update.path, changed), changed);
		assert.throws(() => reverseBrowserRefinementsUpdate(changed, update));
		assert.throws(() => reverseBrowserRefinementsUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
	}
});

const profiles = ["browser-javascript", "browser-react", "browser-worker"];
// The commit whose tree ran every acceptance.
const acceptedRevision = "b5a4d9f1791388fe7557208ca4647d986c5905c1";

// Audit the inventory against its exact predecessor, reconstructed without Git.
test("Browser refinements evidence adds one receipt and one Fin and one Subtype browser cell, and changes no other claim", async () => {
	const path = "docs/type-surface.v1.json", text = await readFile(path, "utf8");
	const current = JSON.parse(text), previous = JSON.parse(beforeBrowserRefinementsSource(path, text));
	const added = current.evidence.filter(entry => !previous.evidence.some(item => item.id === entry.id));
	assert.deepEqual(added.map(entry => entry.id), ["npm-browser-refinements-installed"]);
	const cells = current.observations.filter(entry => !previous.observations.some(item => item.id === entry.id));
	assert.deepEqual(cells.map(entry => entry.id), ["npm-browser-fin-ordinary-source", "npm-browser-subtype-ordinary-source"]);
	const [evidence] = added;
	assert.equal(evidence.kind, "installed"); assert.equal(evidence.revision, acceptedRevision);
	assert.equal(evidence.command, "LEAN_BRIDGE_LAKE_WASM_TEST=1 LEAN_BRIDGE_TYPE_CORPUS_BROWSERS=chromium,firefox,webkit node --test tests/browser-refinements.test.mjs");
	for(const file of ["tests/browser-refinements.test.mjs", "tests/helpers/browser-refinement-packages.mjs", "tests/fixtures/browser-refinements/javascript.mjs", "src/backends/javascript/generate.mjs"])
		assert.ok(evidence.files.some(item => item.path === file), file);
	assert.ok(evidence.artifacts.length === 2 && evidence.artifacts.every(item => item.path.startsWith("npm/browser-refinements/") && /^[0-9a-f]{64}$/.test(item.sha256)));
	for(const [index, shape] of ["fin", "subtype"].entries())
	{
		const cell = cells[index];
		// Top-level browser cells only, each stage backed by the one browser receipt.
		assert.deepEqual(cell.profiles, profiles); assert.deepEqual(cell.shapes, [shape]);
		assert.deepEqual(cell.positions, ["parameter", "result"]); assert.equal(cell.path, "ordinary-source");
		assert.deepEqual(Object.keys(cell.hostTypes), [shape]); assert.deepEqual(Object.keys(cell.hostTypes[shape]), ["parameter", "result"]);
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
			assert.ok(browserRefinementsChangedPaths.includes(file.path), `${entry.id}: ${file.path}`);
			const source = await readFile(file.path, "utf8");
			assert.equal(file.sha256, sha256(beforeBrowserRefinementsSource(file.path, source)));
			assert.equal(now.files[index].sha256, sha256(source));
			++refreshed;
		}
	}
	assert.ok(refreshed > 0);
	process.stdout.write(`# browser-refinements refreshed inventory pins: ${refreshed}\n`);
});
