/**
 * Restrict nineteen-base nominal browser support to the installed profiles and positions.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { readTypeSurface, typeSurfaceCells, validateTypeSurface } from "../../src/adoption/type-surface.mjs";
import { compileDocumentationPage } from "../../scripts/generate-site-content.mjs";
import { docPages } from "../../site/registry.mjs";
import { nominalPrimitiveSubtypeBrowserProducer } from "./nominal-primitive-subtype-browser-archive.mjs";
import { nominalPrimitiveSubtypeBrowserPromotionHistoryPath, nominalPrimitiveSubtypeBrowserPromotionPredecessor } from "./nominal-primitive-subtype-browser-promotion-history.mjs";
import { nominalPrimitiveSubtypeBrowserReferences, promoteNominalPrimitiveSubtypeBrowser, nominalPrimitiveSubtypeBrowserProfiles, nominalPrimitiveSubtypeBrowserConversion, nominalPrimitiveSubtypeBrowserLimit, nominalPrimitiveSubtypeBrowserField } from "./nominal-primitive-subtype-browser-promotion.mjs";
import { sourceAtHistoryMilestone, withHistoryMilestoneSourcePins, withHistorySourcePins } from "./source-history-test-source.mjs";
import { typeSurfaceContractsAtProducer } from "./producer-source.mjs";

const predecessor = () => JSON.parse(execFileSync("git", ["show", `${nominalPrimitiveSubtypeBrowserPromotionPredecessor}:docs/type-surface.v1.json`], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 }));

test("primitive-base browser promotion authenticates four selections in all three engines and consumer profiles", async () => {
	const references = await nominalPrimitiveSubtypeBrowserReferences();
	assert.deepEqual(references.map(item => [item.route, item.mode]), [["ordinary", "full"], ["ordinary", "result-only"], ["reviewed", "full"], ["reviewed", "result-only"]]);
	for(const reference of references)
	{
		assert.deepEqual(reference.profiles, nominalPrimitiveSubtypeBrowserProfiles);
		assert.equal(reference.revision, nominalPrimitiveSubtypeBrowserProducer);
		assert.equal(reference.sourcePath, reference.route === "ordinary" ? "ordinary-source" : "reviewed-ir");
		assert.equal(reference.counts.checks, reference.mode === "full" ? 1213 : 578);
		assert.equal(reference.counts.rejections, reference.mode === "full" ? 283 : 0);
		assert.equal(reference.counts.rounds, 256); assert.equal(reference.counts.wordBits, 32);
		assert.equal(reference.counts.nodeExecutions, 2); assert.equal(reference.counts.browserExecutions, 12);
		assert.equal(reference.counts.lifecycleObservations, 51); assert.equal(reference.counts.dispatchObserved, false);
		assert.deepEqual(reference.counts.engines, ["chromium", "firefox", "webkit"]);
		assert.deepEqual(reference.counts.profiles, nominalPrimitiveSubtypeBrowserProfiles);
		assert.deepEqual(Object.keys(reference.counts.browserVersions).sort(), ["chromium", "firefox", "webkit"]);
		assert.ok(reference.command.includes("--test-concurrency=1"));
		assert.ok(reference.command.includes("LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_BROWSER_TEST='1'"));
		assert.ok(reference.scope.includes(nominalPrimitiveSubtypeBrowserLimit));
		assert.equal(reference.artifacts.length, 2);
		assert.equal(reference.files.filter(file => file.path.endsWith(".tgz")).length, 2);
		for(const suffix of ["runtime/main.wasm"
			, "sources/src/analyze/NativeExports.lean"
			, "records/browser-javascript/report.json"
			, "records/browser-react/observations.json"
			, "records/browser-worker/observations.json", "sources/site/serve.mjs"])
			assert.ok(reference.files.some(file => file.path.endsWith(suffix)), suffix);
	}
});

test("primitive-base browser promotion rejects narrowed evidence, invented host coverage and overlapping positions", async () => {
	const original = predecessor(), references = await nominalPrimitiveSubtypeBrowserReferences();
	for(const changed of [references.slice(1), references.slice().reverse(), [...references, references[0]]])
		await assert.rejects(promoteNominalPrimitiveSubtypeBrowser(original, changed));
	for(const mutate of [
		item => { item.profiles.pop(); }, item => { item.profiles.push("php-wasm"); }
		, item => { item.route = "reviewed"; }, item => { item.mode = "result-only"; }
		, item => { item.sourcePath = "reviewed-ir"; }
		, item => { item.revision = "0".repeat(40); }
		, item => { item.counts.dispatchObserved = true; }
		, item => { item.counts.wordBits = 64; }
		, item => { item.counts.browserExecutions = 9; }
		, item => { item.counts.lifecycleObservations = 50; }
		, item => { item.counts.engines.pop(); }
		, item => { item.counts.profiles.pop(); }
		, item => { item.counts.browserVersions.firefox = "0.0"; }
		, item => { item.scope = "All Subtypes pass"; }
		, item => { item.command = "node --test"; }
		, item => { item.files.pop(); }
		, item => { item.files[0].sha256 = "0".repeat(64); }
		, item => { item.artifacts.pop(); }
	]) {
		const changed = structuredClone(references); mutate(changed[0]);
		await assert.rejects(promoteNominalPrimitiveSubtypeBrowser(original, changed));
	}
	const promoted = await promoteNominalPrimitiveSubtypeBrowser(original, references);
	await assert.rejects(promoteNominalPrimitiveSubtypeBrowser(promoted, references), /Already promoted/u);
	for(const extra of [false, true])
	{
		const changed = structuredClone(original);
		const position = changed.observations.findIndex(item => item.id === "nominal-subtype-browser-fields-ordinary-source");
		assert.ok(position >= 0);
		if(extra) changed.observations.push({ ...structuredClone(changed.observations[position]), id: "overlapping-field" });
		else changed.observations.splice(position, 1);
		await assert.rejects(promoteNominalPrimitiveSubtypeBrowser(changed, references), /Missing or overlapping/u);
	}
	assert.deepEqual(original, predecessor());
});

test("primitive-base browser promotion supplements eighteen existing cells and preserves every other profile and stage", async () => {
	const original = predecessor(), references = await nominalPrimitiveSubtypeBrowserReferences();
	const proposed = withHistoryMilestoneSourcePins(
		nominalPrimitiveSubtypeBrowserPromotionHistoryPath
		, await promoteNominalPrimitiveSubtypeBrowser(original, references)
	);
	const { document: current } = await readTypeSurface();
	const contracts = typeSurfaceContractsAtProducer(
		nominalPrimitiveSubtypeBrowserPromotionPredecessor
	);
	const document = JSON.parse(sourceAtHistoryMilestone(
		nominalPrimitiveSubtypeBrowserPromotionHistoryPath
		, "docs/type-surface.v1.json"
	));
	assert.ok(current.evidence.length >= document.evidence.length);
	validateTypeSurface(proposed, contracts);
	assert.equal(proposed.evidence.length, 532); assert.equal(proposed.observations.length, 595);
	assert.deepEqual(withHistorySourcePins(
		nominalPrimitiveSubtypeBrowserPromotionHistoryPath, proposed
	).evidence.slice(0, 528), original.evidence);
	assert.deepEqual(document.observations, proposed.observations);
	assert.deepEqual(document.evidence.slice(528), proposed.evidence.slice(528));
	const changedObservations = proposed.observations.filter((item, index) => JSON.stringify(item) !== JSON.stringify(original.observations[index]));
	assert.equal(changedObservations.length, 4);
	const before = typeSurfaceCells(original, contracts), after = typeSurfaceCells(proposed, contracts), changed = [];
	for(const [index, cell] of after.entries())
	{
		if(JSON.stringify(cell) === JSON.stringify(before[index])) continue;
		assert.equal(cell.shape, "subtype"); assert.ok(nominalPrimitiveSubtypeBrowserProfiles.includes(cell.profile));
		assert.ok(["parameter", "result", "field"].includes(cell.position));
		const route = cell.path === "ordinary-source" ? "ordinary" : "reviewed";
		const ids = references.filter(item => item.route === route).map(item => item.id);
		for(const [name, stage] of Object.entries(cell.stages))
		{
			assert.equal(stage.state, before[index].stages[name].state); assert.equal(stage.state, "passed");
			assert.deepEqual(stage.evidence.filter(id => id.startsWith("nominal-primitive-subtype-browser-")), ids);
			assert.ok(before[index].stages[name].evidence.every(id => stage.evidence.includes(id)));
		}
		assert.ok(cell.conversionNote.includes(nominalPrimitiveSubtypeBrowserConversion));
		if(cell.position === "field") assert.equal(cell.hostType, nominalPrimitiveSubtypeBrowserField);
		changed.push(cell.id);
	}
	assert.deepEqual(changed.sort(), nominalPrimitiveSubtypeBrowserProfiles.flatMap(profile => ["ordinary-source", "reviewed-ir"].flatMap(path => ["parameter", "result", "field"].map(position => `${profile}/subtype/${path}/${position}`))).sort());
	assert.deepEqual(original, predecessor());
});

test("primitive-base browser documentation names the installed engines, host conversions and remaining combinations", async () => {
	for(const path of ["docs/javascript-typescript.md", "docs/lean/existing-package.md", "docs/lean/export-decisions.md", "docs/reference/types.md"])
	{
		const source = await sourceAtHistoryMilestone(
			nominalPrimitiveSubtypeBrowserPromotionHistoryPath, path
		);
		assert.ok(source.includes("nominal-primitive-subtype-browser-20261014/index.json"), path);
		const compiled = await compileDocumentationPage(source, docPages.find(item => item.source === path), { revision: nominalPrimitiveSubtypeBrowserPromotionPredecessor });
		assert.ok(compiled.links.some(link => link.endsWith("nominal-primitive-subtype-browser-20261014/index.json")), path);
		if(path === "docs/javascript-typescript.md")
			assert.ok(compiled.links.includes("https://github.com/seanmorris/lean-bridge/actions/workflows/nominal-primitive-subtype-browser.yml"));
	}
	const javascript = await sourceAtHistoryMilestone(
		nominalPrimitiveSubtypeBrowserPromotionHistoryPath
		, "docs/javascript-typescript.md"
	);
	for(const text of ["nineteen primitive bases", "undefined", "void"
		, "bigint", "Uint8Array", "wasm32", "normalization"
		, "Chromium", "Firefox", "WebKit", "React", "workers"
		, "missing-asset recovery"])
		assert.ok(javascript.includes(text), text);
	const row = javascript.split("\n").find(line => line.startsWith("| `Subtype /"));
	assert.ok(row.includes(nominalPrimitiveSubtypeBrowserField));
	assert.ok(row.includes(nominalPrimitiveSubtypeBrowserConversion));
	assert.equal(row.split(nominalPrimitiveSubtypeBrowserConversion).length, 2, "Render the shared browser explanation once");
	assert.doesNotMatch(row, /bigint Nat payload|Browser pages, React and workers use bigint for the tested Nat/u);
	assert.ok(row.includes("Not audited (callback input, callback result)"));
	assert.ok(javascript.includes("Primitive-base nominal acceptance in the remaining hosts is pending."));
});
