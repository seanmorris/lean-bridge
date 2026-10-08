/**
 * Keep PHP-Wasm Fin support tied to the exact installed routes, fields and environments.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { readTypeSurface, typeSurfaceCells } from "../../src/adoption/type-surface.mjs";
import { beforePhpWasmFinPromotionSource } from "./php-wasm-fin-promotion-source-history.mjs";
import { phpWasmFinPromotionConversion, phpWasmFinPromotionEnvironment, phpWasmFinPromotionLimit, phpWasmFinPromotionNestedOnly, phpWasmFinPromotionNotes, phpWasmFinPromotionReceipts, phpWasmFinPromotionReferences, phpWasmFinPromotionScope, phpWasmFinPromotionValidators } from "./php-wasm-fin-promotion-references.mjs";

const predecessor = async () => JSON.parse(beforePhpWasmFinPromotionSource("docs/type-surface.v1.json", await readFile("docs/type-surface.v1.json", "utf8")));

const validate = (document, previous, references, contracts) => {
	const added = document.observations.slice(previous.observations.length);
	assert.equal(added.length, 4);
	assert.deepEqual(document.observations.slice(0, previous.observations.length), previous.observations);
	for(const key of Object.keys(previous).filter(key => !["observations", "evidence"].includes(key)))
		assert.deepEqual(document[key], previous[key], key);
	for(const [index, item] of added.entries())
	{
		const reference = references[index];
		assert.equal(item.id, reference.id.replace(/-installed$/u, ""));
		assert.deepEqual(item.profiles, ["php-wasm"]); assert.deepEqual(item.shapes, ["fin"]);
		assert.equal(item.path, reference.sourcePath); assert.deepEqual(item.positions, reference.positions);
		assert.equal(item.scope, reference.scope);
		assert.deepEqual(item.limitations, [phpWasmFinPromotionLimit, phpWasmFinPromotionEnvironment]);
		assert.deepEqual(Object.keys(item.stages), document.stages);
		const notes = phpWasmFinPromotionNotes(reference);
		for(const [name, stage] of Object.entries(item.stages))
			assert.deepEqual(stage, { state: "passed", evidence: [reference.id], note: notes[name] });
		assert.equal(document.evidence[previous.evidence.length + index].scope, phpWasmFinPromotionScope(reference));
		assert.deepEqual(Object.keys(item.hostTypes), ["fin"]);
		assert.deepEqual(Object.keys(item.hostTypes.fin), reference.positions);
		for(const representation of Object.values(item.hostTypes.fin))
			assert.equal(representation, "Brick\\Math\\BigInteger checked against the declared closed Fin bound");
		assert.deepEqual(item.conversionNotes, { fin: phpWasmFinPromotionConversion });
	}
	const old = new Map(typeSurfaceCells(previous, contracts).map(cell => [cell.id, cell]));
	const expected = new Set(["ordinary-source", "reviewed-ir"].flatMap(path => ["parameter", "result", "field"].map(position => `php-wasm/${path}/${position}`)));
	const changed = [];
	for(const cell of typeSurfaceCells(document, contracts))
	{
		const key = `${cell.profile}/${cell.path}/${cell.position}`;
		if(cell.shape === "fin" && expected.has(key))
		{
			assert.equal(old.get(cell.id).stages.installedExecution.state, "unreviewed", cell.id);
			for(const stage of Object.values(cell.stages)) assert.equal(stage.state, "passed", cell.id);
			changed.push(key);
		}
		else assert.deepEqual(cell, old.get(cell.id), cell.id);
	}
	assert.deepEqual(changed.sort(), [...expected].sort());
};

test("PHP-Wasm Fin promotion authenticates four original selections and every pinned file", async () => {
	const references = await phpWasmFinPromotionReferences(), { document } = await readTypeSurface(), previous = await predecessor();
	assert.deepEqual(references.map(item => [item.sourcePath, item.fixture, item.checks]), [
		["ordinary-source", "products", 2039], ["ordinary-source", "records", 2053]
		, ["reviewed-ir", "products", 2039], ["reviewed-ir", "records", 2053]
	]);
	assert.deepEqual(document.evidence.slice(previous.evidence.length).map(item => item.id), references.map(item => item.id));
	for(const reference of references)
	{
		const entry = document.evidence.find(item => item.id === reference.id);
		assert.equal(entry.kind, "installed"); assert.equal(entry.revision, reference.revision);
		assert.equal(entry.command, reference.command);
		assert.equal(entry.scope, phpWasmFinPromotionScope(reference));
		assert.deepEqual(entry.files.map(file => file.path), [...phpWasmFinPromotionValidators, ...reference.files.map(file => file.path)]);
		for(const file of entry.files) assert.equal(sha256(await readFile(file.path)), file.sha256, file.path);
		for(const file of reference.files) assert.ok(entry.files.some(pin => pin.path === file.path && pin.sha256 === file.sha256));
		assert.deepEqual(entry.artifacts, reference.artifacts.map(file => ({ ...file, path: `${reference.id}/${file.path}` })));
		assert.equal(entry.artifacts.length, 3);
	}
});

test("PHP-Wasm Fin promotion states nested-only coverage in the evidence and generated consumer table", async () => {
	assert.equal(phpWasmFinPromotionNestedOnly, "Only Fin nested in products, Except branches or copied fields is exercised; no bare top-level Fin or direct Array/List/Option (Fin n) export is executed.");
	const { document } = await readTypeSurface();
	for(const observation of document.observations.slice(-4))
	{
		assert.ok(observation.limitations.some(note => note.startsWith(phpWasmFinPromotionNestedOnly)));
		assert.ok(observation.conversionNotes.fin.startsWith(phpWasmFinPromotionNestedOnly));
		assert.ok(observation.stages.installedExecution.note.includes(phpWasmFinPromotionNestedOnly));
	}
	for(const entry of document.evidence.slice(-4)) assert.ok(entry.scope.includes(phpWasmFinPromotionNestedOnly));
	const row = (await readFile("docs/php.md", "utf8")).split("\n").find(line => line.startsWith("| `Fin n` |"));
	assert.ok(row.includes(phpWasmFinPromotionNestedOnly));
});

test("PHP-Wasm Fin promotion rejects appended and replaced claims in every selection", async () => {
	const { document, ...contracts } = await readTypeSurface(), previous = await predecessor();
	const references = await phpWasmFinPromotionReferences();
	let controls = 0;
	for(let index = 0; index < 4; index++) for(const append of [false, true])
		for(const target of [...document.stages, "conversion", "evidenceScope"])
		{
			const changed = structuredClone(document), observation = changed.observations[previous.observations.length + index];
			const holder = target === "evidenceScope" ? changed.evidence[previous.evidence.length + index]
				: target === "conversion" ? observation.conversionNotes : observation.stages[target];
			const key = target === "evidenceScope" ? "scope" : target === "conversion" ? "fin" : "note";
			const claim = target === "evidenceScope" ? "Native PHP covered." : target === "conversion"
				? "Refined callbacks are supported." : "Dispatch measured in Firefox and WebKit.";
			holder[key] = append ? holder[key] + " " + claim : claim;
			assert.throws(() => validate(changed, previous, references, contracts), assert.AssertionError, `${index}/${target}/${append}`);
			controls++;
		}
	assert.equal(controls, 56);
});

test("PHP-Wasm Fin promotion changes exactly six cells and no earlier observation", async () => {
	const { document, ...contracts } = await readTypeSurface(), previous = await predecessor();
	assert.equal(previous.observations.length, 486); assert.equal(previous.evidence.length, 260);
	validate(document, previous, await phpWasmFinPromotionReferences(), contracts);
});

test("PHP-Wasm Fin promotion rejects inferred hosts, positions, runtime claims and weakened scope", async () => {
	const { document, ...contracts } = await readTypeSurface(), previous = await predecessor();
	const references = await phpWasmFinPromotionReferences(), start = previous.observations.length;
	for(const mutate of [
		value => { value.observations[start].profiles = ["php-native"]; }
		, value => { value.observations[start].path = "reviewed-ir"; }
		, value => { value.observations[start].positions.push("callback-result"); }
		, value => { value.observations[start + 1].positions = ["parameter", "result", "field"]; }
		, value => { value.observations[start].shapes = ["subtype"]; }
		, value => { value.observations[start].scope = "All PHP host refinements"; }
		, value => { value.observations[start].limitations = []; }
		, value => { value.observations[start].stages.installedExecution.evidence = [references[2].id]; }
		, value => { value.observations[start].stages.installedExecution.note = "All engines and measured dispatch"; }
		, value => { value.observations[start].hostTypes.fin.parameter = "int"; }
		, value => { value.observations[0].scope += " changed"; }
		, value => { value.observations.pop(); }
	]) {
		const changed = structuredClone(document); mutate(changed);
		assert.throws(() => validate(changed, previous, references, contracts), assert.AssertionError);
	}
});

test("PHP-Wasm Fin promotion rejects changed receipts, reports, logs and selected producer sources", async () => {
	const references = await phpWasmFinPromotionReferences();
	const paths = new Set([...phpWasmFinPromotionReceipts.map(file => file.path)
		, ...references.flatMap(reference => reference.files.map(file => file.path))
		, "tests/fixtures/onboarding/native-fin-products/FinProducts.lean"
		, "tests/fixtures/onboarding/native-fin-records/FinRecords.lean"]);
	for(const target of paths)
		await assert.rejects(() => phpWasmFinPromotionReferences(async path => {
			assert.ok(!path.startsWith("/"), path);
			const bytes = await readFile(path);
			return path === target ? Buffer.concat([bytes, Buffer.from("\n")]) : bytes;
		}), assert.AssertionError, target);
});
