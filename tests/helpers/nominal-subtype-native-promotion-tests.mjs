/**
 * Keep nominal native claims tied to the four original C/C++ selections.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { readTypeSurface, typeSurfaceCells, validateTypeSurface } from "../../src/adoption/type-surface.mjs";
import { beforeNominalSubtypePerlPromotionSource } from "./nominal-subtype-perl-promotion-history.mjs";
import { nominalSubtypeNativeArchive, nominalSubtypeNativeProfiles, nominalSubtypeNativeReferences, promoteNominalSubtypeNative, nominalSubtypeNativeConversion, nominalSubtypeNativeLimit } from "./nominal-subtype-native-promotion.mjs";

const predecessor = () => JSON.parse(execFileSync("git", ["show", "4d9424e6c1fa551d0c6802d39ee7c5d469ed8c23:docs/type-surface.v1.json"], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 }));

test("nominal native promotion authenticates four installed selections at the observed glibc runtime", async () => {
	const references = await nominalSubtypeNativeReferences();
	assert.deepEqual(references.map(item => [item.route, item.mode]), [["ordinary", "full"], ["reviewed", "full"], ["ordinary", "result-only"], ["reviewed", "result-only"]]);
	for(const reference of references)
	{
		assert.deepEqual(reference.profiles, nominalSubtypeNativeProfiles);
		assert.equal(reference.revision, "f2600a5efb6f8e0a64c0ed9f6903bf75f40ea332");
		assert.equal(reference.sourcePath, reference.route === "ordinary" ? "ordinary-source" : "reviewed-ir");
		assert.deepEqual(reference.counts.counts, reference.mode === "full" ? { c: 4149, cpp: 4122 } : { c: 2042, cpp: 2042 });
		assert.equal(reference.counts.executions, 4); assert.equal(reference.counts.dispatchObserved, false);
		assert.deepEqual(reference.counts.runtime, { platform: "linux", arch: "x64", glibc: "2.36" });
		assert.ok(reference.command.includes("--test-concurrency=1"));
		assert.ok(reference.scope.includes(nominalSubtypeNativeLimit));
		assert.equal(reference.artifacts.length, 2);
		assert.ok(reference.files.some(file => file.path.endsWith(`/${reference.route}-${reference.mode}/run.tap`)));
		assert.ok(reference.files.some(file => file.path.endsWith("sources/src/analyze/NativeExports.lean")));
	}
});

test("nominal native promotion refuses missing originals and substituted scope or references", async () => {
	const original = predecessor(), references = await nominalSubtypeNativeReferences();
	for(const target of ["index.json", "runner.mjs", "checker.mjs"
		, "sources/src/analyze/NativeExports.lean"
		, ...references.flatMap(item => ["start.json", "end.json", "run.tap", "records/report.json", "records/c/lean-bridge-package.json"].map(path => `${item.route}-${item.mode}/${path}`))]) {
		await assert.rejects(nominalSubtypeNativeReferences(path => {
			if(path === `${nominalSubtypeNativeArchive}/${target}`) throw new Error("Missing original");
			return readFile(path);
		}));
		await assert.rejects(nominalSubtypeNativeReferences(async path => path === `${nominalSubtypeNativeArchive}/${target}` ? Buffer.from("changed") : readFile(path)));
		}
	for(const altered of [references.slice(1), references.slice().reverse(), [...references, references[0]]])
		await assert.rejects(promoteNominalSubtypeNative(original, altered));
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
		, item => { item.counts.runtime.glibc = "2.38"; }
		, item => { item.counts.counts.c = 1; }
		, item => { item.counts.executions = 8; }]) {
		const changed = structuredClone(references); change(changed[0]);
		await assert.rejects(promoteNominalSubtypeNative(original, changed));
		}
	const promoted = await promoteNominalSubtypeNative(original, references);
	await assert.rejects(promoteNominalSubtypeNative(promoted, references), /Already promoted/u);
	const missing = structuredClone(original);
	missing.observations = missing.observations.filter(item => item.id !== "native-subtype-c-cpp-ordinary-source");
	await assert.rejects(promoteNominalSubtypeNative(missing, references), /Missing/u);
	const overlap = structuredClone(original);
	overlap.observations.push({ ...structuredClone(original.observations.find(item => item.id === "native-subtype-c-cpp-ordinary-source")), id: "unreviewed-overlap" });
	await assert.rejects(promoteNominalSubtypeNative(overlap, references), /overlapping/u);
});

test("nominal native promotion adds four C/C++ field cells and supplements eight existing cells only", async () => {
	const original = predecessor(), references = await nominalSubtypeNativeReferences();
	const proposed = await promoteNominalSubtypeNative(original, references), { document: current, ...contracts } = await readTypeSurface();
	const document = JSON.parse(beforeNominalSubtypePerlPromotionSource("docs/type-surface.v1.json", await readFile("docs/type-surface.v1.json", "utf8")));
	validateTypeSurface(proposed, contracts);
	assert.equal(original.evidence.length, 476); assert.equal(proposed.evidence.length, 480);
	assert.equal(original.observations.length, 573); assert.equal(proposed.observations.length, 575);
	assert.deepEqual(proposed.evidence.slice(0, 476), original.evidence);
	assert.deepEqual(document.observations, proposed.observations);
	assert.deepEqual(current.evidence.slice(476, 480), proposed.evidence.slice(476));
	const before = typeSurfaceCells(original, contracts), after = typeSurfaceCells(proposed, contracts);
	const changed = [], added = [];
	for(const [index, cell] of after.entries())
	{
		if(JSON.stringify(cell) === JSON.stringify(before[index])) continue;
		assert.equal(cell.shape, "subtype"); assert.ok(nominalSubtypeNativeProfiles.includes(cell.profile));
		assert.ok(["parameter", "result", "field"].includes(cell.position));
		const route = cell.path === "ordinary-source" ? "ordinary" : "reviewed";
		const ids = references.filter(item => item.route === route).map(item => item.id);
		for(const [name, stage] of Object.entries(cell.stages))
		{
			assert.equal(stage.state, "passed");
			assert.deepEqual(stage.evidence.filter(id => id.startsWith("nominal-subtype-native-")), ids);
			assert.ok(before[index].stages[name].evidence.every(id => stage.evidence.includes(id)));
			assert.equal(before[index].stages[name].state, cell.position === "field" ? "unreviewed" : "passed");
		}
		assert.ok(cell.conversionNote.includes(nominalSubtypeNativeConversion));
		if(cell.position === "field") added.push(cell.id);
		changed.push(cell.id);
	}
	const expected = nominalSubtypeNativeProfiles.flatMap(profile => ["ordinary-source", "reviewed-ir"].flatMap(path => ["parameter", "result", "field"].map(position => `${profile}/subtype/${path}/${position}`)));
	assert.deepEqual(changed.sort(), expected.sort()); assert.equal(added.length, 4);
	assert.deepEqual(original, predecessor());
});

test("nominal native docs distinguish verified C/C++ from other hosts and callback contexts", async () => {
	const author = await readFile("docs/lean/existing-package.md", "utf8");
	for(const prefix of ["| `Subtype` in acyclic", "| Lean-produced `Subtype` result without"])
	{
		const row = author.split("\n").find(line => line.startsWith(prefix));
		assert.ok(row.includes("Node installed; browser pending"));
		assert.equal((row.match(/Generated; pending/gu) ?? []).length, 1);
		assert.ok(row.includes("All four ABIs installed"));
		assert.ok(row.includes("C/C++ and Python installed; other native hosts pending"));
		assert.ok(row.includes("Node, C/C++, Perl and Python ordinary/reviewed installed"));
	}
	for(const path of ["docs/lean/existing-package.md", "docs/lean/export-decisions.md", "docs/consume/c.md", "docs/consume/cpp.md", "docs/reference/types.md"])
		assert.ok((await readFile(path, "utf8")).includes("nominal-subtype-native-acceptance-20261011.md"), path);
	for(const name of ["c", "cpp"])
	{
		const source = await readFile(`docs/consume/${name}.md`, "utf8");
		assert.ok(source.includes("### Subtypes in copied records\n"));
		assert.ok(source.includes("Linux x64/glibc 2.36"));
		assert.doesNotMatch(source, /Subtype fields in nominal records or variants, refined callback signatures and\nowned Subtypes remain unsupported/u);
		const row = source.split("\n").find(line => line.startsWith("| `Subtype /"));
		for(const route of ["Ordinary source", "Reviewed IR"])
			assert.ok(row.includes(`${route}: Installed checks passed (input, result, field)`));
		assert.ok(row.includes("Not audited (callback input, callback result)"));
		assert.ok(row.includes(nominalSubtypeNativeConversion));
	}
});
