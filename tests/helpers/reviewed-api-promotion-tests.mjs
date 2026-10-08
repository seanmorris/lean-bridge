/**
 * Limit reviewed API promotion to exact archived hosts, source routes and positions.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { readTypeSurface } from "../../src/adoption/type-surface.mjs";
import { beforeSubtypeAliasPositionSource } from "./subtype-alias-position-source-history.mjs";
import { historicalTypeSurfaceCells as typeSurfaceCells } from "./historical-type-surface-cells.mjs";
import { reviewedApiPromotionReferences } from "./reviewed-api-promotion-references.mjs";
import { beforeReviewedApiPromotionSource } from "./reviewed-api-promotion-source-history.mjs";
import "./reviewed-api-promotion-source-history-tests.mjs";
import "./reviewed-subtype-evidence-tests.mjs";
import "./reviewed-specialization-evidence-tests.mjs";

const readPromotedSurface = async () => {
	const result = await readTypeSurface();
	result.document = JSON.parse(beforeSubtypeAliasPositionSource("docs/type-surface.v1.json", JSON.stringify(result.document, null, 2) + "\n"));
	return result;
};

test("reviewed API promotion authenticates four original report sets without rewriting their receipts", async () => {
	const references = await reviewedApiPromotionReferences();
	assert.equal(references.length, 4);
	const { document } = await readPromotedSurface();
	const previous = JSON.parse(beforeReviewedApiPromotionSource("docs/type-surface.v1.json", await readFile("docs/type-surface.v1.json", "utf8")));
	assert.deepEqual(document.evidence.slice(previous.evidence.length).map(item => item.id), references.map(item => item.id));
	for(const reference of references)
	{
		const entry = document.evidence.find(item => item.id === reference.id);
		assert.equal(entry.kind, "installed");
		assert.equal(entry.revision, reference.revision);
		assert.equal(entry.command, reference.command);
		assert.match(entry.revision, /^[a-f0-9]{40}$/u);
		assert.match(entry.command, /node --test/u);
		assert.deepEqual(entry.artifacts, reference.artifacts.map(item => ({ ...item, path: `${reference.id}/${item.path}` })));
		assert.ok(entry.files.some(file => file.path === reference.receiptPath));
		assert.ok(entry.files.some(file => file.path === reference.reportPath && file.sha256 === reference.reportSha256));
		assert.ok(entry.files.some(file => file.path === reference.validator));
		for(const file of entry.files) assert.equal(sha256(beforeSubtypeAliasPositionSource(file.path, await readFile(file.path, "utf8"))), file.sha256, file.path);
		assert.match(entry.scope, /Browser, other-host and dispatch-counter coverage is not inferred/u);
		assert.match(entry.scope, /does not establish another floor or hosted CI/u);
	}
});

test("reviewed API promotion advances exactly twenty observed cells and preserves every older claim", async () => {
	const { document, ...contracts } = await readPromotedSurface();
	const previous = JSON.parse(beforeReviewedApiPromotionSource("docs/type-surface.v1.json", await readFile("docs/type-surface.v1.json", "utf8")));
	const references = await reviewedApiPromotionReferences();
	for(const before of previous.observations)
	{
		const now = document.observations.find(item => item.id === before.id);
		if(before.id !== "javascript-delivery")
		{ assert.deepEqual(now, before, before.id); continue; }
		const expected = structuredClone(before);
		expected.shapes = expected.shapes.filter(shape => shape !== "generic");
		delete expected.hostTypes.generic;
		assert.deepEqual(now, expected);
		const browser = document.observations.find(item => item.id === "javascript-reviewed-browser-generic-unverified");
		assert.deepEqual(browser, { ...before, id: browser.id
			, profiles: before.profiles.filter(profile => profile.startsWith("browser-"))
			, shapes: ["generic"], hostTypes: { generic: before.hostTypes.generic } });
	}
	assert.equal(document.observations.length, previous.observations.length + 5);
	const added = document.observations.filter(item => references.some(reference => item.id === reference.id.replace(/-installed$/u, "-reviewed-ir")));
	assert.equal(added.length, 4);
	for(const [index, observation] of added.entries())
	{
		const reference = references[index], subtype = reference.kind === "subtype";
		assert.equal(observation.id, reference.id.replace(/-installed$/u, "-reviewed-ir"));
		assert.equal(observation.path, "reviewed-ir");
		assert.deepEqual(observation.profiles, reference.profiles);
		assert.deepEqual(observation.shapes, subtype ? ["subtype"] : ["generic", "implicit", "instance"]);
		assert.deepEqual(observation.positions, subtype ? ["parameter", "result"] : ["signature"]);
		for(const stage of Object.values(observation.stages))
		{
			assert.equal(stage.state, "passed");
			assert.deepEqual(stage.evidence, [reference.id]);
		}
		assert.ok(observation.limitations.some(note => /Browser and other native-host execution remain separate/u.test(note)));
		assert.ok(observation.limitations.some(note => /no integrated CI, additional runtime-floor or measured-dispatch/u.test(note)));
		assert.ok(observation.limitations.some(note => subtype ? /nested, nominal-field and callback Subtype positions are not promoted/u.test(note)
			: /generic-record instantiation, recursive, inherited and dependent generic structures are not promoted/u.test(note)));
	}
	const current = typeSurfaceCells(document, contracts), before = typeSurfaceCells(previous, contracts);
	const changed = current.filter((cell, index) => JSON.stringify(cell.stages) !== JSON.stringify(before[index].stages));
	assert.equal(changed.length, 20);
	assert.equal(changed.filter(cell => cell.shape === "subtype").length, 8);
	assert.equal(changed.filter(cell => cell.shape !== "subtype").length, 12);
	for(const cell of changed)
	{
		assert.equal(cell.path, "reviewed-ir");
		assert.ok(["c", "cpp", "node-javascript", "node-typescript"].includes(cell.profile));
		assert.ok(cell.shape === "subtype" ? ["parameter", "result"].includes(cell.position) : cell.position === "signature");
		assert.equal(cell.stages.installedExecution.state, "passed");
	}
	for(const key of Object.keys(previous).filter(key => !["evidence", "observations"].includes(key)))
		assert.deepEqual(document[key], previous[key], key);
});
