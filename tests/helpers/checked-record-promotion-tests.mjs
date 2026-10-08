/**
 * Keep checked-record claims within their exact installed hosts, routes and top-level positions.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { readTypeSurface, typeSurfaceCells } from "../../src/adoption/type-surface.mjs";
import { historicalTypeSurfaceCells } from "./historical-type-surface-cells.mjs";
import { checkedRecordPromotionReferences } from "./checked-record-promotion-references.mjs";
import { beforeCheckedRecordPromotionSource } from "./checked-record-promotion-source-history.mjs";
import "./checked-record-promotion-source-history-tests.mjs";

const previousSurface = async () => JSON.parse(beforeCheckedRecordPromotionSource("docs/type-surface.v1.json", await readFile("docs/type-surface.v1.json", "utf8")));

/**
 * Check the complete new observation set, including every excluded position and source route.
 *
 * @param document - Candidate promoted inventory.
 * @param previous - Authenticated predecessor inventory.
 * @param references - Authenticated installed selections.
 */
const assertPromotion = (document, previous, references) => {
	const added = document.observations.slice(previous.observations.length);
	assert.equal(added.length, 16);
	const expected = ["c", "cpp", "node-javascript", "node-typescript"].flatMap(profile =>
		["ordinary-source", "reviewed-ir"].flatMap(path => ["parameter", "result"].map(position => [profile, path, position])));
	assert.deepEqual(added.map(item => [item.profiles[0], item.path, item.positions[0]]), expected);
	for(const item of added)
	{
		assert.equal(item.profiles.length, 1); assert.equal(item.positions.length, 1);
		assert.deepEqual(item.shapes, ["checked-record"]);
		const selected = references.filter(ref => ref.profiles.includes(item.profiles[0]) && ref.sourcePath === item.path && ref.positions.includes(item.positions[0]));
		assert.equal(selected.length, item.path === "ordinary-source" && item.positions[0] === "result" ? 2 : 1);
		for(const stage of Object.values(item.stages))
		{ assert.equal(stage.state, "passed"); assert.deepEqual(stage.evidence, selected.map(ref => ref.id)); }
		assert.match(item.scope, /Interval, Sized 3 and Bounded 0 101 at top-level/u);
		assert.ok(item.limitations.some(note => /General dependent runtime payloads.*remain required and unpromoted/u.test(note)));
		assert.ok(item.limitations.some(note => /No field or callback observations/u.test(note)));
		const note = item.stages.installedExecution.note;
		assert.match(note, item.profiles[0] === "c" ? /entry, pre-validator, constructor, adapter and source/u : /Dispatch is unmeasured/u);
		if(item.profiles[0] === "node-typescript") assert.match(note, /declarations compile.*same installed package executes the Node runtime checks/u);
	}
	assert.deepEqual(document.observations.slice(0, previous.observations.length), previous.observations);
	assert.deepEqual(document.shapes.filter(shape => shape.id !== "checked-record"), previous.shapes);
	for(const key of Object.keys(previous).filter(key => !["shapes", "evidence", "observations"].includes(key))) assert.deepEqual(document[key], previous[key], key);
};

test("checked-record promotion preserves six archived selections and their measured runtime boundaries", async () => {
	const references = await checkedRecordPromotionReferences(), { document } = await readTypeSurface(), previous = await previousSurface();
	assert.deepEqual(document.evidence.slice(previous.evidence.length).map(item => item.id), references.map(item => item.id));
	assert.deepEqual(references.map(item => item.checks), [{ c: 2020, cpp: 2018 }, { c: 2020, cpp: 2018 }, { c: 1001, cpp: 1001 }, { npm: 1011 }, { npm: 1011 }, { npm: 1001 }]);
	for(const reference of references)
	{
		const entry = document.evidence.find(item => item.id === reference.id);
		assert.equal(entry.revision, reference.revision); assert.equal(entry.kind, "installed");
		assert.equal(entry.command, reference.command); assert.match(entry.command, /taskset -c 3 node --test/u);
		assert.ok(entry.scope.includes(reference.environment)); assert.ok(entry.scope.includes(reference.dispatch));
		for(const file of entry.files) assert.equal(sha256(await readFile(file.path)), file.sha256, file.path);
		assert.deepEqual(entry.artifacts, reference.artifacts.map(file => ({ ...file, path: `${reference.id}/${file.path}` })));
		for(const file of [reference.report, ...reference.executionFiles]) assert.ok(entry.files.some(pin => pin.path === file.path && pin.sha256 === file.sha256));
		assert.match(entry.scope, /No reconstructed analyzed-tree claim/u);
		if(reference.host === "c-cpp") assert.match(entry.scope, /host glibc 2\.36.*minimum 2\.38.*not execution on a measured 2\.38 host/u);
		else assert.match(entry.scope, /TypeScript 5\.9\.3.*strict true and skipLibCheck false/u);
	}
});

test("checked-record promotion adds sixteen cells without borrowing proof, dependent or browser coverage", async () => {
	const { document, ...contracts } = await readTypeSurface(), previous = await previousSurface(), references = await checkedRecordPromotionReferences();
	assertPromotion(document, previous, references);
	const cells = typeSurfaceCells(document, contracts), old = historicalTypeSurfaceCells(previous, contracts);
	const byId = new Map(cells.map(cell => [cell.id, cell]));
	for(const cell of old) assert.deepEqual(byId.get(cell.id), cell, cell.id);
	const checked = cells.filter(cell => cell.shape === "checked-record");
	assert.equal(checked.length, 170);
	assert.equal(checked.filter(cell => cell.stages.installedExecution.state === "passed").length, 16);
	for(const cell of checked)
		if(!["c", "cpp", "node-javascript", "node-typescript"].includes(cell.profile) || !["parameter", "result"].includes(cell.position))
			for(const stage of Object.values(cell.stages)) assert.equal(stage.state, "unreviewed", cell.id);
	for(const cell of cells.filter(cell => ["dependent", "proof"].includes(cell.shape)))
		for(const stage of Object.values(cell.stages)) assert.equal(stage.state, "unreviewed", cell.id);
	const first = previous.observations.length;
	for(const mutate of [
		value => { value.observations[first].profiles = ["browser-javascript"]; }
		, value => { value.observations[first].positions = ["field"]; }
		, value => { value.observations[first].shapes = ["dependent"]; }
		, value => { value.observations[first].stages.installedExecution.evidence.push("checked-record-result-only-c-cpp-installed"); }
		, value => { value.observations[first].limitations = []; }
	]) {
		const changed = structuredClone(document); mutate(changed);
		assert.throws(() => assertPromotion(changed, previous, references));
	}
});
