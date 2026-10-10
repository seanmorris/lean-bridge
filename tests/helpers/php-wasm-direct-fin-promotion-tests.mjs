/**
 * Bind current PHP-Wasm guidance to direct installed observations without broadening other cells.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { finDotnetSdkHistoryPath } from "./fin-dotnet-sdk-history.mjs";
import { finJvmDiagnosticsHistoryPath } from "./fin-jvm-diagnostics-history.mjs";
import { readTypeSurface, typeSurfaceCells, validateTypeSurface } from "../../src/adoption/type-surface.mjs";
import { phpWasmDirectArchiveRoot, phpWasmDirectProducer } from "./php-wasm-fin-direct-archive.mjs";
import { beforePhpWasmDirectPromotionSource, phpWasmDirectPromotionHistoryPath } from "./php-wasm-direct-fin-promotion-history.mjs";
import { beforePhpWasmSubtypeSource, phpWasmSubtypeHistoryPath } from "./php-wasm-subtype-history.mjs";
import { phpWasmSubtypeAcceptanceHistoryPath } from "./php-wasm-subtype-acceptance-history.mjs";
import { beforePhpWasmSubtypePromotionSource, phpWasmSubtypePromotionHistoryPath } from "./php-wasm-subtype-promotion-history.mjs";
import { phpWasmDirectPromotionConversion, phpWasmDirectPromotionEnvironment, phpWasmDirectPromotionLimit, phpWasmDirectPromotionReferences, promotePhpWasmDirectFin } from "./php-wasm-direct-fin-promotion.mjs";
import "./php-wasm-direct-fin-promotion-history-tests.mjs";

const predecessor = async () => JSON.parse(beforePhpWasmDirectPromotionSource("docs/type-surface.v1.json", await readFile("docs/type-surface.v1.json", "utf8")));

test("direct PHP-Wasm promotion authenticates four selections without borrowing runtime or dispatch coverage", async () => {
	const references = await phpWasmDirectPromotionReferences();
	assert.deepEqual(references.map(item => [item.sourcePath, item.fixture, item.checks]), [
		["ordinary-source", "scalar", 2028], ["ordinary-source", "containers", 14089]
		, ["reviewed-ir", "scalar", 2028], ["reviewed-ir", "containers", 14089]
	]);
	for(const item of references)
	{
		assert.equal(item.revision, phpWasmDirectProducer);
		assert.ok(item.scope.includes(phpWasmDirectPromotionEnvironment));
		assert.ok(item.scope.includes(phpWasmDirectPromotionLimit));
		assert.equal(item.files.length, 46); assert.equal(item.artifacts.length, 3);
		for(const file of item.files) assert.equal(sha256(await readFile(file.path)), file.sha256);
	}
	for(const name of ["index.json", "ordinary.json", "reviewed.json", "run.tap", "start.json", "runtime.json"])
		await assert.rejects(() => phpWasmDirectPromotionReferences(async path => {
			const bytes = await readFile(path);
			return path === `${phpWasmDirectArchiveRoot}/${name}` ? Buffer.concat([bytes, Buffer.from("\n")]) : bytes;
		}));
});

test("direct PHP-Wasm promotion supplements only its existing six Fin cells and preserves earlier evidence", async () => {
	const current = await readTypeSurface(), previous = await predecessor();
	current.document = JSON.parse(beforePhpWasmSubtypePromotionSource("docs/type-surface.v1.json", JSON.stringify(current.document, null, 2) + "\n"));
	const references = await phpWasmDirectPromotionReferences();
	const proposed = await promotePhpWasmDirectFin(previous, references);
	for(const path of [finJvmDiagnosticsHistoryPath, finDotnetSdkHistoryPath, phpWasmSubtypePromotionHistoryPath])
	{
		const later = JSON.parse(await readFile(path));
		for(const entry of proposed.evidence) for(const file of entry.files)
		{
			const update = later.updates.find(item => item.path === file.path && item.currentSha256 === file.sha256);
			if(update) file.sha256 = update.previousSha256;
		}
	}
	validateTypeSurface(proposed, current);
	assert.equal(proposed.observations.length, previous.observations.length);
	assert.equal(proposed.evidence.length, previous.evidence.length + 4);
	assert.deepEqual(proposed.evidence.slice(0, previous.evidence.length), previous.evidence);
	const changed = [];
	for(const [index, old] of previous.observations.entries())
	{
		const now = proposed.observations[index];
		if(JSON.stringify(old) === JSON.stringify(now)) continue;
		changed.push(now.id);
		for(const key of ["id", "profiles", "shapes", "positions", "path", "hostTypes"]) assert.deepEqual(now[key], old[key]);
		assert.deepEqual(now.profiles, ["php-wasm"]); assert.deepEqual(now.shapes, ["fin"]);
		assert.equal(now.conversionNotes.fin, phpWasmDirectPromotionConversion);
		if(now.positions.includes("field"))
		{
			const restored = structuredClone(now); restored.conversionNotes = old.conversionNotes;
			assert.deepEqual(restored, old); continue;
		}
		for(const name of previous.stages)
		{
			assert.equal(now.stages[name].state, old.stages[name].state);
			assert.deepEqual(now.stages[name].evidence, [...old.stages[name].evidence
				, ...references.filter(item => item.sourcePath === now.path).map(item => item.id)]);
		}
	}
	assert.deepEqual(changed, ["php-wasm-fin-products-ordinary", "php-wasm-fin-records-ordinary", "php-wasm-fin-products-reviewed", "php-wasm-fin-records-reviewed"]);
	const before = typeSurfaceCells(previous, current), after = typeSurfaceCells(proposed, current);
	let updated = 0;
	for(const [index, cell] of after.entries())
	{
		if(JSON.stringify(cell) === JSON.stringify(before[index])) continue;
		updated++; assert.equal(cell.profile, "php-wasm"); assert.equal(cell.shape, "fin");
		assert.ok(["parameter", "result", "field"].includes(cell.position));
		for(const name of previous.stages) assert.equal(cell.stages[name].state, before[index].stages[name].state);
	}
	assert.equal(updated, 6);
	const expected = structuredClone(proposed), history = JSON.parse(await readFile(phpWasmDirectPromotionHistoryPath));
	for(const entry of expected.evidence.slice(0, previous.evidence.length)) for(const file of entry.files)
	{
		const update = history.updates.find(item => item.path === file.path && item.previousSha256 === file.sha256);
		if(update) file.sha256 = update.currentSha256;
	}
	for(const path of [phpWasmSubtypeHistoryPath, phpWasmSubtypeAcceptanceHistoryPath])
	{
		const subtypeHistory = JSON.parse(await readFile(path));
		for(const entry of expected.evidence) for(const file of entry.files)
		{
			const update = subtypeHistory.updates.find(item => item.path === file.path && item.previousSha256 === file.sha256);
			if(update) file.sha256 = update.currentSha256;
		}
	}
	assert.deepEqual(current.document, expected);
	for(const entry of current.document.evidence) for(const file of entry.files)
		assert.equal(sha256(beforeFinRefinementSource(file.path, await readFile(file.path), file.sha256)), file.sha256, file.path);
});

test("direct PHP-Wasm promotion refuses incomplete, duplicated or repeated supplements", async () => {
	const previous = await predecessor(), references = await phpWasmDirectPromotionReferences();
	for(const changed of [references.slice(1), [...references.slice(0, -1), references[0]]])
		await assert.rejects(() => promotePhpWasmDirectFin(previous, changed));
	for(const mutate of [item => { item.checks--; }, item => { item.sourcePath = "ordinary-source"; }, item => { item.revision = "0".repeat(40); }])
	{
		const changed = structuredClone(references); mutate(changed[3]);
		await assert.rejects(() => promotePhpWasmDirectFin(previous, changed));
	}
	const proposed = await promotePhpWasmDirectFin(previous, references);
	await assert.rejects(() => promotePhpWasmDirectFin(proposed, references), /Already supplemented/u);
});

test("PHP consumer and author guides distinguish direct acceptance from the earlier nested fixtures", async () => {
	const consumer = await readFile("docs/php.md", "utf8");
	const author = beforePhpWasmSubtypeSource("docs/lean/existing-package.md", await readFile("docs/lean/existing-package.md", "utf8"));
	const row = consumer.split("\n").find(line => line.startsWith("| `Fin n` |"));
	assert.ok(row.includes(phpWasmDirectPromotionConversion));
	assert.ok(!row.includes("no bare top-level Fin or direct Array/List/Option"));
	for(const text of [consumer, author])
	{
		assert.ok(text.includes("php-wasm-fin-direct-20261010/index.json"));
		assert.ok(text.includes("2,028")); assert.ok(text.includes("14,089"));
		assert.ok(text.includes("Node 22.23.2")); assert.ok(text.includes("Chromium 152.0.7977.75"));
		assert.ok(text.includes("Node 22.23.3")); assert.ok(text.includes("Chromium 154.0.8037.57"));
	}
	assert.ok(!author.includes("bare scalar pending"));
	assert.ok(!author.includes("direct containers pending"));
	assert.ok(consumer.includes("Source-dispatch counters were not measured."));
	assert.ok(author.includes("PHP-Wasm keeps checked Subtype and packages combining Fin with graph, owned or callable transports rejected."));
});
