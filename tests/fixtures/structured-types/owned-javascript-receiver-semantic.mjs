/**
 * Original owners, nominal sharing and read-only properties must be observable.
 *
 * @file
 */
import assert from "node:assert/strict";
import { checkBorrowSemantics } from "./owned-javascript-borrow-semantic.mjs";

/**
 * Extend the unchanged lifetime assertions with receiver-specific regressions.
 *
 * @param api - Actual compiled calls and native lifecycle observers.
 * @param selected - One mutation's assertion, or the complete baseline.
 */
export const checkReceiverSemantics = (api, selected = null) => {
	const cases = {
		"receiver-snapshot": own => {
			const root = own(api.newTicket(42n, "receiver")), child = own(root.retainTicket());
			root.dispose(); assert.throws(() => child.get(), /expired/u, "original-receiver-expiration");
		}
		, "wrong-parameter-owner": own => {
			const receiver = own(api.newTicket(1n, "receiver")), parameter = own(api.newTicket(42n, "parameter"));
			let child;
			assert.doesNotThrow(() => { child = own(receiver.chooseTicket(parameter)); }, "remaining-parameter-owner");
			receiver.dispose(); assert.equal(child.serial, 42n, "remaining-parameter-owner");
			parameter.dispose(); assert.throws(() => child.get(), /expired/u, "remaining-parameter-owner");
		}
		, "shared-members": own => {
			const root = own(api.newTicket(42n, "shared")), alias = own(root.share());
			assert.equal(typeof alias.retainTicket, "function", "shared-nominal-members");
			assert.equal(alias.serial, 42n, "shared-nominal-members");
		}
		, "writable-property": own => {
			const root = own(api.newTicket(42n, "readonly"));
			assert.throws(() => { root.serial = 99n; }, TypeError, "read-only-receiver-property");
			assert.equal(root.serial, 42n);
		}
	};
	let checks = !selected || !Object.hasOwn(cases, selected) ? checkBorrowSemantics(api, selected).checks : 0;
	for(const [name, run] of Object.entries(cases))
	{
		if(selected && name !== selected) continue;
		const roots = [];
		try
		{ run(value => { roots.push(value); return value; }); checks++; }
		finally
		{ for(const root of roots.reverse()) root.dispose(); }
		assert.deepEqual(api.counts(), { owners: 0, allocations: 0, identities: 0 }, name + " cleanup");
	}
	return { checks };
};
