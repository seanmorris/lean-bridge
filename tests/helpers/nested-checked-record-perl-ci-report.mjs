/**
 * Require one complete nested checked-record Perl installed cell and its original TAP.
 *
 * @file
 */
import assert from "node:assert/strict";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	nestedCheckedRecordPerlConfigurations
	, nestedCheckedRecordPerlInstallModes
} from "./nested-checked-record-perl-install.mjs";
import { assertNestedCheckedRecordPerlRecords } from "./nested-checked-record-perl-records.mjs";

export const nestedCheckedRecordPerlCases = Object.freeze([
	"ordinary-full"
	, "ordinary-result-only"
	, "reviewed-full"
	, "reviewed-result-only"
]);

/**
 * Refuse skipped, cancelled, duplicated, or substituted installed tests.
 *
 * @param source - Original combined producer stdout and stderr.
 * @param name - Exact author-route and API-mode case.
 */
export const assertNestedCheckedRecordPerlCiTap = (source, name) => {
	assert.ok(nestedCheckedRecordPerlCases.includes(name));
	const title = `installed nested checked-record Perl packages reproduce and relocate for ${name}`;
	assert.equal(typeof source, "string"); assert.ok(source.startsWith("TAP version 13\n"));
	assert.doesNotMatch(source, /^not ok |^Bail out!|# SKIP|# TODO/gmu);
	assert.deepEqual([...source.matchAll(/^ok (\d+) - (.+)$/gmu)]
		.map(match => [Number(match[1]), match[2]]), [[1, title]]);
	assert.deepEqual([...source.matchAll(/^# Subtest: (.+)$/gmu)]
		.map(match => match[1]), [title]);
	for(const [key, expected] of Object.entries({
		tests: 1, suites: 0, pass: 1, fail: 0, cancelled: 0, skipped: 0, todo: 0
	})){
		const matches = [...source.matchAll(new RegExp(`^# ${key} (\\d+)$`, "gmu"))];
		assert.equal(matches.length, 1, key);
		assert.equal(Number(matches[0][1]), expected, key);
	}
	assert.deepEqual([...source.matchAll(/^\d+\.\.\d+.*$/gmu)].map(match => match[0])
		, ["1..1"]);
};

/**
 * Parse closed checker options before reading producer-controlled paths.
 *
 * @param args - Exact checker CLI arguments.
 */
export const parseNestedCheckedRecordPerlCiArgs = args => {
	const usage = "Usage: check-nested-checked-record-perl-ci.mjs --name <case> --producer <commit> --directory <records> --tap <original-tap> --glibc 2.36|2.38";
	const keys = ["name", "producer", "directory", "tap", "glibc"], parsed = {};
	assert.ok(Array.isArray(args) && args.length === keys.length * 2, usage);
	for(let index = 0; index < args.length; index += 2)
	{
		const flag = args[index], value = args[index + 1];
		assert.ok(typeof flag === "string" && flag.startsWith("--")
			&& keys.includes(flag.slice(2)), usage);
		const key = flag.slice(2);
		assert.ok(!Object.hasOwn(parsed, key) && typeof value === "string"
			&& value.length && !value.startsWith("--"), usage);
		parsed[key] = value;
	}
	assert.ok(nestedCheckedRecordPerlCases.includes(parsed.name), usage);
	assert.match(parsed.producer, /^[a-f0-9]{40}$/u);
	assert.ok(["2.36", "2.38"].includes(parsed.glibc), usage);
	return parsed;
};

/**
 * Enumerate every record the producer must retain for one case.
 *
 * @param name - Exact author-route and API-mode case.
 */
export const nestedCheckedRecordPerlRecordPaths = name => {
	assert.ok(nestedCheckedRecordPerlCases.includes(name));
	const paths = ["consumer.pl", "report.json"];
	for(const attempt of [0, 1])
	{
		const prefix = `build-${attempt}/`;
		paths.push(...[
			"NestedCheckedRecords.lean", "expected.binding-ir.json"
			, "lean-bridge.exports.json", "model.json", "package-set-receipt.json"
		].map(path => prefix + path));
		if(name.startsWith("reviewed-")) paths.push(prefix + "api.binding-ir.json");
	}
	for(const configuration of nestedCheckedRecordPerlConfigurations)
		for(const installMode of nestedCheckedRecordPerlInstallModes)
		{
			const prefix = `${configuration}/${installMode}/`;
			paths.push(...[
				"component-install-receipt.json", "component-manifest.json"
				, "component-source.xs", "component-trace.json", "first.json"
				, "installed-files.json", "repeated.json", "report.json"
				, "runtime-install-receipt.json", "runtime-manifest.json"
				, "runtime-source.xs", "runtime-trace.json"
			].map(path => prefix + path));
		}
	return paths.sort();
};

/**
 * Validate original records and bind their complete identities to the CI producer.
 *
 * @param options - Closed selection, runtime and archive-relative access.
 * @param options.name - Exact author-route and API-mode case.
 * @param options.producer - Exact producer commit.
 * @param options.glibc - Declared package floor.
 * @param options.tap - Original producer TAP.
 * @param options.read - Archive-relative record reader.
 * @param options.paths - Complete observed record path set.
 * @param options.runtime - Independently observed host identity.
 */
export const checkNestedCheckedRecordPerlCiRecords = async options => {
	assertNestedCheckedRecordPerlCiTap(options.tap, options.name);
	assert.match(options.producer, /^[a-f0-9]{40}$/u);
	assert.ok(["2.36", "2.38"].includes(options.glibc));
	assert.deepEqual([...options.paths].sort(), nestedCheckedRecordPerlRecordPaths(options.name));
	const report = await assertNestedCheckedRecordPerlRecords(options);
	assert.equal(report.glibcMinimumVersion, options.glibc);
	assert.deepEqual(options.runtime, {
		platform: "linux", arch: "x64", glibc: options.runtime.glibc
	});
	assert.ok(Number(options.runtime.glibc.split(".")[1]) >= Number(options.glibc.split(".")[1]));
	const files = [];
	for(const path of options.paths)
	{
		const bytes = Buffer.from(await options.read(path));
		files.push({ path, bytes: bytes.length, sha256: sha256(bytes) });
	}
	return {
		schemaVersion: 1, producerCommit: options.producer, name: options.name
		, authorRoute: report.authorRoute, apiMode: report.apiMode
		, floor: options.glibc, runtime: options.runtime
		, configurations: report.configurations, installModes: report.installModes
		, builds: report.builds.length, executions: report.reports.length * 2
		, reportSha256: sha256(canonicalJson(report)), records: files
	};
};
