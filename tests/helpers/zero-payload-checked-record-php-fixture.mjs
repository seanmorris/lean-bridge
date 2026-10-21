/**
 * Explicit native-PHP selections, immutable caller and exact totals for
 * zero-payload checked records: a proof-only Witness, a Unit-bearing Token, a
 * plain empty Marker and a Mark variant as guarded readonly classes, each kept
 * distinct from Option, null and default values. Source/caller evidence only.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
	zeroPayloadBrowserRoutes
	, zeroPayloadBrowserSelection
	, zeroPayloadBrowserName
} from "./zero-payload-checked-record-browser-fixture.mjs";

export const zeroPayloadPhpRoutes = zeroPayloadBrowserRoutes;
export const zeroPayloadPhpTarget = Object.freeze({
	name: `example/${zeroPayloadBrowserName}`, version: "1.0.0"
});
export const zeroPayloadPhpNamespace = "LeanZeropayloadcheckedrecords";
export const zeroPayloadPhpLoadCeilings = Object.freeze([8, 12, 16, 20]);

/**
 * Select an all-route native-PHP producer run.  This remains opt-in so the
 * ordinary source suite never turns a local check into a compiler build.
 *
 * @param environment - Explicit environment supplied by the hosted lane.
 */
export const zeroPayloadPhpEnvironment = environment => {
	const prefix = "LEAN_BRIDGE_ZERO_PAYLOAD_PHP_", flag = environment[prefix + "TEST"];
	assert.ok(flag === undefined || ["0", "1"].includes(flag), "Invalid zero-payload PHP TEST");
	const select = (name, permitted) => {
		const raw = environment[prefix + name];
		if(raw !== undefined)
		{
			assert.equal(typeof raw, "string", `Invalid zero-payload PHP ${name}`);
			assert.equal(flag, "1", `Explicit zero-payload PHP ${name} requires TEST=1`);
		}
		const selected = raw === undefined ? permitted : raw.split(",");
		assert.ok(selected.length && selected.every(value => permitted.includes(value))
			, `Invalid zero-payload PHP ${name}`);
		assert.equal(new Set(selected).size, selected.length, `Duplicate zero-payload PHP ${name}`);
		return selected;
	};
	for(const name of ["OUTPUT", "MAX_LOAD"])
		if(environment[prefix + name] !== undefined)
			assert.equal(flag, "1", `Explicit zero-payload PHP ${name} requires TEST=1`);
	const rawLoad = environment[prefix + "MAX_LOAD"];
	if(rawLoad !== undefined) assert.equal(typeof rawLoad, "string", "Invalid zero-payload PHP MAX_LOAD");
	const maxLoad = rawLoad === undefined ? 8 : Number(rawLoad);
	assert.ok(zeroPayloadPhpLoadCeilings.includes(maxLoad)
		, "Zero-payload PHP max load must be 8, 12, 16, or 20");
	return { enabled: flag === "1"
		, routes: select("ROUTES", zeroPayloadPhpRoutes), maxLoad };
};

/** Load the immutable weak-mode caller without consulting generated output. */
export const zeroPayloadPhpCaller = () => readFile(
	"tests/fixtures/zero-payload-checked-record-php/php.php", "utf8"
);

/**
 * Preserve only author-route switches; strictness is exercised at install time.
 *
 * @param route - Exact full/result-only and ordinary/reviewed route.
 */
export const zeroPayloadPhpCallerArgs = route => {
	const selection = zeroPayloadPhpSelection(route);
	return [...selection.resultOnly ? ["--result-only"] : []
		, ...selection.reviewed ? ["--reviewed"] : []];
};

/**
 * Exact independent caller totals, not values reported by the package.
 *
 * @param route - Exact full/result-only and ordinary/reviewed route.
 */
export const zeroPayloadPhpExpected = route => {
	const { resultOnly } = zeroPayloadPhpSelection(route);
	return resultOnly
		? { calls: 9, checks: 39, recoveries: 0, rejections: 0, snapshots: 9 }
		: { calls: 30, checks: 81, recoveries: 8, rejections: 8, snapshots: 30 };
};

/**
 * Require exactly the one-line receipt emitted by the immutable caller.
 *
 * @param stdout - Complete caller output.
 * @param route - Exact full/result-only and ordinary/reviewed route.
 */
export const parseZeroPayloadPhpResult = (stdout, route) => {
	assert.equal(typeof stdout, "string"); assert.ok(stdout.endsWith("\n"));
	assert.deepEqual(JSON.parse(stdout), zeroPayloadPhpExpected(route));
	return zeroPayloadPhpExpected(route);
};

/**
 * Preserve the independently authored full/result-only and ordinary/reviewed route.
 *
 * @param route - Exact full/result-only and ordinary/reviewed route.
 */
export const zeroPayloadPhpSelection = route => {
	assert.ok(zeroPayloadPhpRoutes.includes(route)
		, "Unknown zero-payload native PHP route");
	const selection = zeroPayloadBrowserSelection(route);
	return {
		...selection
		, configuration: {
			...selection.configuration
			, targets: { "php-native": zeroPayloadPhpTarget }
		}
	};
};
