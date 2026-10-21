/**
 * Independently reconcile one retained zero-payload NuGet route.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { isAbsolute } from "node:path";
import { reviewedContractDifference } from "../../src/analyze/reviewed-source.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { validatePackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import {
	zeroPayloadCheckedRecordFixture
} from "./zero-payload-checked-record-fixture.mjs";
import {
	parseZeroPayloadDotnetResult, zeroPayloadDotnetCaller
	, zeroPayloadDotnetRoutes, zeroPayloadDotnetSelection
} from "./zero-payload-checked-record-dotnet-fixture.mjs";

const fixturePaths = Object.freeze([
	"LICENSE", "ZeroPayloadCheckedRecords.lean", "lakefile.toml"
	, "lean-toolchain", "package.json"
]);
const original = (commit, path) => execFileSync("git", [
	"show", `${commit}:${zeroPayloadCheckedRecordFixture}/${path}`
], { maxBuffer: 16 * 1024 * 1024 });

/**
 * Name the only producer test admitted by one route selection.
 *
 * @param route - Exact author/API route.
 */
export const zeroPayloadDotnetCiTestName = route => {
	assert.ok(zeroPayloadDotnetRoutes.includes(route));
	return `installed zero-payload records reproduce and relocate in .NET for ${route}`;
};

/**
 * Reject unknown, repeated and incomplete checker options.
 *
 * @param args - CLI arguments following the script path.
 */
export const parseZeroPayloadDotnetCiArgs = args => {
	const usage = "Usage: check-zero-payload-checked-record-dotnet-ci.mjs --route <closed-route> --producer <commit> --consumer <commit> --directory <records> --tap <original-tap> --glibc 2.38 --dotnet /absolute/dotnet";
	const allowed = [
		"route", "producer", "consumer", "directory", "tap", "glibc", "dotnet"
	];
	const selected = {};
	assert.ok(Array.isArray(args) && args.length === allowed.length * 2, usage);
	for(let index = 0; index < args.length; index += 2)
	{
		const flag = args[index], value = args[index + 1];
		assert.ok(typeof flag === "string" && flag.startsWith("--")
			&& allowed.includes(flag.slice(2)), usage);
		const key = flag.slice(2);
		assert.ok(!Object.hasOwn(selected, key) && typeof value === "string"
			&& value.length > 0 && !value.startsWith("--")
			&& !/[\0\r\n]/u.test(value), usage);
		selected[key] = value;
	}
	assert.deepEqual(Object.keys(selected).sort(), [...allowed].sort(), usage);
	zeroPayloadDotnetCiTestName(selected.route);
	assert.match(selected.producer, /^[a-f0-9]{40}$/u, usage);
	assert.match(selected.consumer, /^[a-f0-9]{40}$/u, usage);
	assert.equal(selected.glibc, "2.38", usage);
	assert.ok(isAbsolute(selected.dotnet), usage);
	return selected;
};

/**
 * Require zero-skip TAP with exactly one terminal result.
 *
 * @param source - Complete original TAP.
 * @param route - Exact author/API route.
 */
