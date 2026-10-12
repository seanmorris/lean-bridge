/**
 * Keep Python nominal claims tied to the four original installed selections.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { readTypeSurface, typeSurfaceCells, validateTypeSurface } from "../../src/adoption/type-surface.mjs";
import { beforeNominalSubtypeRubyPromotionSource, nominalSubtypeRubyPromotionHistoryPath } from "./nominal-subtype-ruby-promotion-history.mjs";
import { nominalSubtypePythonArchive, nominalSubtypePythonReferences, promoteNominalSubtypePython, nominalSubtypePythonConversion, nominalSubtypePythonLimit } from "./nominal-subtype-python-promotion.mjs";

const predecessor = () => JSON.parse(execFileSync("git", ["show", "ad3f7716d997ef8a4331ec8a3f2a6524a2ca3b30:docs/type-surface.v1.json"], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 }));

test("nominal Python promotion authenticates all four source/API selections and both interpreter floors", async () => {
	const references = await nominalSubtypePythonReferences();
	assert.deepEqual(references.map(item => [item.route, item.mode]), [["ordinary", "full"], ["reviewed", "full"], ["ordinary", "result-only"], ["reviewed", "result-only"]]);
	for(const reference of references)
	{
		assert.deepEqual(reference.profiles, ["python"]);
		assert.equal(reference.revision, "08add61bd0668060833cf7f107aeea33b6939b48");
		assert.equal(reference.sourcePath, reference.route === "ordinary" ? "ordinary-source" : "reviewed-ir");
		assert.deepEqual(reference.counts.counts, reference.mode === "full" ? { checks: 4212, rejections: 1032, snapshotControls: 8 } : { checks: 2086, rejections: 0, snapshotControls: 8 });
		assert.equal(reference.counts.executions, 4); assert.equal(reference.counts.dispatchObserved, false);
		assert.deepEqual(reference.counts.runtime, { platform: "linux", arch: "x64", glibc: "2.36" });
		assert.equal(reference.counts.floor, "2.36");
		assert.deepEqual(reference.counts.minors, ["3.11", "3.12"]);
		assert.ok(reference.command.includes("--test-concurrency=1"));
		assert.ok(reference.scope.includes(nominalSubtypePythonLimit));
		assert.equal(reference.artifacts.length, 1);
		for(const suffix of [`/${reference.route}-${reference.mode}/run.tap`, "sources/src/analyze/NativeExports.lean", "checkers/package-records.mjs"])
			assert.ok(reference.files.some(file => file.path.endsWith(suffix)), suffix);
	}
});

test("nominal Python promotion refuses missing originals and substituted scope or references", async () => {
	const original = predecessor(), references = await nominalSubtypePythonReferences();
	const targets = ["index.json", "runner.mjs", "checkers/report.mjs"
		, "sources/src/analyze/NativeExports.lean"
		, ...references.flatMap(item => ["start.json", "end.json", "run.tap", "records/report.json", "records/3.12/relocated.json"].map(path => `${item.route}-${item.mode}/${path}`))];
	for(const target of targets)
	{
		await assert.rejects(nominalSubtypePythonReferences(path => {
			if(path === `${nominalSubtypePythonArchive}/${target}`) throw new Error("Missing original");
			return readFile(path);
		}));
		await assert.rejects(nominalSubtypePythonReferences(async path => path === `${nominalSubtypePythonArchive}/${target}` ? Buffer.from("changed") : readFile(path)));
	}
	for(const altered of [references.slice(1), references.slice().reverse(), [...references, references[0]]])
		await assert.rejects(promoteNominalSubtypePython(original, altered));
	const changes = [item => { item.profiles.push("python"); }
		, item => { item.route = "reviewed"; }
		, item => { item.mode = "result-only"; }
		, item => { item.sourcePath = "reviewed-ir"; }
		, item => { item.revision = "0".repeat(40); }
		, item => { item.scope = "All Subtypes pass"; }
		, item => { item.command = "node --test"; }
		, item => { item.files.pop(); }
		, item => { item.files[0].sha256 = "0".repeat(64); }
		, item => { item.artifacts.pop(); }
		, item => { item.counts.dispatchObserved = true; }
		, item => { item.counts.runtime.glibc = "2.38"; }
		, item => { item.counts.floor = "2.38"; }
		, item => { item.counts.counts.checks = 1; }
		, item => { item.counts.executions = 32; }
		, item => { item.counts.minors.pop(); }
	];
	for(const change of changes)
	{
		const changed = structuredClone(references); change(changed[0]);
		await assert.rejects(promoteNominalSubtypePython(original, changed));
	}
	const promoted = await promoteNominalSubtypePython(original, references);
	await assert.rejects(promoteNominalSubtypePython(promoted, references), /Already promoted/u);
	const missing = structuredClone(original);
	missing.observations = missing.observations.filter(item => item.id !== "native-subtype-python-ordinary-source");
	await assert.rejects(promoteNominalSubtypePython(missing, references), /Missing/u);
	const overlap = structuredClone(original);
	overlap.observations.push({ ...structuredClone(original.observations.find(item => item.id === "native-subtype-python-ordinary-source")), id: "unreviewed-overlap" });
	await assert.rejects(promoteNominalSubtypePython(overlap, references), /overlapping/u);
});

test("nominal Python promotion adds two field cells and supplements four existing cells only", async () => {
	const original = predecessor(), references = await nominalSubtypePythonReferences();
	const proposed = await promoteNominalSubtypePython(original, references), { document: current, ...contracts } = await readTypeSurface();
	const document = JSON.parse(beforeNominalSubtypeRubyPromotionSource("docs/type-surface.v1.json", await readFile("docs/type-surface.v1.json", "utf8")));
	assert.ok(current.evidence.length >= document.evidence.length);
	const later = JSON.parse(await readFile(nominalSubtypeRubyPromotionHistoryPath));
	for(const entry of proposed.evidence) for(const file of entry.files)
	{
		const update = later.updates.find(item => item.path === file.path);
		if(update && file.sha256 === update.currentSha256) file.sha256 = update.previousSha256;
	}
	validateTypeSurface(proposed, contracts);
	assert.equal(original.evidence.length, 484); assert.equal(proposed.evidence.length, 488);
	assert.equal(original.observations.length, 577); assert.equal(proposed.observations.length, 579);
	assert.deepEqual(proposed.evidence.slice(0, 484), original.evidence);
	assert.deepEqual(document.observations, proposed.observations);
	assert.deepEqual(document.evidence.slice(484), proposed.evidence.slice(484));
	const before = typeSurfaceCells(original, contracts), after = typeSurfaceCells(proposed, contracts);
	const changed = [], added = [];
	for(const [index, cell] of after.entries())
	{
		if(JSON.stringify(cell) === JSON.stringify(before[index])) continue;
		assert.equal(cell.shape, "subtype"); assert.equal(cell.profile, "python");
		assert.ok(["parameter", "result", "field"].includes(cell.position));
		const route = cell.path === "ordinary-source" ? "ordinary" : "reviewed";
		const ids = references.filter(item => item.route === route).map(item => item.id);
		for(const [name, stage] of Object.entries(cell.stages))
		{
			assert.equal(stage.state, "passed");
			assert.deepEqual(stage.evidence.filter(id => id.startsWith("nominal-subtype-python-")), ids);
			assert.ok(before[index].stages[name].evidence.every(id => stage.evidence.includes(id)));
			assert.equal(before[index].stages[name].state, cell.position === "field" ? "unreviewed" : "passed");
		}
		assert.ok(cell.conversionNote.includes(nominalSubtypePythonConversion));
		if(cell.position === "field") added.push(cell.id);
		changed.push(cell.id);
	}
	const expected = ["ordinary-source", "reviewed-ir"].flatMap(path => ["parameter", "result", "field"].map(position => `python/subtype/${path}/${position}`));
	assert.deepEqual(changed.sort(), expected.sort()); assert.equal(added.length, 2);
	assert.deepEqual(original, predecessor());
});

test("nominal Python documentation distinguishes verified packages from pending hosts and callbacks", async () => {
	const author = await readFile("docs/lean/existing-package.md", "utf8");
	assert.doesNotMatch(author, /component builds still require that selection/u);
	for(const prefix of ["| `Subtype` in acyclic", "| Lean-produced `Subtype` result without"])
	{
		const row = author.split("\n").find(line => line.startsWith(prefix));
		assert.ok(row.includes("Node installed; browser pending"));
		assert.equal((row.match(/Generated; pending/gu) ?? []).length, 1);
		assert.ok(row.includes("C/C++, Python and Ruby installed; other native hosts pending"));
		assert.ok(row.includes("All four ABIs installed"));
		assert.ok(row.includes("Node, C/C++, Perl, Python and Ruby ordinary/reviewed installed"));
	}
	for(const path of ["docs/lean/existing-package.md", "docs/lean/export-decisions.md", "docs/consume/python.md", "docs/reference/types.md"])
		assert.ok((await readFile(path, "utf8")).includes("nominal-subtype-python-acceptance-20261012.md"), path);
	const source = await readFile("docs/consume/python.md", "utf8");
	assert.ok(source.includes("### Subtypes in copied records\n"));
	assert.ok(source.includes("Linux x64/glibc 2.36"));
	assert.doesNotMatch(source, /Subtype fields in nominal records or variants, refined callback signatures and\nowned Subtypes remain unsupported/u);
	const row = source.split("\n").find(line => line.startsWith("| `Subtype /"));
	for(const route of ["Ordinary source", "Reviewed IR"])
		assert.ok(row.includes(`${route}: Installed checks passed (input, result, field)`));
	assert.ok(row.includes("Not audited (callback input, callback result)"));
	assert.ok(row.includes(nominalSubtypePythonConversion));
});
