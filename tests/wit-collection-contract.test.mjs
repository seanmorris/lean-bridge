/**
 * Check collection field names and deep shapes in both textual and binary WIT.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { compileCopiedWitModel } from "../src/backends/wit/copied-model.mjs";
import { renderWitHostSource } from "../src/backends/wit/copied-host.mjs";
import { collectionReviewedIr } from "./helpers/collection-fixture.mjs";
import { primitiveFields } from "./helpers/record-fixture.mjs";
import { validateWitCollectionSignatures } from "./helpers/wit-collection-fixture.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";

test("WIT collections retain nineteen primitive fields and 24 Array levels", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-wit-collection-contract-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const model = compileCopiedWitModel(collectionReviewedIr());
	assert.equal(model.functions.length, 35);
	const record = model.surface.copies.find(copy => copy.record?.name === "Primitives");
	assert.deepEqual(record.fields.map(field => field.witName), Object.keys(primitiveFields));
	for(const keyword of ["u8", "u16", "u32", "u64", "f32", "f64", "char"]) assert.ok(model.wit.includes(`%${keyword}:`));
	const host = renderWitHostSource(model, new Uint8Array());
	assert.ok(host.includes('"char"')); assert.ok(host.includes("out->char_"));
	assert.ok(host.includes("value->char_")); assert.doesNotMatch(host, /"char-"/u);
	await saveLakeFile(root, "collections.wit", model.wit); await saveLakeFile(root, "collections.wat", model.wat);
	await runCopied("wasm-tools", ["parse", "collections.wat", "-o", "collections.wasm"], root, process.env);
	await runCopied("wasm-tools", ["validate", "--features", "component-model", "collections.wasm"], root, process.env);
	for(const file of ["collections.wit", "collections.wasm"])
	{
		const parsed = JSON.parse((await runCopied("wasm-tools", ["component", "wit", file, "--json"], root, process.env)).stdout);
		assert.equal(validateWitCollectionSignatures(parsed).length, 35);
		const altered = structuredClone(parsed), iface = altered.interfaces.find(iface => iface.name === "native");
		altered.types[iface.types.primitives].kind.record.fields[16].name = "renamed-char";
		assert.throws(() => validateWitCollectionSignatures(altered));
	}
});

test("WIT record members preserve admitted source suffixes and reject normalized collisions", () => {
	const ir = collectionReviewedIr(), fields = ir.types.find(type => type.name === "Primitives").fields;
	fields[0].name = "name"; fields[1].name = "other_"; fields[2].name = "third__";
	const copy = compileCopiedWitModel(ir).surface.copies.find(copy => copy.record?.name === "Primitives");
	assert.equal(new Set(copy.fields.slice(0, 3).map(field => field.witName)).size, 3);
	assert.equal(copy.fields[0].witName, "name");
	for(const field of copy.fields.slice(1, 3)) assert.match(field.witName, /^lean-field-x[0-9a-f]+$/u);
	fields[0].name = "wordCount"; fields[1].name = "word_count";
	assert.throws(() => compileCopiedWitModel(ir), /C\/C\+\+ record field is reserved or duplicated/u);
	fields[0].name = "name_"; fields[1].name = "lean_field_x00006e00006100006d00006500005f";
	assert.throws(() => compileCopiedWitModel(ir), /WIT record field is duplicated after projection/u);
});
