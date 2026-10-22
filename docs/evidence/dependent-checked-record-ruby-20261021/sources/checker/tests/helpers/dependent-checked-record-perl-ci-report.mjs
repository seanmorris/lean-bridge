/**
 * Require one complete dependent checked-record Perl route and its
 * original TAP, package handoff, and four-ABI observation matrix.
 *
 * @file
 */
import assert from "node:assert/strict";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	dependentCheckedRecordPerlConfigurations
	, dependentCheckedRecordPerlInstallModes
} from "./dependent-checked-record-perl-install.mjs";
import { dependentCheckedRecordPerlRoutes } from "./dependent-checked-record-perl-fixture.mjs";
import { assertDependentCheckedRecordPerlRecords } from "./dependent-checked-record-perl-records.mjs";

const safePath = path => typeof path === "string"
	&& /^(?:[A-Za-z0-9_.:-]+\/)*[A-Za-z0-9_.:-]+$/u.test(path)
	&& path.split("/").every(part => part && part !== "." && part !== "..");

/**
 * Return the exact isolated installed-test title for a route.
 *
 * @param route - Exact ordinary/reviewed and API route.
 */
export const dependentCheckedRecordPerlCiTestName = route => {
	assert.ok(dependentCheckedRecordPerlRoutes.includes(route));
	return `installed dependent checked-record Perl packages reproduce and relocate for ${route}`;
};

/**
 * Reject skipped, substituted, or cancelled original TAP output.
 *
 * @param source - Original test TAP.
 * @param route - Exact ordinary/reviewed and API route.
 */
