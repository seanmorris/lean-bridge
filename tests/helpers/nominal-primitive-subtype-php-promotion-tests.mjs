/**
 * Restrict nineteen-base nominal native PHP claims to installed positions.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { readTypeSurface, typeSurfaceCells, validateTypeSurface } from "../../src/adoption/type-surface.mjs";
import { compileDocumentationPage } from "../../scripts/generate-site-content.mjs";
import { docPages } from "../../site/registry.mjs";
import { nominalPrimitiveSubtypePhpPromotionHistoryPath, nominalPrimitiveSubtypePhpPromotionPredecessor } from "./nominal-primitive-subtype-php-promotion-history.mjs";
import {
	sourceAtHistoryMilestone, withHistoryMilestoneSourcePins
	, withHistorySourcePins
} from "./source-history-test-source.mjs";
import { typeSurfaceContractsAtProducer } from "./producer-source.mjs";
import { nominalPrimitiveSubtypePhpProducer } from "./nominal-primitive-subtype-php-provenance.mjs";
import {
	nominalPrimitiveSubtypePhpConversion
	, nominalPrimitiveSubtypePhpField
	, nominalPrimitiveSubtypePhpLimit
	, nominalPrimitiveSubtypePhpProfiles
	, nominalPrimitiveSubtypePhpReferences
	, promoteNominalPrimitiveSubtypePhp
} from "./nominal-primitive-subtype-php-promotion.mjs";

const predecessor = () => JSON.parse(execFileSync("git", [
	"show"
	, `${nominalPrimitiveSubtypePhpPromotionPredecessor}:docs/type-surface.v1.json`
], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 }));

test("primitive-base native PHP promotion authenticates four installed selections", async () => {
	const references = await nominalPrimitiveSubtypePhpReferences();
	assert.deepEqual(references.map(item => [item.route, item.mode]), [
		["ordinary", "full"], ["ordinary", "result-only"]
		, ["reviewed", "full"], ["reviewed", "result-only"]
	]);
	assert.deepEqual(references.map(item => item.revision),
		Array(4).fill(nominalPrimitiveSubtypePhpProducer));
	for(const reference of references)
	{
		assert.deepEqual(reference.profiles, nominalPrimitiveSubtypePhpProfiles);
		assert.equal(reference.revision, reference.counts.producerCommit);
		assert.equal(reference.sourcePath,
			reference.route === "ordinary" ? "ordinary-source" : "reviewed-ir");
		const full = reference.mode === "full";
		assert.deepEqual(reference.counts.counts, {
			checks: full ? 1821 : 612, rejections: full ? 283 : 0
			, hostRejections: 8, rounds: 256, snapshotControls: 12, wordBits: 64
		});
		assert.equal(reference.counts.executions, 4);
		assert.equal(reference.counts.dispatchObserved, false);
		assert.deepEqual(reference.counts.runtime,
			{ platform: "linux", arch: "x64", glibc: "2.36" });
		assert.equal(reference.counts.floor, "2.36");
		assert.equal(reference.counts.phpVersion, "8.2.33");
		assert.equal(reference.counts.composerVersion, "2.5.5");
		assert.equal(reference.counts.generatorModules, 22);
		assert.equal(reference.counts.modelControls, full ? 6 : 5);
		assert.equal(reference.counts.packageControls, 4);
		assert.equal(reference.counts.environmentControls, 10);
		assert.equal(reference.counts.executionControls, 40);
		assert.equal(reference.counts.recordControls, reference.counts.records * 2);
		assert.equal(reference.counts.loadCeiling, 8);
		assert.ok(reference.command.includes("LEAN_NUM_THREADS='1'"));
		assert.ok(reference.command.includes("LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_PHP_MAX_LOAD='8'"));
		assert.ok(reference.command.includes("'--test-concurrency=1'"));
		assert.ok(reference.scope.includes(nominalPrimitiveSubtypePhpLimit));
		assert.equal(reference.artifacts.length, 1);
		assert.ok(reference.artifacts[0].path.endsWith(".zip"));
		assert.equal(reference.files.filter(file => file.path.endsWith(".zip")).length, 1);
		const label = `${reference.route}-${reference.mode}`;
		for(const suffix of [
			"sources/src/backends/php/copied-values.mjs"
			, "sources/tests/fixtures/nominal-primitive-subtype-consumers/php-native.php"
			, "checkers/nominal-primitive-subtype-php-report.mjs"
			, `${label}/records/consumer.php`, `${label}/records/report.json`
			, `${label}/records/handoff/archives/example-nominalprimitivesubtypes-1.0.0-linux-x86_64.zip`
		]) assert.ok(reference.files.some(file => file.path.endsWith(suffix)), suffix);
	}
});

test("primitive-base native PHP promotion rejects narrowed references and overlaps", async () => {
	const original = predecessor(), references = await nominalPrimitiveSubtypePhpReferences();
	for(const changed of [references.slice(1), references.slice().reverse()
		, [...references, references[0]]])
		await assert.rejects(promoteNominalPrimitiveSubtypePhp(original, changed));
	for(const mutate of [
		item => { item.profiles.push("php-wasm"); }
		, item => { item.route = "reviewed"; }, item => { item.mode = "result-only"; }
		, item => { item.sourcePath = "reviewed-ir"; }
		, item => { item.revision = "0".repeat(40); }
		, item => { item.counts.dispatchObserved = true; }
		, item => { item.counts.counts.wordBits = 32; }
		, item => { item.counts.counts.checks = 1; }
		, item => { item.counts.executions = 2; }
		, item => { item.counts.loadCeiling = 6; }
		, item => { item.counts.phpVersion = "8.4.1"; }
		, item => { item.counts.composerVersion = "2.7.0"; }
		, item => { item.counts.runtime.glibc = "2.38"; }
		, item => { item.counts.floor = "2.38"; }
		, item => { item.scope = "All Subtypes pass"; }
		, item => { item.command = "node --test"; }, item => { item.files.pop(); }
		, item => { item.files[0].sha256 = "0".repeat(64); }
		, item => { item.artifacts.pop(); }
	]) {
		const changed = structuredClone(references); mutate(changed[0]);
		await assert.rejects(promoteNominalPrimitiveSubtypePhp(original, changed));
	}
	const promoted = await promoteNominalPrimitiveSubtypePhp(original, references);
	await assert.rejects(promoteNominalPrimitiveSubtypePhp(promoted, references),
		/Already promoted/u);
	for(const extra of [false, true])
	{
		const changed = structuredClone(original);
		const position = changed.observations.findIndex(item =>
			item.id === "nominal-subtype-php-fields-ordinary-source");
		assert.ok(position >= 0);
		if(extra) changed.observations.push({
			...structuredClone(changed.observations[position]), id: "overlapping-field"
		});
		else changed.observations.splice(position, 1);
		await assert.rejects(promoteNominalPrimitiveSubtypePhp(changed, references),
			/Missing or overlapping/u);
	}
	assert.deepEqual(original, predecessor());
});

test("primitive-base native PHP promotion supplements six cells only", async () => {
	const original = predecessor(), references = await nominalPrimitiveSubtypePhpReferences();
	const proposed = withHistoryMilestoneSourcePins(
		nominalPrimitiveSubtypePhpPromotionHistoryPath
		, await promoteNominalPrimitiveSubtypePhp(original, references)
	);
	const { document: live } = await readTypeSurface();
	const contracts = typeSurfaceContractsAtProducer(
		nominalPrimitiveSubtypePhpPromotionPredecessor
	);
	const document = JSON.parse(sourceAtHistoryMilestone(
		nominalPrimitiveSubtypePhpPromotionHistoryPath
		, "docs/type-surface.v1.json"
	));
	assert.ok(live.evidence.length >= document.evidence.length);
	validateTypeSurface(proposed, contracts);
	assert.equal(proposed.evidence.length, original.evidence.length + 4);
	assert.equal(proposed.observations.length, original.observations.length);
	assert.deepEqual(withHistorySourcePins(
		nominalPrimitiveSubtypePhpPromotionHistoryPath, proposed
	).evidence.slice(0, original.evidence.length), original.evidence);
	assert.deepEqual(document, proposed);
	assert.deepEqual(document.observations, proposed.observations);
	assert.deepEqual(document.evidence.slice(original.evidence.length),
		proposed.evidence.slice(original.evidence.length));
	const changedObservations = proposed.observations.filter((item, index) =>
		JSON.stringify(item) !== JSON.stringify(original.observations[index]));
	assert.equal(changedObservations.length, 4);
	const before = typeSurfaceCells(original, contracts);
	const after = typeSurfaceCells(proposed, contracts), changed = [];
	for(const [index, cell] of after.entries())
	{
		if(JSON.stringify(cell) === JSON.stringify(before[index])) continue;
		assert.equal(cell.shape, "subtype"); assert.equal(cell.profile, "php-native");
		assert.ok(["parameter", "result", "field"].includes(cell.position));
		const route = cell.path === "ordinary-source" ? "ordinary" : "reviewed";
		const ids = references.filter(item => item.route === route).map(item => item.id);
		for(const [name, stage] of Object.entries(cell.stages))
		{
			assert.equal(stage.state, before[index].stages[name].state);
			assert.equal(stage.state, "passed");
			assert.deepEqual(stage.evidence.filter(id =>
				id.startsWith("nominal-primitive-subtype-php-")), ids);
			assert.ok(before[index].stages[name].evidence.every(id => stage.evidence.includes(id)));
		}
		assert.ok(cell.conversionNote.includes(nominalPrimitiveSubtypePhpConversion));
		if(cell.position === "field") assert.equal(cell.hostType, nominalPrimitiveSubtypePhpField);
		else assert.equal(cell.hostType, before[index].hostType);
		changed.push(cell.id);
	}
	assert.deepEqual(changed.sort(), ["ordinary-source", "reviewed-ir"]
		.flatMap(path => ["parameter", "result", "field"]
			.map(position => `php-native/subtype/${path}/${position}`)).sort());
	assert.deepEqual(original, predecessor());
});

test("primitive-base native PHP docs name the accepted boundary", async () => {
	for(const path of ["docs/php.md", "docs/lean/existing-package.md"
		, "docs/lean/export-decisions.md", "docs/reference/types.md"]){
		const source = sourceAtHistoryMilestone(
			nominalPrimitiveSubtypePhpPromotionHistoryPath, path
		);
		assert.ok(source.includes("nominal-primitive-subtype-php-20261015/index.json"), path);
		const compiled = await compileDocumentationPage(source,
			docPages.find(item => item.source === path)
			, { revision: nominalPrimitiveSubtypePhpPromotionPredecessor });
		assert.ok(compiled.links.some(link =>
			link.endsWith("nominal-primitive-subtype-php-20261015/index.json")), path);
		if(path === "docs/php.md") assert.ok(compiled.links.includes(
			"https://github.com/seanmorris/lean-bridge/actions/workflows/nominal-primitive-subtype-php.yml"
		));
		}
	const php = sourceAtHistoryMilestone(
		nominalPrimitiveSubtypePhpPromotionHistoryPath, "docs/php.md"
	);
	for(const text of ["all nineteen primitive bases", "64-bit", "normalization"
		, "Linux x64/glibc 2.36", "PHP 8.2.33", "Composer 2.5.5"
		, "standalone result-only"])
		assert.ok(php.includes(text), text);
	assert.match(php, /consumer PHP source remains required/ui);
	const row = php.split("\n").find(line => line.startsWith("| `Subtype /"));
	assert.ok(row.includes(nominalPrimitiveSubtypePhpField));
	for(const route of ["Ordinary source", "Reviewed IR"])
		assert.ok(row.includes(`${route}: Installed checks passed (input, result, field)`));
	assert.ok(row.includes("Not audited (callback input, callback result)"));
	assert.ok(row.includes(nominalPrimitiveSubtypePhpConversion));
});
