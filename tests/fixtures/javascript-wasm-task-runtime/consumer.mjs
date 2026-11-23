/** @file Run from outside the producer, using only the offline-installed package. */

/**
 * Observe pending, cancelled and completed work through the public test package.
 *
 * @param api - Installed package namespace.
 * @param plugins - Optional producer and transforming peer from two separate packages.
 */
export const exercise = async (api, plugins) => {
	let checks = 0;
	const check = (ok, label) => { if(!ok) throw new Error(label); checks++; };
	const offset = plugins ? 7 : 0;
	const engine = await api.openProbe(plugins);
	try
	{
		check(await engine.alreadyReady() === 2, "missed a subscriber on an already-finished Lean task");
		for(const [cancel, cooperative] of [[false, false], [true, true], [true, false]])
		{
			let settlements = 0;
			const op = engine.start(cooperative);
			const outcome = op.result.then(value => { settlements++; return {value}; }
				, error => { settlements++; return {error: error.code}; });
			await op.entered;
			await new Promise(done => setTimeout(done, 0));
			check(settlements === 0 && engine.counts().live === 1, "expected genuinely pending Lean work");
			if(cancel)
			{
				check(op.cancel() && !op.cancel(), "cancel must win once");
				check((await outcome).error === "operation-cancelled", "wrong cancellation error");
			}
			check(op.release(10) && !op.release(12), "one gate release");
			const raw = await op.drained;
			check(raw === (cooperative && cancel ? 1001 : 13) + offset, "wrong result from Lean worker: " + raw);
			if(!cancel) check((await outcome).value === 13 + offset, "wrong public result");
			check(settlements === 1 && !op.cancel() && !op.release(7), "late native completion changed the outcome");
		}
		const last = engine.start(false), rejected = last.result.catch(error => error.code);
		await last.entered;
		const closing = engine.close();
		check(closing === engine.close(), "shutdown must be idempotent");
		check(await rejected === "operation-cancelled", "shutdown did not cancel");
		check(await last.drained === 3 + offset, "shutdown did not drain the genuine late completion");
		await closing;
		const {live, resolved, cancelled, state} = engine.counts();
		check(live === 0 && resolved === 1 && cancelled === 3 && state === "closed", "outstanding operations at shutdown");
		return {checks, resolved, cancelled, live};
	} finally
	{ await engine.close(); }
};
