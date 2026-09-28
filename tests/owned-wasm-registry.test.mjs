/**
 * Lease publication, rollback, scoped borrows and deferred cleanup for owned JS.
 * Deterministic hooks exercise GC and allocation failures without timing races.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { compileOwnedJavaScriptWasmLayout } from "../src/backends/javascript/owned-wasm-layout.mjs";
import { createOwnedWasmRegistry } from "../src/release/owned-wasm-registry.mjs";
import { ownedAggregateReviewedIr } from "./helpers/owned-aggregate-fixture.mjs";

const layout = compileOwnedJavaScriptWasmLayout(ownedAggregateReviewedIr());
const ticket = layout.types.find(type => type.kind === "resource"), callback = layout.types.find(type => type.kind === "callback");
const key = (type, token) => `${type.id}:${token}`;
const fixture = (options = {}) => {
	const owners = new Map(), released = [], claims = [], queued = [], holdings = [], references = [];
	let next = 0, closes = 0, poisons = 0, registry;
	const owner = (entries = [[ticket, 1n]]) => {
		const value = ++next; owners.set(value, new Set(entries.map(([type, token]) => key(type, token)))); return value;
	};
	const native = {
		assertOpen: () => { assert.equal(closes, 0); assert.equal(poisons, 0); }
		, assertOwner: value => assert.ok(owners.has(value), "Unknown native owner")
		, claimIdentity: (value, type, token) => {
			claims.push([value, key(type, token)]); assert.ok(owners.get(value)?.has(key(type, token)), "Identity absent from owner");
		}
		, releaseOwner: value => { assert.ok(owners.delete(value), "Owner released exactly once"); released.push(value); }
		, invoke: (type, token, args) => ({ type: type.id, token, args })
		, retain: (type, token) => {
			const transaction = registry.output(owner([[type, token]]), { independent: true });
			const result = transaction.project(type, token); transaction.commit(); return result;
		}
		, close: () => { closes++; }
		, poison: () => { poisons++; }
	};
	registry = createOwnedWasmRegistry(layout, native, {
		createWeakReference: value => {
			const reference = { value, deref: () => reference.value }; references.push(reference); return reference;
		}
		, createFinalizationRegistry: operation => ({
			register: (value, state) => { holdings.push({ value, state, operation }); }
			, unregister: () => true
		})
		, enqueue: operation => queued.push(operation), ...options
	});
	const publish = (type = ticket, token = 1n) => {
		const transaction = registry.output(owner([[type, token]]));
		const value = transaction.project(type, token); transaction.commit(); return value;
	};
	const tokenOf = (value, type = ticket) => {
		const scope = registry.pin();
		try
		{ return scope.toToken(type, value); }
		finally
		{ scope.close(); }
	};
	return { registry, native, owner, owners, released, claims, queued, holdings
		, references, publish, tokenOf
		, counts: () => ({ closes, poisons }) };
};

test("output aliases reuse live JS resources and release redundant native result owners", () => {
	const f = fixture(), first = f.publish();
	assert.equal(Object.getPrototypeOf(first), null); assert.equal(Object.isFrozen(first), true);
	assert.equal(Object.keys(first).length, 0); assert.equal(Object.hasOwn(first, "token"), false);
	const transaction = f.registry.output(f.owner());
	assert.equal(transaction.project(ticket, 1n), first);
	assert.equal(transaction.project(ticket, 1n), first);
	transaction.commit(); assert.equal(f.owners.size, 1); assert.equal(f.released.length, 1);
	assert.equal(f.tokenOf(first), 1n); assert.equal(first.disposed, false);
	assert.equal(first.dispose(), true); assert.equal(first.dispose(), false); assert.equal(first.disposed, true);
	assert.equal(f.owners.size, 0); assert.throws(() => f.tokenOf(first), /disposed/);
	f.registry.close(); assert.deepEqual(f.counts(), { closes: 1, poisons: 0 });
});

test("retain creates an independent lease and never resurrects disposed handles", () => {
	const f = fixture(), first = f.publish(), retained = first.retain();
	assert.notEqual(first, retained); assert.equal(f.owners.size, 2);
	first.dispose(); assert.equal(f.tokenOf(retained), 1n);
	assert.throws(() => first.retain(), /disposed/);
	const again = f.publish(); assert.notEqual(again, first); assert.equal(f.tokenOf(again), 1n);
	retained.dispose(); assert.equal(f.tokenOf(again), 1n); again.dispose();
	assert.equal(f.owners.size, 0); f.registry.close();
});

test("a failed aggregate projection rolls back new wrappers but leaves existing inputs alive", () => {
	const f = fixture(), first = f.publish();
	const transaction = f.registry.output(f.owner([[ticket, 1n], [ticket, 2n], [callback, 3n]]));
	assert.equal(transaction.project(ticket, 1n), first);
	const created = transaction.project(ticket, 2n), closure = transaction.project(callback, 3n);
	assert.throws(() => f.tokenOf(created), /not been published/);
	assert.throws(() => closure(), /not been published/);
	assert.throws(() => transaction.project(ticket, 4n), /Identity absent/);
	assert.equal(transaction.rollback(), true); assert.equal(transaction.rollback(), false);
	assert.equal(created.disposed, true); assert.equal(closure.disposed, true);
	assert.equal(f.owners.size, 1); assert.equal(f.tokenOf(first), 1n);
	assert.throws(() => transaction.commit(), /finished/); f.registry.close();
});

test("resource claims authenticate each occurrence, type and exact output owner", () => {
	const f = fixture(), foreignFixture = fixture(), first = f.publish(), foreign = foreignFixture.publish();
	for(const value of [foreign, {}, 1n, new Proxy(first, {}), Object.create(first)])
		assert.throws(() => f.tokenOf(value), /foreign/);
	assert.throws(() => f.tokenOf(first, callback), /wrong-type/);
	const value = f.owner([[ticket, 2n]]), transaction = f.registry.output(value);
	assert.throws(() => f.registry.output(value), /already adopted/);
	assert.throws(() => transaction.project(ticket, 1n), /Identity absent/);
	for(const token of [0n, -1n, 1n << 64n, 1]) assert.throws(() => transaction.project(ticket, token), /private token/);
	assert.throws(() => transaction.project({ id: "other" }, 2n), /nominal/);
	transaction.rollback(); assert.equal(f.tokenOf(first), 1n); f.registry.close(); foreignFixture.registry.close();
});

test("one result owner stays alive until its last independent identity wrapper is disposed", () => {
	const f = fixture(), transaction = f.registry.output(f.owner([[ticket, 1n], [ticket, 2n]]));
	const first = transaction.project(ticket, 1n), second = transaction.project(ticket, 2n);
	assert.equal(transaction.project(ticket, 1n), first); transaction.commit();
	first.dispose(); assert.equal(f.released.length, 0); assert.equal(f.tokenOf(second), 2n);
	second.dispose(); assert.equal(f.released.length, 1); f.registry.close();
});

test("borrowed callback values expire on return and explicit retain can escape the borrow", () => {
	const f = fixture(), original = f.publish(), owner = f.owner(), borrow = f.registry.borrow(owner);
	const argument = borrow.project(ticket, 1n);
	assert.notEqual(argument, original); assert.equal(f.tokenOf(argument), 1n);
	assert.throws(() => borrow.commit(), /cannot be published/);
	const retained = argument.retain(); borrow.rollback(); f.native.releaseOwner(owner);
	assert.equal(argument.disposed, true); assert.throws(() => f.tokenOf(argument), /expired/);
	assert.throws(() => argument.retain(), /expired/); assert.equal(f.tokenOf(original), 1n);
	assert.equal(f.tokenOf(retained), 1n); original.dispose(); retained.dispose();
	assert.equal(f.owners.size, 0); f.registry.close();
});

test("active input pins defer native release after disposal and enforce 64-level reentry", () => {
	const f = fixture(), first = f.publish(), scope = f.registry.pin();
	assert.equal(scope.toToken(ticket, first), 1n); assert.equal(scope.toToken(ticket, first), 1n);
	first.dispose(); assert.equal(f.released.length, 0);
	assert.throws(() => scope.toToken(ticket, first), /disposed/); scope.close(); scope.close();
	assert.equal(f.released.length, 1); assert.throws(() => scope.toToken(ticket, first), /expired/);
	const scopes = Array.from({ length: 64 }, () => f.registry.pin());
	assert.throws(() => f.registry.pin(), /reentry limit/); for(const scope of scopes.reverse()) scope.close();
	f.registry.close();
});

test("closure self-disposal and component close defer native cleanup until invocation returns", () => {
	const f = fixture(), closure = f.publish(callback), resource = f.publish(ticket, 2n);
	f.native.invoke = (type, token, args) => {
		assert.equal(type.id, callback.id); assert.equal(token, 1n); assert.deepEqual(args, [7]);
		assert.equal(closure.dispose(), true); assert.equal(f.owners.size, 2);
		assert.equal(f.registry.close(), true); assert.equal(f.registry.close(), false);
		assert.equal(closure.disposed, true); assert.equal(resource.disposed, true);
		assert.equal(f.owners.size, 1); assert.equal(f.counts().closes, 0);
		return 42;
	};
	assert.equal(closure(7), 42); assert.equal(f.owners.size, 0); assert.equal(f.counts().closes, 1);
	assert.throws(() => closure(), /closed/); assert.throws(() => f.registry.pin(), /closed/);
});

test("queued finalizers cannot release a replacement wrapper or enter a retired heap", () => {
	const f = fixture(), first = f.publish(), stale = f.holdings[0];
	f.references[0].value = undefined;
	const replacement = f.publish(); assert.notEqual(replacement, first); assert.equal(first.disposed, true);
	stale.operation(stale.state); assert.equal(f.queued.length, 1); assert.equal(f.owners.size, 1);
	f.queued.shift()(); assert.equal(f.tokenOf(replacement), 1n);
	const final = f.holdings[1]; final.operation(final.state);
	f.registry.close(); assert.equal(f.owners.size, 0); f.queued.shift()();
	assert.deepEqual(f.counts(), { closes: 1, poisons: 0 });
});

test("every result/wrapper allocation checkpoint rolls back before publication", () => {
	for(let failAt = 1; failAt <= 6; failAt++)
	{
		let attempts = 0;
		const failure = new Error(`Allocation ${failAt}`), f = fixture({ checkpoint: () => { if(++attempts === failAt) throw failure; } });
		const owner = f.owner(); let transaction;
		assert.throws(() => {
			try
			{ transaction = f.registry.output(owner); transaction.project(ticket, 1n); transaction.commit(); }
			catch(error)
			{ transaction?.rollback(); throw error; }
		}, error => error === failure);
		assert.equal(f.owners.size, 0, `Allocation checkpoint ${failAt}`); f.registry.close();
	}
});

test("native cleanup failures poison all wrappers and do not retry unsafe releases", () => {
	const f = fixture(), first = f.publish(), second = f.publish(ticket, 2n);
	const failure = new Error("Native trap"); let attempts = 0;
	f.native.releaseOwner = () => { attempts++; throw failure; };
	assert.throws(() => first.dispose(), error => error === failure);
	assert.equal(second.disposed, true); assert.throws(() => f.tokenOf(second), /poisoned/);
	assert.equal(first.dispose(), false); f.registry.close(); assert.equal(attempts, 1);
	assert.deepEqual(f.counts(), { closes: 0, poisons: 1 });
});

test("retirement by another component invalidates wrappers before any subsequent call", () => {
	const f = fixture(), first = f.publish(), second = f.publish(ticket, 2n);
	let checks = 0;
	f.native.assertOpen = () => { checks++; throw new Error("shared heap retired"); };
	assert.equal(first.disposed, true); assert.equal(second.disposed, true);
	assert.equal(checks, 1);
	assert.throws(() => first.retain(), /poisoned/u);
	assert.equal(first.dispose(), true); f.registry.close();
	assert.equal(f.released.length, 0);
	assert.deepEqual(f.counts(), { closes: 0, poisons: 1 });
});

test("declared callback failures retain their original exception when cleanup also fails", () => {
	const f = fixture(), closure = f.publish(callback), failure = { reason: "host callback" };
	f.native.invoke = () => { closure.dispose(); throw failure; };
	f.native.releaseOwner = () => { throw new Error("Secondary release fault"); };
	assert.throws(() => closure(), error => error === failure);
	assert.equal(f.counts().poisons, 1); f.registry.close();
});

test("the 4096-wrapper limit rejects overflow without leaking and permits reuse after disposal", () => {
	const f = fixture(), values = Array.from({ length: 4096 }, (_, index) => f.publish(ticket, BigInt(index + 1)));
	const transaction = f.registry.output(f.owner([[ticket, 4097n]]));
	assert.throws(() => transaction.project(ticket, 4097n), /registry is full/); transaction.rollback();
	assert.equal(f.owners.size, 4096); values[0].dispose();
	const replacement = f.publish(ticket, 4097n); assert.equal(f.tokenOf(replacement), 4097n);
	f.registry.close(); assert.equal(f.owners.size, 0);
});
