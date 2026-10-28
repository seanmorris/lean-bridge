/**
 * Keep the final Fin promotion tied to the four immutable hosted archives and
 * exactly its 50 copied-field/callback cells.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
	readTypeSurface, typeSurfaceCells
} from "../../src/adoption/type-surface.mjs";
import {
	finCompletionEvidence, finCompletionPromotionReferences
	, finCompletionTargetCells
} from "./fin-completion-promotion.mjs";

test("Fin completion references four immutable hosted archive indexes", async () => {
	const references = await finCompletionPromotionReferences();
	assert.deepEqual(references.map(reference => reference.id)
		, Object.values(finCompletionEvidence).map(item => item.id));
	assert.deepEqual(references.map(reference => reference.artifacts.length)
		, [2, 1, 4, 2]);
	for(const reference of references)
	{
		assert.match(reference.revision, /^[a-f0-9]{40}$/u);
		assert.ok(reference.files.some(file => file.path.endsWith("/index.json")));
		assert.ok(reference.files.some(file =>
			file.path.endsWith("-hosted-evidence.test.mjs")));
		for(const file of [...reference.files, ...reference.artifacts])
			assert.match(file.sha256, /^[a-f0-9]{64}$/u, file.path);
	}
});

test("Fin completion closes exactly the remaining copied-field and callback cells", async () => {
	const { document, ...contracts } = await readTypeSurface();
	const cells = typeSurfaceCells(document, contracts);
	const targets = new Map(cells.filter(cell =>
		finCompletionTargetCells.includes(cell.id)).map(cell => [cell.id, cell]));
	assert.equal(targets.size, 50);
	const expectedEvidence = cell => {
		if(cell.position === "field") return finCompletionEvidence.fields.id;
		if(["browser-javascript", "browser-react", "browser-worker"]
			.includes(cell.profile)) return finCompletionEvidence.browserCallbacks.id;
		if(["dotnet", "java", "kotlin", "php-native", "wit-wasi"]
			.includes(cell.profile)) return finCompletionEvidence.managedCallbacks.id;
		return finCompletionEvidence.nativeCallbacks.id;
	};
	for(const [id, cell] of targets)
	{
		for(const stage of Object.values(cell.stages))
		{
			assert.equal(stage.state, "passed", id);
			assert.deepEqual(stage.evidence, [expectedEvidence(cell)], id);
		}
	}
	assert.deepEqual(cells.filter(cell => cell.shape === "fin"
		&& ["field", "callback-parameter", "callback-result"].includes(
			cell.position)
		&& cell.stages.installedExecution.state !== "passed"), []);
});
