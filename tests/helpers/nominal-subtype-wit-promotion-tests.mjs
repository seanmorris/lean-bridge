/**
 * Keep WIT nominal claims tied to original installed Component Model evidence.
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
import { nominalSubtypeWitArchive, nominalSubtypeWitReferences, promoteNominalSubtypeWit, nominalSubtypeWitConversion, nominalSubtypeWitLimit } from "./nominal-subtype-wit-promotion.mjs";
import { nominalSubtypeWitPromotionPredecessor } from "./nominal-subtype-wit-promotion-history.mjs";
import { beforeNominalSubtypeBrowserPromotionSource, beforeNominalSubtypeBrowserPromotionPins } from "./nominal-subtype-browser-promotion-history.mjs";

const predecessor = () => JSON.parse(execFileSync("git", ["show", `${nominalSubtypeWitPromotionPredecessor}:docs/type-surface.v1.json`], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 }));

test("nominal WIT promotion authenticates four selections and eight original Component Model executions", async () => {
	const references = await nominalSubtypeWitReferences();
	assert.deepEqual(references.map(item => [item.route, item.mode]), [["ordinary", "full"], ["ordinary", "result-only"], ["reviewed", "full"], ["reviewed", "result-only"]]);
	for(const reference of references)
	{
		assert.deepEqual(reference.profiles, ["wit-wasi"]);
		assert.equal(reference.revision, "9b39bd38db9165e95a948a6bbc8023409cc8b4ce");
		assert.equal(reference.sourcePath, reference.route === "ordinary" ? "ordinary-source" : "reviewed-ir");
		assert.equal(reference.counts.executions, 2);
		assert.equal(reference.counts.checks, reference.mode === "full" ? 20852 : 6268);
		assert.equal(reference.counts.rejections, reference.mode === "full" ? 2066 : 0);
		assert.equal(reference.counts.hostRejections, reference.mode === "full" ? 30 : 4);
		assert.equal(reference.counts.snapshotControls, 30);
		assert.deepEqual(reference.counts.runtime, { platform: "linux", arch: "x64", glibc: "2.36" });
		assert.equal(reference.counts.floor, "2.36");
		assert.equal(reference.counts.wasmtime, "42.0.1");
		assert.equal(reference.counts.nativeHostRequired, true);
		assert.equal(reference.counts.standaloneWasi, false);
		assert.equal(reference.counts.dispatchObserved, false);
		assert.ok(reference.command.includes("--test-concurrency=1"));
		assert.ok(reference.scope.includes(nominalSubtypeWitLimit));
		assert.equal(reference.artifacts.length, 1);
		for(const suffix of [`/${reference.route}-${reference.mode}/run.tap`
			, "sources/src/analyze/NativeExports.lean", "checkers/package-records.mjs"
			, "runner.mjs", "failed-r1-ordinary-full/run.tap"
			, "failed-r2-ordinary-result-only/run.tap"
			, "records/package/component/nominalsubtypes.wasm", "records/consumer.bin"]
		)
			assert.ok(reference.files.some(file => file.path.endsWith(suffix)), suffix);
	}
	assert.equal(references.reduce((sum, item) => sum + item.counts.checks, 0), 54240);
});

test("nominal WIT promotion refuses missing originals, invented claims and overlapping observations", async () => {
	const original = predecessor(), references = await nominalSubtypeWitReferences();
	const targets = ["index.json", "checkers/report.mjs", "runner.mjs"
		, "failed-r1-ordinary-full/run.tap", "failed-r2-ordinary-result-only/run.tap"
		, "sources/src/analyze/NativeExports.lean"
		, ...references.flatMap(item => ["start.json", "runs.json", "run.tap"
			, "records/report.json", "records/installed.json", "records/relocated.json"
			, "records/tools.json", "records/consumer.bin"
			, "records/package/component/nominalsubtypes.wasm"]
			.map(path => `${item.route}-${item.mode}/${path}`))];
	for(const target of targets)
	{
		await assert.rejects(nominalSubtypeWitReferences(path => {
			if(path === `${nominalSubtypeWitArchive}/${target}`) throw new Error("Missing original");
			return readFile(path);
		}));
		await assert.rejects(nominalSubtypeWitReferences(async path => path === `${nominalSubtypeWitArchive}/${target}` ? Buffer.from("changed") : readFile(path)));
	}
	for(const altered of [references.slice(1), references.slice().reverse(), [...references, references[0]]])
		await assert.rejects(promoteNominalSubtypeWit(original, altered));
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
		, item => { item.counts.dispatchObserved = true; }
		, item => { item.counts.nativeHostRequired = false; }
		, item => { item.counts.standaloneWasi = true; }
		, item => { item.counts.runtime.glibc = "2.38"; }
		, item => { item.counts.floor = "2.38"; }
		, item => { item.counts.checks = 1; }
		, item => { item.counts.executions = 32; }
		, item => { item.counts.wasmtime = "43.0.0"; }
		, item => { item.counts.archiveSha256 = "0".repeat(64); }];
	for(const change of changes)
	{
		const changed = structuredClone(references); change(changed[0]);
		await assert.rejects(promoteNominalSubtypeWit(original, changed));
	}
	const promoted = await promoteNominalSubtypeWit(original, references);
	await assert.rejects(promoteNominalSubtypeWit(promoted, references), /Already promoted/u);
	const mutations = [item => { item.profiles.push("php-wasm"); }
		, item => { item.positions.push("field"); }
		, item => { item.shapes.push("checked-record"); }
		, item => { item.stages.installedExecution.state = "unreviewed"; }];
	for(const id of ["native-subtype-wit-wasi-ordinary-source", "reviewed-native-subtype-wit-wasi"])
	{
		for(const mutate of mutations)
		{
			const changed = structuredClone(original); mutate(changed.observations.find(item => item.id === id));
			await assert.rejects(promoteNominalSubtypeWit(changed, references));
		}
		const missing = structuredClone(original);
		missing.observations = missing.observations.filter(item => item.id !== id);
		await assert.rejects(promoteNominalSubtypeWit(missing, references), /Missing/u);
		const overlap = structuredClone(original);
		overlap.observations.push({ ...structuredClone(original.observations.find(item => item.id === id)), id: "unreviewed-overlap" });
		await assert.rejects(promoteNominalSubtypeWit(overlap, references), /overlapping/u);
	}
});

test("nominal WIT promotion adds two field cells and supplements four existing cells only", async () => {
	const original = predecessor(), references = await nominalSubtypeWitReferences();
	const proposed = beforeNominalSubtypeBrowserPromotionPins(await promoteNominalSubtypeWit(original, references));
	const { document: current, ...contracts } = await readTypeSurface();
	const document = JSON.parse(beforeNominalSubtypeBrowserPromotionSource("docs/type-surface.v1.json", JSON.stringify(current, null, 2) + "\n"));
	validateTypeSurface(proposed, contracts);
	assert.equal(original.evidence.length, 508); assert.equal(proposed.evidence.length, 512);
	assert.equal(original.observations.length, 589); assert.equal(proposed.observations.length, 591);
	assert.deepEqual(proposed.evidence.slice(0, 508), original.evidence);
	assert.deepEqual(document.observations, proposed.observations);
	assert.deepEqual(document.evidence.slice(508), proposed.evidence.slice(508));
	const before = typeSurfaceCells(original, contracts), after = typeSurfaceCells(proposed, contracts);
	const changed = [], added = [];
	for(const [index, cell] of after.entries())
	{
		if(JSON.stringify(cell) === JSON.stringify(before[index])) continue;
		assert.equal(cell.shape, "subtype"); assert.equal(cell.profile, "wit-wasi");
		assert.ok(["parameter", "result", "field"].includes(cell.position));
		const route = cell.path === "ordinary-source" ? "ordinary" : "reviewed";
		const ids = references.filter(item => item.route === route).map(item => item.id);
		for(const [name, stage] of Object.entries(cell.stages))
		{
			assert.equal(stage.state, "passed");
			assert.deepEqual(stage.evidence.filter(id => id.startsWith("nominal-subtype-wit-")), ids);
			assert.ok(before[index].stages[name].evidence.every(id => stage.evidence.includes(id)));
			assert.equal(before[index].stages[name].state, cell.position === "field" ? "unreviewed" : "passed");
		}
		assert.ok(cell.conversionNote.includes(nominalSubtypeWitConversion));
		assert.ok(cell.limitations.includes(nominalSubtypeWitLimit));
		if(cell.position === "field") added.push(cell.id);
		changed.push(cell.id);
	}
	const expected = ["ordinary-source", "reviewed-ir"].flatMap(path => ["parameter", "result", "field"].map(position => `wit-wasi/subtype/${path}/${position}`));
	assert.deepEqual(changed.sort(), expected.sort()); assert.equal(added.length, 2);
	assert.deepEqual(original, predecessor());
});

test("nominal WIT documentation describes tested Nat fields and the required native host", async () => {
	const author = await readFile("docs/lean/existing-package.md", "utf8");
	for(const prefix of ["| `Subtype` in acyclic", "| Lean-produced `Subtype` result without"])
	{
		const row = author.split("\n").find(line => line.startsWith(prefix));
		assert.ok(row.includes("Node, browser, React and worker installed"));
		assert.equal((row.match(/Generated; pending/gu) ?? []).length, 1);
		assert.ok(row.includes("native PHP and WIT/WASI installed"));
		assert.ok(row.includes("All four ABIs installed"));
		assert.ok(row.includes("native PHP and WIT/WASI ordinary/reviewed installed"));
	}
	for(const path of ["docs/lean/existing-package.md", "docs/lean/export-decisions.md", "docs/consume/wit-wasi.md", "docs/reference/types.md"])
		assert.ok((await readFile(path, "utf8")).includes("nominal-subtype-wit-promotion-20261013.md"), path);
	const source = await readFile("docs/consume/wit-wasi.md", "utf8");
	assert.ok(source.includes("### Subtypes in copied records\n"));
	assert.ok(source.includes("Linux x64/glibc 2.36"));
	assert.match(source, /Wasmtime 42\.0\.1 and wasm-tools 1\.245\.1/u);
	assert.match(source, /requires the packaged native Lean host/u);
	assert.match(source, /Generated package sources remain installed/u);
	assert.match(source, /Other primitive-base nominal fixtures/u);
	const row = source.split("\n").find(line => line.startsWith("| `Subtype /"));
	for(const route of ["Ordinary source", "Reviewed IR"])
		assert.ok(row.includes(`${route}: Installed checks passed (input, result, field)`));
	assert.ok(row.includes("Not audited (callback input, callback result)"));
	assert.ok(row.includes(nominalSubtypeWitConversion));
});

test("nominal WIT guides compile with visible type syntax and refuse unquoted HTML", async () => {
	for(const path of ["docs/consume/wit-wasi.md", "docs/lean/existing-package.md"
		, "docs/lean/export-decisions.md", "docs/reference/types.md"]
	) {
		const page = docPages.find(item => item.source === path);
		const source = await readFile(path, "utf8");
		const options = { revision: nominalSubtypeWitPromotionPredecessor };
		const compiled = await compileDocumentationPage(source, page, options);
		assert.ok(compiled.links.some(link => link.endsWith("nominal-subtype-wit-promotion-20261013.md")));
		if(path === "docs/consume/wit-wasi.md")
		{
			assert.ok(compiled.code.includes("list<u32>"));
			assert.ok(compiled.searchText.includes("list<u32>"));
			await assert.rejects(compileDocumentationPage(source.replaceAll("`list<u32>`", "list<u32>"), page, options), /raw HTML/u);
		}
	}
});
