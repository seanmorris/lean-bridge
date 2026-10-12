/**
 * Keep Perl nominal claims tied to the four original installed selections.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { readTypeSurface, typeSurfaceCells, validateTypeSurface } from "../../src/adoption/type-surface.mjs";
import { beforeNominalSubtypePythonPromotionSource, nominalSubtypePythonPromotionHistoryPath } from "./nominal-subtype-python-promotion-history.mjs";
import { nominalSubtypePerlArchive, nominalSubtypePerlReferences, promoteNominalSubtypePerl, nominalSubtypePerlConversion, nominalSubtypePerlLimit } from "./nominal-subtype-perl-promotion.mjs";

const predecessor = () => JSON.parse(execFileSync("git", ["show", "7c9fbfee9c31b60dc7433ca6945be62e39810754:docs/type-surface.v1.json"], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 }));

test("nominal Perl promotion authenticates all four source/API selections and all four ABIs", async () => {
	const references = await nominalSubtypePerlReferences();
	assert.deepEqual(references.map(item => [item.route, item.mode]), [["ordinary", "full"], ["reviewed", "full"], ["ordinary", "result-only"], ["reviewed", "result-only"]]);
	for(const reference of references)
	{
		assert.deepEqual(reference.profiles, ["perl"]);
		assert.equal(reference.revision, "875fbc9fb3191ad9eea959499abca5c01e631394");
		assert.equal(reference.sourcePath, reference.route === "ordinary" ? "ordinary-source" : "reviewed-ir");
		assert.deepEqual(reference.counts.counts, reference.mode === "full" ? { checks: 4212, rejections: 1032, snapshotControls: 8 } : { checks: 2086, rejections: 0, snapshotControls: 8 });
		assert.equal(reference.counts.executions, 16); assert.equal(reference.counts.dispatchObserved, false);
		assert.deepEqual(reference.counts.runtime, { platform: "linux", arch: "x64", glibc: "2.36" });
		assert.equal(reference.counts.floor, "2.36");
		assert.deepEqual(reference.counts.configurations, ["5.36.3-threaded", "5.36.3-unthreaded", "5.38.2-threaded", "5.38.2-unthreaded"]);
		assert.deepEqual(reference.counts.deliveryModes, ["prebuilt-only", "build-xs"]);
		assert.ok(reference.command.includes("--test-concurrency=1"));
		assert.ok(reference.scope.includes(nominalSubtypePerlLimit));
		assert.equal(reference.artifacts.length, 2);
		for(const suffix of [`/${reference.route}-${reference.mode}/run.tap`, "sources/src/analyze/NativeExports.lean", "checkers/package-records.mjs"])
			assert.ok(reference.files.some(file => file.path.endsWith(suffix)), suffix);
	}
});

test("nominal Perl promotion refuses missing originals and substituted scope or references", async () => {
	const original = predecessor(), references = await nominalSubtypePerlReferences();
	const targets = ["index.json", "runner.mjs", "checkers/report.mjs"
		, "sources/src/analyze/NativeExports.lean"
		, ...references.flatMap(item => ["start.json", "end.json", "run.tap", "records/report.json", "records/5.38.2-unthreaded/build-xs/repeated.json"].map(path => `${item.route}-${item.mode}/${path}`))];
	for(const target of targets)
	{
		await assert.rejects(nominalSubtypePerlReferences(path => {
			if(path === `${nominalSubtypePerlArchive}/${target}`) throw new Error("Missing original");
			return readFile(path);
		}));
		await assert.rejects(nominalSubtypePerlReferences(async path => path === `${nominalSubtypePerlArchive}/${target}` ? Buffer.from("changed") : readFile(path)));
	}
	for(const altered of [references.slice(1), references.slice().reverse(), [...references, references[0]]])
		await assert.rejects(promoteNominalSubtypePerl(original, altered));
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
		, item => { item.counts.configurations.pop(); }
		, item => { item.counts.deliveryModes.pop(); }
	];
	for(const change of changes)
	{
		const changed = structuredClone(references); change(changed[0]);
		await assert.rejects(promoteNominalSubtypePerl(original, changed));
	}
	const promoted = await promoteNominalSubtypePerl(original, references);
	await assert.rejects(promoteNominalSubtypePerl(promoted, references), /Already promoted/u);
	const missing = structuredClone(original);
	missing.observations = missing.observations.filter(item => item.id !== "perl-subtype-ordinary-source");
	await assert.rejects(promoteNominalSubtypePerl(missing, references), /Missing/u);
	const overlap = structuredClone(original);
	overlap.observations.push({ ...structuredClone(original.observations.find(item => item.id === "perl-subtype-ordinary-source")), id: "unreviewed-overlap" });
	await assert.rejects(promoteNominalSubtypePerl(overlap, references), /overlapping/u);
});

test("nominal Perl promotion adds two field cells and supplements four existing cells only", async () => {
	const original = predecessor(), references = await nominalSubtypePerlReferences();
	const proposed = await promoteNominalSubtypePerl(original, references), { document: current, ...contracts } = await readTypeSurface();
	const document = JSON.parse(beforeNominalSubtypePythonPromotionSource("docs/type-surface.v1.json", await readFile("docs/type-surface.v1.json", "utf8")));
	assert.ok(current.evidence.length >= document.evidence.length);
	const later = JSON.parse(await readFile(nominalSubtypePythonPromotionHistoryPath));
	for(const entry of proposed.evidence) for(const file of entry.files)
	{
		const update = later.updates.find(item => item.path === file.path);
		if(update && file.sha256 === update.currentSha256) file.sha256 = update.previousSha256;
	}
	validateTypeSurface(proposed, contracts);
	assert.equal(original.evidence.length, 480); assert.equal(proposed.evidence.length, 484);
	assert.equal(original.observations.length, 575); assert.equal(proposed.observations.length, 577);
	assert.deepEqual(proposed.evidence.slice(0, 480), original.evidence);
	assert.deepEqual(document.observations, proposed.observations);
	assert.deepEqual(document.evidence.slice(480), proposed.evidence.slice(480));
	const before = typeSurfaceCells(original, contracts), after = typeSurfaceCells(proposed, contracts);
	const changed = [], added = [];
	for(const [index, cell] of after.entries())
	{
		if(JSON.stringify(cell) === JSON.stringify(before[index])) continue;
		assert.equal(cell.shape, "subtype"); assert.equal(cell.profile, "perl");
		assert.ok(["parameter", "result", "field"].includes(cell.position));
		const route = cell.path === "ordinary-source" ? "ordinary" : "reviewed";
		const ids = references.filter(item => item.route === route).map(item => item.id);
		for(const [name, stage] of Object.entries(cell.stages))
		{
			assert.equal(stage.state, "passed");
			assert.deepEqual(stage.evidence.filter(id => id.startsWith("nominal-subtype-perl-")), ids);
			assert.ok(before[index].stages[name].evidence.every(id => stage.evidence.includes(id)));
			assert.equal(before[index].stages[name].state, cell.position === "field" ? "unreviewed" : "passed");
		}
		assert.ok(cell.conversionNote.includes(nominalSubtypePerlConversion));
		if(cell.position === "field") added.push(cell.id);
		changed.push(cell.id);
	}
	const expected = ["ordinary-source", "reviewed-ir"].flatMap(path => ["parameter", "result", "field"].map(position => `perl/subtype/${path}/${position}`));
	assert.deepEqual(changed.sort(), expected.sort()); assert.equal(added.length, 2);
	assert.deepEqual(original, predecessor());
});

test("nominal Perl documentation distinguishes verified packages from pending hosts and callbacks", async () => {
	const author = await readFile("docs/lean/existing-package.md", "utf8");
	for(const prefix of ["| `Subtype` in acyclic", "| Lean-produced `Subtype` result without"])
	{
		const row = author.split("\n").find(line => line.startsWith(prefix));
		assert.ok(row.includes("Node installed; browser pending"));
		assert.equal((row.match(/Generated; pending/gu) ?? []).length, 1);
		assert.ok(row.includes("C/C++ and Python installed; other native hosts pending"));
		assert.ok(row.includes("All four ABIs installed"));
		assert.ok(row.includes("Node, C/C++, Perl and Python ordinary/reviewed installed"));
	}
	for(const path of ["docs/lean/existing-package.md", "docs/lean/export-decisions.md", "docs/consume/perl.md", "docs/reference/types.md"])
		assert.ok((await readFile(path, "utf8")).includes("nominal-subtype-perl-acceptance-20261012.md"), path);
	const source = await readFile("docs/consume/perl.md", "utf8");
	assert.ok(source.includes("### Subtypes in copied records\n"));
	assert.ok(source.includes("Linux x64/glibc 2.36"));
	assert.doesNotMatch(source, /Subtype fields in nominal records or variants, refined callback signatures and\nowned Subtypes remain unsupported/u);
	const row = source.split("\n").find(line => line.startsWith("| `Subtype /"));
	for(const route of ["Ordinary source", "Reviewed IR"])
		assert.ok(row.includes(`${route}: Installed checks passed (input, result, field)`));
	assert.ok(row.includes("Not audited (callback input, callback result)"));
	assert.ok(row.includes(nominalSubtypePerlConversion));
});
