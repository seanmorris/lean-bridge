/**
 * Bind PHP-Wasm Subtype documentation to exactly four installed position/route cells.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforeFinDotnetSdkSource, finDotnetSdkHistoryPath } from "./fin-dotnet-sdk-history.mjs";
import { readTypeSurface, typeSurfaceCells, validateTypeSurface } from "../../src/adoption/type-surface.mjs";
import { phpWasmSubtypeArchiveRoot, phpWasmSubtypeProducer } from "./php-wasm-subtype-archive.mjs";
import { beforePhpWasmSubtypePromotionSource, phpWasmSubtypePromotionHistoryPath } from "./php-wasm-subtype-promotion-history.mjs";
import { phpWasmSubtypePromotionConversion, phpWasmSubtypePromotionEnvironment, phpWasmSubtypePromotionLimit, phpWasmSubtypePromotionReferences, promotePhpWasmSubtype } from "./php-wasm-subtype-promotion.mjs";

const predecessor = async () => JSON.parse(beforePhpWasmSubtypePromotionSource("docs/type-surface.v1.json", await readFile("docs/type-surface.v1.json", "utf8")));

test("PHP-Wasm Subtype promotion authenticates both source routes without inventing dispatch or browser coverage", async () => {
	const references = await phpWasmSubtypePromotionReferences();
	assert.deepEqual(references.map(item => [item.id, item.sourcePath]), [
		["php-wasm-subtype-ordinary-installed", "ordinary-source"]
		, ["php-wasm-subtype-reviewed-installed", "reviewed-ir"]
	]);
	for(const reference of references)
	{
		assert.equal(reference.revision, phpWasmSubtypeProducer);
		assert.ok(reference.scope.includes(phpWasmSubtypePromotionEnvironment));
		assert.ok(reference.scope.includes(phpWasmSubtypePromotionLimit));
		assert.equal(reference.files.length, 41); assert.equal(reference.artifacts.length, 3);
		for(const file of reference.files) assert.equal(sha256(await readFile(file.path)), file.sha256);
	}
	for(const name of ["index.json", "ordinary.json", "reviewed.json", "run.tap", "start.json", "runtime.json", "failed-host-path/run.tap"])
		await assert.rejects(() => phpWasmSubtypePromotionReferences(async path => {
			const bytes = await readFile(path);
			return path === `${phpWasmSubtypeArchiveRoot}/${name}` ? Buffer.concat([bytes, Buffer.from("\n")]) : bytes;
		}));
});

test("PHP-Wasm Subtype promotion changes only four cells and preserves every older observation", async () => {
	const current = await readTypeSurface(), previous = await predecessor();
	current.document = JSON.parse(beforeFinDotnetSdkSource("docs/type-surface.v1.json", await readFile("docs/type-surface.v1.json", "utf8")));
	const references = await phpWasmSubtypePromotionReferences(), proposed = await promotePhpWasmSubtype(previous, references);
	const later = JSON.parse(await readFile(finDotnetSdkHistoryPath));
	for(const entry of proposed.evidence) for(const file of entry.files)
	{
		const update = later.updates.find(item => item.path === file.path && item.currentSha256 === file.sha256);
		if(update) file.sha256 = update.previousSha256;
	}
	validateTypeSurface(proposed, current);
	assert.equal(previous.evidence.length, 405); assert.equal(previous.observations.length, 507);
	assert.equal(proposed.evidence.length, 407); assert.equal(proposed.observations.length, 509);
	assert.deepEqual(proposed.evidence.slice(0, previous.evidence.length), previous.evidence);
	assert.deepEqual(proposed.observations.slice(0, previous.observations.length), previous.observations);
	const before = typeSurfaceCells(previous, current), after = typeSurfaceCells(proposed, current), changed = [];
	for(const [index, cell] of after.entries())
	{
		if(JSON.stringify(cell) === JSON.stringify(before[index])) continue;
		assert.equal(cell.profile, "php-wasm"); assert.equal(cell.shape, "subtype");
		assert.ok(["parameter", "result"].includes(cell.position));
		assert.equal(before[index].stages.installedExecution.state, "unreviewed");
		for(const stage of Object.values(cell.stages)) assert.equal(stage.state, "passed");
		changed.push(`${cell.path}/${cell.position}`);
	}
	assert.deepEqual(changed.sort(), ["ordinary-source/parameter", "ordinary-source/result", "reviewed-ir/parameter", "reviewed-ir/result"]);
	for(const observation of proposed.observations.slice(previous.observations.length))
	{
		assert.deepEqual(observation.profiles, ["php-wasm"]); assert.deepEqual(observation.shapes, ["subtype"]);
		assert.deepEqual(observation.positions, ["parameter", "result"]);
		assert.deepEqual(observation.limitations, [phpWasmSubtypePromotionLimit, phpWasmSubtypePromotionEnvironment]);
		assert.deepEqual(observation.conversionNotes, { subtype: phpWasmSubtypePromotionConversion });
	}
	const expected = structuredClone(proposed), history = JSON.parse(await readFile(phpWasmSubtypePromotionHistoryPath));
	for(const entry of expected.evidence) for(const file of entry.files)
	{
		const update = history.updates.find(item => item.path === file.path && item.previousSha256 === file.sha256);
		if(update) file.sha256 = update.currentSha256;
	}
	assert.deepEqual(current.document, expected);
	for(const entry of current.document.evidence) for(const file of entry.files)
		assert.equal(sha256(beforeFinRefinementSource(file.path, await readFile(file.path), file.sha256)), file.sha256, file.path);
});

test("PHP-Wasm Subtype promotion refuses missing, duplicate, weakened or repeated evidence selections", async () => {
	const previous = await predecessor(), references = await phpWasmSubtypePromotionReferences();
	for(const changed of [references.slice(1), [references[0], references[0]], [...references].reverse()])
		await assert.rejects(() => promotePhpWasmSubtype(previous, changed));
	for(const mutate of [
		item => { item.scope = "All host and field positions pass"; }
		, item => { item.sourcePath = "ordinary-source"; }
		, item => { item.revision = "0".repeat(40); }
		, item => { item.artifacts.pop(); }
		, item => { item.files[0].sha256 = "0".repeat(64); }
	]) {
		const changed = structuredClone(references); mutate(changed[1]);
		await assert.rejects(() => promotePhpWasmSubtype(previous, changed));
	}
	const promoted = await promotePhpWasmSubtype(previous, references);
	await assert.rejects(() => promotePhpWasmSubtype(promoted, references), /Already promoted/u);
});

test("PHP-Wasm consumer and author guides describe installed Subtypes and retain unmeasured entry counts", async () => {
	const consumer = await readFile("docs/php.md", "utf8"), author = await readFile("docs/lean/existing-package.md", "utf8");
	const row = consumer.split("\n").find(line => line.startsWith("| `Subtype /"));
	assert.ok(row.includes(phpWasmSubtypePromotionConversion));
	assert.ok(row.includes("PHP-Wasm:")); assert.ok(!row.includes("No host mapping recorded"));
	for(const source of [consumer, author])
	{
		assert.ok(source.includes("php-wasm-subtype-installed-20261010.md"));
		assert.ok(source.includes("2,024"));
		assert.doesNotMatch(source, /Installed PHP-Wasm Subtype execution and constructor-call measurements remain pending/u);
	}
	assert.ok(consumer.includes("Constructor and dispatch counts were not measured."));
	assert.ok(author.includes("runtime entry counts remain unmeasured"));
	assert.ok(author.includes("PHP-Wasm keeps nested Subtype and packages combining refinements with graph, owned or callable transports rejected."));
});
