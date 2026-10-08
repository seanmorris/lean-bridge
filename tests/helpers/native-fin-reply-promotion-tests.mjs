/**
 * Keep contained host-reply support cumulative, local and ordinary-source only.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { readTypeSurface, typeSurfaceCells } from "../../src/adoption/type-surface.mjs";
import { beforeNativeFinReplyPromotionSource } from "./native-fin-reply-promotion-source-history.mjs";
import { nativeFinReplyPromotionDirections, nativeFinReplyPromotionFailure, nativeFinReplyPromotionId, nativeFinReplyPromotionLimit, nativeFinReplyPromotionObservation, nativeFinReplyPromotionObservationIds, nativeFinReplyPromotionReference, nativeFinReplyPromotionValidators } from "./native-fin-reply-promotion-references.mjs";

const predecessor = async () => JSON.parse(beforeNativeFinReplyPromotionSource("docs/type-surface.v1.json", await readFile("docs/type-surface.v1.json", "utf8")));
const validate = (document, previous, reference, contracts) => {
	assert.equal(document.observations.length, previous.observations.length);
	for(const [index, observation] of previous.observations.entries())
		assert.deepEqual(document.observations[index], nativeFinReplyPromotionObservationIds.includes(observation.id)
			? nativeFinReplyPromotionObservation(observation) : observation, observation.id);
	for(const key of Object.keys(previous).filter(key => !["observations", "evidence"].includes(key)))
		assert.deepEqual(document[key], previous[key], key);
	assert.equal(document.evidence.length, previous.evidence.length + 1);
	const entry = document.evidence.at(-1);
	assert.deepEqual({ id: entry.id, kind: entry.kind, revision: entry.revision, command: entry.command, scope: entry.scope, artifacts: entry.artifacts },
		{ id: reference.id, kind: "installed", revision: reference.revision, command: reference.command, scope: reference.scope, artifacts: reference.artifacts });
	assert.deepEqual(entry.files.map(file => file.path), [...nativeFinReplyPromotionValidators, ...reference.files.map(file => file.path)]);
	const old = new Map(typeSurfaceCells(previous, contracts).map(cell => [cell.id, cell]));
	const changed = [];
	for(const cell of typeSurfaceCells(document, contracts))
	{
		const before = old.get(cell.id); assert.ok(before, cell.id);
		if(nativeFinReplyPromotionObservationIds.includes(cell.observation))
		{
			assert.equal(cell.path, "ordinary-source"); assert.equal(cell.shape, "fin");
			assert.deepEqual(Object.values(cell.stages).map(stage => stage.state), Object.values(before.stages).map(stage => stage.state));
			for(const stage of Object.values(cell.stages)) assert.deepEqual(stage.evidence, ["native-callback-fin-ordinary-installed", nativeFinReplyPromotionId]);
			if(cell.position === "callback-parameter") assert.equal(cell.hostType, before.hostType);
			changed.push(cell.id);
		}
		else assert.deepEqual(cell, before, cell.id);
	}
	assert.deepEqual(changed.sort(), ["c", "cpp"].flatMap(profile => ["callback-parameter", "callback-result"].map(position => `${profile}/fin/ordinary-source/${position}`)).sort());
	assert.equal(typeSurfaceCells(document, contracts).filter(cell => cell.stages.installedExecution.state === "passed").length,
		[...old.values()].filter(cell => cell.stages.installedExecution.state === "passed").length, "no newly passed cells");
};

test("native host-reply promotion authenticates its original producers, sources and installed archives", async () => {
	const reference = await nativeFinReplyPromotionReference(), { document } = await readTypeSurface();
	const entry = document.evidence.at(-1);
	assert.equal(entry.id, reference.id); assert.equal(entry.artifacts.length, 2);
	assert.deepEqual(entry.files.map(file => file.path), [...nativeFinReplyPromotionValidators, ...reference.files.map(file => file.path)]);
	for(const file of entry.files) assert.equal(sha256(await readFile(file.path)), file.sha256, file.path);
	for(const file of reference.files) assert.ok(entry.files.some(pin => pin.path === file.path && pin.sha256 === file.sha256), file.path);
});

test("host-reply reconciliation preserves every other observation and adds no passed cells", async () => {
	const { document, ...contracts } = await readTypeSurface(), previous = await predecessor();
	assert.equal(previous.observations.length, 490); assert.equal(previous.evidence.length, 264);
	validate(document, previous, await nativeFinReplyPromotionReference(), contracts);
});

test("host-reply reconciliation refuses broader types, hosts, source routes, counters and lost earlier directions", async () => {
	const { document, ...contracts } = await readTypeSurface(), previous = await predecessor(), reference = await nativeFinReplyPromotionReference();
	let controls = 0;
	for(const id of nativeFinReplyPromotionObservationIds)
	{
		const index = document.observations.findIndex(item => item.id === id);
		const mutations = [
			item => { item.profiles = ["python"]; }
			, item => { item.path = "reviewed-ir"; }
			, item => { item.shapes = ["subtype"]; }
			, item => { item.positions.push("field"); }
			, item => { item.positions = ["callback-result"]; }
			, item => { item.hostTypes.fin["callback-parameter"] = "unbounded integer"; }
			, item => { item.hostTypes.fin["callback-result"] = "bare Fin replies"; }
			, item => { item.limitations = []; }
			, item => { item.scope = "All host replies supported"; }
			, item => { item.conversionNotes.fin += " Effects are rolled back."; }
		];
		for(const stage of document.stages) for(const append of [false, true])
			mutations.push(item => { item.stages[stage].note = (append ? item.stages[stage].note + " " : "") + "Reviewed native replies and installed source dispatch measured."; });
		for(const stage of document.stages)
		{
			mutations.push(item => { item.stages[stage].evidence = [nativeFinReplyPromotionId]; });
			mutations.push(item => { item.stages[stage].evidence = ["native-callback-fin-ordinary-installed"]; });
		}
		for(const mutate of mutations)
		{
			const changed = structuredClone(document); mutate(changed.observations[index]);
			assert.throws(() => validate(changed, previous, reference, contracts), assert.AssertionError); controls++;
		}
	}
	assert.equal(controls, 60);
	for(const mutate of [
		value => { value.observations[0].scope += " changed"; }
		, value => { value.observations.push(structuredClone(value.observations.at(-1))); }
		, value => { value.evidence.at(-1).scope += " ASan covers the Lean runtime."; }
		, value => { value.evidence.at(-1).revision = "0".repeat(40); }
		, value => { value.evidence.at(-1).artifacts.pop(); }
	]) {
		const changed = structuredClone(document); mutate(changed);
		assert.throws(() => validate(changed, previous, reference, contracts), assert.AssertionError);
	}
});

test("host-reply promotion refuses corruption of every original receipt, output and selected producer source", async () => {
	const reference = await nativeFinReplyPromotionReference();
	for(const file of reference.files)
		await assert.rejects(() => nativeFinReplyPromotionReference(async path => {
			assert.ok(!path.startsWith("/"));
			const bytes = await readFile(path);
			return path === file.path ? Buffer.concat([bytes, Buffer.from("\n")]) : bytes;
		}), assert.AssertionError, file.path);
});

test("C/C++ conversion tables distinguish ordinary contained host replies from earlier reviewed closure directions", async () => {
	for(const profile of ["c", "cpp"])
	{
		const text = await readFile(`docs/consume/${profile}.md`, "utf8"), row = text.split("\n").find(line => line.startsWith("| `Fin n` |"));
		for(const required of [nativeFinReplyPromotionDirections, nativeFinReplyPromotionFailure, nativeFinReplyPromotionLimit]) assert.ok(row.includes(required), required);
		assert.ok(text.includes("../evidence/native-fin-replies-20261008/receipt.json"));
		assert.ok(row.includes("callback-result coverage here means results produced by Lean"), "retain the separate reviewed observation's direction");
	}
});
