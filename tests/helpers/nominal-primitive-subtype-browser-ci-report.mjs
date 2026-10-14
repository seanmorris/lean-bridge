/**
 * Require an explicit nominal browser selection, exact original record set and terminal TAP.
 *
 * @file
 */
import assert from "node:assert/strict";
import { nominalPrimitiveSubtypeBrowserRoutes, nominalPrimitiveSubtypeBrowserModes } from "./nominal-primitive-subtype-browser-fixture.mjs";
import { checkNominalPrimitiveSubtypeBrowserReport, nominalPrimitiveSubtypeBrowserRecords } from "./nominal-primitive-subtype-browser-report.mjs";
import { assertNominalPrimitiveSubtypeNpmCiTap } from "./nominal-primitive-subtype-npm-ci-report.mjs";


/**
 * Require the complete terminal producer TAP, including no hidden nested failure.
 *
 * @param source - Original combined producer output.
 * @param route - Independently selected author route.
 * @param mode - Independently selected API mode.
 */
export const assertNominalPrimitiveSubtypeBrowserTap = (source, route, mode) => {
	assertNominalPrimitiveSubtypeNpmCiTap(source, route, mode);
	assert.doesNotMatch(source, /^[ \t]+(?:ok |not ok |# Subtest:|Bail out!)/gmu);
	assert.match(source, /\n1\.\.1\n# tests 1\n# suites 0\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n# duration_ms [0-9]+(?:\.[0-9]+)?\n$/u);
};

/**
 * Reject ambiguous options before reading any records.
 *
 * @param args - CLI arguments following the executable script name.
 */
export const parseNominalPrimitiveSubtypeBrowserCiArgs = args => {
	const usage = "Usage: check-nominal-primitive-subtype-browser-ci.mjs --route <ordinary|reviewed> --mode <full|result-only> --producer <commit> --directory <records> --tap <original-tap> --runtime <independent-runtime-json>";
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
	assert.ok(nominalPrimitiveSubtypeBrowserRoutes.includes(selected.route), usage);
	assert.ok(nominalPrimitiveSubtypeBrowserModes.includes(selected.mode), usage);
	assert.match(selected.producer, /^[a-f0-9]{40}$/u);
	return selected;
};

/**
 * Check real archive bytes and all browser profiles against independently selected runtime evidence.
 *
 * @param options - Explicit parsed options, not fields chosen by the report itself.
 * @param original - Original TAP, runtime observation and closed relative record reader.
 * @param original.tap - Complete combined producer output.
 * @param original.runtime - Runtime observed outside the producer test.
 * @param original.paths - Complete regular-file inventory of the retained output.
 * @param original.read - Reads current retained records, never historical machine paths.
 */
export const checkNominalPrimitiveSubtypeBrowserCiRecords = async (options, { tap, runtime, paths, read }) => {
	const selected = parseNominalPrimitiveSubtypeBrowserCiArgs(Object.entries(options).flatMap(([key, value]) => ["--" + key, value]));
	assertNominalPrimitiveSubtypeBrowserTap(tap, selected.route, selected.mode);
	const npm = JSON.parse(await read("report.json"));
	const expected = nominalPrimitiveSubtypeBrowserRecords(selected.mode, npm.receipt).sort();
	assert.equal(new Set(expected).size, expected.length); assert.deepEqual(paths, expected);
	return checkNominalPrimitiveSubtypeBrowserReport(read, { route: selected.route, mode: selected.mode, producerCommit: selected.producer, runtime });
};
