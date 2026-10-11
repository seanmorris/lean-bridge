/**
 * Keep nominal npm claims tied to the four original Node selections.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { readTypeSurface, typeSurfaceCells, validateTypeSurface } from "../../src/adoption/type-surface.mjs";
import { nominalSubtypeNpmArchive, nominalSubtypeNpmProfiles, nominalSubtypeNpmReferences, promoteNominalSubtypeNpm, nominalSubtypeNpmConversion, nominalSubtypeNpmLimit } from "./nominal-subtype-npm-promotion.mjs";

const predecessor = () => JSON.parse(execFileSync("git", ["show", "d5aedc154ed94073c85c0087c466b426c7991d56:docs/type-surface.v1.json"], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 }));

test("nominal npm promotion authenticates four installed selections at the observed Node runtime", async () => {
	const references = await nominalSubtypeNpmReferences();
	assert.deepEqual(references.map(item => [item.route, item.mode]), [["ordinary", "full"], ["ordinary", "result-only"], ["reviewed", "full"], ["reviewed", "result-only"]]);
	for(const reference of references)
	{
		assert.deepEqual(reference.profiles, nominalSubtypeNpmProfiles);
		assert.equal(reference.revision, "fab6d1b1c054a7a818bf70e4be84c80d7e8ec5c7");
		assert.equal(reference.sourcePath, reference.route === "ordinary" ? "ordinary-source" : "reviewed-ir");
		assert.equal(reference.counts.checks, reference.mode === "full" ? 3172 : 2078);
		assert.equal(reference.counts.rejections, reference.mode === "full" ? 1032 : 0);
		assert.equal(reference.counts.executions, 2); assert.equal(reference.counts.dispatchObserved, false);
		assert.deepEqual(reference.counts.runtime, { node: "v22.23.2", platform: "linux", arch: "x64" });
		assert.ok(reference.command.includes("--test-concurrency=1"));
		assert.ok(reference.scope.includes(nominalSubtypeNpmLimit));
		assert.equal(reference.artifacts.length, 2);
		assert.ok(reference.files.some(file => file.path.endsWith(`/${reference.route}/${reference.mode}/run.tap`)));
		assert.ok(reference.files.some(file => file.path.endsWith("sources/src/analyze/NativeExports.lean")));
	}
});

test("nominal npm promotion refuses missing originals and substituted scope or references", async () => {
	const original = predecessor(), references = await nominalSubtypeNpmReferences();
	for(const target of ["index.json", "runner.mjs", "checker.mjs"
		, "sources/src/analyze/NativeExports.lean"
		, ...references.flatMap(item => ["start.json", "end.json", "run.tap", "records/report.json", "records/build-0/locks/compiler-adapters.json"].map(path => `${item.route}/${item.mode}/${path}`))]) {
		await assert.rejects(nominalSubtypeNpmReferences(path => {
			if(path === `${nominalSubtypeNpmArchive}/${target}`) throw new Error("Missing original");
			return readFile(path);
		}));
		await assert.rejects(nominalSubtypeNpmReferences(async path => path === `${nominalSubtypeNpmArchive}/${target}` ? Buffer.from("changed") : readFile(path)));
		}
	for(const altered of [references.slice(1), references.slice().reverse(), [...references, references[0]]])
		await assert.rejects(promoteNominalSubtypeNpm(original, altered));
	for(const change of [item => { item.profiles.push("browser-javascript"); }
		, item => { item.route = "reviewed"; }, item => { item.mode = "result-only"; }
		, item => { item.sourcePath = "reviewed-ir"; }
		, item => { item.revision = "0".repeat(40); }
		, item => { item.scope = "All Subtypes pass"; }
		, item => { item.command = "node --test"; }
		, item => { item.files.pop(); }
		, item => { item.files[0].sha256 = "0".repeat(64); }
		, item => { item.artifacts.pop(); }
		, item => { item.counts.dispatchObserved = true; }
		, item => { item.counts.runtime.node = "v24.0.0"; }]) {
		const changed = structuredClone(references); change(changed[0]);
		await assert.rejects(promoteNominalSubtypeNpm(original, changed));
		}
	const promoted = await promoteNominalSubtypeNpm(original, references);
	await assert.rejects(promoteNominalSubtypeNpm(promoted, references), /Already promoted/u);
	const missing = structuredClone(original);
	missing.observations = missing.observations.filter(item => item.id !== "npm-subtype-refinements-ordinary-source");
	await assert.rejects(promoteNominalSubtypeNpm(missing, references), /Missing/u);
	const overlap = structuredClone(original);
	overlap.observations.push({ ...structuredClone(original.observations.find(item => item.id === "npm-subtype-refinements-ordinary-source")), id: "unreviewed-overlap" });
	await assert.rejects(promoteNominalSubtypeNpm(overlap, references), /overlapping/u);
});

test("nominal npm promotion adds four Node field cells and supplements eight existing cells only", async () => {
	const original = predecessor(), references = await nominalSubtypeNpmReferences();
	const proposed = await promoteNominalSubtypeNpm(original, references), { document, ...contracts } = await readTypeSurface();
	validateTypeSurface(proposed, contracts);
	assert.equal(original.evidence.length, 472); assert.equal(proposed.evidence.length, 476);
	assert.equal(original.observations.length, 571); assert.equal(proposed.observations.length, 573);
	assert.deepEqual(proposed.evidence.slice(0, 472), original.evidence);
	assert.deepEqual(document.observations, proposed.observations);
	assert.deepEqual(document.evidence.slice(472), proposed.evidence.slice(472));
	const before = typeSurfaceCells(original, contracts), after = typeSurfaceCells(proposed, contracts);
	const changed = [], added = [];
	for(const [index, cell] of after.entries())
	{
		if(JSON.stringify(cell) === JSON.stringify(before[index])) continue;
		assert.equal(cell.shape, "subtype"); assert.ok(nominalSubtypeNpmProfiles.includes(cell.profile));
		assert.ok(["parameter", "result", "field"].includes(cell.position));
		const route = cell.path === "ordinary-source" ? "ordinary" : "reviewed";
		const ids = references.filter(item => item.route === route).map(item => item.id);
		for(const [name, stage] of Object.entries(cell.stages))
		{
			assert.equal(stage.state, "passed");
			assert.deepEqual(stage.evidence.filter(id => id.startsWith("nominal-subtype-npm-")), ids);
			assert.ok(before[index].stages[name].evidence.every(id => stage.evidence.includes(id)));
			assert.equal(before[index].stages[name].state, cell.position === "field" ? "unreviewed" : "passed");
		}
		assert.ok(cell.conversionNote.includes(nominalSubtypeNpmConversion));
		if(cell.position === "field") added.push(cell.id);
		changed.push(cell.id);
	}
	const expected = nominalSubtypeNpmProfiles.flatMap(profile => ["ordinary-source", "reviewed-ir"].flatMap(path => ["parameter", "result", "field"].map(position => `${profile}/subtype/${path}/${position}`)));
	assert.deepEqual(changed.sort(), expected.sort()); assert.equal(added.length, 4);
	assert.deepEqual(original, predecessor());
});

test("nominal npm docs separate Node acceptance from pending browser, native and callback contexts", async () => {
	const author = await readFile("docs/lean/existing-package.md", "utf8");
	for(const prefix of ["| `Subtype` in acyclic", "| Lean-produced `Subtype` result without"])
	{
		const row = author.split("\n").find(line => line.startsWith(prefix));
		assert.ok(row.includes("Node installed; browser pending"));
		assert.equal((row.match(/Generated; pending/gu) ?? []).length, 3);
		assert.ok(row.includes("Node ordinary/reviewed installed"));
	}
	for(const path of ["docs/lean/existing-package.md", "docs/lean/export-decisions.md", "docs/javascript-typescript.md", "docs/reference/types.md"])
		assert.ok((await readFile(path, "utf8")).includes("nominal-subtype-npm-acceptance-20261011.md"), path);
	const javascript = await readFile("docs/javascript-typescript.md", "utf8");
	assert.ok(javascript.includes("### Subtypes in copied records\n"));
	assert.ok(javascript.includes("Node 22.23.2"));
	assert.doesNotMatch(javascript, /Subtype fields in nominal records or variants, refined callback signatures and\nowned Subtypes remain unsupported/u);
	const row = javascript.split("\n").find(line => line.startsWith("| `Subtype /"));
	assert.ok(row.includes("Node JavaScript / TypeScript: Installed checks passed (input, result, field)"));
	assert.ok(row.includes("Browser / React / Worker: Installed checks passed (input, result)"));
});
