/**
 * Reverse the exact generated recorder change before comparing older C evidence.
 * Callers still authenticate the complete restored source against its old hash.
 *
 * @file
 */
import assert from "node:assert/strict";

const marker = "  /* An explicit host code is kept; otherwise an invalid argument keeps its matching boundary code. */\n";
const current = / {2}\/\* An explicit host code is kept; otherwise an invalid argument keeps its matching boundary code\. \*\/\n {2}frame->code = error && error->code \? error->code : frame->status == ([A-Z][A-Z0-9_]*)_STATUS_INVALID_ARGUMENT \? \1_ERROR_INVALID_ARGUMENT : \1_ERROR_UNEXPECTED;\n/gu;

/**
 * Restore only the known status-to-code mapping, leaving unrelated bytes intact.
 *
 * @param source - Complete generated C source.
 */
export const beforeCallableErrorCode = source => {
	if(!source.includes(marker)) return source;
	assert.equal([...source.matchAll(current)].length, 1, "Exactly one recorded callable error-code change");
	return source.replace(current, (_, prefix) => "  frame->code = error && error->code ? error->code : " + prefix + "_ERROR_UNEXPECTED;\n");
};
