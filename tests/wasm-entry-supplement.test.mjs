/**
 * Keep Wasm entry measurements additive, profile-scoped and separate from package archive evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { validateTypeSurface } from "../src/adoption/type-surface.mjs";
import { supplementWasmEntryInventory, wasmEntrySupplementEvidence, wasmEntrySupplementObservations, wasmEntrySupplementReceipt, wasmEntrySupplementReferences } from "./helpers/wasm-entry-supplement.mjs";
import { beforeWasmEntrySupplementSource } from "./helpers/wasm-entry-supplement-source-history.mjs";

const readJson = async path => JSON.parse(await readFile(path));
const original = JSON.parse(beforeWasmEntrySupplementSource("docs/type-surface.v1.json", await readFile("docs/type-surface.v1.json", "utf8")));
const contracts = { irSchema: await readJson("schema/binding-ir.schema.json"), consumers: await readJson("docs/consumer-support.v1.json") };

test("Wasm entry references retain all sixteen original reports without merging the observation modes", async () => {
	const { references, entries } = await wasmEntrySupplementEvidence();
	assert.equal(references.length, 16);
	assert.deepEqual(references.map(reference => reference.runs), [...Array(8).fill(2), ...Array(8).fill(53)]);
	for(const path of ["ordinary-source", "reviewed-ir"]) for(const mode of ["original", "probe"]) for(const selection of ["scalar", "structural"])
	{
		const matches = references.filter(item => item.path === path && item.mode === mode && item.selection === selection);
		assert.equal(matches.length, 2);
		assert.deepEqual(matches.map(item => item.engines), [[], ["chromium", "firefox", "webkit"]]);
		assert.deepEqual(matches.map(item => item.calls), Array(2).fill((selection === "scalar" ? 226 : 520) + (mode === "probe" ? 10 : 0)));
		assert.ok(matches.every(item => !item.attempt.startsWith("failed-")));
	}
	for(const [index, entry] of entries.entries())
	{
		assert.equal(entry.id, references[index].id);
		assert.equal(entry.kind, "test");
		assert.deepEqual(entry.artifacts, [], "retained report identity must not become a fabricated package archive");
		assert.ok(entry.files.some(file => file.path === references[index].reportPath && file.sha256 === references[index].compressedSha256));
		assert.match(entry.scope, /report-carried identities/u);
		assert.match(entry.scope, /Local execution only, not hosted CI or locked Nix/u);
		assert.match(entry.scope, references[index].mode === "probe" ? /Separate instrumented installed packages/u : /Lean source entry is not measured in these packages/u);
		assert.match(entry.command, /node --test /u);
	}
	for(const file of entries[0].files) assert.equal(sha256(await readFile(file.path)), file.sha256, file.path);
});

test("Wasm entry supplementation preserves all old evidence, support states and unrelated observations", async () => {
	const before = structuredClone(original), document = await supplementWasmEntryInventory(before);
	const { references } = await wasmEntrySupplementReferences();
	assert.deepEqual(before, original, "caller data remains unchanged");
	assert.equal(validateTypeSurface(document, contracts), true);
	assert.deepEqual(document.evidence.slice(0, original.evidence.length), original.evidence);
	assert.equal(document.evidence.length, original.evidence.length + 16);
	assert.equal(document.observations.length, original.observations.length);
	for(const [index, previous] of original.observations.entries())
	{
		const next = document.observations[index];
		if(!wasmEntrySupplementObservations.includes(previous.id))
		{ assert.deepEqual(next, previous); continue; }
		const restored = structuredClone(next);
		restored.limitations = previous.limitations;
		restored.stages.installedExecution.evidence = previous.stages.installedExecution.evidence;
		assert.deepEqual(restored, previous, "only installed references and the explicit measurement note change");
		const added = next.stages.installedExecution.evidence.slice(previous.stages.installedExecution.evidence.length);
		assert.ok(next.limitations.some(note => note.includes("Firefox and WebKit versions are not report-carried")));
		assert.equal(added.length, previous.id.includes("browser") ? 4 : 8);
		for(const profile of previous.profiles) for(const mode of ["original", "probe"]) for(const selection of ["scalar", "structural"])
			assert.ok(references.some(item => added.includes(item.id) && item.path === previous.path && item.profiles.includes(profile) && item.mode === mode && item.selection === selection));
	}
	for(const key of Object.keys(original).filter(key => !["evidence", "observations"].includes(key))) assert.deepEqual(document[key], original[key]);
});

test("supplement refuses altered scope, missing installed evidence and repeated application", async () => {
	const mutations = [
		doc => { doc.observations = doc.observations.filter(item => item.id !== wasmEntrySupplementObservations[0]); }
		, doc => { doc.observations.push(structuredClone(doc.observations.find(item => item.id === wasmEntrySupplementObservations[0]))); }
		, doc => { doc.observations.find(item => item.id === wasmEntrySupplementObservations[0]).profiles.push("php-wasm"); }
		, doc => { doc.observations.find(item => item.id === wasmEntrySupplementObservations[0]).positions.push("field"); }
		, doc => { doc.observations.find(item => item.id === wasmEntrySupplementObservations[0]).path = "reviewed-ir"; }
		, doc => { doc.observations.find(item => item.id === wasmEntrySupplementObservations[0]).stages.installedExecution.state = "unreviewed"; }
		, doc => { doc.observations.find(item => item.id === wasmEntrySupplementObservations[0]).stages.installedExecution.evidence = []; }
		, doc => { doc.observations.find(item => item.id === wasmEntrySupplementObservations[2]).limitations = []; }
	];
	for(const mutate of mutations)
	{
		const document = structuredClone(original); mutate(document);
		let reads = 0;
		await assert.rejects(supplementWasmEntryInventory(document, () => { reads++; throw new Error("unexpected evidence read"); }), assert.AssertionError);
		assert.equal(reads, 0, "invalid scope must refuse before reading evidence");
	}
	const supplemented = await supplementWasmEntryInventory(original);
	await assert.rejects(supplementWasmEntryInventory(supplemented), /superseded unmeasured-counter note/u);
});

test("supplement refuses modified receipt bytes and a changed report on its second read", async () => {
	await assert.rejects(wasmEntrySupplementReferences(async path => path === wasmEntrySupplementReceipt ? Buffer.from("{}") : readFile(path)), /unchanged entry archive receipt/u);
	const target = "docs/evidence/wasm-entry-20261009/node-smoke-7c11757/original-ordinary-scalar.json.gz";
	let reads = 0;
	await assert.rejects(wasmEntrySupplementReferences(async path => {
		const bytes = await readFile(path);
		return path === target && ++reads > 1 ? Buffer.concat([bytes, Buffer.from("changed")]) : bytes;
	}), assert.AssertionError);
});

test("supplement refuses an archive member changed while collecting inventory pins", async () => {
	const target = "docs/evidence/wasm-entry-20261009/node-smoke-7c11757/run.tap";
	let reads = 0;
	await assert.rejects(wasmEntrySupplementEvidence(async path => {
		const bytes = await readFile(path);
		return path === target && ++reads > 1 ? Buffer.concat([bytes, Buffer.from("changed")]) : bytes;
	}), /archive member changed while collecting evidence/u);
});
