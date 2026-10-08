/**
 * Limit native Fin promotion to exact archived C/C++ positions and source paths.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { readTypeSurface, typeSurfaceCells } from "../../src/adoption/type-surface.mjs";
import { nativeFinPromotionReferences } from "./native-fin-promotion-references.mjs";
import { beforeNativeFinPromotionSource } from "./native-fin-promotion-source-history.mjs";
import { beforeReviewedApiPromotionSource } from "./reviewed-api-promotion-source-history.mjs";
import "./native-fin-promotion-source-history-tests.mjs";
import "./fin-product-evidence-tests.mjs";
import "./fin-product-array-dispatch-evidence-tests.mjs";
import "./fin-record-evidence-tests.mjs";

const readPromotedSurface = async () => {
	const result = await readTypeSurface();
	result.document = JSON.parse(beforeReviewedApiPromotionSource("docs/type-surface.v1.json", JSON.stringify(result.document, null, 2) + "\n"));
	return result;
};

test("native Fin promotion retains all eight original reports and artifact identities", async () => {
	const references = await nativeFinPromotionReferences();
	assert.equal(references.length, 8);
	const { document } = await readPromotedSurface();
	const previous = JSON.parse(beforeNativeFinPromotionSource("docs/type-surface.v1.json", await readFile("docs/type-surface.v1.json", "utf8")));
	assert.deepEqual(document.evidence.slice(previous.evidence.length).map(item => item.id), references.map(item => item.id));
	for(const reference of references)
	{
		const entry = document.evidence.find(item => item.id === reference.id);
		assert.equal(entry.kind, "installed"); assert.equal(entry.revision, reference.revision);
		assert.equal(entry.command, reference.command);
		assert.match(entry.revision, /^[a-f0-9]{40}$/u); assert.match(entry.command, /node --test/u);
		assert.deepEqual(entry.artifacts, reference.artifacts.map(item => ({ ...item, path: `${reference.id}/${item.path}` })));
		assert.ok(entry.files.some(file => file.path === reference.reportPath && file.sha256 === reference.reportSha256));
		assert.ok(entry.files.some(file => file.path === reference.receiptPath));
		assert.ok(entry.files.some(file => file.path === reference.validator));
		for(const file of entry.files) assert.equal(sha256(beforeReviewedApiPromotionSource(file.path, await readFile(file.path, "utf8"), file.sha256)), file.sha256, file.path);
		if(reference.kind === "products")
		{
			assert.match(entry.scope, /not an execution of the renamed absentOnly fixture/u);
			assert.ok(entry.files.some(file => file.path.endsWith("original-fixture-reference.json")));
		}
		if(reference.kind === "arrays") assert.match(entry.scope, /no source or raw-adapter dispatch measurements/u);
		else assert.match(entry.scope, /Only C has measured dispatch; C\+\+ does not inherit/u);
	}
});

test("native Fin promotion changes four field cells and supplements eight structural cells only", async () => {
	const { document, ...contracts } = await readPromotedSurface();
	const previous = JSON.parse(beforeNativeFinPromotionSource("docs/type-surface.v1.json", await readFile("docs/type-surface.v1.json", "utf8")));
	const references = await nativeFinPromotionReferences();
	const added = document.observations.slice(previous.observations.length);
	assert.equal(added.length, 2);
	assert.deepEqual(added.map(item => item.path), ["ordinary-source", "reviewed-ir"]);
	for(const observation of added)
	{
		assert.deepEqual(observation.profiles, ["c", "cpp"]);
		assert.deepEqual(observation.shapes, ["fin"]); assert.deepEqual(observation.positions, ["field"]);
		const selected = references.filter(item => item.kind === "fields" && item.sourcePath === observation.path);
		for(const stage of Object.values(observation.stages))
		{
			assert.equal(stage.state, "passed");
			assert.deepEqual(stage.evidence, selected.map(item => item.id));
		}
		assert.ok(observation.limitations.some(note => /no recursive, generic, indexed or inherited/iu.test(note)));
	}
	for(const [index, before] of previous.observations.entries())
	{
		const now = document.observations[index];
		if(!["native-fin-c-family-ordinary-source", "native-fin-c-family-reviewed-ir"].includes(before.id))
		{ assert.deepEqual(now, before, before.id); continue; }
		for(const key of ["id", "profiles", "shapes", "positions", "path", "hostTypes"]) assert.deepEqual(now[key], before[key]);
		const selected = references.filter(item => item.kind !== "fields" && item.sourcePath === before.path);
		for(const [name, stage] of Object.entries(now.stages))
		{
			assert.equal(stage.state, before.stages[name].state);
			assert.deepEqual(stage.evidence, [...before.stages[name].evidence, ...selected.map(item => item.id)]);
		}
	}
	const cells = typeSurfaceCells(document, contracts), old = typeSurfaceCells(previous, contracts);
	const changed = cells.filter((cell, index) => JSON.stringify(cell.stages) !== JSON.stringify(old[index].stages));
	assert.equal(changed.length, 12);
	assert.equal(changed.filter(cell => cell.position === "field").length, 4);
	for(const cell of changed)
	{
		assert.equal(cell.shape, "fin"); assert.ok(["c", "cpp"].includes(cell.profile));
		assert.ok(["parameter", "result", "field"].includes(cell.position));
	}
	for(const key of Object.keys(previous).filter(key => !["evidence", "observations"].includes(key)))
		assert.deepEqual(document[key], previous[key], key);
});
