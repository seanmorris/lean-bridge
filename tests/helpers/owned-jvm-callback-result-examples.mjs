/**
 * Execute standalone callback-result guide examples against installed Maven JARs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * Keep native-only examples separate from the host-enabled callback reply example.
 *
 * @param namespace - Installed package namespace.
 * @param combined - Include host callback replies.
 * @param profile - Java or Kotlin consumer language.
 */
export const ownedJvmCallbackResultExamples = (namespace, combined, profile) => {
	assert.ok(["java", "kotlin"].includes(profile));
	const catalog = [
		["OwnedCallbackResultExample", "result-retained"]
		, ...combined ? [["OwnedCallbackReplyExample", "replies-copied"]] : []
		, ["OwnedCallbackThreadExample", "thread-owners-closed"]
	];
	const guide = readFileSync(new URL(`../../docs/consume/${profile}.md`, import.meta.url), "utf8");
	return catalog.map(([name, outcome]) => {
		const file = name + (profile === "java" ? ".java" : ".kt");
		const source = readFileSync(new URL(`../fixtures/documentation/consumers/${profile}/${file}`, import.meta.url), "utf8");
		assert.ok(guide.includes("```" + profile + ` file=${profile}/${file}\n` + source + "```"), file);
		assert.doesNotMatch(source, /_Owned|\.foreign\b|SymbolLookup|\.bindings\b/u);
		return { id: "owned/callback-" + outcome, file
			, main: name + (profile === "java" ? "" : "Kt")
			, source: source.replaceAll("org.leanbridge.owned_aggregates", namespace)
			, stdout: "callback-" + outcome + "\n" };
	});
};
