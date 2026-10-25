/**
 * Check current author guidance and probe topology without replaying archives.
 *
 * @file
 */
import assert from "node:assert/strict";
import { createReadStream } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	phpWasmRefinementEntryBoundary, phpWasmRefinementEntryReference
} from "../../scripts/generate-type-docs.mjs";
import { readPromotionInventory } from "./type-surface-promotion-io.mjs";
import {
	phpWasmRefinementEntryMatrix, phpWasmRefinementEntryMatrixLocation
} from "./php-wasm-refinement-entry-matrix.mjs";

test("generated entry guidance agrees with the configured matrix and reference page", async () => {
	const matrix = phpWasmRefinementEntryMatrix;
	const artifacts = new Set(matrix.map(cell =>
		phpWasmRefinementEntryMatrixLocation(cell, "0".repeat(40)).artifact));
	assert.equal(matrix.length, 30);
	assert.equal(artifacts.size, 27);
	assert.equal(matrix.filter(cell => cell.kind === "callback").length, 6);
	assert.equal(matrix.filter(cell => cell.kind !== "callback").length, 24);
	assert.ok(phpWasmRefinementEntryBoundary.includes(
		`${matrix.length} ordinary/reviewed routes in ${artifacts.size} retained artifacts`));
	assert.match(phpWasmRefinementEntryBoundary, /six callback routes/u);
	assert.match(phpWasmRefinementEntryBoundary, /do\s+not widen any type-support cell/u);
	assert.match(phpWasmRefinementEntryBoundary, /is not a hosted result/u);
	const contracts = {
		irSchema: JSON.parse(await readFile("schema/binding-ir.schema.json", "utf8"))
		, consumers: JSON.parse(await readFile("docs/consumer-support.v1.json", "utf8"))
	};
	const { document } = await readPromotionInventory(
		createReadStream("docs/type-surface.v1.json"), contracts
	);
	const published = phpWasmRefinementEntryReference(document);
	assert.notEqual(published, phpWasmRefinementEntryBoundary);
	assert.ok(published.includes(
		`${matrix.length} ordinary/reviewed routes in ${artifacts.size} retained artifacts`));
	assert.match(published, /six callback routes/u);
	assert.match(published, /leave unmodified prepared packages and their supported types unchanged/u);
	assert.doesNotMatch(published, /is not a hosted result/u);
	const reference = await readFile("docs/reference/types.md", "utf8");
	assert.equal(reference.split(published).length, 2);
	assert.ok(!reference.includes(phpWasmRefinementEntryBoundary));
});

test("author callback guidance distinguishes the Fin archive from PHP-Wasm acceptance", async () => {
	const document = await readFile("docs/lean/existing-package.md", "utf8");
	const fin = document.split("\n").find(line =>
		line.startsWith("| `Fin n` in callbacks and closures"));
	assert.ok(fin);
	assert.equal(fin.split("|")[5].trim(), "Node and Chromium installed, both source routes");
	assert.match(document, /Node R2 fixture additionally checks a host-produced `Fin 3` reply/u);
	assert.match(document, /The reviewed Fin archive does not establish reviewed-browser execution, native host-produced replies, `Fin 0` or wider bounds/u);
	assert.match(document, /callback-refinements-php-wasm-promotion-20261023\.md/u);
	assert.match(document, /Each ordinary-source and reviewed-IR route runs in twelve Node\/Chromium arrangements/u);
	assert.match(document, /Fin corpus executes 23 checks per arrangement and the checked-record corpus executes 30/u);
	const record = document.split("\n").find(line =>
		line.startsWith("| Record with erased proof fields"));
	assert.ok(record);
	assert.match(record, /separately archived synchronous callback parameter\/result checks cover all seventeen profiles on both source routes/u);
	assert.doesNotMatch(record, /callback\/owned and unarchived combinations remain unfinished/u);
});