export const assertDependentCheckedRecordPerlCiTap = (source, route) => {
	const title = dependentCheckedRecordPerlCiTestName(route);
	assert.equal(typeof source, "string");
	assert.ok(source.startsWith("TAP version 13\n"));
	assert.doesNotMatch(source, /^not ok |^Bail out!|# SKIP|# TODO/gmu);
	assert.deepEqual([...source.matchAll(/^ok (\d+) - (.+)$/gmu)]
		.map(match => [Number(match[1]), match[2]]), [[1, title]]);
	assert.deepEqual([...source.matchAll(/^# Subtest: (.+)$/gmu)]
		.map(match => match[1]), [title]);
	for(const [key, expected] of Object.entries({
		tests: 1, suites: 0, pass: 1, fail: 0, cancelled: 0, skipped: 0, todo: 0
	})){
		const matches = [...source.matchAll(new RegExp(`^# ${key} (\\d+)$`, "gmu"))];
		assert.equal(matches.length, 1, key); assert.equal(Number(matches[0][1]), expected, key);
	}
	assert.deepEqual([...source.matchAll(/^\d+\.\.\d+.*$/gmu)].map(match => match[0])
		, ["1..1"]);
};

/**
 * Parse closed checker arguments before opening producer-controlled paths.
 *
 * @param args - Exact checker command-line arguments.
 */
export const parseDependentCheckedRecordPerlCiArgs = args => {
	const usage = "Usage: check-dependent-checked-record-perl-ci.mjs --route <route> --producer <commit> --directory <records> --tap <original-tap> --glibc 2.36|2.38 --max-load 8|12|16|20";
	const keys = ["route", "producer", "directory", "tap", "glibc", "max-load"];
	const parsed = {};
	assert.ok(Array.isArray(args) && args.length === keys.length * 2, usage);
	for(let index = 0; index < args.length; index += 2)
	{
		const flag = args[index], value = args[index + 1];
		assert.ok(typeof flag === "string" && flag.startsWith("--")
			&& keys.includes(flag.slice(2)), usage);
		const key = flag.slice(2);
		assert.ok(!Object.hasOwn(parsed, key) && typeof value === "string"
			&& value.length && !value.startsWith("--") && !value.includes("\0"), usage);
		parsed[key] = value;
	}
	assert.deepEqual(Object.keys(parsed).sort(), [...keys].sort(), usage);
	assert.ok(dependentCheckedRecordPerlRoutes.includes(parsed.route), usage);
	assert.match(parsed.producer, /^[a-f0-9]{40}$/u);
	for(const key of ["directory", "tap"])
		assert.ok(!parsed[key].split("/").includes(".."), usage);
	assert.ok(["2.36", "2.38"].includes(parsed.glibc), usage);
	assert.ok(["8", "12", "16", "20"].includes(parsed["max-load"]), usage);
	return {
		route: parsed.route, producer: parsed.producer, directory: parsed.directory
		, tap: parsed.tap, glibc: parsed.glibc, maxLoad: Number(parsed["max-load"])
	};
};

/**
 * Enumerate every non-archive retained record for one route.
 *
 * @param route - Exact ordinary/reviewed and API route.
 */
export const dependentCheckedRecordPerlRecordPaths = route => {
	assert.ok(dependentCheckedRecordPerlRoutes.includes(route));
	const paths = [
		"configuration.json"
		, "consumer.pl"
		, "expected.binding-ir.json"
		, "interpreters.json"
		, "report.json", "runtime.json"
	];
	for(const attempt of [0, 1])
	{
		const prefix = `build-${attempt}/`;
		paths.push(...[
			"DependentRecords.lean", "author-inputs.json"
			, "lean-bridge.exports.json", "model.json", "package-set-receipt.json"
		].map(path => prefix + path));
		if(route.endsWith("reviewed-ir")) paths.push(prefix + "api.binding-ir.json");
	}
	for(const configuration of dependentCheckedRecordPerlConfigurations)
		for(const installMode of dependentCheckedRecordPerlInstallModes)
		{
			const prefix = `${configuration}/${installMode}/`;
			paths.push(...[
				"component-install-receipt.json", "component-manifest.json"
				, "component-source.xs", "component-trace.json", "installed-files.json"
				, "installed-process.json", "installed.json", "relocated-process.json"
				, "relocated.json", "report.json", "runtime-install-receipt.json"
				, "runtime-manifest.json", "runtime-source.xs", "runtime-trace.json"
			].map(path => prefix + path));
		}
	return paths.sort();
};

/**
 * Reconcile original records, handoff bytes, and externally observed tools.
 *
 * @param options - Closed checker selection, records, and host observations.
 */
export const checkDependentCheckedRecordPerlCiRecords = async options => {
	assertDependentCheckedRecordPerlCiTap(options.tap, options.route);
	assert.match(options.producer, /^[a-f0-9]{40}$/u);
	assert.ok(["2.36", "2.38"].includes(options.glibc));
	assert.ok([8, 12, 16, 20].includes(options.maxLoad));
	assert.deepEqual(options.runtime, {
		platform: "linux", arch: "x64", glibc: options.runtime.glibc
	});
	assert.ok(Number(options.runtime.glibc.split(".")[1])
		>= Number(options.glibc.split(".")[1]));
	const expectedRecords = dependentCheckedRecordPerlRecordPaths(options.route);
	const report = await assertDependentCheckedRecordPerlRecords({
		route: options.route, producerCommit: options.producer, read: options.read
		, interpreters: options.interpreters
	});
	assert.equal(report.glibcMinimumVersion, options.glibc);
	const receiptBytes = Buffer.from(await options.read("handoff/package-set-receipt.json"));
	const receipt = JSON.parse(receiptBytes);
	assert.equal(receiptBytes.toString(), canonicalJson(receipt));
	assert.deepEqual(receipt, JSON.parse(await options.read("build-0/package-set-receipt.json")));
	const sidecar = "handoff/package-set-receipt.json.sha256";
	assert.equal(Buffer.from(await options.read(sidecar)).toString()
		, `${sha256(receiptBytes)}  package-set-receipt.json\n`);
	const archivePaths = receipt.packages.flatMap(pkg => pkg.artifacts.map(item => item.path));
	assert.equal(new Set(archivePaths).size, 2);
	const handoffPaths = [
		"handoff/package-set-receipt.json", sidecar
		, ...archivePaths.map(path => "handoff/" + path)
	].sort();
	assert.ok(handoffPaths.every(safePath));
	assert.deepEqual([...options.paths].sort(), [...expectedRecords, ...handoffPaths].sort());
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
	for(const pkg of receipt.packages) for(const artifact of pkg.artifacts)
	{
		const item = handoff.find(value => value.path === "handoff/" + artifact.path);
		assert.ok(item); assert.equal(item.bytes, artifact.bytes);
		assert.equal(item.sha256, artifact.sha256);
	}
	return {
		schemaVersion: 1, producerCommit: options.producer, route: options.route
		, floor: options.glibc, maxLoad: options.maxLoad, runtime: options.runtime
		, configurations: report.configurations, installModes: report.installModes
		, builds: report.builds.length, executions: report.reports.length * 2
		, reportSha256: sha256(canonicalJson(report)), records, handoff
	};
};
