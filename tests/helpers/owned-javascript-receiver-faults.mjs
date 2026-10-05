/**
 * Original receiver ownership survives recoverable host and native failures.
 *
 * @file
 */
import assert from "node:assert/strict";

/**
 * Sweep every allocation checkpoint through public members, keeping errors live.
 *
 * @param fixture - Compiled Lean component and its public call projection.
 * @param faults - Mutable deterministic host-failure controls.
 */
export const checkOwnedJavaScriptReceiverFaults = (fixture, faults) => {
	const { module, call, layout, copyValue } = fixture;
	const heldErrors = [], counts = {};
	const fresh = (serial = 42n) => call("newTicket", serial, "fault\0💠");
	const copy = (name, value) => copyValue(layout.native.functions.find(fn => fn.name === name).result, value);
	const drained = () => {
		assert.equal(module._owned_results(), 0); assert.equal(module._owned_live(), 0);
		assert.equal(module._owned_identities(), 0); assert.equal(fixture.callbackCount(), 0);
	};
	const payload = { count: -(1n << 160n), bytes: new Uint8Array([0, 128, 255]) };
	const recordOf = base => copy("echoRecord", { primary: base.get()
		, spare: { tag: "some", value: base.get() }
		, peers: [base.get(), base.get()], history: [base.get()], payload });
	for(const domain of ["native", "host"]) for(const kind of ["borrow", "property", "parameter", "copy", "move", "mixed", "transfer"])
	{
		const observed = { before: 0, after: 0 }; let complete = false;
		for(let index = 1; index <= 512; index++)
		{
			const base = fresh(), consumed = fresh(99n), record = recordOf(base);
			const child = record.primary, shared = record.share(), ticketShare = consumed.share();
			let result, rejected = false;
			faults.failure = new Error(`${domain} ${kind} checkpoint ${index}`);
			if(domain === "native") module._owned_fail_after(index);
			else faults.failAt = faults.attempt + index;
			try
			{
				result = kind === "borrow" ? record.echoRecord()
					: kind === "property" ? record.primary
						: kind === "parameter" ? base.chooseTicket(consumed)
							: kind === "copy" ? record.retain()
								: kind === "move" ? record.moveRecord(value => value)
									: kind === "mixed" ? base.mixedTicket(consumed) : consumed.transferTicket();
			}
			catch(error)
			{
				rejected = true; heldErrors.push(error);
				if(domain === "host") assert.equal(error, faults.failure);
				else assert.ok([3, 10].includes(error.status), `${kind} native checkpoint ${index}: ${error.stack}`);
			}
			finally
			{ module._owned_fail_after(0); faults.failAt = 0; }
			const moved = kind === "move" ? record.disposed : ["mixed", "transfer"].includes(kind) ? consumed.disposed : false;
			if(rejected) observed[moved ? "after" : "before"]++;
			if(kind === "move")
			{
				assert.equal(shared.disposed, moved); assert.equal(child.disposed, moved);
				if(!moved) assert.equal(child.serial, 42n);
			}
			if(["mixed", "transfer"].includes(kind)) assert.equal(ticketShare.disposed, moved);
			assert.equal(base.serial, 42n);
			if(!rejected)
			{
				if(["property", "parameter", "mixed", "transfer"].includes(kind))
					assert.equal(result.serial, ["parameter", "mixed", "transfer"].includes(kind) ? 99n : 42n, `${domain} ${kind} result`);
				else assert.equal(result.get().primary.serial, 42n);
			}
			result?.dispose();
			for(const owner of [child, shared, record, ticketShare, consumed, base]) owner.dispose();
			drained();
			if(!rejected)
			{ complete = true; break; }
		}
		assert.ok(complete, `${domain} ${kind} fault sweep must terminate`);
		assert.ok(observed.before > 0, `${domain} ${kind} pre-handoff failures`);
		if(["move", "mixed", "transfer"].includes(kind)) assert.ok(observed.after > 0, `${domain} ${kind} post-handoff failures`);
		counts[`${domain}:${kind}`] = observed;
	}
	for(const consuming of [false, true])
	{
		const root = fresh(), shared = root.share(), borrowed = root.retainTicket();
		faults.failure = new Error(`Unpublished receiver result, consuming=${consuming}`);
		faults.projection = true;
		try
		{
			assert.throws(() => consuming ? root.transferTicket() : root.retainTicket(), error => {
				heldErrors.push(error); return error === faults.failure;
			});
		}
		finally
		{ faults.projection = false; }
		for(const value of [root, shared, borrowed]) assert.equal(value.disposed, consuming);
		if(!consuming) assert.equal(root.serial, 42n);
		for(const value of [root, shared, borrowed]) value.dispose(); drained();
	}
	const chain = [copy("echoVariant", { kind: "empty" })];
	for(let depth = 0; depth < 128; depth++) chain.push(chain.at(-1).echoVariant());
	assert.throws(() => chain.at(-1).echoVariant(), error => error.status === 2);
	assert.equal(chain.at(-1).get().kind, "empty"); chain[0].dispose();
	for(const owner of chain.slice(1))
	{ assert.equal(owner.disposed, true); assert.throws(() => owner.echoVariant(), /expired|disposed/u); owner.dispose(); }
	drained();
	const capacity = fresh(), aliases = [];
	for(let index = 0; index < 4094; index++) aliases.push(capacity.share());
	assert.throws(() => capacity.share(), /registry is full/u);
	assert.throws(() => capacity.retainTicket(), /registry is full/u);
	assert.equal(capacity.serial, 42n);
	for(const owner of aliases) owner.dispose(); capacity.dispose(); drained();
	assert.equal(heldErrors.length, Object.values(counts).reduce((total, row) => total + row.before + row.after, 2));
	const recovery = fresh(); assert.equal(recovery.serial, 42n); recovery.dispose(); drained();
	return { counts, retainedErrors: heldErrors.length
		, borrowDepth: 128, hostWrappers: 4096, publicationFailures: 2
		, liveOwners: module._owned_results()
		, liveAllocations: module._owned_live()
		, liveIdentities: module._owned_identities()
		, liveCallbacks: fixture.callbackCount() };
};
