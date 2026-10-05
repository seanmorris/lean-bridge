/**
 * Deterministic host-root, pin, publication and deferred finalizer lifetimes.
 * Actual native owner generations are tested in owned-javascript-borrows.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { compileOwnedJavaScriptWasmLayout } from "../src/backends/javascript/owned-wasm-layout.mjs";
import { createOwnedWasmBorrowRegistry } from "../src/release/owned-wasm-borrow-registry.mjs";
import { ownedRustBorrowReviewedIr } from "./helpers/owned-rust-borrow-fixture.mjs";

const layout = compileOwnedJavaScriptWasmLayout(ownedRustBorrowReviewedIr(), { transferredInputs: true, anchoredResults: true });
const ticketType = layout.types.find(type => type.kind === "resource");
const arrayType = layout.types.find(type => type.id === layout.native.functions.find(fn => fn.name === "echoArray").result);
const fixture = (options = {}) => {
	const owners = new Set(), revoked = new Set(), pending = [], registered = new Set();
	let next = 0, closed = false, poisoned = false, finalize, registry;
	registry = createOwnedWasmBorrowRegistry(layout, {
		assertOpen: () => assert.equal(closed || poisoned, false)
		, assertOwner: owner => assert.ok(owners.has(owner))
		, claimIdentity: owner => assert.ok(owners.has(owner))
		, releaseOwner: owner => assert.equal(owners.delete(owner), true)
		, revokeOwner: owner => { assert.ok(owners.has(owner)); revoked.add(owner); }
		, invoke: () => { throw new Error("Not a callable fixture"); }
		, copy: (type, payload) => publish(type, payload)
		, close: () => { assert.equal(owners.size, 0); closed = true; }
		, poison: () => { poisoned = true; }
	}, { ...options
		, enqueue: operation => pending.push(operation)
		, createFinalizationRegistry: callback => {
			finalize = callback;
			return { register: (_target, held) => registered.add(held), unregister: held => registered.delete(held) };
		}
	});
	const output = (type, anchor = null) => {
		const owner = ++next; owners.add(owner); return registry.output(owner, { type, anchor });
	};
	const publish = (type, payload = []) => output(type).commit(payload);
	return { registry, output, publish, owners, revoked, pending, registered
		, collect: state => finalize(state), poisoned: () => poisoned };
};

test("whole empty owners outlive roots individually but not their final public root", () => {
	const f = fixture(), parent = f.publish(arrayType), share = parent.share(), call = f.registry.pin();
	const { group } = call.whole(arrayType, parent);
	const child = f.output(arrayType, group).commit([]); call.close();
	parent.dispose(); assert.deepEqual(child.get(), []); assert.equal(f.revoked.size, 0);
	share.dispose(); assert.equal(child.disposed, true); assert.throws(() => child.get(), /expired/u);
	assert.throws(() => child.retain(), /expired/u); assert.throws(() => child.share(), /expired/u);
	child.dispose(); assert.equal(f.owners.size, 0); f.registry.close();
});

test("public closure is immediate while an active call still pins native storage", () => {
	const f = fixture(), output = f.output(ticketType), view = output.project(ticketType, 42n), root = output.commit(view);
	const call = f.registry.pin(); assert.equal(call.toToken(ticketType, view), 42n);
	root.dispose(); assert.equal(f.revoked.size, 1); assert.equal(f.owners.size, 1);
	assert.equal(view.disposed, true); assert.throws(() => call.toToken(ticketType, view), /expired/u);
	call.close(); assert.equal(f.owners.size, 0); f.registry.close();
});

test("finalizers queue native cleanup and do not hold wrappers or whole payloads", () => {
	const f = fixture(), payload = [], root = f.publish(arrayType, payload);
	payload.push(root); // A user-created payload cycle must not enter finalizer holdings.
	const [state] = f.registered;
	assert.deepEqual(Object.keys(state).sort(), ["disposed", "group", "root", "token", "type"]);
	assert.equal(Object.values(state).includes(root), false); assert.equal(Object.values(state).includes(payload), false);
	assert.equal(Object.values(state.group).includes(root), false); assert.equal(Object.values(state.group).includes(payload), false);
	f.collect(state); assert.equal(f.owners.size, 1); assert.equal(f.revoked.size, 0);
	assert.equal(f.pending.length, 1); f.pending.shift()();
	assert.equal(f.owners.size, 0); assert.equal(root.disposed, true); f.registry.close();
});

test("failed host construction releases unpublished owners at every checkpoint", () => {
	let failures = 0, successes = 0;
	for(let failAt = 1; failAt <= 16; failAt++)
	{
		let checkpoints = 0, output;
		const failure = { failAt }, f = fixture({ checkpoint: () => { if(++checkpoints === failAt) throw failure; } });
		try
		{
			output = f.output(ticketType); const view = output.project(ticketType, 42n);
			output.commit(view).dispose(); successes++;
		}
		catch(error)
		{ assert.equal(error, failure); failures++; output?.rollback(); }
		assert.equal(f.owners.size, 0, `checkpoint ${failAt}`); assert.equal(f.poisoned(), false);
		f.registry.close();
	}
	assert.ok(failures >= 9); assert.ok(successes > 0);
});

test("empty whole transfers reserve one original owner and invalidate all shared roots", () => {
	const f = fixture(), root = f.publish(arrayType), shared = root.share(); let consumed = false;
	const call = f.registry.pin(), move = call.transfers(1, () => consumed);
	assert.deepEqual(move.whole(0, arrayType, root), []); assert.deepEqual(move.owners(), [[1]]);
	assert.throws(() => call.transfers(1, () => false), /transfer scope/u);
	consumed = true; assert.equal(root.disposed, true); assert.equal(shared.disposed, true);
	assert.throws(() => root.get(), /expired/u); move.finish();
	assert.equal(f.owners.size, 1); call.close(); assert.equal(f.owners.size, 0); f.registry.close();
});

test("failed duplicate-owner transfer reservations leave every source usable", () => {
	const f = fixture(), root = f.publish(arrayType), shared = root.share();
	const call = f.registry.pin(), move = call.transfers(2, () => false);
	move.whole(0, arrayType, root);
	assert.throws(() => move.whole(1, arrayType, shared), /one result owner/u);
	call.close(); assert.deepEqual(root.get(), []); assert.deepEqual(shared.get(), []);
	root.dispose(); shared.dispose(); assert.equal(f.owners.size, 0); f.registry.close();
});

test("explicit root disposal frees nested view slots without waiting for GC", () => {
	const f = fixture();
	for(let index = 0; index < 5000; index++)
	{
		const output = f.output(ticketType), view = output.project(ticketType, 42n);
		const root = output.commit(view); root.dispose(); assert.equal(view.disposed, true);
	}
	assert.equal(f.registered.size, 0); assert.equal(f.owners.size, 0); f.registry.close();
});

test("call pins enforce the reentry bound and defer close until the last caller exits", () => {
	const f = fixture(), root = f.publish(arrayType), calls = [];
	assert.throws(() => f.registry.borrowPin(), /enclosing call/u);
	for(let index = 0; index < 64; index++)
	{
		const call = f.registry.pin(); call.whole(arrayType, root); calls.push(call);
	}
	assert.throws(() => f.registry.pin(), /reentry limit/u);
	const callback = f.registry.borrowPin(); callback.whole(arrayType, root);
	assert.equal(f.registry.close(), true); assert.equal(root.disposed, true);
	assert.equal(f.owners.size, 1); callback.close();
	for(const call of calls.reverse()) call.close();
	assert.equal(f.owners.size, 0); assert.equal(f.registry.close(), false);
});

test("closing a nested view neither closes nor extends its whole-value owner", () => {
	const f = fixture(), output = f.output(ticketType), view = output.project(ticketType, 42n);
	const root = output.commit(view), shared = root.share();
	assert.equal(view.dispose(), true); assert.equal(view.dispose(), false);
	assert.equal(root.disposed, false); assert.equal(shared.disposed, false);
	assert.equal(root.get(), view); root.dispose(); assert.equal(f.owners.size, 1);
	shared.dispose(); assert.equal(f.owners.size, 0); f.registry.close();
});
