/**
 * Break receiver ownership deliberately without changing the consumer assertions.
 *
 * @file
 */
import assert from "node:assert/strict";

/**
 * Return separately compiled mutations of the generated public/native C adapter.
 *
 * @param generated - Actual compiler-authenticated receiver adapter.
 */
export const ownedReceiverMutants = generated => {
	const mutations = [
		["unbound-result", "status = transaction->anchor\n    ? lb_owned_scope_commit_borrow", "status = 0\n    ? lb_owned_scope_commit_borrow"]
		, ["canonical-view-escape", "if (!arena->view_batch) { *out = token; return LB_OWNED_OK; }", "if (1) { *out = token; return LB_OWNED_OK; }"]
		, ["missing-owner-membership", "transaction->anchor_input\n  ?", "0\n  ?"]
		, ["missing-view-identity-release", "if (lean_bridge_native_identity_release(view->key,", "if (0 && lean_bridge_native_identity_release(view->key,"]
		, ["callback-view-escape", ", .view_batch = &argument_owner.batch, .views = &argument_views", ", .views = &argument_views"]
		, ["missing-ancestor-transfer-check", "if (ancestor == candidate) return LB_OWNED_INVALID;", "if (0 && ancestor == candidate) return LB_OWNED_INVALID;"]
	].map(([name, before, after]) => {
		assert.ok(generated.source.includes(before), name);
		return { name, source: generated.source.replaceAll(before, after) };
	});
	const choose = generated.values.functions.find(item => item.name === "chooseTicket");
	const pattern = new RegExp(`int ${choose.symbol}\\([^]*?\\n\\}`, "u");
	const original = generated.source.match(pattern)?.[0];
	assert.ok(original); assert.ok(original.includes("transaction.anchor_input = 1;"));
	const changed = original.replace("transaction.anchor_input = 0;", "transaction.anchor_input = 1;")
		.replace(/(transaction\.anchor_input = 1;[^]*?)transaction\.anchor_input = 1;/u, "$1transaction.anchor_input = 0;");
	mutations.push({ name: "receiver-parameter-offset"
		, source: generated.source.replace(original, changed) });
	for(const mutation of mutations) assert.notEqual(mutation.source, generated.source, mutation.name);
	return mutations;
};
