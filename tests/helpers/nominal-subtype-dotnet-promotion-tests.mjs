/**
 * Keep C# nominal claims tied to the four original installed selections.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { readTypeSurface, typeSurfaceCells, validateTypeSurface } from "../../src/adoption/type-surface.mjs";
import { nominalSubtypeDotnetArchive, nominalSubtypeDotnetReferences, promoteNominalSubtypeDotnet, nominalSubtypeDotnetConversion, nominalSubtypeDotnetLimit } from "./nominal-subtype-dotnet-promotion.mjs";

const predecessor = () => JSON.parse(execFileSync("git", ["show", "ad838834ca234ac7715462df368c28ca0d1cede1:docs/type-surface.v1.json"], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 }));

test("nominal C# promotion authenticates all four source/API selections and the pinned .NET SDK and shared framework", async () => {
	const references = await nominalSubtypeDotnetReferences();
	assert.deepEqual(references.map(item => [item.route, item.mode]), [["ordinary", "full"], ["reviewed", "full"], ["ordinary", "result-only"], ["reviewed", "result-only"]]);
	for(const reference of references)
	{
		assert.deepEqual(reference.profiles, ["dotnet"]);
		assert.equal(reference.revision, "5762111059313672f23825b65df2f91ec05437a3");
		assert.equal(reference.sourcePath, reference.route === "ordinary" ? "ordinary-source" : "reviewed-ir");
		assert.deepEqual(reference.counts.counts, reference.mode === "full" ? { checks: 4226, hostRejections: 7, rejections: 1032, snapshotControls: 8 } : { checks: 2088, hostRejections: 1, rejections: 0, snapshotControls: 8 });
		assert.equal(reference.counts.executions, 3); assert.equal(reference.counts.dispatchObserved, false);
		assert.deepEqual(reference.counts.runtime, { platform: "linux", arch: "x64", glibc: "2.36" });
		assert.equal(reference.counts.floor, "2.36");
		assert.equal(reference.counts.toolchain.sdk.version, "8.0.424");
		assert.equal(reference.counts.framework.facts.version, "8.0.30");
		assert.ok(reference.command.includes("--test-concurrency=1"));
		assert.ok(reference.scope.includes(nominalSubtypeDotnetLimit));
		assert.equal(reference.artifacts.length, 1);
		for(const suffix of [`/${reference.route}-${reference.mode}/run.tap`, "sources/src/analyze/NativeExports.lean", "checkers/package-records.mjs"])
			assert.ok(reference.files.some(file => file.path.endsWith(suffix)), suffix);
	}
});

test("nominal C# promotion refuses missing originals and substituted scope or references", async () => {
	const original = predecessor(), references = await nominalSubtypeDotnetReferences();
	const targets = ["index.json", "runner.mjs", "checkers/report.mjs"
		, "sources/src/analyze/NativeExports.lean"
		, ...references.flatMap(item => ["start.json", "end.json", "run.tap", "records/report.json", "records/relocated.json"].map(path => `${item.route}-${item.mode}/${path}`))];
	for(const target of targets)
	{
		await assert.rejects(nominalSubtypeDotnetReferences(path => {
			if(path === `${nominalSubtypeDotnetArchive}/${target}`) throw new Error("Missing original");
			return readFile(path);
		}));
		await assert.rejects(nominalSubtypeDotnetReferences(async path => path === `${nominalSubtypeDotnetArchive}/${target}` ? Buffer.from("changed") : readFile(path)));
	}
	for(const altered of [references.slice(1), references.slice().reverse(), [...references, references[0]]])
		await assert.rejects(promoteNominalSubtypeDotnet(original, altered));
	const changes = [item => { item.profiles.push("dotnet"); }
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
		, item => { item.counts.toolchain.interpreter.sha256 = "0".repeat(64); }
		, item => { item.counts.toolchain.sdk.version = "8.0.100"; }
		, item => { item.counts.framework.facts.version = "8.0.0"; }
		, item => { item.counts.archiveSha512 = "substituted"; }
	];
	for(const change of changes)
	{
		const changed = structuredClone(references); change(changed[0]);
		await assert.rejects(promoteNominalSubtypeDotnet(original, changed));
	}
	const promoted = await promoteNominalSubtypeDotnet(original, references);
	await assert.rejects(promoteNominalSubtypeDotnet(promoted, references), /Already promoted/u);
	const missing = structuredClone(original);
	missing.observations = missing.observations.filter(item => item.id !== "native-subtype-dotnet-ordinary-source");
	await assert.rejects(promoteNominalSubtypeDotnet(missing, references), /Missing/u);
	const overlap = structuredClone(original);
	overlap.observations.push({ ...structuredClone(original.observations.find(item => item.id === "native-subtype-dotnet-ordinary-source")), id: "unreviewed-overlap" });
	await assert.rejects(promoteNominalSubtypeDotnet(overlap, references), /overlapping/u);
});

test("nominal C# promotion adds two field cells and supplements four existing cells only", async () => {
	const original = predecessor(), references = await nominalSubtypeDotnetReferences();
	const proposed = await promoteNominalSubtypeDotnet(original, references), { document, ...contracts } = await readTypeSurface();
	validateTypeSurface(proposed, contracts);
	assert.equal(original.evidence.length, 496); assert.equal(proposed.evidence.length, 500);
	assert.equal(original.observations.length, 583); assert.equal(proposed.observations.length, 585);
	assert.deepEqual(proposed.evidence.slice(0, 496), original.evidence);
	assert.deepEqual(document.observations, proposed.observations);
	assert.deepEqual(document.evidence.slice(496), proposed.evidence.slice(496));
	const before = typeSurfaceCells(original, contracts), after = typeSurfaceCells(proposed, contracts);
	const changed = [], added = [];
	for(const [index, cell] of after.entries())
	{
		if(JSON.stringify(cell) === JSON.stringify(before[index])) continue;
		assert.equal(cell.shape, "subtype"); assert.equal(cell.profile, "dotnet");
		assert.ok(["parameter", "result", "field"].includes(cell.position));
		const route = cell.path === "ordinary-source" ? "ordinary" : "reviewed";
		const ids = references.filter(item => item.route === route).map(item => item.id);
		for(const [name, stage] of Object.entries(cell.stages))
		{
			assert.equal(stage.state, "passed");
			assert.deepEqual(stage.evidence.filter(id => id.startsWith("nominal-subtype-dotnet-")), ids);
			assert.ok(before[index].stages[name].evidence.every(id => stage.evidence.includes(id)));
			assert.equal(before[index].stages[name].state, cell.position === "field" ? "unreviewed" : "passed");
		}
		assert.ok(cell.conversionNote.includes(nominalSubtypeDotnetConversion));
		if(cell.position === "field") added.push(cell.id);
		changed.push(cell.id);
	}
	const expected = ["ordinary-source", "reviewed-ir"].flatMap(path => ["parameter", "result", "field"].map(position => `dotnet/subtype/${path}/${position}`));
	assert.deepEqual(changed.sort(), expected.sort()); assert.equal(added.length, 2);
	assert.deepEqual(original, predecessor());
});

test("nominal C# documentation distinguishes verified packages from pending hosts and callbacks", async () => {
	const author = await readFile("docs/lean/existing-package.md", "utf8");
	assert.doesNotMatch(author, /component builds still require that selection/u);
	for(const prefix of ["| `Subtype` in acyclic", "| Lean-produced `Subtype` result without"])
	{
		const row = author.split("\n").find(line => line.startsWith(prefix));
		assert.ok(row.includes("Node installed; browser pending"));
		assert.equal((row.match(/Generated; pending/gu) ?? []).length, 1);
		assert.ok(row.includes("C/C++, Python, Ruby, Rust and C# installed; other native hosts pending"));
		assert.ok(row.includes("All four ABIs installed"));
		assert.ok(row.includes("Node, C/C++, Perl, Python, Ruby, Rust and C# ordinary/reviewed installed"));
	}
	for(const path of ["docs/lean/existing-package.md", "docs/lean/export-decisions.md", "docs/consume/dotnet.md", "docs/reference/types.md"])
		assert.ok((await readFile(path, "utf8")).includes("nominal-subtype-dotnet-20261012.md"), path);
	const source = await readFile("docs/consume/dotnet.md", "utf8");
	assert.ok(source.includes("### Subtypes in copied records\n"));
	assert.ok(source.includes("Linux x64/glibc 2.36"));
	assert.doesNotMatch(source, /Subtype fields in nominal records or variants, refined callback signatures and\nowned Subtypes remain unsupported/u);
	const row = source.split("\n").find(line => line.startsWith("| `Subtype /"));
	for(const route of ["Ordinary source", "Reviewed IR"])
		assert.ok(row.includes(`${route}: Installed checks passed (input, result, field)`));
	assert.ok(row.includes("Not audited (callback input, callback result)"));
	assert.ok(row.includes(nominalSubtypeDotnetConversion));
});
