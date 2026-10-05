/**
 * Run unchanged lifetime assertions against intact and deliberately broken hosts.
 *
 * @file
 */
import assert from "node:assert/strict";

/**
 * The control hooks observe native state without replacing Lean or its adapters.
 *
 * @param api - Actual compiled calls, typed copies and result-owner counters.
 * @param selected - One mutation's assertion, or every assertion for the baseline.
 */
export const checkBorrowSemantics = (api, selected = null) => {
	let checks = 0;
	const cases = {
		"share-is-independent": own => {
			const root = own(api.newTicket(42n, "shared")), alias = own(root.share());
			const child = own(api.retainTicket(root)); root.dispose();
			assert.doesNotThrow(() => child.get(), "shared-root-lifetime");
			alias.dispose(); assert.equal(child.disposed, true);
		}
		, "retain-is-shared": own => {
			const root = own(api.newTicket(42n, "retained")), child = own(api.retainTicket(root));
			const retained = own(child.retain()); root.dispose();
			assert.doesNotThrow(() => retained.get(), "independent-retained-lifetime");
			assert.equal(api.serial(retained), 42n);
		}
		, "wrapper-identity": own => {
			const root = own(api.newTicket(42n, "identity")), child = own(api.retainTicket(root));
			assert.notEqual(root.get(), child.get());
			assert.equal(root.get().equals(child.get()), true, "canonical-resource-identity");
		}
		, "lost-anchor": own => {
			const root = own(api.newTicket(42n, "anchor")), child = own(api.retainTicket(root));
			const descendant = own(api.retainTicket(child)); root.dispose();
			assert.throws(() => descendant.get(), /expired/u, "transitive-root-expiration");
		}
		, "empty-root": own => {
			const empty = api.copyValue("echoArray", []);
			assert.equal(typeof empty.get, "function", "empty-value-keeps-root"); own(empty);
			const child = own(api.echoArray(empty)); empty.dispose();
			assert.throws(() => child.get(), /expired/u);
		}
		, "unpublished-owner": own => {
			const root = own(api.newTicket(42n, "unpublished"));
			const before = api.counts(), failure = { reason: "projection failed" };
			api.failProjection(failure);
			try
			{ assert.throws(() => api.retainTicket(root), error => error === failure); }
			finally
			{ api.failProjection(null); }
			assert.deepEqual(api.counts(), before, "unpublished-owner-cleanup");
		}
	};
	for(const name of ["native-revocation", "native-ancestor-revocation"]) cases[name] = own => {
		const ticket = own(api.newTicket(42n, name));
		const root = own(api.copyValue("echoRecord", { primary: ticket.get()
			, spare: { tag: "none" }, peers: [], history: []
			, payload: { count: 0n, bytes: new Uint8Array() } }));
		const parentKey = api.lastOwner(), child = own(api.primary(root)), childKey = api.lastOwner();
		let reentered = false;
		assert.throws(() => api.callbackRecord(root, value => {
			root.dispose(); reentered = true;
			const key = name === "native-revocation" ? parentKey : childKey;
			assert.equal(api.alive(key), 0, name + "-before-unpin");
			assert.equal(child.disposed, true); return value;
		}), error => {
			if(error.code === "ERR_ASSERTION") throw error;
			return /invalid argument|expired/u.test(error.message);
		});
		assert.equal(reentered, true);
	};
	if(selected) assert.ok(Object.hasOwn(cases, selected), selected);
	for(const [name, run] of Object.entries(cases))
	{
		if(selected && name !== selected) continue;
		const roots = [];
		try
		{ run(root => { roots.push(root); return root; }); checks++; }
		finally
		{ for(const root of roots.reverse()) root.dispose(); }
		assert.deepEqual(api.counts(), { owners: 0, allocations: 0, identities: 0 }, name + " cleanup");
	}
	return { checks };
};
