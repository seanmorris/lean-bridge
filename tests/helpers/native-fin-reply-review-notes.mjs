/**
 * Clarify existing C/C++ callback evidence without changing its accepted directions or cell states.
 *
 * @file
 */
import assert from "node:assert/strict";
import { nativeFinReplyPromotionEnvironment, nativeFinReplyPromotionId, nativeFinReplyPromotionInstalled, nativeFinReplyPromotionObservationIds } from "./native-fin-reply-promotion-references.mjs";

export const nativeReplyReviewObservationIds = [
	...nativeFinReplyPromotionObservationIds
	, "callback-fin-c-reviewed-ir"
	, "callback-fin-cpp-reviewed-ir"
];
export const nativeReplyReviewValidator = "tests/helpers/native-fin-reply-review-notes.mjs";
export const nativeReplyReviewPattern = "^(?:fresh Lean|generated C wrapper execution: C reply walks|relocated source-free C and C\\+\\+ packages check every host reply)";
export const nativeReplyReviewEarlierShapes = "The earlier closure-argument and Lean-produced-value checks cover scalar Fin, Array/List/Option/Prod/Except and plain record/variant payloads, including Fin 0 absence and wide bounds.";
export const nativeReplyReviewDispatch = "The earlier ordinary-source C closure-argument probes measured source dispatch; C++ and the installed host-reply run did not.";

/**
 * Add route labels and retain the earlier result bounds, shapes and distinct execution environment.
 *
 * @param previous - One existing callback observation before this clarification.
 */
export const clarifyNativeReplyObservation = previous => {
	assert.ok(nativeReplyReviewObservationIds.includes(previous.id));
	const result = structuredClone(previous), ordinary = nativeFinReplyPromotionObservationIds.includes(previous.id);
	assert.equal(previous.path, ordinary ? "ordinary-source" : "reviewed-ir");
	assert.deepEqual(previous.shapes, ["fin"]);
	assert.deepEqual(previous.positions, ["callback-parameter", "callback-result"]);
	const label = ordinary ? "Ordinary source" : "Reviewed IR";
	result.conversionNotes.fin = `${label}: ${previous.conversionNotes.fin}`;
	result.hostTypes.fin["callback-result"] = `${label}: ${previous.hostTypes.fin["callback-result"]}${ordinary ? ", below the declared Fin bound" : ""}`;
	if(ordinary)
	{
		assert.equal(previous.limitations[1], nativeFinReplyPromotionEnvironment);
		assert.match(previous.limitations[3], /it does not measure host glibc/u);
		result.limitations[1] = `Host-reply run: ${previous.limitations[1]}`;
		result.limitations[3] = `Earlier closure-argument run: ${previous.limitations[3]}`;
		result.stages.packaging.note = `${result.limitations[3]} Host-reply run: ${nativeFinReplyPromotionInstalled} ${nativeFinReplyPromotionEnvironment}`;
		result.stages.installedExecution.note = `${nativeReplyReviewEarlierShapes} ${previous.stages.installedExecution.note}`;
	}
	return result;
};

/**
 * Anchor the existing reproduction selector and pin this clarification's validator.
 *
 * @param previous - Existing installed host-reply evidence reference.
 * @param validatorSha256 - Current digest of this file.
 */
export const clarifyNativeReplyEvidence = (previous, validatorSha256) => {
	assert.equal(previous.id, nativeFinReplyPromotionId);
	assert.match(validatorSha256, /^[0-9a-f]{64}$/u);
	const result = structuredClone(previous);
	const oldPattern = nativeReplyReviewPattern.slice("^(?:".length, -1);
	assert.equal(previous.command.split(`--test-name-pattern='${oldPattern}'`).length, 2);
	result.command = previous.command.replace(`--test-name-pattern='${oldPattern}'`, `--test-name-pattern='${nativeReplyReviewPattern}'`);
	assert.ok(!result.files.some(file => file.path === nativeReplyReviewValidator));
	result.files.push({ path: nativeReplyReviewValidator, sha256: validatorSha256 });
	return result;
};
