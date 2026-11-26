import {observeTariff} from "./observer.mjs";
import {hostField} from "./host-field.mjs";
import type {Tariff, TariffInput} from "@example/tariff-quotes";
const {api, live} = await observeTariff(() => import("@example/tariff-quotes"));
const baseline = live();

const original: Tariff = api.makeTariff(40);
const input: TariffInput = {quote: original.quote};
const fromLean: Tariff = api.echoTariff(input);
const kept = fromLean.quote.retain();
const held = live(); if (held <= baseline) throw new Error("missing live identity");
fromLean.quote.dispose(); original.quote.dispose();
const packed: Tariff = api.packQuote(kept);
const value: number = api.stagedQuote(api.withRecovery((n: number) => {
	if (n !== 9) throw new Error("wrong callback argument");
	return kept;
}, kept), 9, 2);
if (value !== 42 || api.applyTariff(packed, 4) !== 44) throw new Error("wrong installed result");
let entries = 0;
const expired: Tariff = api.packQuote(n => { ++entries; return n; });
for (const call of [() => expired.quote(1), () => api.applyTariff(expired, 1)]) {
	try { call(); throw new Error("expired callback was accepted"); }
	catch (e) { if (!(e instanceof Error && "status" in e && e.status === 10)) throw e; }
}
expired.quote.dispose();
const marker = new Error("rejected by caller");
try { api.stagedQuote(api.withRecovery((_n: number) => { throw marker; }, kept), 1, 2); throw new Error("missing failure"); }
catch (e) { if (e !== marker) throw e; }
if (entries !== 0 || kept(2) !== 42) throw new Error("invalid borrow or failed recovery");
if (false) {
	// @ts-expect-error An ordinary function is not a returned Lean lease.
	const forged: Tariff = {quote: (n: number) => n};
	// @ts-expect-error A scalar is not the callable reply of the first stage.
	api.stagedQuote((_n: number) => 42, 1, 2);
	void forged;
}
packed.quote.dispose(); kept.dispose();
const applicationField=hostField(api,(quote): TariffInput => ({quote}));
const after = live(); if (after !== baseline) throw new Error("leaked a native identity");
console.log(JSON.stringify({value, entries, baseline, held, after, applicationField}));
