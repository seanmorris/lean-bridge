/**
 * Check route cleanup, copied input snapshots, and pending prepared-handle ownership.
 *
 * @file
 */

import assert from "node:assert/strict";
import test from "node:test";
import { createWorkbenchScope } from "./workbench-scope.mjs";

const fixture = options => {
	const window = new EventTarget();
	const root = new EventTarget();
	const frames = new Map();
	const timers = new Map();
	let nextId = 0;
	window.requestAnimationFrame = callback => { frames.set(++nextId, callback); return nextId; };
	window.cancelAnimationFrame = id => frames.delete(id);
	window.setTimeout = callback => { timers.set(++nextId, callback); return nextId; };
	window.clearTimeout = id => timers.delete(id);
	root.ownerDocument = { defaultView: window };
	root.querySelectorAll = () => [];
	return { root, window, frames, timers, scope: createWorkbenchScope(root, options) };
};

test("unmount removes listeners, frames, timers, and snapshots inputs before pagehide", () => {
	let saved;
	const { scope, root, window, frames, timers } = fixture({ remember: value => { saved = value; } });
	const input = { walls: new Uint8Array([0, 1]), keys: new Set([2]), ledges: new Map([[7, "up-left"]]) };
	let clicks = 0;
	scope.remember(() => input);
	scope.listen(root, "click", () => clicks++);
	scope.listen(window, "pagehide", () => input.walls.fill(0));
	scope.requestAnimationFrame(() => assert.fail("Unmounted frame ran"));
	scope.setTimeout(() => assert.fail("Unmounted timer ran"), 1);
	root.dispatchEvent(new Event("click"));
	scope.dispose();
	scope.dispose();
	root.dispatchEvent(new Event("click"));
	assert.equal(clicks, 1);
	assert.equal(scope.active, false);
	assert.equal(frames.size, 0);
	assert.equal(timers.size, 0);
	assert.deepEqual([...saved.walls], [0, 1]);
	assert.notEqual(saved.keys, input.keys);
	assert.deepEqual(saved.ledges, input.ledges);
});

test("late preparation is disposed and rejected instead of updating an unmounted route", async () => {
	const { scope } = fixture();
	let resolve;
	let disposed = 0;
	const runtime = scope.runtime({ prepare: () => new Promise(accept => { resolve = accept; }) });
	const pending = runtime.prepare();
	scope.dispose();
	resolve({ dispose: () => disposed++ });
	await assert.rejects(pending, { name: "AbortError" });
	assert.equal(disposed, 1);
	assert.throws(() => runtime.prepare(), { name: "AbortError" });
});

test("prepared hot calls keep their identity and explicit disposal is not repeated", async () => {
	const { scope } = fixture();
	let disposed = 0;
	const solver = value => value + 1;
	solver.dispose = () => disposed++;
	const runtime = scope.runtime({ prepare: async () => solver });
	const prepared = await runtime.prepare();
	assert.equal(prepared, solver, "No proxy overhead in the timed algorithm call");
	assert.equal(prepared(3), 4);
	prepared.dispose();
	scope.dispose();
	assert.equal(disposed, 1);
});

test("owned handles release once and stale initialization failures stay silent", async () => {
	let failures = 0;
	const { scope } = fixture({ fail: () => failures++ });
	let released = 0;
	const runtime = scope.runtime({ prepare: async () => ({ dispose: () => released++ }) });
	await runtime.prepare();
	await runtime.prepare();
	scope.fail(new Error("Initialization failed"));
	scope.dispose();
	scope.fail(new Error("Stale initialization failed"));
	assert.equal(released, 2);
	assert.equal(failures, 1);
});

test("a failing snapshot or disposer cannot prevent the remaining cleanup", () => {
	const { scope, frames } = fixture();
	let released = false;
	scope.remember(() => { throw new Error("Snapshot failed"); });
	scope.onDispose(() => { throw new Error("One disposer failed"); });
	scope.onDispose(() => { released = true; });
	scope.requestAnimationFrame(() => assert.fail("Unmounted frame ran"));
	assert.throws(() => scope.dispose(), { name: "AggregateError" });
	assert.equal(released, true);
	assert.equal(frames.size, 0);
	assert.equal(scope.active, false);
});

test("unmount releases an active drag's pointer capture", () => {
	const { scope, root } = fixture();
	let captured = true;
	root.querySelectorAll = () => [{
		hasPointerCapture: id => captured && id === 9
		, releasePointerCapture: id => { assert.equal(id, 9); captured = false; }
	}];
	const event = new Event("pointerdown");
	event.pointerId = 9;
	root.dispatchEvent(event);
	scope.dispose();
	assert.equal(captured, false);
});
