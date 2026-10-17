/**
 * Closed Maven selections and independent Java/Kotlin inherited-record callers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
	inheritedCheckedRecordConfiguration
	, inheritedCheckedRecordModule
	, inheritedCheckedRecordReview
} from "./inherited-checked-record-fixture.mjs";

export const inheritedCheckedRecordJvmRoutes = Object.freeze([
	"ordinary", "reviewed"
]);
export const inheritedCheckedRecordJvmModes = Object.freeze([
	"full", "result-only"
]);
export const inheritedCheckedRecordJvmProfiles = Object.freeze([
	"java", "kotlin"
]);
export const inheritedCheckedRecordJvmMavenName
	= "org.leanbridge:inheritedcheckedrecords";
export const inheritedCheckedRecordJvmCounts = Object.freeze(
	Object.fromEntries(inheritedCheckedRecordJvmProfiles.map(profile => [
		profile
		, Object.freeze({
			full: Object.freeze({
				checks: 7204, rejections: 1286, recoveries: 256
				, snapshots: 3342, snapshotControls: 8, rounds: 256
			})
			, "result-only": Object.freeze({
				checks: 1546, rejections: 0, recoveries: 0
				, snapshots: 514, snapshotControls: 6, rounds: 256
			})
		})
	]))
);

/**
 * Reject disabled explicit selections, unknown values, and duplicate work.
 *
 * @param environment - Explicit injectable producer environment.
 */
export const inheritedCheckedRecordJvmSelection = environment => {
	const prefix = "LEAN_BRIDGE_INHERITED_CHECKED_RECORD_JVM_";
	const flag = environment[prefix + "TEST"];
	assert.ok(flag === undefined || ["0", "1"].includes(flag)
		, "Invalid inherited checked-record JVM TEST");
	const select = (name, permitted) => {
		const raw = environment[prefix + name];
		if(raw !== undefined)
		{
			assert.equal(typeof raw, "string"
				, `Invalid inherited checked-record JVM ${name}`);
			assert.equal(flag, "1"
				, `Explicit inherited checked-record JVM ${name} requires TEST=1`);
		}
		const selected = raw === undefined ? permitted : raw.split(",");
		assert.ok(selected.length
			&& selected.every(value => permitted.includes(value))
		, `Invalid inherited checked-record JVM ${name}`);
		assert.equal(new Set(selected).size, selected.length
			, `Duplicate inherited checked-record JVM ${name}`);
		return selected;
	};
	for(const name of [prefix + "OUTPUT", prefix + "MAX_LOAD"])
		if(environment[name] !== undefined)
			assert.equal(flag, "1", `Explicit ${name} requires TEST=1`);
	const rawLoad = environment[prefix + "MAX_LOAD"];
	if(rawLoad !== undefined)
		assert.equal(typeof rawLoad, "string"
			, "Invalid inherited checked-record JVM MAX_LOAD");
	const maxLoad = rawLoad === undefined
		? environment.CI === "true" ? 6 : 10
		: Number(rawLoad);
	assert.ok([6, 8, 10, 12].includes(maxLoad)
		, "Inherited checked-record JVM max load must be 6, 8, 10, or 12");
	return {
		enabled: flag === "1"
		, routes: select("ROUTES", inheritedCheckedRecordJvmRoutes)
		, modes: select("MODES", inheritedCheckedRecordJvmModes), maxLoad
	};
};

/**
 * Keep the full review or only constructor-free result exports.
 *
 * @param mode - Full API or standalone constructor-free results.
 */
export const inheritedCheckedRecordJvmReview = mode => {
	assert.ok(inheritedCheckedRecordJvmModes.includes(mode));
	const review = inheritedCheckedRecordReview();
	if(mode === "full") return review;
	const names = new Set(["produce", "produceStamped"]);
	review.declarations = review.declarations.filter(item =>
		names.has(item.name));
	review.types = review.types.filter(type => type.name !== "TicketAlias");
	return review;
};

/**
 * Select Maven packaging while retaining ordinary or reviewed author authority.
 *
 * @param route - Ordinary source or independently reviewed Binding IR.
 * @param mode - Full API or standalone constructor-free results.
 */
export const inheritedCheckedRecordJvmConfiguration = (route, mode) => {
	assert.ok(inheritedCheckedRecordJvmRoutes.includes(route));
	assert.ok(inheritedCheckedRecordJvmModes.includes(mode));
	const configuration = inheritedCheckedRecordConfiguration(route, ["c"]);
	if(mode === "result-only")
	{
		const names = new Set([
			`${inheritedCheckedRecordModule}.produce`
			, `${inheritedCheckedRecordModule}.produceStamped`
		]);
		if(configuration.exports)
			configuration.exports = configuration.exports.filter(name =>
				names.has(name));
		if(configuration.contracts)
		{
			configuration.contracts = Object.fromEntries(
				Object.entries(configuration.contracts)
					.filter(([name]) => names.has(name))
			);
			if(!Object.keys(configuration.contracts).length)
				delete configuration.contracts;
		}
	}
	return {
		...configuration
		, targets: {
			maven: { name: inheritedCheckedRecordJvmMavenName, version: "1.0.0" }
		}
	};
};

/**
 * Add only route/mode selectors to an immutable Java or Kotlin caller.
 *
 * @param profile - Java or Kotlin public API.
 * @param route - Ordinary or reviewed diagnostic names.
 * @param mode - Full API or standalone constructor-free results.
 */
export const inheritedCheckedRecordJvmCaller = async (
	profile, route, mode
) => {
	assert.ok(inheritedCheckedRecordJvmProfiles.includes(profile));
	assert.ok(inheritedCheckedRecordJvmRoutes.includes(route));
	assert.ok(inheritedCheckedRecordJvmModes.includes(mode));
	const extension = profile === "java" ? "java" : "kt";
	let source = await readFile(
		`tests/fixtures/inherited-checked-record-consumers/${profile}.${extension}`
		, "utf8"
	);
	assert.equal((source.match(/ROUTE_PREFIX/gu) ?? []).length, 1);
	source = source.replace("ROUTE_PREFIX"
		, route === "ordinary" ? "arg" : "value");
	const pattern
		= /^[ \t]*\/\/ BEGIN FULL_ONLY\n([\s\S]*?)^[ \t]*\/\/ END FULL_ONLY\n/gmu;
	assert.equal([...source.matchAll(pattern)].length, 4);
	source = source.replace(pattern
		, (_, content) => mode === "full" ? content : "");
	assert.doesNotMatch(source, /FULL_ONLY|ROUTE_PREFIX/u);
	return source;
};

/**
 * Require every independent check, rejection, recovery, and snapshot total.
 *
 * @param stdout - Exact caller JSON output.
 * @param profile - Java or Kotlin public API.
 * @param mode - Full API or standalone constructor-free results.
 */
export const parseInheritedCheckedRecordJvmResult = (
	stdout, profile, mode
) => {
	assert.ok(inheritedCheckedRecordJvmProfiles.includes(profile));
	assert.ok(inheritedCheckedRecordJvmModes.includes(mode));
	const result = JSON.parse(stdout);
	assert.deepEqual(result, inheritedCheckedRecordJvmCounts[profile][mode]);
	return result;
};
