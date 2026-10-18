/**
 * Require one complete inherited checked-record Perl installed cell and its
 * original TAP.
 *
 * @file
 */
import assert from "node:assert/strict";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	inheritedCheckedRecordPerlModes, inheritedCheckedRecordPerlRoutes
} from "./inherited-checked-record-perl-fixture.mjs";
import {
	inheritedCheckedRecordPerlConfigurations
	, inheritedCheckedRecordPerlInstallModes
} from "./inherited-checked-record-perl-install.mjs";
import {
	assertInheritedCheckedRecordPerlRecords
} from "./inherited-checked-record-perl-records.mjs";

export const inheritedCheckedRecordPerlCases = Object.freeze([
	"ordinary-full", "ordinary-result-only"
	, "reviewed-full", "reviewed-result-only"
]);

/**
 * Split one exact route/API case without confusing result-only's hyphen.
 *
 * @param name - Exact route/API case name.
 */
export const inheritedCheckedRecordPerlCase = name => {
	assert.ok(inheritedCheckedRecordPerlCases.includes(name));
	const route = name.startsWith("ordinary-") ? "ordinary" : "reviewed";
	const mode = name.slice(route.length + 1);
	assert.ok(inheritedCheckedRecordPerlRoutes.includes(route));
	assert.ok(inheritedCheckedRecordPerlModes.includes(mode));
	return Object.freeze({ name, route, mode });
};

/**
 * Return the exact isolated installed-test title.
 *
 * @param route - Ordinary source or independent review.
 * @param mode - Full or result-only API.
 */
export const inheritedCheckedRecordPerlCiTestName = (route, mode) => {
	assert.ok(inheritedCheckedRecordPerlRoutes.includes(route));
	assert.ok(inheritedCheckedRecordPerlModes.includes(mode));
	return `installed inherited checked-record Perl packages reproduce and relocate ${route} ${mode}`;
};

/**
 * Reject skipped, cancelled, duplicated, or substituted installed tests.
 *
 * @param source - Complete original TAP.
 * @param route - Required author route.
 * @param mode - Required package API.
 */
