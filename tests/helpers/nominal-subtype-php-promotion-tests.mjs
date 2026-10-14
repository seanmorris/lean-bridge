/**
 * Keep native PHP nominal claims tied to original installed Composer evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { readTypeSurface, typeSurfaceCells, validateTypeSurface } from "../../src/adoption/type-surface.mjs";
import { nominalSubtypePhpArchive, nominalSubtypePhpReferences, promoteNominalSubtypePhp, nominalSubtypePhpConversion, nominalSubtypePhpLimit } from "./nominal-subtype-php-promotion.mjs";
import { nominalSubtypePhpPromotionPredecessor } from "./nominal-subtype-php-promotion-history.mjs";
import { beforeNominalSubtypeWitPromotionSource, beforeNominalSubtypeWitPromotionPins } from "./nominal-subtype-wit-promotion-history.mjs";
import { beforeNominalSubtypePhpWasmPromotionPins } from "./nominal-subtype-php-wasm-promotion-history.mjs";

const predecessor = () => JSON.parse(execFileSync("git", ["show", `${nominalSubtypePhpPromotionPredecessor}:docs/type-surface.v1.json`], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 }));

test("nominal PHP promotion authenticates four Composer selections and sixteen original executions", async () => {
	const references = await nominalSubtypePhpReferences();
	assert.deepEqual(references.map(item => [item.route, item.mode]), [["ordinary", "full"], ["ordinary", "result-only"], ["reviewed", "full"], ["reviewed", "result-only"]]);
	for(const reference of references)
	{
		assert.deepEqual(reference.profiles, ["php-native"]);
		assert.equal(reference.revision, "39f7f06e3db8f47b554ef039dc71c4bbc42ed98b");
		assert.equal(reference.sourcePath, reference.route === "ordinary" ? "ordinary-source" : "reviewed-ir");
		assert.equal(reference.counts.executions, 4);
		assert.equal(reference.counts.checks, reference.mode === "full" ? 17016 : 8448);
		assert.equal(reference.counts.rejections, reference.mode === "full" ? 4128 : 0);
		assert.equal(reference.counts.hostRejections, reference.mode === "full" ? 80 : 48);
		assert.equal(reference.counts.snapshotControls, 32);
		assert.deepEqual(reference.counts.runtime, { platform: "linux", arch: "x64", glibc: "2.36" });
		assert.equal(reference.counts.floor, "2.36");
		assert.equal(reference.counts.phpVersion, "8.2.33"); assert.equal(reference.counts.composerVersion, "2.5.5");
		assert.equal(reference.counts.dispatchObserved, false);
		assert.ok(reference.command.includes("--test-concurrency=1"));
		assert.ok(reference.scope.includes(nominalSubtypePhpLimit));
		assert.equal(reference.artifacts.length, 1);
		for(const suffix of [`/${reference.route}-${reference.mode}/run.tap`, "sources/src/analyze/NativeExports.lean", "checkers/package-records.mjs", "runner.mjs", "failed-reviewed-full-r1/run.tap"])
			assert.ok(reference.files.some(file => file.path.endsWith(suffix)), suffix);
	}
	assert.equal(references.reduce((sum, item) => sum + item.counts.checks, 0), 50928);
});

test("nominal PHP promotion refuses missing originals, invented claims and overlapping observations", async () => {
	const original = predecessor(), references = await nominalSubtypePhpReferences();
	const targets = ["index.json", "checkers/report.mjs", "runner.mjs"
		, "failed-reviewed-full-r1/run.tap"
		, "sources/src/analyze/NativeExports.lean"
		, ...references.flatMap(item => ["start.json", "end.json", "run.tap", "records/report.json", "records/environment.json", "records/tools.json"].map(path => `${item.route}-${item.mode}/${path}`))];
	for(const target of targets)
	{
		await assert.rejects(nominalSubtypePhpReferences(path => {
			if(path === `${nominalSubtypePhpArchive}/${target}`) throw new Error("Missing original");
			return readFile(path);
		}));
		await assert.rejects(nominalSubtypePhpReferences(async path => path === `${nominalSubtypePhpArchive}/${target}` ? Buffer.from("changed") : readFile(path)));
	}
	for(const altered of [references.slice(1), references.slice().reverse(), [...references, references[0]]])
		await assert.rejects(promoteNominalSubtypePhp(original, altered));
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
		, item => { item.counts.runtime.glibc = "2.38"; }
		, item => { item.counts.floor = "2.38"; }
		, item => { item.counts.checks = 1; }
		, item => { item.counts.executions = 32; }
		, item => { item.counts.phpVersion = "8.4.0"; }
		, item => { item.counts.composerVersion = "2.7.0"; }
		, item => { item.counts.archiveSha256 = "0".repeat(64); }];
	for(const change of changes)
	{
		const changed = structuredClone(references); change(changed[0]);
		await assert.rejects(promoteNominalSubtypePhp(original, changed));
	}
	const promoted = await promoteNominalSubtypePhp(original, references);
	await assert.rejects(promoteNominalSubtypePhp(promoted, references), /Already promoted/u);
	const mutations = [item => { item.profiles.push("php-wasm"); }
		, item => { item.positions.push("field"); }
		, item => { item.shapes.push("checked-record"); }
		, item => { item.stages.installedExecution.state = "unreviewed"; }];
	for(const id of ["native-subtype-php-native-ordinary-source", "reviewed-native-subtype-php-native"])
	{
		for(const mutate of mutations)
		{
			const changed = structuredClone(original); mutate(changed.observations.find(item => item.id === id));
			await assert.rejects(promoteNominalSubtypePhp(changed, references));
		}
		const missing = structuredClone(original);
		missing.observations = missing.observations.filter(item => item.id !== id);
		await assert.rejects(promoteNominalSubtypePhp(missing, references), /Missing/u);
		const overlap = structuredClone(original);
		overlap.observations.push({ ...structuredClone(original.observations.find(item => item.id === id)), id: "unreviewed-overlap" });
		await assert.rejects(promoteNominalSubtypePhp(overlap, references), /overlapping/u);
	}
});

test("nominal PHP promotion adds two field cells and supplements four existing cells only", async () => {
	const original = predecessor(), references = await nominalSubtypePhpReferences();
	const proposed = beforeNominalSubtypeWitPromotionPins(beforeNominalSubtypePhpWasmPromotionPins(await promoteNominalSubtypePhp(original, references)));
	const { document: current, ...contracts } = await readTypeSurface();
	const document = JSON.parse(beforeNominalSubtypeWitPromotionSource("docs/type-surface.v1.json", JSON.stringify(current, null, 2) + "\n"));
	validateTypeSurface(proposed, contracts);
	assert.equal(original.evidence.length, 504); assert.equal(proposed.evidence.length, 508);
	assert.equal(original.observations.length, 587); assert.equal(proposed.observations.length, 589);
	assert.deepEqual(proposed.evidence.slice(0, 504), original.evidence);
	assert.deepEqual(document.observations, proposed.observations);
	assert.deepEqual(document.evidence.slice(504), proposed.evidence.slice(504));
	const before = typeSurfaceCells(original, contracts), after = typeSurfaceCells(proposed, contracts);
	const changed = [], added = [];
	for(const [index, cell] of after.entries())
	{
		if(JSON.stringify(cell) === JSON.stringify(before[index])) continue;
		assert.equal(cell.shape, "subtype"); assert.equal(cell.profile, "php-native");
		assert.ok(["parameter", "result", "field"].includes(cell.position));
		const route = cell.path === "ordinary-source" ? "ordinary" : "reviewed";
		const ids = references.filter(item => item.route === route).map(item => item.id);
		for(const [name, stage] of Object.entries(cell.stages))
		{
			assert.equal(stage.state, "passed");
			assert.deepEqual(stage.evidence.filter(id => id.startsWith("nominal-subtype-php-")), ids);
			assert.ok(before[index].stages[name].evidence.every(id => stage.evidence.includes(id)));
			assert.equal(before[index].stages[name].state, cell.position === "field" ? "unreviewed" : "passed");
		}
		assert.ok(cell.conversionNote.includes(nominalSubtypePhpConversion));
		assert.ok(cell.limitations.includes(nominalSubtypePhpLimit));
		if(cell.position === "field") added.push(cell.id);
		changed.push(cell.id);
	}
	const expected = ["ordinary-source", "reviewed-ir"].flatMap(path => ["parameter", "result", "field"].map(position => `php-native/subtype/${path}/${position}`));
	assert.deepEqual(changed.sort(), expected.sort()); assert.equal(added.length, 2);
	assert.deepEqual(original, predecessor());
});

test("nominal PHP documentation distinguishes native Nat records from pending PHP-Wasm combinations", async () => {
	const authorPath = "docs/lean/existing-package.md";
	const author = beforeNominalSubtypeWitPromotionSource(authorPath, await readFile(authorPath, "utf8"));
	for(const prefix of ["| `Subtype` in acyclic", "| Lean-produced `Subtype` result without"])
	{
		const row = author.split("\n").find(line => line.startsWith(prefix));
		assert.ok(row.includes("Node installed; browser pending"));
		assert.equal((row.match(/Generated; pending/gu) ?? []).length, 1);
		assert.ok(row.includes("C/C++, Python, Ruby, Rust, C#, Java, Kotlin and native PHP installed; WIT/WASI pending"));
		assert.ok(row.includes("All four ABIs installed"));
		assert.ok(row.includes("Node, C/C++, Perl, Python, Ruby, Rust, C#, Java, Kotlin and native PHP ordinary/reviewed installed"));
	}
	for(const path of ["docs/lean/existing-package.md", "docs/lean/export-decisions.md", "docs/php.md", "docs/reference/types.md"])
		assert.ok((await readFile(path, "utf8")).includes("nominal-subtype-php-20261013.md"), path);
	const source = beforeNominalSubtypeWitPromotionSource("docs/php.md", await readFile("docs/php.md", "utf8"));
	assert.ok(source.includes("### Subtypes in copied records\n"));
	assert.ok(source.includes("Linux x64/glibc 2.36"));
	assert.match(source, /PHP 8\.2\.33 and Composer 2\.5\.5/u);
	assert.match(source, /PHP consumer source remains required\s+at runtime/u);
	assert.match(source, /PHP-Wasm nominal fields and results still need separate installed acceptance/u);
	assert.doesNotMatch(source, /Subtype fields in nominal records or variants, refined callback signatures and\nowned Subtypes remain unsupported/u);
	const row = source.split("\n").find(line => line.startsWith("| `Subtype /"));
	assert.ok(row.includes("Native PHP: Installed checks passed (input, result, field)"));
	assert.ok(row.includes("PHP-Wasm: Installed checks passed (input, result)"));
	assert.ok(row.includes("Not audited (field, callback input, callback result)"));
	assert.ok(row.includes(nominalSubtypePhpConversion));
});
