/**
 * Closed C# selections and an independent inherited checked-record caller.
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

export const inheritedCheckedRecordDotnetRoutes = Object.freeze([
	"ordinary", "reviewed"
]);
export const inheritedCheckedRecordDotnetModes = Object.freeze([
	"full", "result-only"
]);
export const inheritedCheckedRecordDotnetTarget = Object.freeze({
	name: "Inheritedcheckedrecords.Api", version: "1.0.0"
});
export const inheritedCheckedRecordDotnetCounts = Object.freeze({
	full: Object.freeze({
		checks: 7204, rejections: 1286, recoveries: 256
		, snapshots: 3342, snapshotControls: 8, rounds: 256
	})
	, "result-only": Object.freeze({
		checks: 1546, rejections: 0, recoveries: 0
		, snapshots: 514, snapshotControls: 6, rounds: 256
	})
});

/**
 * Reject disabled explicit selections, spelling errors and duplicated runs.
 *
 * @param environment - Explicit injectable producer environment.
 */
export const inheritedCheckedRecordDotnetSelection = environment => {
	const prefix = "LEAN_BRIDGE_INHERITED_CHECKED_RECORD_DOTNET_";
	const flag = environment[prefix + "TEST"];
	assert.ok(flag === undefined || ["0", "1"].includes(flag)
		, "Invalid inherited checked-record C# TEST");
	const select = (name, permitted) => {
		const raw = environment[prefix + name];
		if(raw !== undefined)
		{
			assert.equal(typeof raw, "string"
				, `Invalid inherited checked-record C# ${name}`);
			assert.equal(flag, "1"
				, `Explicit inherited checked-record C# ${name} requires TEST=1`);
		}
		const selected = raw === undefined ? permitted : raw.split(",");
		assert.ok(selected.length && selected.every(value => permitted.includes(value))
			, `Invalid inherited checked-record C# ${name}`);
		assert.equal(new Set(selected).size, selected.length
			, `Duplicate inherited checked-record C# ${name}`);
		return selected;
	};
	for(const name of [prefix + "OUTPUT", prefix + "MAX_LOAD"])
		if(environment[name] !== undefined)
		assert.equal(flag, "1", `Explicit ${name} requires TEST=1`);
	const rawLoad = environment[prefix + "MAX_LOAD"];
	if(rawLoad !== undefined)
		assert.equal(typeof rawLoad, "string"
			, "Invalid inherited checked-record C# MAX_LOAD");
	const maxLoad = rawLoad === undefined
		? environment.CI === "true" ? 6 : 10 : Number(rawLoad);
	assert.ok([6, 8, 10, 12].includes(maxLoad)
		, "Inherited checked-record C# max load must be 6, 8, 10, or 12");
	return {
		enabled: flag === "1"
		, routes: select("ROUTES", inheritedCheckedRecordDotnetRoutes)
		, modes: select("MODES", inheritedCheckedRecordDotnetModes)
		, maxLoad
	};
};

/**
 * Keep the full review or only constructor-free result exports.
 *
 * @param mode - Full API or standalone constructor-free results.
 */
export const inheritedCheckedRecordDotnetReview = mode => {
	assert.ok(inheritedCheckedRecordDotnetModes.includes(mode));
	const review = inheritedCheckedRecordReview();
	if(mode === "full") return review;
	const names = new Set(["produce", "produceStamped"]);
	review.declarations = review.declarations.filter(item => names.has(item.name));
	review.types = review.types.filter(type => type.name !== "TicketAlias");
	return review;
};

/**
 * Select NuGet packaging while retaining ordinary or reviewed author authority.
 *
 * @param route - Ordinary source or independently reviewed Binding IR.
 * @param mode - Full API or standalone constructor-free results.
 */
export const inheritedCheckedRecordDotnetConfiguration = (route, mode) => {
	assert.ok(inheritedCheckedRecordDotnetRoutes.includes(route));
	assert.ok(inheritedCheckedRecordDotnetModes.includes(mode));
	const configuration = inheritedCheckedRecordConfiguration(route, ["c"]);
	if(mode === "result-only")
	{
		const names = new Set([
			`${inheritedCheckedRecordModule}.produce`
			, `${inheritedCheckedRecordModule}.produceStamped`
		]);
		if(configuration.exports)
			configuration.exports = configuration.exports.filter(name => names.has(name));
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
		, targets: { nuget: { ...inheritedCheckedRecordDotnetTarget } }
	};
};

/**
 * Add only route/mode selectors to the immutable checked-in C# caller.
 *
 * @param route - Ordinary or reviewed diagnostic names.
 * @param mode - Full API or standalone constructor-free results.
 */
export const inheritedCheckedRecordDotnetCaller = async (route, mode) => {
	assert.ok(inheritedCheckedRecordDotnetRoutes.includes(route));
	assert.ok(inheritedCheckedRecordDotnetModes.includes(mode));
	const source = await readFile(
		"tests/fixtures/inherited-checked-record-consumers/dotnet.cs", "utf8"
	);
	const defines = [
		mode === "result-only" ? "#define RESULT_ONLY" : ""
		, route === "reviewed" ? "#define REVIEWED" : ""
	].filter(Boolean).join("\n");
	return (defines ? defines + "\n" : "") + source;
};

/**
 * Require every independent check, rejection, recovery and snapshot total.
 *
 * @param stdout - Original complete public caller output.
 * @param mode - Full API or standalone constructor-free results.
 */
export const parseInheritedCheckedRecordDotnetResult = (stdout, mode) => {
	assert.ok(inheritedCheckedRecordDotnetModes.includes(mode));
	const result = JSON.parse(stdout);
	assert.deepEqual(result, inheritedCheckedRecordDotnetCounts[mode]);
	return result;
};
