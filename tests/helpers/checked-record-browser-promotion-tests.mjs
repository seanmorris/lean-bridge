/**
 * Keep browser checked-record support bound to original routes and exact public positions.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { readTypeSurface, typeSurfaceCells, validateTypeSurface } from "../../src/adoption/type-surface.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { checkedRecordBrowserReferences, promoteCheckedRecordBrowsers, checkedRecordBrowserProfiles, checkedRecordBrowserArchiveRoot, checkedRecordBrowserArchiveIndex, checkedRecordBrowserConversion, checkedRecordBrowserLimit } from "./checked-record-browser-promotion.mjs";
import { checkedRecordBrowserPromotionPredecessor, checkedRecordBrowserPromotionHistoryPath } from "./checked-record-browser-promotion-history.mjs";

const baseline = () => JSON.parse(execFileSync("git", ["show", `${checkedRecordBrowserPromotionPredecessor}:docs/type-surface.v1.json`], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 }));

test("browser checked-record promotion authenticates all four original runs and their distinct producer commits", async () => {
	const references = await checkedRecordBrowserReferences();
	assert.equal(references.length, 4); assert.equal(new Set(references.map(item => item.revision)).size, 3);
	assert.equal(references.filter(item => item.resultOnly).length, 2);
	const hashes = new Map();
	for(const reference of references)
	{
		assert.deepEqual(reference.profiles, checkedRecordBrowserProfiles);
		assert.deepEqual(reference.positions, reference.resultOnly ? ["result"] : ["parameter", "result"]);
		assert.ok(reference.command.includes("LEAN_BRIDGE_TYPE_CORPUS_BROWSERS='chromium,firefox,webkit'"));
		assert.ok(reference.command.includes("tests/helpers/checked-record-browser-installed-tests.mjs"));
		assert.ok(reference.scope.includes(checkedRecordBrowserLimit));
		assert.equal(reference.files[0].sha256, checkedRecordBrowserArchiveIndex);
		assert.equal(reference.artifacts.length, 2);
		assert.ok(reference.files.some(file => file.path.endsWith(`sources/${reference.revision}/src/analyze/NativeExports.lean`)));
		assert.ok(!reference.files.some(file => file.path.includes("/sources/") && !file.path.includes(`/sources/${reference.revision}/`)));
		for(const file of reference.files)
		{
			if(!hashes.has(file.path)) hashes.set(file.path, sha256(await readFile(file.path)));
			assert.equal(hashes.get(file.path), file.sha256);
		}
	}
});

test("browser promotion refuses missing or corrupt original provenance, callers and compiler records", async t => {
	const index = JSON.parse(await readFile(`${checkedRecordBrowserArchiveRoot}/index.json`));
	const routeFiles = ["start.json", "end.json", "run.tap"
		, "records/report.json", "records/browser.json", "records/index.mts"
		, "records/build-0/locks/compiler-adapters.json"
		, "records/build-1/CheckedRecords.lean"
		, "records/browser-react/observations.json"
		, "records/browser-worker/installed-runtime-identity.json"];
	const paths = ["index.json", "runner.mjs", "checkers/report.mjs"
		, "checkers/npm-report.mjs"
		, ...index.producerCommits.map(revision => `sources/${revision}/schema/compiler-adapter-plan.schema.json`)
		, ...index.runs.flatMap(run => routeFiles.map(path => `${run.route}/${path}`))];
	for(const selected of paths)
	{
		const target = `${checkedRecordBrowserArchiveRoot}/${selected}`;
		await assert.rejects(checkedRecordBrowserReferences(async path => { assert.notEqual(path, target); return readFile(path); }));
		await assert.rejects(checkedRecordBrowserReferences(async path => {
			const bytes = await readFile(path); return path === target ? Buffer.concat([bytes, Buffer.from("changed")]) : bytes;
		}));
	}
	t.diagnostic(`${paths.length * 2} missing/corrupt original controls`);
});

test("browser promotion supplements eight Node cells and adds exactly twelve browser cells", async () => {
	const current = await readTypeSurface(), previous = baseline(), unchanged = structuredClone(previous);
	const references = await checkedRecordBrowserReferences(), proposed = await promoteCheckedRecordBrowsers(previous, references);
	assert.deepEqual(previous, unchanged); validateTypeSurface(proposed, current);
	assert.equal(previous.evidence.length, 464); assert.equal(previous.observations.length, 555);
	assert.equal(proposed.evidence.length, 468); assert.equal(proposed.observations.length, 567);
	assert.deepEqual(proposed.evidence.slice(0, 464), previous.evidence);
	const before = typeSurfaceCells(previous, current), after = typeSurfaceCells(proposed, current), changed = [];
	for(const [index, cell] of after.entries())
	{
		if(JSON.stringify(cell) === JSON.stringify(before[index])) continue;
		assert.equal(cell.shape, "checked-record"); assert.ok(checkedRecordBrowserProfiles.includes(cell.profile));
		assert.ok(["ordinary-source", "reviewed-ir"].includes(cell.path)); assert.ok(["parameter", "result"].includes(cell.position));
		assert.equal(before[index].stages.installedExecution.state, cell.profile.startsWith("node-") ? "passed" : "unreviewed");
		const matching = references.filter(item => item.sourcePath === cell.path && item.positions.includes(cell.position)).map(item => item.id);
		for(const [stage, value] of Object.entries(cell.stages))
		{
			assert.equal(value.state, "passed");
			assert.deepEqual(value.evidence, [...before[index].stages[stage].evidence, ...matching]);
			assert.equal(value.evidence.filter(id => id.startsWith("checked-record-browser-result-only")).length, cell.position === "result" ? 1 : 0);
		}
		changed.push(`${cell.profile}/${cell.path}/${cell.position}`);
	}
	assert.deepEqual(changed.sort(), checkedRecordBrowserProfiles.flatMap(profile => ["ordinary-source", "reviewed-ir"].flatMap(path => ["parameter", "result"].map(position => `${profile}/${path}/${position}`))).sort());
	assert.equal(after.filter(cell => cell.shape === "checked-record" && cell.stages.installedExecution.state === "passed").length, 64);
	const restored = structuredClone(proposed); restored.evidence.splice(464); restored.observations.splice(555);
	let supplements = 0;
	for(const [index, observation] of restored.observations.entries())
	{
		if(JSON.stringify(observation) === JSON.stringify(previous.observations[index])) continue;
		assert.ok(observation.profiles[0].startsWith("node-")); assert.deepEqual(observation.shapes, ["checked-record"]);
		assert.ok(observation.scope.startsWith(previous.observations[index].scope));
		assert.deepEqual(observation.hostTypes, previous.observations[index].hostTypes);
		assert.deepEqual(observation.conversionNotes, previous.observations[index].conversionNotes);
		assert.deepEqual(observation.limitations, [...previous.observations[index].limitations, checkedRecordBrowserLimit]);
		restored.observations[index] = previous.observations[index]; supplements++;
	}
	assert.equal(supplements, 8); assert.deepEqual(restored, previous);
	const history = JSON.parse(await readFile(checkedRecordBrowserPromotionHistoryPath));
	const path = "docs/type-surface.v1.json", update = history.updates.find(item => item.path === path);
	const milestone = JSON.parse(beforeFinRefinementSource(path, await readFile(path, "utf8"), update.currentSha256));
	for(const entry of proposed.evidence) for(const file of entry.files)
	{
		const transition = history.updates.find(item => item.path === file.path && item.previousSha256 === file.sha256);
		if(transition) file.sha256 = transition.currentSha256;
		if(previous.evidence.some(item => item.id === entry.id) || file.path.startsWith("docs/evidence/")) continue;
		const original = milestone.evidence.find(item => item.id === entry.id).files.find(item => item.path === file.path);
		assert.equal(sha256(beforeFinRefinementSource(file.path, await readFile(file.path), original.sha256)), original.sha256);
		file.sha256 = original.sha256;
	}
	assert.deepEqual(proposed, milestone);
});

test("browser promotion refuses forged references, overlapping positions and repeated promotion", async () => {
	const previous = baseline(), references = await checkedRecordBrowserReferences();
	for(const changed of [references.slice(1), [...references].reverse(), [...references, references[0]]])
		await assert.rejects(promoteCheckedRecordBrowsers(previous, changed));
	const mutations = [item => { item.profiles.push("php-wasm"); }
		, item => { item.positions.push("parameter"); }
		, item => { item.resultOnly = false; }
		, item => { item.revision = "0".repeat(40); }
		, item => { item.scope = "All dependent records pass"; }
		, item => { item.files[0].sha256 = "0".repeat(64); }
		, item => { item.artifacts.pop(); }];
	for(const mutate of mutations)
	{
		const changed = structuredClone(references); mutate(changed.at(-1));
		await assert.rejects(promoteCheckedRecordBrowsers(previous, changed));
	}
	const promoted = await promoteCheckedRecordBrowsers(previous, references);
	await assert.rejects(promoteCheckedRecordBrowsers(promoted, references), /Already promoted/u);
	const overlap = structuredClone(previous); overlap.observations.push(promoted.observations.at(-1));
	await assert.rejects(promoteCheckedRecordBrowsers(overlap, references), /overlapping/u);
});

test("browser checked-record docs describe the tested positions and keep remaining combinations open", async () => {
	const guide = await readFile("docs/javascript-typescript.md", "utf8");
	const row = guide.split("\n").find(line => line.startsWith("| `Checked records and closed Nat indices`"));
	assert.ok(row.includes("Ordinary source: Installed checks passed (input, result)"));
	assert.ok(row.includes("Reviewed IR: Installed checks passed (input, result)"));
	assert.ok(row.includes("Not audited (field, callback input, callback result)"));
	assert.ok(row.includes(checkedRecordBrowserConversion));
	for(const path of ["docs/javascript-typescript.md", "docs/lean/existing-package.md", "docs/reference/types.md"])
		assert.ok((await readFile(path, "utf8")).includes("checked-record-browser-promotion-20261011.md"));
	assert.ok(guide.includes("standalone result-only packages"));
	assert.ok(guide.includes("do not establish PHP-Wasm support"));
	assert.ok(guide.includes("Nested, refined, recursive or inherited checked records"));
});
