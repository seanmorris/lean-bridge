/**
 * Capacity-state and asynchronous ownership contracts for the React workbench.
 *
 * @file
 */

import test from "node:test";
import assert from "node:assert/strict";
import { createNetwork } from "./network.mjs";
import { createNetworkSession } from "./network-session.mjs";
import { createFlowController } from "./flow-controller.mjs";

const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => {
	let resolve;
	let reject;
	const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
	return { promise, resolve, reject };
};
const fakeFrameClock = () => {
	let sequence = 0;
	const frames = new Map();
	return {
		requestFrame: callback => { const handle = ++sequence; frames.set(handle, callback); return handle; }
		, cancelFrame: handle => frames.delete(handle)
		, size: () => frames.size
		, flush: () => { const callbacks = [...frames.values()]; frames.clear(); for(const callback of callbacks) callback(); }
	};
};
const fakeSolve = value => {
	let calls = 0;
	let releases = 0;
	const solve = () => { calls++; return { value, cutCapacity: value, flows: new Uint32Array(8), sourceSide: new Uint32Array(6) }; };
	return Object.assign(solve, { dispose: () => { releases++; }, calls: () => calls, releases: () => releases });
};

test("capacity session retains selection, explicit motion, edits and baseline without storing runtime handles", () => {
	const session = createNetworkSession();
	let notifications = 0;
	const unsubscribe = session.subscribe(() => notifications++);
	session.acceptBaseline(9, "c-sink,d-sink");
	session.widen();
	session.select("a-c");
	session.setCapacity(13);
	session.pauseMotion(true);
	const snapshot = session.getSnapshot();
	assert.equal(snapshot.selected, "a-c");
	assert.equal(snapshot.network.edges.find(edge => edge.id === "a-c").capacity, 13);
	assert.equal(snapshot.network.edges.find(edge => edge.id === "c-sink").capacity, 9);
	assert.equal(snapshot.motionPaused, true);
	assert.deepEqual(snapshot.baseline, { value: 9, cut: "c-sink,d-sink" });
	assert.equal(snapshot.hasEdits, true);
	assert.equal(snapshot.revision, 2);
	unsubscribe();
	const before = notifications;
	session.reset();
	assert.equal(notifications, before);
	assert.deepEqual(session.getSnapshot().network, createNetwork());
	assert.equal(session.getSnapshot().motionPaused, true);
	assert.equal(session.getSnapshot().baseline, undefined);
	assert.equal(createNetworkSession().getSnapshot().motionPaused, null);
});

test("capacity snapshots are independent and limits remain integral from zero through twenty", () => {
	const session = createNetworkSession();
	const copy = session.getSnapshot();
	copy.network.edges[0].capacity = 1000;
	copy.network.nodes[0].name = "Mutated";
	assert.deepEqual(session.getSnapshot().network, createNetwork());
	for(const [input, output] of [[23, 20], [-1, 0], [3.8, 4], ["12", 12], [Infinity, 0], ["no", 0]])
	{
		session.setCapacity(input);
		assert.equal(session.getSnapshot().network.edges.find(edge => edge.id === "c-sink").capacity, output);
	}
	assert.throws(() => session.select("missing"), /Unknown network edge/);
	session.acceptBaseline(99, "wrong-after-edit");
	assert.equal(session.getSnapshot().baseline, undefined);
});

test("frame coalescing solves only the newest copied network and disposes its handle", async () => {
	const clock = fakeFrameClock();
	const states = [];
	const requests = [];
	const solve = fakeSolve(14);
	const controller = createFlowController({ ...clock, onState: state => states.push(state), loadRuntime: async () => ({ prepareGraph: async request => { requests.push(request); return solve; } }) });
	const network = createNetwork();
	controller.schedule(network);
	network.edges[6].capacity = 9;
	controller.schedule(network);
	network.edges[6].capacity = 20;
	assert.equal(clock.size(), 1);
	clock.flush();
	await tick();
	assert.equal(requests.length, 1);
	assert.equal(requests[0].capacities[6], 9);
	assert.equal(states.at(-1).result.answer.value, 14);
	assert.equal(solve.calls(), 1);
	assert.equal(solve.releases(), 1);
	controller.dispose();
	controller.dispose();
	assert.equal(solve.releases(), 1);
});

test("late prepared handles after navigation are released without executing or publishing", async () => {
	const preparation = deferred();
	const states = [];
	const solve = fakeSolve(9);
	const controller = createFlowController({ onState: state => states.push(state), loadRuntime: async () => ({ prepareGraph: () => preparation.promise }) });
	controller.schedule(createNetwork(), true);
	await tick();
	controller.dispose();
	preparation.resolve(solve);
	await tick();
	assert.equal(solve.calls(), 0);
	assert.equal(solve.releases(), 1);
	assert.deepEqual(states.map(state => state.status), ["pending"]);
});

