/**
 * Restrict nineteen-base nominal Java and Kotlin claims to installed positions.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { readTypeSurface, typeSurfaceCells, validateTypeSurface } from "../../src/adoption/type-surface.mjs";
import { compileDocumentationPage } from "../../scripts/generate-site-content.mjs";
import { docPages } from "../../site/registry.mjs";
import { nominalPrimitiveSubtypeJvmPromotionHistoryPath, nominalPrimitiveSubtypeJvmPromotionPredecessor } from "./nominal-primitive-subtype-jvm-promotion-history.mjs";
import {
	sourceAtHistoryMilestone, withHistoryMilestoneSourcePins
	, withHistorySourcePins
} from "./source-history-test-source.mjs";
import { nominalPrimitiveSubtypeJvmProducer } from "./nominal-primitive-subtype-jvm-provenance.mjs";
import {
	nominalPrimitiveSubtypeJvmConversion
	, nominalPrimitiveSubtypeJvmField
	, nominalPrimitiveSubtypeJvmLimit
	, nominalPrimitiveSubtypeJvmProfiles
	, nominalPrimitiveSubtypeJvmReferences
	, promoteNominalPrimitiveSubtypeJvm
} from "./nominal-primitive-subtype-jvm-promotion.mjs";
import { nominalSubtypeJvmConversion, nominalSubtypeJvmLimit } from "./nominal-subtype-jvm-promotion.mjs";

const predecessor = () => JSON.parse(execFileSync("git", ["show", `${nominalPrimitiveSubtypeJvmPromotionPredecessor}:docs/type-surface.v1.json`], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 }));

test("primitive-base JVM promotion authenticates four installed selections", async () => {
	const references = await nominalPrimitiveSubtypeJvmReferences();
	assert.deepEqual(references.map(item => [item.route, item.mode, item.counts.attempt]), [
		["ordinary", "full", "r2"], ["ordinary", "result-only", "r1"]
		, ["reviewed", "full", "r1"], ["reviewed", "result-only", "r1"]
	]);
	assert.deepEqual(references.map(item => item.revision), Array(4).fill(nominalPrimitiveSubtypeJvmProducer));
	for(const reference of references)
	{
		assert.deepEqual(reference.profiles, nominalPrimitiveSubtypeJvmProfiles);
		assert.equal(reference.revision, reference.counts.producerCommit);
		assert.equal(reference.sourcePath, reference.route === "ordinary" ? "ordinary-source" : "reviewed-ir");
		const full = reference.mode === "full";
		assert.equal(reference.counts.checks, full ? 7380 : 3552); assert.equal(reference.counts.rejections, full ? 1698 : 0);
		assert.equal(reference.counts.hostRejections, 39); assert.equal(reference.counts.executions, 6);
		assert.equal(reference.counts.snapshotControls, 54); assert.equal(reference.counts.loadCeiling, 8);
		assert.deepEqual(reference.counts.runtime, { platform: "linux", arch: "x64", glibc: "2.36" });
		assert.equal(reference.counts.floor, "2.36");
		assert.match(reference.counts.tools.java, /^openjdk 22\.0\.2 /u); assert.equal(reference.counts.tools.javac, "javac 22.0.2");
		assert.match(reference.counts.tools.kotlinc, /kotlinc-jvm 2\.2\.0 /u);
		assert.equal(reference.counts.executionControls, 48); assert.equal(reference.counts.probeControls, 22);
		assert.equal(reference.counts.packageControls, 4); assert.equal(reference.counts.resourceControls, 8);
		assert.equal(reference.counts.modelControls, full ? 6 : 4);
		assert.equal(reference.counts.recordControls, { "ordinary-full": 280, "ordinary-result-only": 274, "reviewed-full": 284, "reviewed-result-only": 278 }[`${reference.route}-${reference.mode}`]);
		assert.equal(reference.counts.archiveSha256, reference.artifacts[0].sha256);
		assert.ok(reference.command.includes("LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_JVM_MAX_LOAD='8'"));
		assert.ok(reference.command.includes("LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR='2.36'"));
		assert.ok(reference.command.includes("'--test-concurrency=1'")); assert.ok(reference.command.includes("'/usr/bin/nice'"));
		assert.ok(reference.scope.includes(nominalPrimitiveSubtypeJvmLimit));
		assert.deepEqual(reference.artifacts.map(item => item.path), ["archives/nominalprimitivesubtypes-1.0.0.jar", "archives/nominalprimitivesubtypes-1.0.0.pom"]);
		const label = `${reference.route}-${reference.mode}`;
		for(const suffix of [
			"sources/src/backends/jvm/copied-model.mjs"
			, "sources/tests/fixtures/nominal-primitive-subtype-consumers/java.java"
			, "sources/tests/fixtures/nominal-primitive-subtype-consumers/kotlin.kt"
			, "checkers/report.mjs", "checkers/provenance.mjs"
			, "runners/run-vo1495-nominal-primitive-jvm-controls-e0fed7f-v2.mjs"
			, `${label}/producer/run.tap`, `${label}/controls/controls.json`
			, `${label}/records/consumer.java`, `${label}/records/consumer.kt`
			, `${label}/records/report.json`
		]) assert.ok(reference.files.some(file => file.path.endsWith(suffix)), suffix);
	}
});

test("primitive-base JVM promotion rejects narrowed references and overlaps", async () => {
	const original = predecessor(), references = await nominalPrimitiveSubtypeJvmReferences();
	for(const changed of [references.slice(1), references.slice().reverse(), [...references, references[0]]])
		await assert.rejects(promoteNominalPrimitiveSubtypeJvm(original, changed));
	for(const mutate of [
		item => { item.profiles.push("c"); }
		, item => { item.route = "reviewed"; }, item => { item.mode = "result-only"; }
		, item => { item.sourcePath = "reviewed-ir"; }
		, item => { item.revision = "0".repeat(40); }
		, item => { item.counts.checks = 1; }
		, item => { item.counts.attempt = "r1"; }
		, item => { item.counts.loadCeiling = 6; }
		, item => { item.counts.tools.kotlinc = "0.0.0"; }
		, item => { item.counts.runtime.glibc = "2.38"; }
		, item => { item.counts.floor = "2.38"; }
		, item => { item.scope = "All Subtypes pass"; }
		, item => { item.command = "node --test"; }, item => { item.files.pop(); }
		, item => { item.files[0].sha256 = "0".repeat(64); }
		, item => { item.artifacts.pop(); }
	]) {
		const changed = structuredClone(references); mutate(changed[0]);
		await assert.rejects(promoteNominalPrimitiveSubtypeJvm(original, changed));
	}
	const promoted = await promoteNominalPrimitiveSubtypeJvm(original, references);
	await assert.rejects(promoteNominalPrimitiveSubtypeJvm(promoted, references), /Already promoted/u);
	for(const extra of [false, true])
	{
		const changed = structuredClone(original);
		const position = changed.observations.findIndex(item => item.id === "nominal-subtype-jvm-fields-ordinary-source");
		assert.ok(position >= 0);
		if(extra) changed.observations.push({ ...structuredClone(changed.observations[position]), id: "overlapping-field" });
		else changed.observations.splice(position, 1);
		await assert.rejects(promoteNominalPrimitiveSubtypeJvm(changed, references), /Missing or overlapping/u);
	}
	assert.deepEqual(original, predecessor());
});

test("primitive-base JVM promotion supplements twelve cells only", async () => {
	const original = predecessor(), references = await nominalPrimitiveSubtypeJvmReferences();
	const proposed = withHistoryMilestoneSourcePins(
		nominalPrimitiveSubtypeJvmPromotionHistoryPath
		, await promoteNominalPrimitiveSubtypeJvm(original, references)
	);
	const { document: live, ...contracts } = await readTypeSurface();
	const document = JSON.parse(sourceAtHistoryMilestone(
		nominalPrimitiveSubtypeJvmPromotionHistoryPath
		, "docs/type-surface.v1.json"
	));
	assert.ok(live.evidence.length >= document.evidence.length);
	validateTypeSurface(proposed, contracts);
	assert.equal(proposed.evidence.length, original.evidence.length + 4);
	assert.equal(proposed.observations.length, original.observations.length);
	assert.deepEqual(withHistorySourcePins(
		nominalPrimitiveSubtypeJvmPromotionHistoryPath, proposed
	).evidence.slice(0, original.evidence.length), original.evidence);
	assert.deepEqual(document, proposed);
	assert.deepEqual(document.observations, proposed.observations);
	assert.deepEqual(document.evidence.slice(original.evidence.length), proposed.evidence.slice(original.evidence.length));
	const changedObservations = proposed.observations.filter((item, index) => JSON.stringify(item) !== JSON.stringify(original.observations[index]));
	assert.deepEqual(changedObservations.map(item => item.id).sort(), [
		"native-subtype-java-kotlin-ordinary-source"
		, "reviewed-native-subtype-java", "reviewed-native-subtype-kotlin"
		, "nominal-subtype-jvm-fields-ordinary-source"
		, "nominal-subtype-jvm-fields-reviewed-ir"
	].sort());
	for(const observation of changedObservations)
	{
		assert.ok(!observation.limitations.includes(nominalSubtypeJvmLimit));
		assert.ok(!observation.conversionNotes.subtype.includes(nominalSubtypeJvmConversion));
	}
	const before = typeSurfaceCells(original, contracts), after = typeSurfaceCells(proposed, contracts), changed = [];
	for(const [index, cell] of after.entries())
	{
		if(JSON.stringify(cell) === JSON.stringify(before[index])) continue;
		assert.equal(cell.shape, "subtype"); assert.ok(nominalPrimitiveSubtypeJvmProfiles.includes(cell.profile));
		assert.ok(["parameter", "result", "field"].includes(cell.position));
		const route = cell.path === "ordinary-source" ? "ordinary" : "reviewed";
		const ids = references.filter(item => item.route === route).map(item => item.id);
		for(const [name, stage] of Object.entries(cell.stages))
		{
			assert.equal(stage.state, before[index].stages[name].state); assert.equal(stage.state, "passed");
			assert.deepEqual(stage.evidence.filter(id => id.startsWith("nominal-primitive-subtype-jvm-")), ids);
			assert.ok(before[index].stages[name].evidence.every(id => stage.evidence.includes(id)));
		}
		assert.ok(cell.conversionNote.includes(nominalPrimitiveSubtypeJvmConversion));
		assert.ok(cell.limitations.includes(nominalPrimitiveSubtypeJvmLimit));
		if(cell.position === "field") assert.equal(cell.hostType, nominalPrimitiveSubtypeJvmField);
		else assert.equal(cell.hostType, before[index].hostType);
		changed.push(cell.id);
	}
	assert.deepEqual(changed.sort(), nominalPrimitiveSubtypeJvmProfiles.flatMap(profile => ["ordinary-source", "reviewed-ir"]
		.flatMap(path => ["parameter", "result", "field"].map(position => `${profile}/subtype/${path}/${position}`))).sort());
	assert.deepEqual(original, predecessor());
});

test("primitive-base JVM docs name the accepted boundary", async () => {
	for(const path of ["docs/consume/java.md", "docs/consume/kotlin.md", "docs/lean/existing-package.md", "docs/lean/export-decisions.md", "docs/reference/types.md"])
	{
		const source = await readFile(path, "utf8");
		assert.ok(source.includes("nominal-primitive-subtype-jvm-20261015/index.json"), path);
		const compiled = await compileDocumentationPage(source, docPages.find(item => item.source === path), { revision: nominalPrimitiveSubtypeJvmPromotionPredecessor });
		assert.ok(compiled.links.some(link => link.endsWith("nominal-primitive-subtype-jvm-20261015/index.json")), path);
		if(path.startsWith("docs/consume/"))
			assert.ok(compiled.links.includes("https://github.com/seanmorris/lean-bridge/actions/workflows/nominal-primitive-subtype-jvm.yml"), path);
	}
	for(const [path, words] of [
		["docs/consume/java.md", ["`boolean`", "`byte[]` for `ByteArray`", "`int`\nUnicode scalars"]]
		, ["docs/consume/kotlin.md", ["`Boolean`", "`ByteArray`, and `Int`\nUnicode scalars"]]
	]) {
		const guide = await readFile(path, "utf8");
		for(const text of [...words, "all nineteen primitive bases", "64-bit machine words", "`PacketPair`", "JDK 22.0.2 and Kotlin 2.2.0", "Linux x64/glibc 2.36", "source-free", "load-admission ceiling of 8"])
			assert.ok(guide.includes(text), `${path}: ${text}`);
		assert.doesNotMatch(guide, /Other primitive-base nominal fixtures, refined callbacks, owned, recursive,/u);
		const row = guide.split("\n").find(line => line.startsWith("| `Subtype /"));
		assert.ok(row.includes(nominalPrimitiveSubtypeJvmField));
		for(const route of ["Ordinary source", "Reviewed IR"])
			assert.ok(row.includes(`${route}: Installed checks passed (input, result, field)`), route);
		assert.ok(row.includes(nominalPrimitiveSubtypeJvmConversion));
	}
});
