/**
 * Source-free owner-anchored API checks shared by Node, pages, React and workers.
 *
 * @file
 */

/**
 * Exercise every exported function using only the installed public API.
 *
 * @param api - Generated component exports.
 */
export const runBorrows = api => {
	let checks = 0;
	const names = new Set(), owners = [];
	const check = (condition, label) => { checks++; if(!condition) throw new Error(label); };
	const rejects = (operation, label) => {
		let rejected = false;
		try
		{ operation(); }
		catch
		{ rejected = true; }
		check(rejected, label);
	};
	const own = value => { owners.push(value); return value; };
	const call = (name, ...args) => { names.add(name); return api[name](...args); };
	const fresh = (serial = 42n) => own(call("newTicket", serial, "borrowed\0💠"));
	const copy = (name, payload) => own(api.copyValue(payload, { resultOf: name }));
	const expired = root => {
		check(root.disposed, "owner expiration"); rejects(() => root.get(), "get after expiration");
		rejects(() => root.share(), "share after expiration"); rejects(() => root.retain(), "retain after expiration");
	};
	const payload = { count: -(1n << 160n), bytes: new Uint8Array([0, 128, 255]) };
	const bundle = ticket => ({ primary: ticket, spare: { tag: "some", value: ticket }, peers: [ticket, ticket], history: [ticket], payload });
	try
	{
		const first = fresh(), shared = own(first.share()), borrowed = own(call("retainTicket", first));
		const descendant = own(call("retainTicket", borrowed)), independent = own(borrowed.retain());
		check(first.get() !== borrowed.get(), "views keep distinct owner lifetimes");
		check(first.get().equals(borrowed.get()), "views compare canonical identity");
		check(call("label", first) === "borrowed\0💠", "label text");
		check(call("serial", first.get()) === 42n, "plain resource view");
		first.dispose(); check(call("serial", borrowed) === 42n, "shared root retains borrowed result");
		shared.dispose(); expired(borrowed); expired(descendant);
		check(call("serial", independent) === 42n, "independent retained owner");
		const ticket = fresh(), leaf = ticket.get();
		const shapes = [
			["echoArray", [leaf, leaf]], ["echoList", [leaf]]
			, ["echoOption", { tag: "some", value: leaf }]
			, ["echoResult", { ok: bundle(leaf) }], ["echoResult", { error: leaf }]
			, ["echoTuple", [leaf, [{ tag: "some", value: leaf }, payload]]]
			, ["echoRecord", bundle(leaf)], ["echoAlias", bundle(leaf)]
			, ["echoVariant", { kind: "one", ticket: leaf }]
			, ["echoVariant", { kind: "pair", first: leaf, second: leaf }]
			, ["echoVariant", { kind: "many", tickets: [leaf, leaf] }]
			, ["echoRow", [{ tag: "none" }, { tag: "some", value: leaf }]]
			, ["echoRecursive", { kind: "branch", children: [{ kind: "leaf", ticket: leaf }] }]
			, ["echoNested", [[{ tag: "some", value: { ok: bundle(leaf) } }, { tag: "some", value: { error: leaf } }]]]
			, ["echoArray", []], ["echoList", []], ["echoOption", { tag: "none" }]
			, ["echoVariant", { kind: "empty" }]
			, ["echoRecursive", { kind: "branch", children: [] }]
			, ["echoNested", [[]]]
		];
		for(const [name, value] of shapes)
		{
			const root = copy(name, value), share = own(root.share()), result = own(call(name, root));
			const retained = own(result.retain());
			check(!result.disposed && !retained.disposed, name + " publication");
			root.dispose(); check(!result.disposed, name + " shared lifetime"); result.get();
			share.dispose(); expired(result); check(!retained.disposed, name + " independent lifetime"); retained.get();
			retained.dispose(); result.dispose();
		}
		const peers = copy("echoArray", [leaf]);
		const record = own(call("bundle", leaf, { tag: "none" }, peers, [leaf], payload));
		const primary = own(call("primary", record));
		check(call("serial", primary) === 42n, "primary resource");
		check(call("payload", record).count === payload.count, "copied payload");
		let cached;
		const echoed = own(call("callbackRecord", record, value => { cached = value; return value; }));
		check(call("serial", echoed.get().primary) === 42n, "callback resource");
		check(cached.primary.disposed, "callback argument expires");
		const closure = own(call("makeRecord", record)), reply = own(closure.get()(true, record));
		check(call("serial", reply.get().primary) === 42n, "returned closure");
		const tree = copy("echoRecursive", { kind: "leaf", ticket: leaf });
		const callbackTree = own(call("callbackRecursive", tree, value => value));
		const treeClosure = own(call("makeRecursive", tree)), treeReply = own(treeClosure.get()(true, tree));
		check(call("serial", callbackTree.get().ticket) === 42n, "recursive callback");
		check(call("serial", treeReply.get().ticket) === 42n, "recursive returned closure");
		peers.dispose(); expired(record); expired(primary); expired(echoed); expired(closure);
		check(call("serial", reply.get().primary) === 42n, "returned closure result has its own owner");
		const movedInput = fresh(), movedAlias = own(movedInput.share()), movedBorrow = own(call("retainTicket", movedInput));
		const moved = own(call("transferTicket", movedInput));
		expired(movedInput); expired(movedAlias); expired(movedBorrow);
		check(call("serial", moved) === 42n, "consuming result");
		const movedArrayInput = copy("echoArray", []), emptyBorrow = own(call("echoArray", movedArrayInput));
		const movedArray = own(call("moveArray", movedArrayInput));
		expired(movedArrayInput); expired(emptyBorrow); check(movedArray.get().length === 0, "empty original slot transfer");
		const movingRecord = copy("echoRecord", bundle(leaf));
		const movingChild = own(call("primary", movingRecord));
		const recordReply = own(call("moveRecord", movingRecord, value => {
			expired(movingRecord); expired(movingChild); return value;
		}));
		check(call("serial", recordReply.get().primary) === 42n, "moved record callback");
		const anchor = fresh(), consumed = fresh(0n), mixed = own(call("mixedTicket", anchor, consumed));
		expired(consumed); check(call("serial", mixed) === 42n, "mixed borrow and transfer");
		anchor.dispose(); expired(mixed);
		const ancestor = fresh(), child = own(call("retainTicket", ancestor));
		rejects(() => call("mixedTicket", child, ancestor), "cannot consume an anchor ancestor");
		check(call("serial", ancestor) === 42n, "failed transfer preserves ancestor");
		rejects(() => call("transferTicket", child), "cannot consume a borrowed result");
		rejects(() => call("echoArray", []), "whole array owner required");
		rejects(() => api.copyValue([], { resultOf: "serial" }), "copied result is not an owner selector");
		const closing = copy("echoRecord", bundle(leaf));
		rejects(() => call("callbackRecord", closing, value => { closing.dispose(); return value; }), "reentry closes original anchor");
		expired(closing); check(call("serial", ticket) === 42n, "unrelated owner survives callback close");
		const throwing = copy("echoRecord", bundle(leaf)), failure = { reason: "original callback failure" };
		let observed;
		try
		{ call("callbackRecord", throwing, () => { throw failure; }); }
		catch(error)
		{ observed = error; }
		check(observed === failure, "exact thrown value"); check(!throwing.disposed, "callback failure preserves owner");
		check(names.size === 26, "every authored export executes");
		return { checks, exports: names.size, borrowedResults: true };
	}
	finally
	{ for(const owner of owners.reverse()) owner.dispose(); }
};
