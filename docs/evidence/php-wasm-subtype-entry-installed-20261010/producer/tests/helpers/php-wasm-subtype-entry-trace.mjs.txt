/**
 * Browser-safe parser for explicit PHP-Wasm probe markers. No source-order inference.
 * A caller must compare the complete call sequence with independently specified expectations.
 *
 * @file
 */
const kinds = ["validator", "constructor", "adapter", "source"];
const require = (condition, message) => { if(!condition) throw new Error(message); };

/**
 * Parse complete public-call brackets, refusing unknown, unbracketed or malformed output.
 * Empty traces are allowed for calls rejected by PHP before the C wrapper; expectations must
 * require nonzero controls, so absent instrumentation cannot establish acceptance.
 *
 * @param trace - Concatenated stderr chunks, retaining their exact newlines.
 * @param selected - Expected marker identities from the separately authenticated selection.
 */
export const parseSubtypeEntryTrace = (trace, selected) => {
	require(typeof trace === "string" && trace.length <= 4 * 1024 * 1024, "invalid or oversized entry trace");
	require(Array.isArray(selected) && selected.length > 0, "entry selection is required");
	const identities = new Set();
	for(const { kind, label } of selected)
	{
		require(["public", ...kinds].includes(kind) && typeof label === "string" && /^[A-Za-z_][A-Za-z0-9_.:]*$/u.test(label), "invalid entry identity");
		const identity = `${kind}/${label}`;
		require(!identities.has(identity), "duplicate entry identity"); identities.add(identity);
	}
	const calls = [];
	if(trace === "") return calls;
	require(trace.endsWith("\n"), "incomplete entry trace line");
	let active = null;
	for(const line of trace.slice(0, -1).split("\n"))
	{
		const match = /^LB_SUBTYPE_ENTRY_V1 (begin|enter|end) (public|validator|constructor|adapter|source) ([A-Za-z_][A-Za-z0-9_.:]*)$/u.exec(line);
		require(match !== null, `unexpected probe stderr: ${line}`);
		const [, event, kind, label] = match;
		require(identities.has(`${kind}/${label}`), `unselected entry: ${kind}/${label}`);
		if(event === "begin")
		{
			require(kind === "public" && active === null, "invalid or nested public begin");
			active = { publicName: label, entries: [], counts: Object.fromEntries(kinds.map(kind => [kind, 0])) };
		}
		else if(event === "end")
		{
			require(kind === "public" && active?.publicName === label, "unmatched public end");
			calls.push(active); active = null;
		}
		else
		{
			require(kind !== "public" && active !== null, "entry outside a public call");
			active.entries.push({ kind, label }); active.counts[kind]++;
		}
	}
	require(active === null, "missing public end");
	return calls;
};
