/**
 * Reverse the exact generated C call-local namespace change before comparing
 * older copied-value evidence. Public parameter names and all other generated
 * helpers remain untouched.
 *
 * @file
 */
import assert from "node:assert/strict";

const marker = "size_t _lb_budget = 16u * 1024u * 1024u;";
const callStart = /^static .*\blb_call_[A-Za-z0-9_]+\(.*\) \{$/u;
const local = /\b_lb_(budget|checked|boxed|value|result|status)\b/gu;
const braces = line => [...line].reduce((depth, character) =>
	depth + (character === "{" ? 1 : character === "}" ? -1 : 0), 0);

/**
 * Restore the six pre-namespace local identifiers only inside generated
 * lb_call_* bodies authenticated by their private budget marker.
 *
 * @param source - Complete generated native C source.
 */
export const beforeCopiedNativeLocalNamespace = source => {
	if(!source.includes(marker)) return source;
	const lines = source.split("\n");
	let changed = 0;
	for(let start = 0; start < lines.length; ++start)
	{
		if(!callStart.test(lines[start])) continue;
		let depth = braces(lines[start]), end = start;
		while(depth > 0 && ++end < lines.length) depth += braces(lines[end]);
		assert.equal(depth, 0, "Generated lb_call_* body must be structurally closed");
		const body = lines.slice(start, end + 1).join("\n");
		if(!body.includes(marker))
		{
			start = end;
			continue;
		}
		assert.equal((body.match(/\b_lb_budget\b/gu) ?? []).length >= 2, true);
		const previous = body.replace(local, (_, name) => name);
		assert.notEqual(previous, body);
		lines.splice(start, end - start + 1, ...previous.split("\n"));
		++changed;
		start = end;
	}
	assert.ok(changed > 0, "At least one generated lb_call_* body must carry the namespace change");
	return lines.join("\n");
};