export const assertInheritedCheckedRecordPerlCiTap = (
	source, route, mode
) => {
	const title = inheritedCheckedRecordPerlCiTestName(route, mode);
	assert.equal(typeof source, "string");
	assert.ok(source.startsWith("TAP version 13\n"));
	assert.doesNotMatch(source, /^not ok |^Bail out!|# SKIP|# TODO/gmu);
	assert.deepEqual([...source.matchAll(/^ok (\d+) - (.+)$/gmu)]
		.map(match => [Number(match[1]), match[2]]), [[1, title]]);
	assert.deepEqual([...source.matchAll(/^# Subtest: (.+)$/gmu)]
		.map(match => match[1]), [title]);
	for(const [key, expected] of Object.entries({
		tests: 1, suites: 0, pass: 1, fail: 0
		, cancelled: 0, skipped: 0, todo: 0
	})) {
		const matches = [...source.matchAll(new RegExp(
			`^# ${key} (\\d+)$`, "gmu"
		))];
		assert.equal(matches.length, 1, key);
		assert.equal(Number(matches[0][1]), expected, key);
	}
	assert.deepEqual([...source.matchAll(/^\d+\.\.\d+.*$/gmu)]
		.map(match => match[0]), ["1..1"]);
};

/**
 * Parse all closed checker options before opening producer-controlled paths.
 *
 * @param args - Arguments following the checker script name.
 */
export const parseInheritedCheckedRecordPerlCiArgs = args => {
	const usage = "Usage: check-inherited-checked-record-perl-ci.mjs --route ordinary|reviewed --mode full|result-only --producer <commit> --directory <records> --tap <original-tap> --glibc 2.36|2.38 --max-load 8|12|16|20";
	const keys = [
		"route", "mode", "producer", "directory", "tap", "glibc", "max-load"
	];
	const parsed = {};
	assert.ok(Array.isArray(args) && args.length === keys.length * 2, usage);
	for(let index = 0; index < args.length; index += 2)
	{
		const flag = args[index], value = args[index + 1];
		assert.ok(typeof flag === "string" && flag.startsWith("--")
			&& keys.includes(flag.slice(2)), usage);
		const key = flag.slice(2);
		assert.ok(!Object.hasOwn(parsed, key) && typeof value === "string"
			&& value.length && !value.startsWith("--")
			&& !value.includes("\0"), usage);
		parsed[key] = value;
	}
	assert.deepEqual(Object.keys(parsed).sort(), [...keys].sort(), usage);
	inheritedCheckedRecordPerlCiTestName(parsed.route, parsed.mode);
	assert.match(parsed.producer, /^[a-f0-9]{40}$/u);
	assert.ok(["2.36", "2.38"].includes(parsed.glibc), usage);
	assert.ok(["8", "12", "16", "20"].includes(parsed["max-load"]), usage);
	return {
		route: parsed.route, mode: parsed.mode, producer: parsed.producer
		, directory: parsed.directory, tap: parsed.tap, glibc: parsed.glibc
		, maxLoad: Number(parsed["max-load"])
	};
};

/**
 * Enumerate every required non-archive producer record.
 *
 * @param route - Ordinary source or independent review.
 * @param mode - Full or result-only API.
 */
export const inheritedCheckedRecordPerlRecordPaths = (route, mode) => {
	inheritedCheckedRecordPerlCiTestName(route, mode);
	const paths = [
		"configuration.json", "consumer.pl", "expected.binding-ir.json"
		, "interpreters.json", "report.json", "resources.json", "runtime.json"
	];
	for(const attempt of [0, 1])
	{
		const prefix = `build-${attempt}/`;
		paths.push(...[
			"InheritedCheckedRecords.lean", "author-inputs.json"
			, "lean-bridge.exports.json", "model.json"
			, "package-set-receipt.json"
		].map(path => prefix + path));
		if(route === "reviewed")
			paths.push(prefix + "api.binding-ir.json");
	}
	for(const configuration of inheritedCheckedRecordPerlConfigurations)
		for(const installMode of inheritedCheckedRecordPerlInstallModes)
		{
			const prefix = `${configuration}/${installMode}/`;
			paths.push(...[
				"component-install-receipt.json", "component-manifest.json"
				, "component-source.xs", "component-trace.json"
				, "installed-files.json", "installed-process.json"
				, "installed.json", "relocated-process.json", "relocated.json"
				, "report.json", "runtime-install-receipt.json"
				, "runtime-manifest.json", "runtime-source.xs"
				, "runtime-trace.json"
			].map(path => prefix + path));
		}
	return paths.sort();
};

const safePath = path => typeof path === "string"
	&& /^(?:[A-Za-z0-9_.:-]+\/)*[A-Za-z0-9_.:-]+$/u.test(path)
	&& path.split("/").every(part => part && part !== "." && part !== "..");

/**
 * Validate original records, package handoff, runtime, and all Perl ABIs.
 *
 * @param options - Closed producer, selection, paths and independent runtime.
 */
export const checkInheritedCheckedRecordPerlCiRecords = async options => {
	assertInheritedCheckedRecordPerlCiTap(
		options.tap, options.route, options.mode
	);
	assert.match(options.producer, /^[a-f0-9]{40}$/u);
	assert.ok(["2.36", "2.38"].includes(options.glibc));
	assert.ok([8, 12, 16, 20].includes(options.maxLoad));
	const expectedRecords = inheritedCheckedRecordPerlRecordPaths(
		options.route, options.mode
	);
	const report = await assertInheritedCheckedRecordPerlRecords(options);
	assert.equal(report.producerCommit, options.producer);
	assert.equal(report.glibcMinimumVersion, options.glibc);
	assert.equal(report.loadCeiling, options.maxLoad);
	assert.deepEqual(options.runtime, {
		platform: "linux", arch: "x64", glibc: options.runtime.glibc
	});
	assert.ok(Number(options.runtime.glibc.split(".")[1])
		>= Number(options.glibc.split(".")[1]));
	assert.deepEqual(report.interpreters, options.interpreters);
	const receiptBytes = Buffer.from(await options.read(
		"handoff/package-set-receipt.json"
	));
	const receipt = JSON.parse(receiptBytes);
	assert.equal(receiptBytes.toString(), canonicalJson(receipt));
	assert.deepEqual(receipt, JSON.parse(await options.read(
		"build-0/package-set-receipt.json"
	)));
	const sidecarPath = "handoff/package-set-receipt.json.sha256";
	assert.equal(Buffer.from(await options.read(sidecarPath)).toString()
		, `${sha256(receiptBytes)}  package-set-receipt.json\n`);
	const archivePaths = receipt.packages.flatMap(pkg =>
		pkg.artifacts.map(item => item.path));
	assert.equal(new Set(archivePaths).size, 2);
	const handoffPaths = [
		"handoff/package-set-receipt.json", sidecarPath
		, ...archivePaths.map(path => "handoff/" + path)
	].sort();
	assert.ok(handoffPaths.every(safePath));
	assert.deepEqual([...options.paths].sort()
		, [...expectedRecords, ...handoffPaths].sort());
	const records = [];
	for(const path of expectedRecords)
	{
		const bytes = Buffer.from(await options.read(path));
		records.push({ path, bytes: bytes.length, sha256: sha256(bytes) });
	}
	const handoff = [];
	for(const path of handoffPaths)
	{
		const bytes = Buffer.from(await options.read(path));
		handoff.push({ path, bytes: bytes.length, sha256: sha256(bytes) });
	}
	for(const pkg of receipt.packages)
		for(const artifact of pkg.artifacts)
		{
			const item = handoff.find(value =>
				value.path === "handoff/" + artifact.path);
			assert.ok(item); assert.equal(item.bytes, artifact.bytes);
			assert.equal(item.sha256, artifact.sha256);
		}
	return {
		schemaVersion: 1, producerCommit: options.producer
		, name: `${options.route}-${options.mode}`
		, route: options.route, mode: options.mode
		, floor: options.glibc, maxLoad: options.maxLoad
		, runtime: options.runtime
		, interpreterSha256: Object.fromEntries(report.interpreters.map(item => [
			item.configuration, item.executable.sha256
		]))
		, configurations: report.configurations
		, installModes: report.installModes, builds: report.builds.length
		, executions: report.reports.length * 2
		, reportSha256: sha256(canonicalJson(report)), records, handoff
	};
};
