/** @file Ordinary application calls shared by Node, a page, React and a dedicated worker. */
import {observeTariff} from "./observer.mjs";
const {api,live} = await observeTariff(() => import("@example/tariff-quotes"));

export function exercise(alternate) {
	const base = alternate ? 71 : 40;
	const check = (condition, why) => { if (!condition) throw new Error(why); };
	const rejected = (call, expected) => {
		try { call(); } catch (e) { if (expected(e)) return; throw e; }
		throw new Error("expected refusal");
	};
	const baseline = live(), source = api.makeTariff(base);
	const input = {quote: source.quote};
	const echoed = api.echoTariff(input);
	const unpacked = api.unpackQuote(echoed);
	const field = unpacked.retain();
	const repacked = api.packQuote(field);
	const keep = repacked.quote.retain();
	const held = live(); check(held > baseline, "observer missed held function");
	// JavaScript may canonicalize returned handles. retain() explicitly separates ownership.
	for (const fn of new Set([source.quote, echoed.quote, unpacked, repacked.quote, field])) fn.dispose();
	const keptValue = api.applyTariff({quote: keep}, 2);
	check(keptValue === base + 2 && keep(3) === base + 3, "retained function changed");

	let entries = 0;
	const expired = api.packQuote(n => { ++entries; return n; });
	const refusedBorrow = e => e.status === 10;
	rejected(() => expired.quote(1), refusedBorrow);
	rejected(() => api.applyTariff(expired, 1), refusedBorrow);
	check(entries === 0, "invoked expired host callback");
	expired.quote.dispose();

	const error = new Error("application rejected tariff");
	const recovery = api.makeTariff(100).quote;
	let stageCalls = 0;
	const stagedValue = api.stagedQuote(api.withRecovery(n => {
		check(n === base, "wrong callback argument"); ++stageCalls; return keep;
	}, recovery), base, 4);
	check(stagedValue === base + 4 && stageCalls === 1, "staged function not invoked");
	rejected(() => api.stagedQuote(api.withRecovery(() => { throw error; }, recovery), 9, 3), e => e === error);
	check(recovery(2) === 102 && keep(5) === base + 5, "lost function on callback failure");
	keep.dispose(); recovery.dispose();
	rejected(() => api.echoTariff({quote: keep}), e => /disposed|expired/u.test(e.message));
	const next = api.makeTariff(6).quote;
	const nextValue = next(36); next.dispose(); check(nextValue === 42, "binding not reusable");
	const after = live(); check(after === baseline, "leaked a native identity");
	return {keptValue, entries, stageCalls, stagedValue, nextValue, baseline, held, after};
}
