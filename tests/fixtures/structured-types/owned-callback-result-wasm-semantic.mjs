/**
 * Independent lifetime assertions for callback-local owners and host replies.
 *
 * @file
 */
import assert from "node:assert/strict";

/**
 * Observe real native owners without replacing compiled Lean calls.
 *
 * @param api - Compiled calls with owner counters and fault controls.
 * @param selected - One broken behavior, or all cases for the baseline.
 */
export const checkCallbackResultSemantics = (api, selected = null) => {
	let checks = 0;
	const bundle = ticket => ({ primary: ticket.get(), spare: { tag: "none" }
		, peers: [], history: [], payload: { count: 0n, bytes: new Uint8Array() } });
	const cases = {
		"lost-anchor": own => {
			const ticket = own(api.newTicket(42n, "nested")), root = own(api.echoRecord(bundle(ticket)));
			const closure = own(api.makeRecord(root)), child = own(closure.get()(false, root));
			const nested = own(closure.get()(false, child)); root.dispose();
			assert.throws(() => nested.get(), /expired/u, "callback-transitive-expiration");
		}
		, "independent-native-result": own => {
			const ticket = own(api.newTicket(42n, "native")), root = own(api.echoRecord(bundle(ticket)));
			const closure = own(api.makeRecord(root)); own(closure.get()(false, root));
			const childKey = api.lastOwner(); root.dispose();
			assert.equal(api.alive(childKey), 0, "callback-native-owner-expiration");
		}
		, "unchecked-anchor-input": own => {
			const ticket = own(api.newTicket(42n, "first")), other = own(api.newTicket(99n, "second"));
			const first = own(api.echoRecord(bundle(ticket))), wrongKey = api.lastOwner();
			const supplied = own(api.echoRecord(bundle(other))), closure = own(api.makeRecord(first));
			api.forceAnchor(wrongKey);
			try
			{ assert.throws(() => own(closure.get()(false, supplied)), /invalid argument/u, "callback-native-anchor-membership"); }
			finally
			{ api.forceAnchor(null); }
		}
		, "host-owner-unwrapping": own => {
			const ticket = own(api.newTicket(42n, "host")), root = own(api.echoRecord(bundle(ticket)));
			assert.doesNotThrow(() => {
				const result = own(api.callbackRecord(root, value => own(api.echoRecord(value))));
				assert.equal(api.serial(result.get().primary), 42n);
			}, "callback-whole-owner-reply");
		}
		, "early-host-view-expiration": own => {
			const ticket = own(api.newTicket(42n, "borrowed")), root = own(api.echoRecord(bundle(ticket)));
			assert.doesNotThrow(() => {
				const result = own(api.callbackRecord(root, value => value));
				assert.equal(api.serial(result.get().primary), 42n);
			}, "callback-host-handoff-before-expiration");
		}
		, "unpublished-owner": own => {
			const ticket = own(api.newTicket(42n, "publication")), root = own(api.echoRecord(bundle(ticket)));
			const closure = own(api.makeRecord(root)), before = api.counts(), failure = new Error("publication failed");
			api.failProjection(failure);
			try
			{ assert.throws(() => closure.get()(false, root), error => error === failure); }
			finally
			{ api.failProjection(null); }
			assert.deepEqual(api.counts(), before, "callback-unpublished-owner-cleanup");
		}
	};
	if(selected) assert.ok(Object.hasOwn(cases, selected), selected);
	for(const [name, run] of Object.entries(cases))
	{
		if(selected && selected !== name) continue;
		const roots = [];
		try
		{ run(value => { roots.push(value); return value; }); checks++; }
		finally
		{ for(const value of roots.reverse()) value.dispose(); }
		assert.deepEqual(api.counts(), { owners: 0, allocations: 0, identities: 0 }, name + " cleanup");
	}
	return { checks };
};
