/**
 * Keep browser nominal support tied to original installed selections and exact positions.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { readTypeSurface, typeSurfaceCells, validateTypeSurface } from "../../src/adoption/type-surface.mjs";
import { compileDocumentationPage } from "../../scripts/generate-site-content.mjs";
import { docPages } from "../../site/registry.mjs";
import { nominalSubtypeBrowserArchive, nominalSubtypeBrowserReferences, promoteNominalSubtypeBrowser, nominalSubtypeBrowserProfiles, nominalSubtypeBrowserConversion, nominalSubtypeBrowserLimit } from "./nominal-subtype-browser-promotion.mjs";
import { nominalSubtypeBrowserPromotionHistoryPath, nominalSubtypeBrowserPromotionPredecessor } from "./nominal-subtype-browser-promotion-history.mjs";
import { beforeNominalSubtypePhpWasmPromotionSource, beforeNominalSubtypePhpWasmPromotionPins, nominalSubtypePhpWasmPromotionHistoryPath } from "./nominal-subtype-php-wasm-promotion-history.mjs";
import { sourceBeforeFinHistoryRecord } from "./source-at-fin-history-milestone.mjs";
import { sourceAtHistoryMilestone } from "./source-history-test-source.mjs";
import { beforeNominalPrimitiveSubtypeBrowserPromotionPins } from "./nominal-primitive-subtype-browser-promotion-history.mjs";
import { beforeCheckedJavaScriptDispositionPins } from "./checked-javascript-disposition-history.mjs";
import { beforeCiContractRepairPins } from "./ci-contract-repair-source-history.mjs";

const predecessor = () => JSON.parse(execFileSync("git", ["show", `${nominalSubtypeBrowserPromotionPredecessor}:docs/type-surface.v1.json`], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 }));

test("nominal browser promotion authenticates four selections and their original lifecycle evidence", async () => {
	const references = await nominalSubtypeBrowserReferences();
	assert.deepEqual(references.map(item => [item.route, item.mode]), [["ordinary", "full"], ["ordinary", "result-only"], ["reviewed", "full"], ["reviewed", "result-only"]]);
	for(const reference of references)
	{
		assert.deepEqual(reference.profiles, nominalSubtypeBrowserProfiles);
		assert.equal(reference.revision, "2f723c1300abf84975454486b80882130b97048b");
		assert.equal(reference.sourcePath, reference.route === "ordinary" ? "ordinary-source" : "reviewed-ir");
		assert.equal(reference.counts.nodeExecutions, 2); assert.equal(reference.counts.browserExecutions, 12);
		assert.equal(reference.counts.lifecycleObservations, 51);
		assert.equal(reference.counts.checks, reference.mode === "full" ? 3172 : 2078);
		assert.equal(reference.counts.rejections, reference.mode === "full" ? 1032 : 0);
		assert.deepEqual(reference.counts.runtime, { node: "v22.23.2", platform: "linux", arch: "x64" });
		assert.deepEqual(reference.counts.browserVersions, { chromium: "151.0.7922.34", firefox: "153.0", webkit: "26.5" });
		assert.equal(reference.counts.dispatchObserved, false);
		assert.ok(reference.command.includes("--test-concurrency=1"));
		assert.ok(reference.command.includes("LEAN_BRIDGE_NOMINAL_SUBTYPE_BROWSER_TEST='1'"));
		assert.ok(reference.scope.includes(nominalSubtypeBrowserLimit));
		assert.equal(reference.artifacts.length, 2);
		for(const suffix of [`/${reference.route}-${reference.mode}/run.tap`
			, "sources/src/analyze/NativeExports.lean"
			, "runner.mjs", "records/browser.json", "records/report.json"
			, "records/browser-worker/observations.json"
			, "records/browser-react/installed-runtime-identity.json"
			, ...reference.artifacts.map(artifact => "records/handoff/" + artifact.path)]
		) assert.ok(reference.files.some(file => file.path.endsWith(suffix)), suffix);
	}
	assert.equal(references.reduce((sum, item) => sum + item.counts.browserExecutions, 0), 48);
	assert.equal(references.reduce((sum, item) => sum + item.counts.lifecycleObservations, 0), 204);
	assert.equal(references.reduce((sum, item) => sum + item.counts.checks * (item.counts.nodeExecutions + item.counts.lifecycleObservations), 0), 556500);
	assert.equal(references.reduce((sum, item) => sum + item.counts.rejections * (item.counts.nodeExecutions + item.counts.lifecycleObservations), 0), 109392);
});

test("nominal browser promotion refuses missing originals, invented scope and overlapping observations", async () => {
	const original = predecessor(), references = await nominalSubtypeBrowserReferences();
	const targets = ["index.json", "runner.mjs"
		, "checkers/tests/helpers/nominal-subtype-browser-report.mjs"
		, "sources/src/analyze/NativeExports.lean"
		, ...references.flatMap(item => ["start.json", "end.json", "run.tap"
			, "records/report.json", "records/browser.json"
			, "records/browser-worker/observations.json"
			, ...item.artifacts.map(artifact => "records/handoff/" + artifact.path)]
			.map(path => `${item.route}-${item.mode}/${path}`))];
	for(const target of targets)
	{
		await assert.rejects(nominalSubtypeBrowserReferences(path => {
			if(path === `${nominalSubtypeBrowserArchive}/${target}`) throw new Error("Missing original");
			return readFile(path);
		}));
		await assert.rejects(nominalSubtypeBrowserReferences(async path => path === `${nominalSubtypeBrowserArchive}/${target}` ? Buffer.from("changed") : readFile(path)));
	}
	for(const altered of [references.slice(1), references.slice().reverse(), [...references, references[0]]])
		await assert.rejects(promoteNominalSubtypeBrowser(original, altered));
	const changes = [item => { item.profiles.pop(); }
		, item => { item.profiles.push("php-wasm"); }
		, item => { item.route = "reviewed"; }, item => { item.mode = "result-only"; }
		, item => { item.sourcePath = "reviewed-ir"; }
		, item => { item.revision = "0".repeat(40); }
		, item => { item.scope = "All Subtypes pass"; }
		, item => { item.command = "node --test"; }
		, item => { item.files.pop(); }
		, item => { item.files[0].sha256 = "0".repeat(64); }
		, item => { item.artifacts.pop(); }
		, item => { item.artifacts[0].sha256 = "0".repeat(64); }
		, item => { item.counts.dispatchObserved = true; }
		, item => { item.counts.runtime.node = "v0.0.0"; }
		, item => { item.counts.browserVersions.firefox = "0.0"; }
		, item => { item.counts.checks = 1; }
		, item => { item.counts.browserExecutions = 1; }
		, item => { item.counts.lifecycleObservations = 1; }];
	for(const change of changes)
	{
		const changed = structuredClone(references); change(changed[0]);
		await assert.rejects(promoteNominalSubtypeBrowser(original, changed));
	}
	const promoted = await promoteNominalSubtypeBrowser(original, references);
	await assert.rejects(promoteNominalSubtypeBrowser(promoted, references), /Already promoted/u);
	const mutations = [item => { item.profiles.push("php-wasm"); }
		, item => { item.profiles.pop(); }
		, item => { item.positions.push("field"); }
		, item => { item.shapes.push("checked-record"); }
		, item => { item.stages.installedExecution.state = "unreviewed"; }];
	for(const id of ["npm-browser-subtype-ordinary-source", "reviewed-browser-subtype"])
	{
		for(const mutate of mutations)
		{
			const changed = structuredClone(original); mutate(changed.observations.find(item => item.id === id));
			await assert.rejects(promoteNominalSubtypeBrowser(changed, references));
		}
		const missing = structuredClone(original);
		missing.observations = missing.observations.filter(item => item.id !== id);
		await assert.rejects(promoteNominalSubtypeBrowser(missing, references), /Missing/u);
		const overlap = structuredClone(original);
		overlap.observations.push({ ...structuredClone(original.observations.find(item => item.id === id)), id: "unreviewed-overlap" });
		await assert.rejects(promoteNominalSubtypeBrowser(overlap, references), /overlapping/u);
	}
});

test("nominal browser promotion changes exactly eighteen Subtype cells and adds six field cells", async () => {
	const original = predecessor(), references = await nominalSubtypeBrowserReferences();
	const proposed = beforeNominalSubtypePhpWasmPromotionPins(
		beforeNominalPrimitiveSubtypeBrowserPromotionPins(
			beforeCiContractRepairPins(beforeCheckedJavaScriptDispositionPins(
				await promoteNominalSubtypeBrowser(original, references)
			))
		)
	);
	const { document: current, ...contracts } = await readTypeSurface(); void current;
	const document = JSON.parse(await sourceBeforeFinHistoryRecord(
		nominalSubtypePhpWasmPromotionHistoryPath, "docs/type-surface.v1.json"
		, beforeNominalSubtypePhpWasmPromotionSource
	));
	validateTypeSurface(proposed, contracts);
	assert.equal(original.evidence.length, 512); assert.equal(proposed.evidence.length, 516);
	assert.equal(original.observations.length, 591); assert.equal(proposed.observations.length, 593);
	assert.deepEqual(proposed.evidence.slice(0, 512), original.evidence);
	assert.deepEqual(document.observations, proposed.observations);
	assert.deepEqual(document.evidence.slice(512), proposed.evidence.slice(512));
	const before = typeSurfaceCells(original, contracts), after = typeSurfaceCells(proposed, contracts);
	const changed = [], added = [];
	for(const [index, cell] of after.entries())
	{
		if(JSON.stringify(cell) === JSON.stringify(before[index])) continue;
		assert.equal(cell.shape, "subtype"); assert.ok(nominalSubtypeBrowserProfiles.includes(cell.profile));
		assert.ok(["parameter", "result", "field"].includes(cell.position));
		const route = cell.path === "ordinary-source" ? "ordinary" : "reviewed";
		const ids = references.filter(item => item.route === route).map(item => item.id);
		for(const [name, stage] of Object.entries(cell.stages))
		{
			assert.equal(stage.state, "passed");
			assert.deepEqual(stage.evidence.filter(id => id.startsWith("nominal-subtype-browser-")), ids);
			assert.ok(before[index].stages[name].evidence.every(id => stage.evidence.includes(id)));
			assert.equal(before[index].stages[name].state, cell.position === "field" ? "unreviewed" : "passed");
		}
		assert.ok(cell.conversionNote.includes(nominalSubtypeBrowserConversion));
		assert.ok(cell.limitations.includes(nominalSubtypeBrowserLimit));
		if(cell.position === "field") added.push(cell.id);
		changed.push(cell.id);
	}
	const expected = nominalSubtypeBrowserProfiles.flatMap(profile => ["ordinary-source", "reviewed-ir"].flatMap(path => ["parameter", "result", "field"].map(position => `${profile}/subtype/${path}/${position}`)));
	assert.deepEqual(changed.sort(), expected.sort()); assert.equal(added.length, 6);
	assert.deepEqual(original, predecessor());
});

test("nominal browser guides describe installed Nat fields without promoting Fin fields or callbacks", async () => {
	const sourcePath = "docs/javascript-typescript.md";
	const source = sourceAtHistoryMilestone(
		nominalSubtypeBrowserPromotionHistoryPath, sourcePath
	);
	assert.ok(source.includes("### Subtypes in copied records\n"));
	assert.match(source, /Use `bigint` for each payload/u);
	for(const text of ["Chromium 151.0.7922.34", "153.0 and WebKit 26.5", "worker", "pending unmounts", "disposal"])
		assert.ok(source.includes(text), text);
	const row = source.split("\n").find(line => line.startsWith("| `Subtype /"));
	for(const route of ["Ordinary source", "Reviewed IR"])
		assert.ok(row.includes(`${route}: Installed checks passed (input, result, field)`));
	assert.ok(row.includes("Not audited (callback input, callback result)"));
	assert.ok(row.includes(nominalSubtypeBrowserConversion));
	const authorPath = "docs/lean/existing-package.md";
	const author = beforeNominalSubtypePhpWasmPromotionSource(
		authorPath, await sourceAtHistoryMilestone(
			nominalSubtypePhpWasmPromotionHistoryPath, authorPath
		)
	);
	for(const prefix of ["| `Subtype` in acyclic", "| Lean-produced `Subtype` result without"])
	{
		const row = author.split("\n").find(line => line.startsWith(prefix));
		assert.ok(row.includes("Node, browser, React and worker installed"));
		assert.equal((row.match(/Generated; pending/gu) ?? []).length, 1);
		assert.ok(row.includes("All four ABIs installed"));
		assert.ok(row.includes("for the tested Nat"));
	}
	const fin = author.split("\n").find(line => line.startsWith("| `Fin n` in record"));
	assert.ok(fin.includes("Node installed; browser pending"));
	assert.ok(author.includes("Browser nominal Fin exports still need installed acceptance"));
	assert.ok(author.includes("PHP-Wasm installed acceptance for these nominal additions remains pending"));
	assert.doesNotMatch(author, /Browser and PHP-Wasm installed acceptance|installed browser and PHP-Wasm nominal acceptance remains pending/u);
});

test("nominal browser consumer and author pages render the support links and visible payload syntax", async () => {
	for(const path of ["docs/javascript-typescript.md", "docs/lean/existing-package.md", "docs/lean/export-decisions.md", "docs/reference/types.md"])
	{
		const page = docPages.find(item => item.source === path);
		const source = await sourceAtHistoryMilestone(
			nominalSubtypeBrowserPromotionHistoryPath, path
		);
		const compiled = await compileDocumentationPage(source, page, { revision: nominalSubtypeBrowserPromotionPredecessor });
		assert.ok(compiled.links.some(link => link.endsWith("nominal-subtype-browser-promotion-20261014.md")), path);
		assert.equal(compiled.searchText.includes("Browser and PHP-Wasm nominal acceptance remains pending"), false, path + ": stale browser acceptance claim");
		if(path === "docs/javascript-typescript.md")
		{
			assert.ok(compiled.code.includes("bigint"));
			assert.ok(compiled.searchText.includes("bigint"));
			assert.ok(compiled.searchText.includes("Installed checks passed (input, result, field)"));
		}
	}
});
