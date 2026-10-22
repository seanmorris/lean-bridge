/**
 * CPAN selections and immutable caller for dependent checked records.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
	dependentCheckedRecordRoutes, dependentCheckedRecordSelection
} from "./dependent-checked-record-browser-fixture.mjs";
import {
	checkedRecordPerlConfigurations, checkedRecordPerlModes
} from "./checked-record-perl-install.mjs";

export const dependentCheckedRecordPerlModule
	= "LeanBridge::DependentRecords";
export const dependentCheckedRecordPerlLeanModule = "DependentRecords";
export const dependentCheckedRecordPerlFixtureRoot
	= "tests/fixtures/onboarding/dependent-checked-records";
export const dependentCheckedRecordPerlRoutes = dependentCheckedRecordRoutes;
export const dependentCheckedRecordPerlConfigurations
	= checkedRecordPerlConfigurations;
export const dependentCheckedRecordPerlInstallModes = checkedRecordPerlModes;
export const dependentCheckedRecordPerlTarget = Object.freeze({
	module: dependentCheckedRecordPerlModule, version: "1.000"
});
export const dependentCheckedRecordPerlCounts = Object.freeze({
	full: Object.freeze({
		calls: 1289, checks: 2326, recoveries: 258
		, rejections: 258, snapshots: 1289
	})
	, "result-only": Object.freeze({
		calls: 513, checks: 516, recoveries: 0
		, rejections: 0, snapshots: 513
	})
});

/**
 * Select one exact ordinary/reviewed and full/result-only CPAN package.
 *
 * @param route - Exact author selection.
 */
export const dependentCheckedRecordPerlSelection = route => {
	assert.ok(dependentCheckedRecordPerlRoutes.includes(route));
	const selection = dependentCheckedRecordSelection(route);
	return {
		...selection
		, configuration: {
			...selection.configuration
			, targets: { cpan: dependentCheckedRecordPerlTarget }
		}
	};
};

/**
 * Return the exact route-specific independent caller receipt.
 *
 * @param route - Exact author selection.
 */
export const dependentCheckedRecordPerlExpected = route => {
	const { resultOnly } = dependentCheckedRecordPerlSelection(route);
	return dependentCheckedRecordPerlCounts[
		resultOnly ? "result-only" : "full"
	];
};

/**
 * Keep caller bytes identical and pass only public author-route facts.
 *
 * @param route - Exact author selection.
 */
export const dependentCheckedRecordPerlCallerArgs = route => {
	const selection = dependentCheckedRecordPerlSelection(route);
	return [
		...selection.resultOnly ? ["--result-only"] : []
		, ...selection.reviewed ? ["--reviewed"] : []
	];
};

/** Load the independently authored caller. */
export const dependentCheckedRecordPerlCaller = () => readFile(
	"tests/fixtures/dependent-checked-record-consumers/perl.pl", "utf8"
);

/**
 * Authenticate one complete caller result.
 *
 * @param stdout - Complete caller stdout.
 * @param route - Exact author selection.
 */
export const parseDependentCheckedRecordPerlResult = (stdout, route) => {
	assert.equal(typeof stdout, "string");
	assert.ok(stdout.endsWith("\n"));
	const result = JSON.parse(stdout);
	assert.deepEqual(result, dependentCheckedRecordPerlExpected(route));
	return result;
};
