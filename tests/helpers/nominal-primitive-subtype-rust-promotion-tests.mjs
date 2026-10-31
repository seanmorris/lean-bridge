/**
 * Restrict nineteen-base nominal Rust claims to the installed input, result and field positions.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { readTypeSurface, typeSurfaceCells, validateTypeSurface } from "../../src/adoption/type-surface.mjs";
import { compileDocumentationPage } from "../../scripts/generate-site-content.mjs";
import { docPages } from "../../site/registry.mjs";
import { nominalPrimitiveSubtypeRustProducer } from "./nominal-primitive-subtype-rust-provenance.mjs";
import { nominalPrimitiveSubtypeRustPromotionHistoryPath, nominalPrimitiveSubtypeRustPromotionPredecessor } from "./nominal-primitive-subtype-rust-promotion-history.mjs";
import {
	sourceAtHistoryMilestone, withHistoryMilestoneSourcePins
	, withHistorySourcePins
} from "./source-history-test-source.mjs";
import { typeSurfaceContractsAtProducer } from "./producer-source.mjs";
import {
	nominalPrimitiveSubtypeRustConversion
	, nominalPrimitiveSubtypeRustField
	, nominalPrimitiveSubtypeRustLimit
	, nominalPrimitiveSubtypeRustProfiles
	, nominalPrimitiveSubtypeRustReferences
	, promoteNominalPrimitiveSubtypeRust
} from "./nominal-primitive-subtype-rust-promotion.mjs";

const predecessor = () => JSON.parse(execFileSync("git", ["show", `${nominalPrimitiveSubtypeRustPromotionPredecessor}:docs/type-surface.v1.json`], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 }));

test("primitive-base Rust promotion authenticates four installed selections on both source routes", async () => {
	const references = await nominalPrimitiveSubtypeRustReferences();
	assert.deepEqual(references.map(item => [item.route, item.mode]), [["ordinary", "full"], ["ordinary", "result-only"], ["reviewed", "full"], ["reviewed", "result-only"]]);
	assert.deepEqual(references.map(item => item.revision), Array(4).fill(nominalPrimitiveSubtypeRustProducer));
	for(const reference of references)
	{
		assert.deepEqual(reference.profiles, nominalPrimitiveSubtypeRustProfiles);
		assert.equal(reference.revision, reference.counts.producerCommit);
		assert.equal(reference.sourcePath, reference.route === "ordinary" ? "ordinary-source" : "reviewed-ir");
		const full = reference.mode === "full";
		assert.deepEqual(reference.counts.counts, { checks: full ? 1332 : 601, rejections: full ? 306 : 0, rounds: 256, snapshotControls: 30, wordBits: 64 });
		assert.equal(reference.counts.executions, 3); assert.equal(reference.counts.dispatchObserved, false);
		assert.deepEqual(reference.counts.runtime, { platform: "linux", arch: "x64", glibc: "2.36" });
		assert.equal(reference.counts.floor, "2.36");
		assert.equal(reference.counts.toolchain.cargo.run.stdout, "cargo 1.90.0 (840b83a10 2025-07-30)\n");
		assert.equal(reference.counts.toolchain.rustc.run.stdout, "rustc 1.90.0 (1159e78c4 2025-09-14)\n");
		assert.equal(reference.counts.generatorModules, 21); assert.equal(reference.counts.modelControls, full ? 42 : 23);
		assert.equal(reference.counts.packageControls, 6); assert.equal(reference.counts.environmentControls, full ? 60 : 61);
		assert.equal(reference.counts.executionControls, 30); assert.equal(reference.counts.recordControls, reference.counts.records * 2);
		assert.equal(reference.counts.loadCeiling, 8);
		assert.ok(reference.command.includes("CARGO_BUILD_JOBS='1'"));
		assert.ok(reference.command.includes("LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_RUST_MAX_LOAD='8'"));
		assert.ok(reference.command.includes("'--test-concurrency=1'"));
		assert.ok(reference.scope.includes(nominalPrimitiveSubtypeRustLimit));
		assert.equal(reference.artifacts.length, 2);
		assert.ok(reference.artifacts.some(item => item.path.endsWith(".crate")));
		assert.ok(reference.artifacts.some(item => item.path.endsWith("rust-dependencies.tar.gz")));
		assert.equal(reference.files.filter(file => file.path.endsWith(".crate")).length, 1);
		const label = `${reference.route}-${reference.mode}`;
		for(const suffix of [
			"sources/src/backends/rust/copied-values.mjs"
			, "sources/tests/fixtures/nominal-primitive-subtype-consumers/rust.rs"
			, `${label}/producer/run.tap`
			, `${label}/producer/verification.json`
			, `${label}/records/consumer.rs`
			, `${label}/records/dependency-handoff/rust-dependencies.tar.gz`
		]) assert.ok(reference.files.some(file => file.path.endsWith(suffix)), suffix);
	}
});

test("primitive-base Rust promotion rejects narrowed references, new hosts and overlapping observations", async () => {
	const original = predecessor(), references = await nominalPrimitiveSubtypeRustReferences();
	for(const changed of [references.slice(1), references.slice().reverse(), [...references, references[0]]])
		await assert.rejects(promoteNominalPrimitiveSubtypeRust(original, changed));
	for(const mutate of [
		item => { item.profiles.push("python"); }
		, item => { item.route = "reviewed"; }, item => { item.mode = "result-only"; }
		, item => { item.sourcePath = "reviewed-ir"; }
		, item => { item.revision = "0".repeat(40); }
		, item => { item.counts.dispatchObserved = true; }
		, item => { item.counts.counts.wordBits = 32; }
		, item => { item.counts.counts.checks = 1; }
		, item => { item.counts.executions = 2; }
		, item => { item.counts.loadCeiling = 6; }
		, item => { item.counts.toolchain.rustc.run.stdout = "rustc 1.89.0\n"; }
		, item => { item.counts.runtime.glibc = "2.38"; }
		, item => { item.counts.floor = "2.38"; }
		, item => { item.scope = "All Subtypes pass"; }
		, item => { item.command = "node --test"; }, item => { item.files.pop(); }
		, item => { item.files[0].sha256 = "0".repeat(64); }
		, item => { item.artifacts.pop(); }
	]) {
		const changed = structuredClone(references); mutate(changed[0]);
		await assert.rejects(promoteNominalPrimitiveSubtypeRust(original, changed));
	}
	const promoted = await promoteNominalPrimitiveSubtypeRust(original, references);
	await assert.rejects(promoteNominalPrimitiveSubtypeRust(promoted, references), /Already promoted/u);
	for(const extra of [false, true])
	{
		const changed = structuredClone(original);
		const position = changed.observations.findIndex(item => item.id === "nominal-subtype-rust-fields-ordinary-source");
		assert.ok(position >= 0);
		if(extra) changed.observations.push({ ...structuredClone(changed.observations[position]), id: "overlapping-field" });
		else changed.observations.splice(position, 1);
		await assert.rejects(promoteNominalPrimitiveSubtypeRust(changed, references), /Missing or overlapping/u);
	}
	assert.deepEqual(original, predecessor());
});

test("primitive-base Rust promotion supplements six existing Rust cells and preserves all other observations", async () => {
	const original = predecessor(), references = await nominalPrimitiveSubtypeRustReferences();
	const proposed = withHistoryMilestoneSourcePins(
		nominalPrimitiveSubtypeRustPromotionHistoryPath
		, await promoteNominalPrimitiveSubtypeRust(original, references)
	);
	const { document: live } = await readTypeSurface();
	const contracts = typeSurfaceContractsAtProducer(
		nominalPrimitiveSubtypeRustPromotionPredecessor
	);
	const document = JSON.parse(sourceAtHistoryMilestone(
		nominalPrimitiveSubtypeRustPromotionHistoryPath
		, "docs/type-surface.v1.json"
	));
	assert.ok(live.evidence.length >= document.evidence.length);
	validateTypeSurface(proposed, contracts);
	assert.equal(proposed.evidence.length, original.evidence.length + 4); assert.equal(proposed.observations.length, original.observations.length);
	assert.deepEqual(withHistorySourcePins(
		nominalPrimitiveSubtypeRustPromotionHistoryPath, proposed
	).evidence.slice(0, original.evidence.length), original.evidence);
	assert.deepEqual(document, proposed);
	assert.deepEqual(document.observations, proposed.observations);
	assert.deepEqual(document.evidence.slice(original.evidence.length), proposed.evidence.slice(original.evidence.length));
	const changedObservations = proposed.observations.filter((item, index) => JSON.stringify(item) !== JSON.stringify(original.observations[index]));
	assert.equal(changedObservations.length, 4);
	const before = typeSurfaceCells(original, contracts), after = typeSurfaceCells(proposed, contracts), changed = [];
	for(const [index, cell] of after.entries())
	{
		if(JSON.stringify(cell) === JSON.stringify(before[index])) continue;
		assert.equal(cell.shape, "subtype"); assert.equal(cell.profile, "rust");
		assert.ok(["parameter", "result", "field"].includes(cell.position));
		const route = cell.path === "ordinary-source" ? "ordinary" : "reviewed";
		const ids = references.filter(item => item.route === route).map(item => item.id);
		for(const [name, stage] of Object.entries(cell.stages))
		{
			assert.equal(stage.state, before[index].stages[name].state); assert.equal(stage.state, "passed");
			assert.deepEqual(stage.evidence.filter(id => id.startsWith("nominal-primitive-subtype-rust-")), ids);
			assert.ok(before[index].stages[name].evidence.every(id => stage.evidence.includes(id)));
		}
		assert.ok(cell.conversionNote.includes(nominalPrimitiveSubtypeRustConversion));
		if(cell.position === "field") assert.equal(cell.hostType, nominalPrimitiveSubtypeRustField);
		else assert.equal(cell.hostType, before[index].hostType);
		changed.push(cell.id);
	}
	assert.deepEqual(changed.sort(), ["ordinary-source", "reviewed-ir"].flatMap(path => ["parameter", "result", "field"].map(position => `rust/subtype/${path}/${position}`)).sort());
	assert.deepEqual(original, predecessor());
});

test("primitive-base Rust docs name all nineteen bases without claiming pending host or callback matrices", async () => {
	for(const path of ["docs/consume/rust.md", "docs/javascript-typescript.md", "docs/lean/existing-package.md", "docs/lean/export-decisions.md", "docs/reference/types.md"])
	{
		const source = sourceAtHistoryMilestone(
			nominalPrimitiveSubtypeRustPromotionHistoryPath, path
		);
		assert.ok(source.includes("nominal-primitive-subtype-rust-20261015/index.json"), path);
		const compiled = await compileDocumentationPage(source, docPages.find(item => item.source === path), { revision: nominalPrimitiveSubtypeRustPromotionPredecessor });
		assert.ok(compiled.links.some(link => link.endsWith("nominal-primitive-subtype-rust-20261015/index.json")), path);
		if(path === "docs/consume/rust.md")
			assert.ok(compiled.links.includes("https://github.com/seanmorris/lean-bridge/actions/workflows/nominal-primitive-subtype-rust.yml"));
	}
	const rust = sourceAtHistoryMilestone(
		nominalPrimitiveSubtypeRustPromotionHistoryPath, "docs/consume/rust.md"
	);
	for(const text of ["all nineteen primitive bases", "64-bit", "normalization", "Linux x64/glibc 2.36", "Rust and Cargo 1.90.0", "standalone result-only"])
		assert.ok(rust.includes(text), text);
	assert.doesNotMatch(rust, /cover `Nat` record and variant fields[^]*Other primitive-base nominal fixtures/u);
	const row = rust.split("\n").find(line => line.startsWith("| `Subtype /"));
	assert.ok(row.includes(nominalPrimitiveSubtypeRustField));
	for(const route of ["Ordinary source", "Reviewed IR"])
		assert.ok(row.includes(`${route}: Installed checks passed (input, result, field)`));
	assert.ok(row.includes("Not audited (callback input, callback result)"));
	assert.ok(row.includes(nominalPrimitiveSubtypeRustConversion));
});
