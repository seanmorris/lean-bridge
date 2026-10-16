/**
 * Closed npm selections and independent observations for mutual checked records.
 *
 * @file
 */
import assert from "node:assert/strict";
import {
	mutualCheckedRecordConfiguration, mutualCheckedRecordReview
} from "./mutual-checked-record-fixture.mjs";

export const mutualCheckedRecordNpmRoutes = Object.freeze(["ordinary", "reviewed"]);

export const mutualCheckedRecordNpmPositions = Object.freeze([
	"first.arg0.value", "first.arg0.mode", "first.arg0.next?.more.packet"
	, "second.arg0", "echo.arg0", "echo.result"
	, "groups.arg0[*]?", "echoGroups.arg0[*]?", "echoGroups.result[*]?"
	, "produce.result"
]);

/**
 * Select one independently authored package route.
 *
 * @param route - Ordinary compiler analysis or independently reviewed Binding IR.
 */
export const mutualCheckedRecordNpmSelection = route => {
	assert.ok(mutualCheckedRecordNpmRoutes.includes(route));
	return {
		route, reviewed: route === "reviewed"
		, configuration: mutualCheckedRecordConfiguration(route)
		, expected: mutualCheckedRecordReview()
	};
};

/**
 * Exact result emitted by the immutable Node and browser caller.
 *
 * @param route - Ordinary or reviewed author route.
 */
export const mutualCheckedRecordNpmExpected = route => {
	assert.ok(mutualCheckedRecordNpmRoutes.includes(route));
	const argument = route === "reviewed" ? "first.value0" : "first.arg0";
	const error = (name, message) => ({ name, message });
	const component = error("Error", "Component copied call failed (5)");
	return {
		checks: 1350, rejections: 269, calls: 674, snapshots: 674, recoveries: 141
		, failures: {
			"outer-subtype": component
			, "late-subtype": component
			, "outer-record": component
			, "outer-fin": error("TypeError", `${argument}.mode must be bigint below 3`)
			, "nested-fin": error("TypeError"
				, `${argument}.next.value.packet.mode must be bigint below 3`)
			, "erased-proof": error("TypeError"
				, `${argument} does not match the declared copied fields`)
			, "missing-field": error("TypeError"
				, `${argument} does not match the declared copied fields`)
			, "option-tag": error("TypeError", `${argument}.next must be Option tag`)
			, "variant-tag": error("TypeError"
				, `${argument}.next.value must be declared variant constructor`)
			, "missing-active-field": error("TypeError"
				, `${argument}.next.value does not match the declared copied fields`)
			, "inactive-field": error("TypeError"
				, `${argument}.next.value does not match the declared copied fields`)
			, cycle: error("TypeError", "Cyclic copied value")
			, depth: error("RangeError", "Component recursive value depth exceeded")
		}
	};
};
