/** @file Verify routing and owner lifetime rules for shared Wasm task subscriptions. */
import assert from "node:assert/strict";
import test from "node:test";
import { createWasmTaskNotifications } from "../src/runtime/wasm-task-notifications.mjs";

test("one runtime routes independent subscribers, including reentrant delivery", () => {
	const owner = createWasmTaskNotifications(2), order = [];
	const a = owner.subscribe(() => {
		order.push("A");
		assert.equal(owner.notify(a.token), false);
		assert.equal(owner.notify(b.token), true);
	});
	const b = owner.subscribe(() => order.push("B"));
	assert.throws(() => owner.subscribe(() => {}), RangeError);
	assert.equal(owner.notify(a.token), true);
	assert.deepEqual(order, ["A", "B"]);
	assert.equal(owner.pending(), 0);
	assert.equal(owner.notify(b.token), false);
});

test("a detached or failed subscriber cannot consume the next notification", () => {
	const owner = createWasmTaskNotifications(1), visits = [];
	const old = owner.subscribe(() => assert.fail("detached handler called"));
	assert.equal(old.detach(), true); assert.equal(old.detach(), false);
	const next = owner.subscribe(() => { visits.push("ready"); throw new Error("observer failure"); });
	assert.notEqual(next.token, old.token);
	assert.equal(owner.notify(old.token), false);
	assert.throws(() => owner.notify(next.token), /observer failure/u);
	assert.equal(owner.pending(), 0); assert.deepEqual(visits, ["ready"]);
	assert.equal(owner.notify(next.token), false);
});
