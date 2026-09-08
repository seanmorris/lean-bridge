/**
 * Check scene input persistence and disposal of current and superseded Lean frames.
 *
 * @file
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { createSceneSession, getBrowserSceneSession } from "./scene-session.mjs";
import { createFrameController } from "./frame-controller.mjs";

const settle = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => {
	let resolve;
	const promise = new Promise(accept => { resolve = accept; });
	return { promise, resolve };
};
const answer = { candidates: Uint32Array.of(0, 1), overlaps: new Uint32Array() };
const prepared = () => {
	let releases = 0;
	let calls = 0;
	const solve = () => { calls++; return answer; };
	solve.dispose = () => { releases++; };
	return { solve, releases: () => releases, calls: () => calls };
};

test("scene sessions preserve exact edits without mutating earlier snapshots", () => {
	const session = createSceneSession();
	const initial = session.getSnapshot();
	let updates = 0;
	const unsubscribe = session.subscribe(() => updates++);
	session.select(3);
	session.move(3, 1e6, -10);
	session.update({ axis: 1 }, true);
	assert.equal(initial.bodies[3].x, 477);
	assert.equal(session.getSnapshot().bodies[3].x, 900 - 115 - 12);
	assert.equal(session.getSnapshot().bodies[3].y, 12);
	assert.equal(session.getSnapshot().axis, 1);
	assert.equal(session.getSnapshot().allLinks, false);
	assert.equal(session.getSnapshot().revision, 2);
	assert.equal(updates, 3);
	unsubscribe();
	session.advance(.4);
	assert.equal(updates, 3);
});

test("seeded scenes reproduce inputs and advance only an unedited seed", () => {
	const session = createSceneSession();
	session.update({ seed: "2026", seedEdited: true, count: 24 });
	session.generate();
	const first = session.getSnapshot().bodies;
	assert.equal(first.length, 24);
	session.update({ seed: "2026", seedEdited: true });
	session.generate();
	assert.deepEqual(session.getSnapshot().bodies, first);
	session.generate();
	assert.equal(session.getSnapshot().seed, "2027");
	assert.notDeepEqual(session.getSnapshot().bodies, first);
	session.reset();
	assert.equal(session.getSnapshot().bodies.length, 6);
	assert.equal(session.getSnapshot().axis, 0);
	assert.equal(session.getSnapshot().selected, 0);
	assert.equal(session.getSnapshot().allLinks, true);
});

test("server sessions never share mutable state between renders", () => {
	const a = getBrowserSceneSession();
	const b = getBrowserSceneSession();
	a.move(0, 100, 100);
	assert.equal(b.getSnapshot().bodies[0].x, 98);
});

test("current-frame solvers snapshot input and release exactly once", async () => {
	const solve = prepared();
	const states = [];
	const waiting = deferred();
	const controller = createFrameController({ loadRuntime: () => waiting.promise, onState: state => states.push(state) });
	const input = createSceneSession().getSnapshot();
	controller.request(input);
	input.bodies[0].x = 400;
	waiting.resolve({ prepareSweep: async () => solve.solve });
	await settle();
	assert.equal(states[0].input.bodies[0].x, 98);
	assert.deepEqual(states[0].answer, answer);
	assert.equal(solve.releases(), 1);
	controller.dispose();
	assert.equal(solve.releases(), 1);
});

test("late preparation is released without drawing after unmount", async () => {
	const waiting = deferred();
	const solve = prepared();
	const states = [];
	const controller = createFrameController({ loadRuntime: async () => ({ prepareSweep: () => waiting.promise }), onState: state => states.push(state) });
	controller.request(createSceneSession().getSnapshot());
	await settle();
	controller.dispose();
	waiting.resolve(solve.solve);
	await settle();
	assert.equal(solve.releases(), 1);
	assert.equal(solve.calls(), 0);
	assert.deepEqual(states, []);
});

test("superseded frames coalesce and never publish an obsolete axis", async () => {
	const first = deferred();
	const discarded = prepared();
	const latest = prepared();
	const inputs = [];
	const states = [];
	const controller = createFrameController({
		loadRuntime: async () => ({ prepareSweep: input => { inputs.push(input); return inputs.length === 1 ? first.promise : Promise.resolve(latest.solve); } })
		, onState: state => states.push(state)
	});
	const session = createSceneSession();
	controller.request(session.getSnapshot());
	await settle();
	session.move(0, 100, 100);
	controller.request(session.getSnapshot());
	session.update({ axis: 1 }, true);
	controller.request(session.getSnapshot());
	first.resolve(discarded.solve);
	await settle();
	assert.equal(discarded.calls(), 0);
	assert.equal(discarded.releases(), 1);
	assert.equal(latest.releases(), 1);
	assert.equal(inputs.length, 2);
	assert.equal(states.length, 1);
	assert.equal(states[0].input.axis, 1);
	assert.equal(states[0].input.bodies[0].x, 100);
	controller.dispose();
});

test("hidden pages release late handles and resume the newest pending input", async () => {
	const waiting = deferred();
	const stale = prepared();
	const current = prepared();
	const states = [];
	let count = 0;
	const controller = createFrameController({ loadRuntime: async () => ({ prepareSweep: () => ++count === 1 ? waiting.promise : Promise.resolve(current.solve) }), onState: state => states.push(state) });
	const session = createSceneSession();
	controller.request(session.getSnapshot());
	await settle();
	controller.suspend();
	session.move(0, 200, 200);
	controller.request(session.getSnapshot());
	waiting.resolve(stale.solve);
	await settle();
	assert.deepEqual(states, []);
	assert.equal(stale.releases(), 1);
	controller.resume();
	await settle();
	assert.equal(states[0].input.bodies[0].x, 200);
	assert.equal(current.releases(), 1);
	controller.dispose();
});

test("failed current frames report an error and remain retryable", async () => {
	let fails = true;
	const solve = prepared();
	const states = [];
	const controller = createFrameController({ loadRuntime: async () => { if(fails) throw new Error("load failed"); return { prepareSweep: async () => solve.solve }; }, onState: state => states.push(state) });
	const input = createSceneSession().getSnapshot();
	controller.request(input);
	await settle();
	assert.equal(states[0].status, "error");
	fails = false;
	controller.request(input);
	await settle();
	assert.equal(states[1].status, "ready");
	assert.equal(solve.releases(), 1);
	controller.dispose();
});

test("the React frame controller obtains example pairs from the unchanged Wasm runtime", async () => {
	const result = deferred();
	const controller = createFrameController({ loadRuntime: () => import("./runtime.mjs"), onState: state => result.resolve(state) });
	controller.request(createSceneSession().getSnapshot());
	const frame = await result.promise;
	assert.equal(frame.status, "ready");
	assert.equal(frame.answer.candidates.length, 4);
	assert.equal(frame.answer.overlaps.length, 2);
	controller.dispose();
});
