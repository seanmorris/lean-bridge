/**
 * Identify the three contiguous milestones that close the final Core
 * type-surface audit without conflating behavior with exact snapshots.
 *
 * @file
 */

export const coreFinalTypeSurfaceAuditHistoryPath
	= "docs/evidence/core-final-type-surface-audit-source-history-20261031.json";

export const coreFinalTypeSurfaceAuditMilestones = Object.freeze([
	Object.freeze({
		role: "behavior-and-semantic-gate"
		, commit: "8f5e50a90602689f88c3213cbd182c620a30196b"
		, parent: "4456a0c2025a3e914ea9143ecdbe1192f339dfc7"
		, tree: "92674de908ec2cc9fec2d696f5afdfb1935ece41"
		, subject: "test(core): separate semantic acceptance from final snapshots"
	})
	, Object.freeze({
		role: "live-source-pin-reconciliation"
		, commit: "21d77a4566d7b502073ab32facba7b395c3350aa"
		, parent: "8f5e50a90602689f88c3213cbd182c620a30196b"
		, tree: "1003295e0742a390d13b25f1a071f36a45b28a02"
		, subject: "test(core): reconcile semantic gate live citations"
	})
	, Object.freeze({
		role: "exact-model-and-documentation-seal"
		, commit: "dd68f225961b4692132e98f5af9b64c5bb2d6aaf"
		, parent: "21d77a4566d7b502073ab32facba7b395c3350aa"
		, tree: "cd51a68879c9d2a1725d5237f83db58cf9088e4d"
		, subject: "test(core): seal exact type-surface contracts"
	})
]);

export const coreFinalTypeSurfaceAuditHistoryAdditions = Object.freeze([
	"scripts/update-core-final-type-surface-audit-source-history.mjs"
	, "tests/core-final-type-surface-audit-source-history.test.mjs"
	, "tests/helpers/core-final-type-surface-audit-source-history.mjs"
]);

