/**
 * Keep closed value-index CPAN routes and caller transformations explicit.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
	checkedRecordValueIndexPerlConfigurations
	, checkedRecordValueIndexPerlConsumer, checkedRecordValueIndexPerlExpected
	, checkedRecordValueIndexPerlModes, checkedRecordValueIndexPerlModule
	, checkedRecordValueIndexPerlRoutes, checkedRecordValueIndexPerlSelection
} from "./checked-record-value-index-perl-fixture.mjs";

test("value-index Perl routes retain the complete ABI and delivery matrix", () => {
	assert.deepEqual(checkedRecordValueIndexPerlConfigurations, [
		"5.36.3-threaded", "5.36.3-unthreaded"
		, "5.38.2-threaded", "5.38.2-unthreaded"
	]);
	assert.deepEqual(checkedRecordValueIndexPerlModes, [
		"prebuilt-only", "build-xs"
	]);
	assert.equal(checkedRecordValueIndexPerlRoutes.length, 4);
});

for(const route of checkedRecordValueIndexPerlRoutes) test(
	`value-index Perl caller selects ${route} without changing its public contract`
	, async () => {
		const selection = checkedRecordValueIndexPerlSelection(route);
		assert.deepEqual(selection.configuration.targets, {
			cpan: { module: checkedRecordValueIndexPerlModule, version: "1.000" }
		});
		const source = await checkedRecordValueIndexPerlConsumer(route);
		assert.match(source, /use LeanBridge::CheckedRecordValueIndices;/u);
		assert.doesNotMatch(source, /ROUTE_(?:PREFIX|RESULT_ONLY)/u);
		assert.match(source, selection.reviewed ? /my \$prefix = 'value0';/u
			: /my \$prefix = 'arg0';/u);
		assert.match(source, new RegExp(
			`my \\$result_only = ${selection.resultOnly ? "1" : "0"};`, "u"));
		assert.deepEqual(checkedRecordValueIndexPerlExpected(route), selection.resultOnly
			? { calls: 8, checks: 9, recoveries: 0, rejections: 0, snapshots: 0 }
			: { calls: 28, checks: 49, recoveries: 6, rejections: 6, snapshots: 14 });
	}
);
