/**
 * Receiver consumers use only their installed package's public API.
 *
 * @file
 */

/**
 * Resource-only members need neither callbacks nor borrowed-result contracts.
 *
 * @param api - Generated public receiver exports.
 * @param consuming - Include an original-owner consuming member.
 */
export const runPlainReceivers = (api, consuming) => {
	let checks = 0;
	const owners = [], own = value => { owners.push(value); return value; };
	const check = (value, label) => { checks++; if(!value) throw new Error(label); };
	const rejects = (operation, label) => {
		let rejected = false; try
		{ operation(); } catch
		{ rejected = true; }
		check(rejected, label);
	};
	try
	{
		const root = own(api.newTicket(42n, "plain\0💠")), raw = root.get(), shared = own(root.share());
		const kept = own(root.retainTicket()), fromRaw = own(raw.retainTicket()), retained = own(root.retain());
		check(root.serial === 42n, "whole getter"); check(raw.serial === 42n, "raw getter");
		check(root.pingTicket === undefined, "whole Unit getter"); check(raw.pingTicket === undefined, "raw Unit getter");
		rejects(() => { root.serial = 1n; }, "read-only property");
		check(api.serial(root) === 42n && api.serial(raw) === 42n, "flat getter exports");
		root.dispose(); check(root.disposed, "root disposed"); check(shared.serial === 42n, "shared member");
		rejects(() => root.serial, "closed owner member"); shared.dispose(); check(raw.disposed, "raw expiration");
		rejects(() => raw.serial, "expired raw getter");
		check(kept.serial === 42n, "independent member result"); check(fromRaw.serial === 42n, "independent raw member result");
		check(retained.serial === 42n, "retain preserves members");
		const copied = own(api.copyValue(kept.get(), { receiverOf: "retainTicket" }));
		check(copied.serial === 42n, "receiver selector");
		if(consuming)
		{
			const alias = own(kept.share()), moved = own(kept.transferTicket());
			check(kept.disposed && alias.disposed, "original receiver consumed");
			check(moved.serial === 42n, "consumed result has members");
			rejects(() => kept.serial, "consumed property");
			check(typeof fromRaw.get().transferTicket === "undefined", "raw views cannot consume receiver");
		}
		else check(typeof kept.transferTicket === "undefined", "no undeclared consuming member");
		check(retained.serial === 42n && copied.serial === 42n, "independent roots survive consume or disposal");
		return { checks, consuming, callbacks: false, resultAnchors: false };
	}
	finally
	{ for(const owner of owners.reverse()) owner.dispose(); }
};

/**
 * Callback members preserve independent results without borrowed-result support.
 *
 * @param api - Generated public receiver exports.
 */
export const runUnanchoredReceivers = api => {
	let checks = 0;
	const owners = [], own = value => { owners.push(value); return value; };
	const check = (value, label) => { checks++; if(!value) throw new Error(label); };
	try
	{
		const root = own(api.newTicket(42n, "unanchored")), kept = own(root.retainTicket());
		root.dispose(); check(kept.serial === 42n, "independent receiver result");
		const record = own(api.copyValue({ primary: kept.get()
			, spare: { tag: "none" }, peers: [], history: []
			, payload: { count: 0n, bytes: new Uint8Array() } }, { receiverOf: "echoRecord" }));
		const primary = own(record.primary), echoed = own(record.echoRecord());
		let callbackView;
		const callback = own(record.callbackRecord(value => { callbackView = value.primary; return value; }));
		check(callbackView.disposed, "callback view expires");
		const closure = own(record.makeRecord()); record.dispose();
		check(primary.serial === 42n, "independent property result");
		check(echoed.get().primary.serial === 42n, "independent aggregate result");
		check(callback.get().primary.serial === 42n, "independent callback result");
		const reply = own(closure.get()(true, echoed));
		check(reply.get().primary.serial === 42n, "independent closure result");
		const tree = own(api.copyValue({ kind: "branch", children: [] }, { receiverOf: "echoRecursive" }));
		const child = own(tree.echoRecursive()), called = own(tree.callbackRecursive(value => value));
		tree.dispose(); check(child.get().children.length === 0 && called.get().children.length === 0, "empty owners independent");
		const shared = own(echoed.share());
		const moved = own(echoed.moveRecord(value => { check(echoed.disposed && shared.disposed, "consume before callback"); return value; }));
		check(moved.get().primary.serial === 42n, "consuming callback result");
		const failure = new Error("retained callback failure"); let caught;
		try
		{ moved.callbackRecord(() => { throw failure; }); } catch(error)
		{ caught = error; }
		check(caught === failure, "callback exception identity");
		check(own(moved.primary).serial === 42n, "receiver recovers after callback failure");
		return { checks, consuming: true, callbacks: true, resultAnchors: false };
	}
	finally
	{ for(const owner of owners.reverse()) owner.dispose(); }
};
