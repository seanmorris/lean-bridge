/**
 * Restrict PHP-Wasm checked-record claims to authenticated installed selections.
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
import { checkedRecordPhpWasmReferences, promoteCheckedRecordPhpWasm, checkedRecordPhpWasmProfiles, checkedRecordPhpWasmArchiveRoot, checkedRecordPhpWasmArchiveIndex, checkedRecordPhpWasmConversion, checkedRecordPhpWasmLimit } from "./checked-record-php-wasm-promotion.mjs";
import { checkedRecordPhpWasmPromotionPredecessor, checkedRecordPhpWasmPromotionHistoryPath } from "./checked-record-php-wasm-promotion-history.mjs";

const baseline = () => JSON.parse(execFileSync("git", ["show", `${checkedRecordPhpWasmPromotionPredecessor}:docs/type-surface.v1.json`], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 }));
const promotionSource = async path => {
	const history = JSON.parse(await readFile(
		checkedRecordPhpWasmPromotionHistoryPath, "utf8"
	));
	const update = history.updates.find(item => item.path === path);
	const source = await readFile(path, "utf8");
	return update === undefined ? source : beforeFinRefinementSource(
		path, source, update.currentSha256
	);
};

test("PHP-Wasm checked-record promotion authenticates all four original installed routes", async () => {
	const references = await checkedRecordPhpWasmReferences();
	assert.equal(references.length, 4); assert.equal(new Set(references.map(item => item.revision)).size, 1);
	assert.equal(references.filter(item => item.resultOnly).length, 2);
	const hashes = new Map();
	for(const reference of references)
	{
		assert.deepEqual(reference.profiles, checkedRecordPhpWasmProfiles);
		assert.deepEqual(reference.positions, reference.resultOnly ? ["result"] : ["parameter", "result"]);
		assert.ok(reference.command.includes("LEAN_BRIDGE_CHECKED_RECORD_PHP_WASM_TEST='1'"));
		assert.ok(reference.command.includes("tests/helpers/checked-record-php-wasm-installed-tests.mjs"));
		assert.ok(reference.scope.includes(checkedRecordPhpWasmLimit));
		assert.equal(reference.counts.executions, 12); assert.equal(reference.counts.counts.word_bits, 32);
		assert.equal(reference.files[0].sha256, checkedRecordPhpWasmArchiveIndex);
		assert.equal(reference.artifacts.length, 3);
		assert.ok(reference.files.some(file => file.path.endsWith(`sources/${reference.revision}/src/analyze/NativeExports.lean`)));
		assert.ok(reference.files.some(file => file.path.endsWith("/runtime.json")));
		for(const file of reference.files)
		{
			if(!hashes.has(file.path)) hashes.set(file.path, sha256(await readFile(file.path)));
			assert.equal(hashes.get(file.path), file.sha256);
		}
	}
});

test("PHP-Wasm promotion refuses missing or corrupt runtime, compiler and installed provenance", async t => {
	const index = JSON.parse(await readFile(`${checkedRecordPhpWasmArchiveRoot}/index.json`));
	const routeFiles = ["start.json", "end.json", "run.tap", "runtime.json"
		, "records/report.json", "records/build-0/model.json"
		, "records/build-1/CheckedRecords.lean", "records/deployment/strict.php"
		, "records/deployment/weak.php", "records/executions/11.json"];
	const paths = ["index.json", "runner.mjs", "checker.mjs"
		, ...index.producerCommits.map(revision => `sources/${revision}/src/build/native-model.mjs`)
		, ...index.runs.flatMap(run => routeFiles.map(path => `${run.route}/${path}`))];
	for(const selected of paths)
	{
		const target = `${checkedRecordPhpWasmArchiveRoot}/${selected}`;
		await assert.rejects(checkedRecordPhpWasmReferences(async path => { assert.notEqual(path, target); return readFile(path); }));
		await assert.rejects(checkedRecordPhpWasmReferences(async path => {
			const bytes = await readFile(path); return path === target ? Buffer.concat([bytes, Buffer.from("changed")]) : bytes;
		}));
	}
	t.diagnostic(`${paths.length * 2} missing/corrupt original controls`);
});

test("PHP-Wasm promotion adds exactly four top-level checked-record cells without changing earlier claims", async () => {
	const current = await readTypeSurface(), previous = baseline(), unchanged = structuredClone(previous);
	const references = await checkedRecordPhpWasmReferences(), proposed = await promoteCheckedRecordPhpWasm(previous, references);
	assert.deepEqual(previous, unchanged); validateTypeSurface(proposed, current);
	assert.equal(previous.evidence.length, 468); assert.equal(previous.observations.length, 567);
	assert.equal(proposed.evidence.length, 472); assert.equal(proposed.observations.length, 571);
	assert.deepEqual(proposed.evidence.slice(0, 468), previous.evidence);
	assert.deepEqual(proposed.observations.slice(0, 567), previous.observations);
	const before = typeSurfaceCells(previous, current), after = typeSurfaceCells(proposed, current), changed = [];
	for(const [index, cell] of after.entries())
	{
		if(JSON.stringify(cell) === JSON.stringify(before[index])) continue;
		assert.equal(cell.shape, "checked-record"); assert.equal(cell.profile, "php-wasm");
		assert.ok(["ordinary-source", "reviewed-ir"].includes(cell.path)); assert.ok(["parameter", "result"].includes(cell.position));
		assert.equal(before[index].stages.installedExecution.state, "unreviewed");
		const matching = references.filter(item => item.sourcePath === cell.path && item.positions.includes(cell.position)).map(item => item.id);
		for(const value of Object.values(cell.stages))
		{
			assert.equal(value.state, "passed"); assert.deepEqual(value.evidence, matching);
			assert.equal(value.evidence.filter(id => id.includes("result-only")).length, cell.position === "result" ? 1 : 0);
		}
		changed.push(`${cell.path}/${cell.position}`);
	}
	assert.deepEqual(changed.sort(), ["ordinary-source/parameter", "ordinary-source/result", "reviewed-ir/parameter", "reviewed-ir/result"]);
	assert.equal(after.filter(cell => cell.shape === "checked-record" && cell.stages.installedExecution.state === "passed").length, 68);
	const restored = structuredClone(proposed); restored.evidence.splice(468); restored.observations.splice(567);
	assert.deepEqual(restored, previous);
	const history = JSON.parse(await readFile(checkedRecordPhpWasmPromotionHistoryPath));
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

test("PHP-Wasm promotion refuses forged references, overlapping positions and repeated promotion", async () => {
	const previous = baseline(), references = await checkedRecordPhpWasmReferences();
	for(const changed of [references.slice(1), [...references].reverse(), [...references, references[0]]])
		await assert.rejects(promoteCheckedRecordPhpWasm(previous, changed));
	const mutations = [item => { item.profiles.push("browser-javascript"); }
		, item => { item.positions.push("parameter"); }
		, item => { item.resultOnly = false; }
		, item => { item.revision = "0".repeat(40); }
		, item => { item.scope = "All dependent records pass"; }
		, item => { item.counts.executions++; }
		, item => { item.files[0].sha256 = "0".repeat(64); }
		, item => { item.artifacts.pop(); }];
	for(const mutate of mutations)
	{
		const changed = structuredClone(references); mutate(changed.at(-1));
		await assert.rejects(promoteCheckedRecordPhpWasm(previous, changed));
	}
	const promoted = await promoteCheckedRecordPhpWasm(previous, references);
	await assert.rejects(promoteCheckedRecordPhpWasm(promoted, references), /Already promoted/u);
	const overlap = structuredClone(previous); overlap.observations.push(promoted.observations.at(-1));
	await assert.rejects(promoteCheckedRecordPhpWasm(overlap, references), /Overlapping/u);
});

test("PHP checked-record documentation matches installed payloads and keeps untested positions open", async () => {
	const guide = await promotionSource("docs/php.md");
	const row = guide.split("\n").find(line => line.startsWith("| `Checked records and closed Nat indices`"));
	assert.ok(row.includes("Ordinary source: Installed checks passed (input, result)"));
	assert.ok(row.includes("Reviewed IR: Installed checks passed (input, result)"));
	assert.ok(row.includes("Not audited (field, callback input, callback result)"));
	assert.ok(row.includes(checkedRecordPhpWasmConversion));
	assert.ok(!row.includes("PHP-Wasm: Not audited"));
	for(const path of ["docs/php.md", "docs/lean/existing-package.md", "docs/reference/types.md"])
		assert.ok((await promotionSource(path)).includes("checked-record-php-wasm-promotion-20261011.md"));
	assert.ok(guide.includes("standalone result-only packages"));
	assert.ok(guide.includes("PHP 8.4.1"));
	assert.ok(guide.includes("Nested, refined, recursive or inherited checked records"));
	assert.ok(guide.includes("Brick\\Math\\BigInteger"));
});