test("a stale older solve cannot overwrite an edited network", async () => {
	const first = deferred();
	const second = deferred();
	const oldSolve = fakeSolve(9);
	const newSolve = fakeSolve(14);
	let prepares = 0;
	const states = [];
	const controller = createFlowController({ onState: state => states.push(state), loadRuntime: async () => ({ prepareGraph: () => ++prepares === 1 ? first.promise : second.promise }) });
	controller.schedule(createNetwork(), true);
	await tick();
	const network = createNetwork();
	network.edges[6].capacity = 9;
	controller.schedule(network, true);
	await tick();
	second.resolve(newSolve);
	await tick();
	first.resolve(oldSolve);
	await tick();
	assert.equal(states.at(-1).result.answer.value, 14);
	assert.equal(oldSolve.calls(), 0);
	assert.equal(oldSolve.releases(), 1);
	assert.equal(newSolve.releases(), 1);
	controller.dispose();
});

test("hidden-page suspension cancels frames and resumes the latest network once", async () => {
	const clock = fakeFrameClock();
	let loads = 0;
	const solve = fakeSolve(9);
	const controller = createFlowController({ ...clock, onState: () => {}, loadRuntime: async () => { loads++; return { prepareGraph: async () => solve }; } });
	controller.schedule(createNetwork());
	controller.suspend();
	assert.equal(clock.size(), 0);
	controller.schedule(createNetwork());
	clock.flush();
	assert.equal(loads, 0);
	controller.resume();
	controller.resume();
	await tick();
	assert.equal(loads, 1);
	assert.equal(solve.releases(), 1);
	controller.dispose();
	controller.resume();
	assert.equal(loads, 1);
});

test("runtime failures are local and retry can recover", async () => {
	let fail = true;
	const states = [];
	const solve = fakeSolve(9);
	const controller = createFlowController({ onState: state => states.push(state), loadRuntime: async () => { if(fail) throw new Error("Offline"); return { prepareGraph: async () => solve }; } });
	controller.schedule(createNetwork(), true);
	await tick();
	assert.equal(states.at(-1).status, "error");
	fail = false;
	controller.schedule(createNetwork(), true);
	await tick();
	assert.equal(states.at(-1).status, "ready");
	assert.equal(solve.releases(), 1);
	controller.dispose();
});

test("suspending a pending preparation releases its stale handle and resumes with a fresh solve", async () => {
	const preparation = deferred();
	const stale = fakeSolve(9);
	const fresh = fakeSolve(14);
	const states = [];
	let prepares = 0;
	const controller = createFlowController({ onState: state => states.push(state), loadRuntime: async () => ({ prepareGraph: () => ++prepares === 1 ? preparation.promise : Promise.resolve(fresh) }) });
	controller.schedule(createNetwork(), true);
	await tick();
	controller.suspend();
	preparation.resolve(stale);
	await tick();
	assert.equal(stale.calls(), 0);
	assert.equal(stale.releases(), 1);
	assert.deepEqual(states.map(state => state.status), ["pending"]);
	controller.resume();
	await tick();
	assert.equal(states.at(-1).result.answer.value, 14);
	assert.equal(fresh.releases(), 1);
	controller.dispose();
});

test("a thrown compiled solve releases its prepared handle and reports a local error", async () => {
	let releases = 0;
	const solve = Object.assign(() => { throw new Error("Malformed result"); }, { dispose: () => releases++ });
	const states = [];
	const controller = createFlowController({ onState: state => states.push(state), loadRuntime: async () => ({ prepareGraph: async () => solve }) });
	controller.schedule(createNetwork(), true);
	await tick();
	assert.equal(states.at(-1).status, "error");
	assert.equal(states.at(-1).error.message, "Malformed result");
	assert.equal(releases, 1);
	controller.dispose();
});

test("the unchanged compiled Lean solver still moves the bottleneck from nine to fourteen", async () => {
	const runtime = await import("./runtime.mjs");
	const states = [];
	const controller = createFlowController({ loadRuntime: async () => runtime, onState: state => states.push(state) });
	const network = createNetwork();
	controller.schedule(network, true);
	for(let attempt = 0; states.at(-1)?.status === "pending" && attempt < 100; attempt++) await new Promise(resolve => setTimeout(resolve, 20));
	assert.equal(states.at(-1).result.answer.value, 9);
	assert.equal(states.at(-1).result.answer.cutCapacity, 9);
	network.edges[6].capacity = 9;
	controller.schedule(network, true);
	await tick();
	assert.equal(states.at(-1).result.answer.value, 14);
	assert.equal(states.at(-1).result.answer.cutCapacity, 14);
	controller.dispose();
});
