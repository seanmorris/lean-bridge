/**
 * Close one recurring nominal npm/browser entry measurement over its original records.
 *
 * @file
 */
import assert from "node:assert/strict";
import { nominalSubtypeBrowserRoutes, nominalSubtypeBrowserModes } from "./nominal-subtype-browser-fixture.mjs";
import { checkNominalSubtypeBrowserReport, nominalSubtypeBrowserRecords } from "./nominal-subtype-browser-report.mjs";
import { nominalSubtypeBrowserHandoffRecords } from "./nominal-subtype-browser-package.mjs";
import { assertNominalSubtypeBrowserTap } from "./nominal-subtype-browser-provenance.mjs";
import { nominalSubtypeEntryRecordPaths } from "./nominal-subtype-entry-npm.mjs";

/**
 * Parse an explicit recurring selection without allowing a historical unmeasured mode.
 *
 * @param args - CLI arguments following the executable script name.
 */
export const parseNominalSubtypeEntryBrowserCiArgs = args => {
	const usage = "Usage: check-nominal-subtype-entry-browser-ci.mjs --route <ordinary|reviewed> --mode <full|result-only> --producer <commit> --directory <records> --tap <original-tap> --runtime <independent-runtime-json>";
	const allowed = ["route", "mode", "producer", "directory", "tap", "runtime"], selected = {};
	assert.ok(Array.isArray(args) && args.length === 2 * allowed.length, usage);
	for(let index = 0; index < args.length; index += 2)
	{
		const flag = args[index], value = args[index + 1];
		assert.ok(typeof flag === "string" && flag.startsWith("--") && allowed.includes(flag.slice(2)), usage);
		const key = flag.slice(2);
		assert.ok(!Object.hasOwn(selected, key) && typeof value === "string" && value.length > 0 && !value.startsWith("--") && !/[\0\r\n]/u.test(value), usage);
		selected[key] = value;
	}
	assert.ok(nominalSubtypeBrowserRoutes.includes(selected.route), usage);
	assert.ok(nominalSubtypeBrowserModes.includes(selected.mode), usage);
	assert.match(selected.producer, /^[a-f0-9]{40}$/u);
	return selected;
};

/**
 * Require exact full-mode entry records and explicit result-only nonmeasurement.
 *
 * @param options - Explicit parsed selection.
 * @param original - Original TAP, runtime and closed record reader.
 * @param original.tap - Complete combined producer output.
 * @param original.runtime - Runtime observed outside the producer test.
 * @param original.paths - Complete regular-file inventory.
 * @param original.read - Closed reader relative to the selection records.
 */
export const checkNominalSubtypeEntryBrowserCiRecords = async (options, { tap, runtime, paths, read }) => {
	const selected = parseNominalSubtypeEntryBrowserCiArgs(Object.entries(options).flatMap(([key, value]) => ["--" + key, value]));
	assertNominalSubtypeBrowserTap(tap, selected.route, selected.mode);
	const npm = JSON.parse(await read("report.json")), measured = selected.mode === "full";
	assert.equal(npm.entry !== undefined, measured, measured ? "full mode requires the entry probe" : "result-only must remain uninstrumented");
	const expected = [...nominalSubtypeBrowserRecords(selected.mode)
		, ...measured ? nominalSubtypeEntryRecordPaths({ browser: true }) : []
		, ...nominalSubtypeBrowserHandoffRecords(npm.receipt)].sort();
	assert.equal(new Set(expected).size, expected.length); assert.deepEqual(paths, expected);
	const checked = await checkNominalSubtypeBrowserReport(read, {
		route: selected.route, mode: selected.mode
		, producerCommit: selected.producer, runtime
	});
	return { ...checked, entryObserved: measured };
};
