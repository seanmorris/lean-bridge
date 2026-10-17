/**
 * Verify fresh primitive-base native PHP acceptance against measured host tools.
 *
 * @file
 */
import assert from "node:assert/strict";
import { isAbsolute, posix } from "node:path";
import {
	nominalPrimitiveSubtypePhpRoutes
	, nominalPrimitiveSubtypePhpModes
} from "./nominal-primitive-subtype-php-fixture.mjs";
import { checkNominalPrimitiveSubtypePhpReport } from "./nominal-primitive-subtype-php-report.mjs";

/**
 * Select one complete primitive-base native PHP installed-package test.
 *
 * @param route - Ordinary source or independent review.
 * @param mode - Full or constructor-free result-only API.
 */
export const nominalPrimitiveSubtypePhpCiTestName = (route, mode) => {
	assert.ok(nominalPrimitiveSubtypePhpRoutes.includes(route));
	assert.ok(nominalPrimitiveSubtypePhpModes.includes(mode));
	return `installed primitive-base nominal PHP packages reproduce and relocate ${route} ${mode}`;
};

/**
 * Require the retained record list to contain the Composer ZIP exactly once.
 *
 * @param records - Complete selection-relative paths returned by the report checker.
 * @param archivePath - Independently authenticated Composer ZIP path.
 */
export const nominalPrimitiveSubtypePhpCiArtifactPaths = (records, archivePath) => {
	assert.ok(Array.isArray(records));
	assert.equal(typeof archivePath, "string");
	assert.equal(records.filter(path => path === archivePath).length, 1);
	assert.equal(new Set(records).size, records.length);
	return [...records].sort();
};

/**
 * Refuse incomplete, duplicate or unknown checker selections.
 *
 * @param args - Arguments following the checker script name.
 */
export const parseNominalPrimitiveSubtypePhpCiArgs = args => {
	const usage = "Usage: check-nominal-primitive-subtype-php-ci.mjs --route ordinary|reviewed --mode full|result-only --producer <commit> --directory <records> --tap <original-tap> --glibc 2.36|2.38 --php /absolute/php --composer /absolute/composer --php-version <exact> --composer-version <exact>";
	const allowed = ["route", "mode", "producer", "directory", "tap", "glibc"
		, "php", "composer", "php-version", "composer-version"];
	const selected = {};
	assert.ok(Array.isArray(args) && args.length % 2 === 0, usage);
	for(let index = 0; index < args.length; index += 2)
	{
		const flag = args[index], value = args[index + 1];
		assert.ok(typeof flag === "string" && flag.startsWith("--") && allowed.includes(flag.slice(2)), usage);
		const key = flag.slice(2);
		assert.ok(!Object.hasOwn(selected, key) && typeof value === "string"
			&& value.length > 0 && !value.startsWith("--") && !/[\0\r\n]/u.test(value), usage);
		selected[key] = value;
	}
	assert.deepEqual(Object.keys(selected).sort(), [...allowed].sort(), usage);
	nominalPrimitiveSubtypePhpCiTestName(selected.route, selected.mode);
	assert.match(selected.producer, /^[a-f0-9]{40}$/u);
	assert.ok(["2.36", "2.38"].includes(selected.glibc), usage);
	for(const key of ["php", "composer"])
		assert.ok(isAbsolute(selected[key]) && posix.normalize(selected[key]) === selected[key], usage);
	assert.match(selected["php-version"], /^8\.(?:[2-9]|[1-9][0-9]+)\.[0-9]+$/u);
	assert.match(selected["composer-version"], /^2\.[0-9]+\.[0-9]+$/u);
	return selected;
};

/**
 * Require one successful installed selection with complete zero-skip TAP totals.
 *
 * @param source - Original combined producer output.
 * @param route - Required author route.
 * @param mode - Required package API.
 */
export const assertNominalPrimitiveSubtypePhpCiTap = (source, route, mode) => {
	const name = nominalPrimitiveSubtypePhpCiTestName(route, mode);
	assert.equal(typeof source, "string"); assert.ok(source.startsWith("TAP version 13\n"));
	assert.doesNotMatch(source, /^not ok |^Bail out!|# SKIP|# TODO/gmu);
	assert.doesNotMatch(source, /^[ \t]+(?:ok |not ok |# Subtest:|Bail out!)/gmu);
	assert.deepEqual([...source.matchAll(/^ok (\d+) - (.+)$/gmu)].map(match => [Number(match[1]), match[2]]), [[1, name]]);
	assert.deepEqual([...source.matchAll(/^# Subtest: (.+)$/gmu)].map(match => match[1]), [name]);
	for(const [key, expected] of Object.entries({ tests: 1, suites: 0, pass: 1, fail: 0, cancelled: 0, skipped: 0, todo: 0 }))
	{
		const matches = [...source.matchAll(new RegExp(`^# ${key} (\\d+)$`, "gmu"))];
		assert.equal(matches.length, 1, key); assert.equal(Number(matches[0][1]), expected, key);
	}
	assert.deepEqual([...source.matchAll(/^\d+\.\.\d+.*$/gmu)].map(match => match[0]), ["1..1"]);
	assert.match(source, /\n1\.\.1\n# tests 1\n# suites 0\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n# duration_ms [0-9]+(?:\.[0-9]+)?\n$/u);
};

/**
 * Bind original package records to the selected current host tools.
 *
 * @param options - Closed source, API, floor and tool selection.
 * @param original - Original records and independently measured facts.
 * @param original.tap - Complete original producer output.
 * @param original.read - Selection-relative original byte reader.
 * @param original.runtime - Actual checker platform, architecture and glibc.
 * @param original.tools - Independently probed PHP, Composer and extension identities.
 * @param original.archiveSha256 - Digest of the independently authenticated ZIP.
 */
export const checkNominalPrimitiveSubtypePhpCiRecords = async (options, { tap, read, runtime, tools, archiveSha256 }) => {
	const selected = parseNominalPrimitiveSubtypePhpCiArgs(Object.entries(options).flatMap(([key, value]) => ["--" + key, value]));
	assertNominalPrimitiveSubtypePhpCiTap(tap, selected.route, selected.mode);
	assert.ok(isAbsolute(tools.command)); assert.ok(isAbsolute(tools.composer));
	assert.deepEqual(tools.selected, {
		php: selected.php
		, composer: selected.composer
		, phpVersion: selected["php-version"]
		, composerVersion: selected["composer-version"]
	});
	assert.deepEqual(JSON.parse(await read("tools.json")), tools);
	const result = await checkNominalPrimitiveSubtypePhpReport(read, {
		route: selected.route, mode: selected.mode, producerCommit: selected.producer
		, runtime, floor: selected.glibc, phpVersion: selected["php-version"]
		, composerVersion: selected["composer-version"]
	});
	assert.equal(result.archiveSha256, archiveSha256);
	return { ...result, tools };
};
