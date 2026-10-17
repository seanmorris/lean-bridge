/**
 * Require one complete recursive checked-record Perl installed cell and its original TAP.
 *
 * @file
 */
import assert from "node:assert/strict";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	recursiveCheckedRecordPerlConfigurations
	, recursiveCheckedRecordPerlInstallModes
} from "./recursive-checked-record-perl-install.mjs";
import { recursiveCheckedRecordPerlPackage } from "./recursive-checked-record-perl-fixture.mjs";
import { assertRecursiveCheckedRecordPerlRecords } from "./recursive-checked-record-perl-records.mjs";

export const recursiveCheckedRecordPerlCases = Object.freeze([
	"ordinary-recursive"
	, "ordinary-mutual"
	, "reviewed-recursive"
	, "reviewed-mutual"
]);

/**
 * Split one closed route/fixture case name.
 *
 * @param name - Exact recursive checked-record Perl case name.
 */
export const recursiveCheckedRecordPerlCase = name => {
	assert.ok(recursiveCheckedRecordPerlCases.includes(name));
	const [route, fixture] = name.split("-");
	return Object.freeze({ name, route, fixture });
};

/**
 * Refuse skipped, cancelled, duplicated, or substituted installed tests.
 *
 * @param source - Original combined producer stdout and stderr.
 * @param name - Exact author-route and recursive-fixture case.
 */
