/**
 * Archived Fin executions can promote only their measured routes, hosts and positions.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { readTypeSurface, typeSurfaceCells } from "../../src/adoption/type-surface.mjs";
import { reviewedFinPromotionReferences } from "./reviewed-fin-promotion-references.mjs";
import { beforeReviewedFinPromotionSource } from "./reviewed-fin-promotion-source-history.mjs";
import { beforeNativeFinPromotionSource } from "./native-fin-promotion-source-history.mjs";
import "./reviewed-fin-host-evidence-tests.mjs";
import "./reviewed-scalar-host-evidence-tests.mjs";
import "./reviewed-scalar-rollout-evidence-tests.mjs";
import "./reviewed-perl-scalar-evidence-tests.mjs";
import "./reviewed-perl-container-evidence-tests.mjs";
import "./reviewed-fin-wasm-evidence-tests.mjs";
import "./reviewed-fin-promotion-source-history-tests.mjs";

const readPromotedSurface = async () => {
	const result = await readTypeSurface();
	result.document = JSON.parse(beforeNativeFinPromotionSource("docs/type-surface.v1.json", JSON.stringify(result.document, null, 2) + "\n"));
	return result;
};

test("reviewed Fin promotion cites nineteen unchanged original reports and artifact sets", async () => {
	const references = await reviewedFinPromotionReferences();
	assert.equal(references.length, 19);
	const { document } = await readPromotedSurface();
	const previous = JSON.parse(beforeReviewedFinPromotionSource("docs/type-surface.v1.json", await readFile("docs/type-surface.v1.json", "utf8")));
	assert.deepEqual(document.evidence.slice(previous.evidence.length).map(item => item.id), references.map(item => item.id));
	for(const reference of references)
	{
		const entry = document.evidence.find(item => item.id === reference.id);
		assert.equal(entry.kind, "installed");
		assert.equal(entry.revision, reference.revision);
		assert.match(entry.revision, /^[a-f0-9]{40}$/u);
		assert.equal(entry.command, reference.command);
		assert.ok(entry.command.includes("node --test"));
		assert.deepEqual(entry.artifacts, reference.artifacts.map(item => ({ ...item, path: `${reference.id}/${item.path}` })));
		assert.ok(entry.files.some(file => file.path === reference.receiptPath));
		assert.ok(entry.files.some(file => file.path === reference.reportPath && file.sha256 === reference.reportSha256));
		assert.ok(entry.files.some(file => file.path === reference.validator));
		for(const file of entry.files) assert.equal(sha256(beforeNativeFinPromotionSource(file.path, await readFile(file.path, "utf8"), file.sha256)), file.sha256, file.path);
	}
});

test("reviewed Fin promotion advances exactly twenty-eight parameter/result cells and no unrelated claims", async () => {
	const { document, ...contracts } = await readPromotedSurface();
	const previous = JSON.parse(beforeReviewedFinPromotionSource("docs/type-surface.v1.json", await readFile("docs/type-surface.v1.json", "utf8")));
	const added = document.observations.slice(previous.observations.length);
	const nativeProfiles = ["python", "rust", "dotnet", "java", "kotlin", "php-native", "ruby", "wit-wasi", "perl"];
	const npmProfiles = ["node-javascript", "node-typescript", "browser-javascript", "browser-react", "browser-worker"];
	assert.equal(added.length, 10);
	assert.deepEqual(added.flatMap(item => item.profiles), [...nativeProfiles, ...npmProfiles]);
	const references = await reviewedFinPromotionReferences();
	for(const cell of added)
	{
		assert.deepEqual(cell.shapes, ["fin"]);
		assert.deepEqual(cell.positions, ["parameter", "result"]);
		assert.equal(cell.path, "reviewed-ir");
		for(const profile of cell.profiles)
		{
			const selected = references.filter(item => item.sourcePath === "reviewed-ir" && item.profiles.includes(profile));
			for(const stage of Object.values(cell.stages))
			{
				assert.equal(stage.state, "passed");
				assert.deepEqual(stage.evidence, selected.map(item => item.id));
			}
			assert.ok(selected.some(item => item.kind === "scalar"));
			assert.ok(selected.some(item => ["containers", "structural"].includes(item.kind)));
		}
		assert.ok(cell.limitations.some(note => /nominal-field/iu.test(note)));
	}
	for(const [index, before] of previous.observations.entries())
	{
		const now = document.observations[index];
		if(!["npm-fin-refinements-ordinary-source", "npm-browser-fin-ordinary-source"].includes(before.id))
		{ assert.deepEqual(now, before, before.id); continue; }
		const expected = structuredClone(before);
		const ordinary = references.filter(item => item.npm && item.sourcePath === "ordinary-source").map(item => item.id);
		for(const stage of Object.values(expected.stages)) stage.evidence.push(...ordinary);
		assert.deepEqual(now, expected);
	}
	const cells = typeSurfaceCells(document, contracts), old = typeSurfaceCells(previous, contracts);
	const changed = cells.filter((cell, index) => JSON.stringify(cell.stages) !== JSON.stringify(old[index].stages));
	assert.equal(changed.filter(cell => cell.path === "reviewed-ir").length, 28);
	assert.equal(changed.filter(cell => cell.path === "ordinary-source").length, 10);
	for(const cell of changed)
	{
		assert.equal(cell.shape, "fin");
		assert.ok(["parameter", "result"].includes(cell.position));
		assert.notEqual(cell.profile, "php-wasm");
	}
	for(const key of Object.keys(previous).filter(key => !["evidence", "observations"].includes(key)))
		assert.deepEqual(document[key], previous[key], key);
});
