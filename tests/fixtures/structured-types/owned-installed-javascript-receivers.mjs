/**
 * Receiver-member probes use only a generated downstream JavaScript API.
 *
 * @file
 */

/**
 * Check original receiver and parameter lifetimes through named members.
 *
 * @param api - Generated public exports, with no transport internals.
 */
export const runReceiverMembers = api => {
	let checks = 0;
	const owners = [], members = new Set();
	const own = value => { owners.push(value); return value; };
	const check = (value, label) => { checks++; if(!value) throw new Error(label); };
	const rejects = (operation, label) => {
		let rejected = false; try
		{ operation(); } catch
		{ rejected = true; }
		check(rejected, label);
	};
	const property = (value, name) => { members.add(name); return value[name]; };
	const method = (value, name, ...args) => { members.add(name); return value[name](...args); };
	const fresh = (serial = 42n) => own(api.newTicket(serial, "receiver\0💠"));
	const copy = (name, value) => own(api.copyValue(value, { resultOf: name }));
	const expired = value => { check(value.disposed, "expired owner"); rejects(() => value.get(), "expired payload"); };
	try
	{
		const first = fresh(), shared = own(first.share()), raw = first.get();
		check(property(first, "serial") === 42n && raw.serial === 42n, "copied scalar property");
		check(property(first, "label") === "receiver\0💠" && raw.label === first.label, "text property");
		rejects(() => { first.serial = 1n; }, "read-only property");
		const borrowed = own(method(first, "retainTicket")), child = own(borrowed.retainTicket()), kept = own(child.retain());
		check(typeof kept.retainTicket === "function", "retain preserves members");
		first.dispose(); check(shared.serial === 42n && borrowed.serial === 42n, "shared receiver lifetime");
		rejects(() => first.serial, "closed receiver getter"); shared.dispose(); expired(borrowed); expired(child);
		rejects(() => raw.serial, "expired raw view getter"); check(kept.serial === 42n, "independent member owner");
		const receiver = fresh(10n), parameter = fresh(99n), selected = own(method(receiver, "chooseTicket", parameter));
		check(selected.serial === 99n, "remaining parameter chosen");
		receiver.dispose(); check(selected.serial === 99n, "receiver is not parameter anchor");
		parameter.dispose(); expired(selected);
		const moving = fresh(), movingShared = own(moving.share()), movingBorrow = own(moving.retainTicket());
		const moved = own(method(moving, "transferTicket")); expired(moving); expired(movingShared); expired(movingBorrow);
		check(moved.serial === 42n, "consuming receiver result");
		const anchor = fresh(), consumed = fresh(0n), mixed = own(method(anchor, "mixedTicket", consumed));
		expired(consumed); check(mixed.serial === 42n, "mixed consuming member"); anchor.dispose(); expired(mixed);
		const ticket = fresh(), payload = { primary: ticket.get(), spare: { tag: "none" }, peers: [], history: [], payload: { count: -7n, bytes: new Uint8Array([0, 255]) } };
		const record = copy("echoRecord", payload), recordShare = own(record.share());
		const primary = own(property(record, "primary")); check(primary.serial === 42n, "borrowed property");
		check(property(record, "payload").count === -7n, "copied record property");
		const echoed = own(method(record, "echoRecord")); check(echoed.get().primary.serial === 42n, "record receiver");
		let cached;
		const callback = own(method(record, "callbackRecord", value => { cached = value; return value; }));
		check(cached.primary.disposed && callback.get().primary.serial === 42n, "callback view expires");
		const closure = own(method(record, "makeRecord")), closureReply = own(closure.get()(true, record));
		check(closureReply.get().primary.serial === 42n, "returned closure member");
		record.dispose(); check(primary.serial === 42n, "shared aggregate receiver"); recordShare.dispose();
		for(const value of [primary, echoed, callback, closure]) expired(value);
		check(closureReply.get().primary.serial === 42n, "returned result independent");
		const variant = copy("echoVariant", { kind: "empty" }), variantChild = own(method(variant, "echoVariant"));
		check(variantChild.get().kind === "empty", "empty variant receiver"); variant.dispose(); expired(variantChild);
		const tree = copy("echoRecursive", { kind: "branch", children: [] });
		const treeChild = own(method(tree, "echoRecursive")), treeCallback = own(method(tree, "callbackRecursive", value => value));
		const treeClosure = own(method(tree, "makeRecursive")), treeReply = own(treeClosure.get()(true, tree));
		check(treeReply.get().children.length === 0, "empty recursive closure result"); tree.dispose();
		for(const value of [treeChild, treeCallback, treeClosure]) expired(value);
		const movingRecord = copy("echoRecord", payload), movingPrimary = own(movingRecord.primary);
		const movedRecord = own(method(movingRecord, "moveRecord", value => { expired(movingRecord); expired(movingPrimary); return value; }));
		check(movedRecord.get().primary.serial === 42n, "aggregate consuming member");
		const closing = copy("echoRecord", payload);
		rejects(() => closing.callbackRecord(value => { closing.dispose(); return value; }), "closed callback receiver cannot publish borrowed result");
		check(members.size === 16, "every receiver member executes");
		return { checks, members: members.size, receiverAnchors: true, parameterAnchors: true };
	}
	finally
	{ for(const owner of owners.reverse()) owner.dispose(); }
};
