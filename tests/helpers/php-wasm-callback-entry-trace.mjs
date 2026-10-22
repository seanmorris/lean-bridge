/**
 * Browser-safe parser for complete instrumented PHP-Wasm callback call scopes.
 *
 * @file
 */

export const phpWasmCallbackEntryKinds = Object.freeze([
	"adapter", "validator", "constructor", "recovery", "callback"
	, "rejection", "closure", "cleanup", "source"
]);

const require = (condition, message) => { if(!condition) throw new Error(message); };

/**
 * Parse only selected callback markers and preserve their exact observed order.
 *
 * @param trace - Complete stderr delta for one control.
 * @param selected - Authenticated entry selection.
 */
export const parsePhpWasmCallbackEntryTrace = (trace, selected) => {
	require(typeof trace === "string" && trace.length <= 4 * 1024 * 1024
		, "invalid or oversized callback entry trace");
	require(Array.isArray(selected) && selected.length > 0, "callback entry selection required");
	const identities = new Set();
	for(const { kind, label } of selected)
	{
		require(["public", ...phpWasmCallbackEntryKinds].includes(kind)
			&& typeof label === "string"
			&& /^[A-Za-z_][A-Za-z0-9_.:]*$/u.test(label), "invalid callback entry identity");
		const identity = `${kind}/${label}`;
		require(!identities.has(identity), "duplicate callback entry identity");
		identities.add(identity);
	}
	if(trace === "") return [];
	require(trace.endsWith("\n"), "incomplete callback entry trace line");
	const calls = []; let active = null;
	for(const line of trace.slice(0, -1).split("\n"))
	{
		const match = /^LB_CALLBACK_ENTRY_V1 (begin|enter|end) (public|adapter|validator|constructor|recovery|callback|rejection|closure|cleanup|source) ([A-Za-z_][A-Za-z0-9_.:]*)$/u.exec(line);
		require(match !== null, `unexpected callback probe stderr: ${line}`);
		const [, event, kind, label] = match;
		require(identities.has(`${kind}/${label}`), `unselected callback entry: ${kind}/${label}`);
		if(event === "begin")
		{
			require(kind === "public" && active === null, "invalid callback public begin");
			active = { publicName: label, entries: []
				, counts: Object.fromEntries(phpWasmCallbackEntryKinds.map(kind => [kind, 0])) };
		}
		else if(event === "end")
		{
			require(kind === "public" && active?.publicName === label
				, "unmatched callback public end");
			calls.push(active); active = null;
		}
		else
		{
			require(kind !== "public" && active !== null
				, "callback entry outside a public call");
			active.entries.push({ kind, label }); active.counts[kind]++;
		}
	}
	require(active === null, "missing callback public end");
	return calls;
};