export const assertZeroPayloadDotnetCiTap = (source, route) => {
	const name = zeroPayloadDotnetCiTestName(route).replace("#", "\\#");
	assert.equal(typeof source, "string");
	assert.ok(source.startsWith("TAP version 13\n"));
	assert.doesNotMatch(source, /^not ok |^Bail out!|# SKIP|# TODO/gmu);
	assert.deepEqual([...source.matchAll(/^ok (\d+) - (.+)$/gmu)]
		.map(match => [Number(match[1]), match[2]]), [[1, name]]);
	assert.deepEqual([...source.matchAll(/^# Subtest: (.+)$/gmu)]
		.map(match => match[1]), [name]);
	for(const [key, expected] of Object.entries({
		tests: 1, suites: 0, pass: 1, fail: 0, cancelled: 0
		, skipped: 0, todo: 0
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
 * Complete retained path set for one route.
 *
 * @param route - Exact author/API route.
 * @param receipt - Verified package-set receipt.
 */
export const zeroPayloadDotnetRecordPaths = (route, receipt) => {
	const reviewed = zeroPayloadDotnetSelection(route).reviewed;
	const build = index => [
		`build-${index}/model.json`
		, `build-${index}/package-set-receipt.json`
		, `build-${index}/author-inputs.json`
		, `build-${index}/ZeroPayloadCheckedRecords.lean`
		, `build-${index}/lean-bridge.exports.json`
		, ...reviewed ? [`build-${index}/api.binding-ir.json`] : []
	];
	return [
		"configuration.json", "consumer.cs", "expected.binding-ir.json"
		, "installed.json", "relocated.json", "report.json", "resources.json"
		, "runtime.json", "source-free.json", "toolchain.json"
		, ...build(0), ...build(1)
		, "handoff/package-set-receipt.json"
		, "handoff/package-set-receipt.json.sha256"
		, ...receipt.packages.flatMap(pkg => pkg.artifacts.map(artifact =>
			`handoff/${artifact.path}`))
	].sort();
};

const json = async (read, path) => {
	const bytes = await read(path);
	const value = JSON.parse(bytes);
	assert.equal(bytes.toString(), canonicalJson(value), path);
	return { bytes, value };
};

/**
 * Reconcile every retained byte with the selected route and original report.
 *
 * @param options - Closed route, revisions, floor and tool selection.
 * @param root0 - Original retained records and fresh tool identity.
 * @param root0.tap - Complete producer TAP.
 * @param root0.read - Closed retained-file reader.
 * @param root0.paths - Complete retained-file inventory.
 * @param root0.dotnetIdentity - Fresh identity of the selected .NET host.
 */
export const checkZeroPayloadDotnetCiRecords = async (
	options, { tap, read, paths, dotnetIdentity }
) => {
	const selected = parseZeroPayloadDotnetCiArgs(
		Object.entries(options).flatMap(([key, value]) => ["--" + key, value])
	);
	assertZeroPayloadDotnetCiTap(tap, selected.route);
	const selection = zeroPayloadDotnetSelection(selected.route);
	const { value: report } = await json(read, "report.json");
	assert.deepEqual(Object.keys(report).sort(), [
		"authorInputsUnchanged", "builds", "compilerFreeReplay"
		, "consumerCommit", "declaredGlibcFloor", "dispatch"
		, "expectedBindingIrSha256", "independentBuilds", "mode"
		, "observations", "offlineInstall", "producerCommit", "receipt"
		, "relocatedInstallation", "reproducible", "resourceChecks", "route"
		, "runtime", "schemaVersion", "sourceFreeDeployment"
		, "sourceRemovedBeforeInstallation", "tools", "trustedToolchains"
	].sort());
	assert.equal(report.schemaVersion, 1);
	assert.equal(report.route, selected.route);
	assert.equal(report.mode, selection.resultOnly ? "result-only" : "full");
	assert.equal(report.producerCommit, selected.producer);
	assert.equal(report.consumerCommit, selected.consumer);
	assert.equal(report.declaredGlibcFloor, selected.glibc);
	for(const key of [
		"authorInputsUnchanged", "compilerFreeReplay", "offlineInstall"
		, "relocatedInstallation", "reproducible", "sourceFreeDeployment"
		, "sourceRemovedBeforeInstallation"
	]) assert.equal(report[key], true, key);
	assert.equal(report.independentBuilds, 2);
	assert.deepEqual(report.dispatch, {
		observed: false
		, reason: "No C# constructor/source entry counters in this installed acceptance"
	});
	assert.equal(report.runtime.platform, "linux");
	assert.equal(report.runtime.arch, "x64");
	assert.equal(report.runtime.glibc.code, 0);
	assert.equal(report.runtime.glibc.stderr, "");
	assert.match(report.runtime.glibc.stdout, /^glibc 2\.[0-9]+\n$/u);
	assert.ok(Number(report.runtime.glibc.stdout.trim().split(".")[1]) >= 38);
	assert.equal(report.tools.command, selected.dotnet);
	assert.deepEqual(report.tools.interpreter, dotnetIdentity);
	assert.equal(report.tools.sdk.version, "8.0.424");
	assert.ok(Array.isArray(report.resourceChecks)
		&& report.resourceChecks.length >= 4);

	const expected = canonicalJson(selection.expected);
	assert.equal((await read("expected.binding-ir.json")).toString(), expected);
	assert.equal(report.expectedBindingIrSha256
		, hashBindingIr(selection.expected));
	assert.equal((await read("configuration.json")).toString()
		, canonicalJson(selection.configuration));
	assert.equal((await read("consumer.cs")).toString()
		, await zeroPayloadDotnetCaller(selected.route));
	assert.equal((await read("runtime.json")).toString()
		, canonicalJson(report.runtime));
	assert.equal((await read("toolchain.json")).toString()
		, canonicalJson(report.tools));
	assert.equal((await read("resources.json")).toString()
		, canonicalJson(report.resourceChecks));

	assert.ok(Array.isArray(report.builds) && report.builds.length === 2);
	assert.deepEqual(report.builds[1], report.builds[0]);
	for(const index of [0, 1])
	{
		const build = report.builds[index];
		assert.deepEqual(Object.keys(build).sort(), [
			"archives", "authorInputsSha256", "bindingIrSha256"
			, "modelSha256", "receiptSha256"
		]);
		const model = await json(read, `build-${index}/model.json`);
		assert.equal(sha256(model.bytes), build.modelSha256);
		assert.equal(model.value.bindingIrSha256, build.bindingIrSha256);
		assert.equal(reviewedContractDifference(
			selection.expected, model.value.bindingIr), null);
		const receipt = await json(
			read, `build-${index}/package-set-receipt.json`
		);
		assert.equal(sha256(receipt.bytes), build.receiptSha256);
		assert.deepEqual(receipt.value, report.receipt);
		const inputs = await json(read, `build-${index}/author-inputs.json`);
		assert.deepEqual(inputs.value.map(item => item.path).sort(), [
			...fixturePaths, "lean-bridge.exports.json"
			, ...selection.reviewed ? ["api.binding-ir.json"] : []
		].sort());
		assert.ok(inputs.value.every(item => item.mode === 33188));
		const stableInputs = inputs.value.map(({
			path, mode, sha256: digest
		}) => ({ path, mode, sha256: digest }));
		assert.equal(sha256(canonicalJson(stableInputs))
			, build.authorInputsSha256);
		for(const path of fixturePaths)
			assert.equal(inputs.value.find(item => item.path === path).sha256
				, sha256(original(selected.producer, path)), path);
		assert.equal(inputs.value.find(item =>
			item.path === "lean-bridge.exports.json").sha256
		, sha256(canonicalJson(selection.configuration)));
		if(selection.reviewed)
			assert.equal(inputs.value.find(item =>
				item.path === "api.binding-ir.json").sha256, sha256(expected));
		assert.equal((await read(
			`build-${index}/lean-bridge.exports.json`
		)).toString(), canonicalJson(selection.configuration));
		assert.deepEqual(await read(
			`build-${index}/ZeroPayloadCheckedRecords.lean`
		), original(selected.producer, "ZeroPayloadCheckedRecords.lean"));
		if(selection.reviewed)
			assert.equal((await read(
				`build-${index}/api.binding-ir.json`
			)).toString(), expected);
	}
	validatePackageSetReceipt(report.receipt);
	assert.deepEqual(report.receipt.packages.map(pkg => [pkg.target, pkg.role])
		, [["nuget", "component"]]);
	const handoff = await json(read, "handoff/package-set-receipt.json");
	assert.deepEqual(handoff.value, report.receipt);
	assert.equal((await read(
		"handoff/package-set-receipt.json.sha256"
	)).toString(), `${sha256(handoff.bytes)}  package-set-receipt.json\n`);
	for(const pkg of report.receipt.packages)
		for(const artifact of pkg.artifacts)
		{
			const bytes = await read(`handoff/${artifact.path}`);
			assert.deepEqual(identity(bytes), {
				bytes: artifact.bytes, sha256: artifact.sha256
			});
			assert.equal(report.builds[0].archives[artifact.path]
				, artifact.sha256);
		}

	assert.deepEqual(report.observations.map(item => item.stage)
		, ["installed", "relocated", "source-free"]);
	for(const observation of report.observations)
	{
		assert.equal(observation.run.code, 0);
		assert.equal(observation.run.stderr, "");
		assert.deepEqual(parseZeroPayloadDotnetResult(
			observation.run.stdout, selected.route), observation.counts);
		assert.match(observation.closure.deployedFilesSha256
			, /^[a-f0-9]{64}$/u);
	}
	assert.equal(report.observations[2].sourcesRemoved, true);
	assert.equal((await read("installed.json")).toString()
		, canonicalJson(report.observations[0]));
	assert.equal((await read("relocated.json")).toString()
		, canonicalJson(report.observations[1]));
	assert.equal((await read("source-free.json")).toString()
		, canonicalJson(report.observations[2]));
	assert.deepEqual(paths, zeroPayloadDotnetRecordPaths(
		selected.route, report.receipt
	));
	return {
		schemaVersion: 1, route: selected.route, mode: report.mode
		, producerCommit: selected.producer, consumerCommit: selected.consumer
		, packageSha256: report.receipt.packages[0].artifacts[0].sha256
		, observations: report.observations.map(item => ({
			stage: item.stage, counts: item.counts
		}))
		, glibc: report.runtime.glibc.stdout.trim().slice(6)
		, dotnet: report.tools.sdk.version
	};
};

const identity = bytes => ({
	bytes: Buffer.byteLength(bytes), sha256: sha256(bytes)
});
