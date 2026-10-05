/**
 * Compile broken lifetime adapters, then reject their observable behavior.
 *
 * @file
 */
import assert from "node:assert/strict";
import { sha256 } from "../../src/capsule/node.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

export const ownedWitBorrowMutations = [
	["unbound-result", "status = transaction->anchor\n    ? lb_owned_scope_commit_borrow", "status = 0\n    ? lb_owned_scope_commit_borrow"]
	, ["canonical-view-escape", "if (!arena->view_batch) { *out = token; return LB_OWNED_OK; }", "if (1) { *out = token; return LB_OWNED_OK; }"]
	, ["missing-owner-membership", "transaction->anchor_input\n  ?", "0\n  ?"]
	, ["missing-view-identity-release", "if (lean_bridge_native_identity_release(view->key,", "if (0 && lean_bridge_native_identity_release(view->key,"]
	, ["callback-view-escape", ", .view_batch = &argument_owner.batch, .views = &argument_views", ", .views = &argument_views"]
	, ["missing-ancestor-transfer-check", "if (ancestor == candidate) return LB_OWNED_INVALID;", "if (0 && ancestor == candidate) return LB_OWNED_INVALID;"]
	, ["missing-wit-result-anchor", "if (!status) status = ov_anchor_prepare(&transaction, anchor);", "if (!status) (void)anchor;"]
	, ["missing-native-anchor-frame", "frame.host.input_anchor = anchor;", "frame.host.input_anchor = NULL;"]
	, ["missing-store-lease-cleanup", "if (frame->host.self && !ow_native_host_close(&frame->host) && !status) status = LB_OWNED_RUNTIME;", "(void)frame->host;"]
];

/**
 * Keep compiled Lean fixed, restore every adapter, and recheck the baseline.
 *
 * @param fixture - Compiled Lean fixture and compiler hook.
 * @param implementation - Instrumented public host source.
 * @param source - Independent public consumer assertions.
 * @param extra - Link arguments for the original public adapter and pinned SDK.
 * @param expected - Complete stdout of the unmodified consumer.
 */
export const rejectOwnedWitBorrowMutants = async (fixture, implementation, source, extra, expected) => {
	const observations = [];
	for(const [name, before, after] of ownedWitBorrowMutations)
	{
		assert.ok(implementation.includes(before), name);
		const changed = implementation.replaceAll(before, after);
		try
		{
			await saveLakeFile(fixture.directory, "public-api.c", changed);
			const broken = await fixture.compile(name, source, false, extra);
			await assert.rejects(broken, error => {
				assert.match(error.message, /borrow C check failed/u, name);
				assert.doesNotMatch(error.message, /Segmentation fault|undefined symbol|ERROR: AddressSanitizer/u);
				return true;
			});
			observations.push({ name, compiled: true, semanticRejection: true, sourceSha256: sha256(changed) });
		}
		finally
		{ await saveLakeFile(fixture.directory, "public-api.c", implementation); }
	}
	const restored = await fixture.compile("restored-borrowed", source, false, extra);
	const result = await restored(); assert.equal(result.stdout, expected); assert.equal(result.stderr, "");
	return observations;
};
