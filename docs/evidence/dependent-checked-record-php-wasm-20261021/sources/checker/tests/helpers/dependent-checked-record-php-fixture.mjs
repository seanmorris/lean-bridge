/**
 * Explicit native-PHP selections, immutable caller and exact totals for
 * proof-erased dependent checked records: a retained `bound : Nat` and a
 * retained `below : Fin bound`, checked only through the reviewed Lean
 * constructor, with the refusal, recovery and huge-value paths exercised by an
 * independent caller. Source/caller evidence only.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
	dependentCheckedRecordFixture
	, dependentCheckedRecordName
	, dependentCheckedRecordRoutes
	, dependentCheckedRecordSelection
} from "./dependent-checked-record-browser-fixture.mjs";

export const dependentCheckedRecordPhpRoutes = dependentCheckedRecordRoutes;
export const dependentCheckedRecordPhpTarget = Object.freeze({
	name: `example/${dependentCheckedRecordName}`, version: "1.0.0"
});
export const dependentCheckedRecordPhpFixtureRoot = dependentCheckedRecordFixture;
export const dependentCheckedRecordPhpLeanModule = "DependentRecords";
export const dependentCheckedRecordPhpNamespace = "LeanDependentrecords";
export const dependentCheckedRecordPhpLoadCeilings = Object.freeze([8, 12, 16, 20]);

/**
 * Select an all-route native-PHP producer run.  This remains opt-in so the
 * ordinary source suite never turns a local check into a compiler build.
 *
 * @param environment - Explicit environment supplied by the hosted lane.
 */
export const dependentCheckedRecordPhpEnvironment = environment => {
	const prefix = "LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_PHP_", flag = environment[prefix + "TEST"];
	assert.ok(flag === undefined || ["0", "1"].includes(flag), "Invalid dependent checked-record PHP TEST");
	const select = (name, permitted) => {
		const raw = environment[prefix + name];
		if(raw !== undefined)
		{
			assert.equal(typeof raw, "string", `Invalid dependent checked-record PHP ${name}`);
			assert.equal(flag, "1", `Explicit dependent checked-record PHP ${name} requires TEST=1`);
		}
		const selected = raw === undefined ? permitted : raw.split(",");
		assert.ok(selected.length && selected.every(value => permitted.includes(value))
			, `Invalid dependent checked-record PHP ${name}`);
		assert.equal(new Set(selected).size, selected.length, `Duplicate dependent checked-record PHP ${name}`);
		return selected;
	};
	for(const name of ["OUTPUT", "MAX_LOAD"])
		if(environment[prefix + name] !== undefined)
			assert.equal(flag, "1", `Explicit dependent checked-record PHP ${name} requires TEST=1`);
	const rawLoad = environment[prefix + "MAX_LOAD"];
	if(rawLoad !== undefined) assert.equal(typeof rawLoad, "string", "Invalid dependent checked-record PHP MAX_LOAD");
	const maxLoad = rawLoad === undefined ? 8 : Number(rawLoad);
	assert.ok(dependentCheckedRecordPhpLoadCeilings.includes(maxLoad)
		, "Dependent checked-record PHP max load must be 8, 12, 16, or 20");
	return { enabled: flag === "1"
		, routes: select("ROUTES", dependentCheckedRecordPhpRoutes), maxLoad };
};

/** Load the immutable weak-mode caller without consulting generated output. */
export const dependentCheckedRecordPhpCaller = () => readFile(
	"tests/fixtures/dependent-checked-record-consumers/php.php", "utf8"
);

/**
 * Preserve only author-route switches; strictness is exercised at install time.
 *
 * @param route - Exact full/result-only and ordinary/reviewed route.
 */
export const dependentCheckedRecordPhpCallerArgs = route => {
	const selection = dependentCheckedRecordPhpSelection(route);
	return [...selection.resultOnly ? ["--result-only"] : []
		, ...selection.reviewed ? ["--reviewed"] : []];
};

/**
 * Exact independent caller totals, not values reported by the package.
 *
 * @param route - Exact full/result-only and ordinary/reviewed route.
 */
export const dependentCheckedRecordPhpExpected = route => {
	const { resultOnly } = dependentCheckedRecordPhpSelection(route);
	return resultOnly
		? { calls: 513, checks: 516, recoveries: 0, rejections: 0, snapshots: 513 }
		: { calls: 1289, checks: 2326, recoveries: 258, rejections: 258, snapshots: 1289 };
};

/**
 * Require exactly the one-line receipt emitted by the immutable caller.
 *
 * @param stdout - Complete caller output.
 * @param route - Exact full/result-only and ordinary/reviewed route.
 */
export const parseDependentCheckedRecordPhpResult = (stdout, route) => {
	assert.equal(typeof stdout, "string"); assert.ok(stdout.endsWith("\n"));
	assert.deepEqual(JSON.parse(stdout), dependentCheckedRecordPhpExpected(route));
	return dependentCheckedRecordPhpExpected(route);
};

/**
 * Preserve the independently authored full/result-only and ordinary/reviewed route.
 *
 * @param route - Exact full/result-only and ordinary/reviewed route.
 */
export const dependentCheckedRecordPhpSelection = route => {
	assert.ok(dependentCheckedRecordPhpRoutes.includes(route)
		, "Unknown dependent checked-record native PHP route");
	const selection = dependentCheckedRecordSelection(route);
	return {
		...selection
		, configuration: {
			...selection.configuration
			, targets: { "php-native": dependentCheckedRecordPhpTarget }
		}
	};
};