export const assertRecursiveCheckedRecordPerlCiTap = (source, name) => {
	const { route, fixture } = recursiveCheckedRecordPerlCase(name);
	const title = `installed recursive checked-record Perl packages reproduce and relocate ${route} ${fixture}`;
	assert.equal(typeof source, "string"); assert.ok(source.startsWith("TAP version 13\n"));
	assert.doesNotMatch(source, /^not ok |^Bail out!|# SKIP|# TODO/gmu);
	assert.deepEqual([...source.matchAll(/^ok (\d+) - (.+)$/gmu)]
		.map(match => [Number(match[1]), match[2]]), [[1, title]]);
	assert.deepEqual([...source.matchAll(/^# Subtest: (.+)$/gmu)]
		.map(match => match[1]), [title]);
	for(const [key, expected] of Object.entries({
		tests: 1, suites: 0, pass: 1, fail: 0, cancelled: 0, skipped: 0, todo: 0
	})) {
		const matches = [...source.matchAll(new RegExp(`^# ${key} (\\d+)$`, "gmu"))];
		assert.equal(matches.length, 1, key); assert.equal(Number(matches[0][1]), expected, key);
	}
	assert.deepEqual([...source.matchAll(/^\d+\.\.\d+.*$/gmu)].map(match => match[0])
		, ["1..1"]);
};

/**
 * Parse closed checker options before reading producer-controlled paths.
 *
 * @param args - Exact checker CLI arguments.
 */
export const parseRecursiveCheckedRecordPerlCiArgs = args => {
	const usage = "Usage: check-recursive-checked-record-perl-ci.mjs --name <case> --producer <commit> --directory <records> --tap <original-tap> --glibc 2.36|2.38 --max-load 8|12|16|20";
	const keys = ["name", "producer", "directory", "tap", "glibc", "max-load"], parsed = {};
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
	assert.ok(recursiveCheckedRecordPerlCases.includes(parsed.name), usage);
	assert.match(parsed.producer, /^[a-f0-9]{40}$/u);
	assert.ok(["2.36", "2.38"].includes(parsed.glibc), usage);
	assert.ok(["8", "12", "16", "20"].includes(parsed["max-load"]), usage);
	return {
		name: parsed.name, producer: parsed.producer, directory: parsed.directory
		, tap: parsed.tap, glibc: parsed.glibc, maxLoad: Number(parsed["max-load"])
	};
};

/**
 * Enumerate every non-archive record the producer must retain for one case.
 *
 * @param name - Exact author-route and recursive-fixture case.
 */
export const recursiveCheckedRecordPerlRecordPaths = name => {
	const { route, fixture } = recursiveCheckedRecordPerlCase(name);
	const selected = recursiveCheckedRecordPerlPackage(fixture);
	const paths = [
		"configuration.json", "consumer.pl", "expected.binding-ir.json"
		, "report.json", "resources.json", "runtime.json"
	];
	for(const attempt of [0, 1])
	{
		const prefix = `build-${attempt}/`;
		paths.push(...[
			`${selected.leanModule}.lean`, "author-inputs.json"
			, "lean-bridge.exports.json", "model.json", "package-set-receipt.json"
		].map(path => prefix + path));
		if(route === "reviewed") paths.push(prefix + "api.binding-ir.json");
	}
	for(const configuration of recursiveCheckedRecordPerlConfigurations)
		for(const installMode of recursiveCheckedRecordPerlInstallModes)
		{
			const prefix = `${configuration}/${installMode}/`;
			paths.push(...[
				"component-install-receipt.json", "component-manifest.json"
				, "component-source.xs", "component-trace.json"
				, "installed-files.json", "installed-process.json", "installed.json"
				, "relocated-process.json", "relocated.json", "report.json"
				, "runtime-install-receipt.json", "runtime-manifest.json"
				, "runtime-source.xs", "runtime-trace.json"
			].map(path => prefix + path));
		}
	return paths.sort();
};

const safePath = path => typeof path === "string"
	&& /^(?:[A-Za-z0-9_.:-]+\/)*[A-Za-z0-9_.:-]+$/u.test(path)
	&& path.split("/").every(part => part && part !== "." && part !== "..");

/**
 * Validate original records, binary handoff identities, and bind them to the producer.
 *
 * @param options - Closed selection, runtime, paths, and record reader.
 */
export const checkRecursiveCheckedRecordPerlCiRecords = async options => {
	assertRecursiveCheckedRecordPerlCiTap(options.tap, options.name);
	assert.match(options.producer, /^[a-f0-9]{40}$/u);
	assert.ok(["2.36", "2.38"].includes(options.glibc));
	assert.ok([8, 12, 16, 20].includes(options.maxLoad));
	const expectedRecords = recursiveCheckedRecordPerlRecordPaths(options.name);
	const report = await assertRecursiveCheckedRecordPerlRecords(options);
	assert.equal(report.producerCommit, options.producer);
	assert.equal(report.glibcMinimumVersion, options.glibc);
	assert.equal(report.loadCeiling, options.maxLoad);
	assert.deepEqual(options.runtime, {
		platform: "linux", arch: "x64", glibc: options.runtime.glibc
	});
	assert.ok(Number(options.runtime.glibc.split(".")[1])
		>= Number(options.glibc.split(".")[1]));
	const receiptBytes = Buffer.from(await options.read("handoff/package-set-receipt.json"));
	const receipt = JSON.parse(receiptBytes);
	assert.equal(receiptBytes.toString(), canonicalJson(receipt));
	assert.deepEqual(receipt, JSON.parse(await options.read("build-0/package-set-receipt.json")));
	const sidecarPath = "handoff/package-set-receipt.json.sha256";
	assert.equal(Buffer.from(await options.read(sidecarPath)).toString()
		, `${sha256(receiptBytes)}  package-set-receipt.json\n`);
	const archivePaths = receipt.packages.flatMap(pkg => pkg.artifacts.map(item => item.path));
	assert.equal(new Set(archivePaths).size, 2);
	const handoffPaths = [
		"handoff/package-set-receipt.json", sidecarPath
		, ...archivePaths.map(path => "handoff/" + path)
	].sort();
	assert.ok(handoffPaths.every(safePath));
	assert.deepEqual([...options.paths].sort(), [...expectedRecords, ...handoffPaths].sort());
	const files = [];
	for(const path of expectedRecords)
	{
		const bytes = Buffer.from(await options.read(path));
		files.push({ path, bytes: bytes.length, sha256: sha256(bytes) });
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
		assert.ok(item); assert.equal(item.bytes, artifact.bytes); assert.equal(item.sha256, artifact.sha256);
	}
	const { route, fixture } = recursiveCheckedRecordPerlCase(options.name);
	return {
		schemaVersion: 1, producerCommit: options.producer, name: options.name
		, route, fixture, floor: options.glibc, maxLoad: options.maxLoad
		, runtime: options.runtime, configurations: report.configurations
		, installModes: report.installModes, builds: report.builds.length
		, executions: report.reports.length * 2
		, reportSha256: sha256(canonicalJson(report)), records: files, handoff
	};
};
