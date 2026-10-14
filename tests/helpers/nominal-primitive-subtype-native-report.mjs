/**
 * Require original C/C++ packages, independent callers and physical relocation.
 *
 * @file
 */
import assert from "node:assert/strict";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { nominalPrimitiveSubtypeModule } from "./nominal-primitive-subtype-fixture.mjs";
import { nominalPrimitiveSubtypeNativeCounts, nominalPrimitiveSubtypeNativeConfiguration } from "./nominal-primitive-subtype-native-fixture.mjs";
import { nominalPrimitiveSubtypeNativeOriginal } from "./nominal-primitive-subtype-native-generators.mjs";
import { checkNominalPrimitiveSubtypeNativeModels } from "./nominal-primitive-subtype-native-model-records.mjs";
import { checkNominalPrimitiveSubtypeNativePackages, nominalPrimitiveSubtypeNativeHandoffRecords } from "./nominal-primitive-subtype-native-package-records.mjs";

const profiles = ["c", "cpp"];
const exactKeys = (value, keys) => assert.deepEqual(Object.keys(value).sort(), keys.slice().sort());

/**
 * Closed original-file set including both independently built models and complete archives.
 *
 * @param route - Ordinary or reviewed author source.
 * @param receipt - Independently authenticated native package-set receipt.
 */
export const nominalPrimitiveSubtypeNativeRecords = (route, receipt) => {
	assert.ok(["ordinary", "reviewed"].includes(route));
	const build = ["model.json", "package-set-receipt.json", "author-inputs.json"
		, `${nominalPrimitiveSubtypeModule}.lean`, "lean-bridge.exports.json"
		, ...route === "reviewed" ? ["api.binding-ir.json"] : []];
	return [
		"report.json", "expected.binding-ir.json"
		, "configuration.json", "runtime.json"
		, ...[0, 1].flatMap(attempt => build.map(path => `build-${attempt}/${path}`))
		, ...profiles.flatMap(profile => [`consumers/${profile}.${profile}`
			, ...["compiler.json", "lean-bridge-package.json", "installed.json", "relocated.json", "report.json"].map(path => `${profile}/${path}`)])
		, ...nominalPrimitiveSubtypeNativeHandoffRecords(receipt)];
};

/**
 * Authenticate producer authority, caller counts, package closure and both replay locations.
 *
 * @param read - Read selection-relative original bytes.
 * @param options - Independently selected run identity.
 * @param options.route - Ordinary or reviewed author route.
 * @param options.mode - Full or constructor-free result-only API.
 * @param options.producerCommit - Frozen producer revision.
 * @param options.runtime - Observed platform, architecture and glibc version.
 * @param options.floor - Producer-selected package glibc floor.
 */
export const checkNominalPrimitiveSubtypeNativeReport = async (read, { route, mode, producerCommit, runtime, floor }) => {
	assert.ok(["ordinary", "reviewed"].includes(route)); assert.ok(["full", "result-only"].includes(mode));
	assert.match(producerCommit, /^[a-f0-9]{40}$/u); assert.match(floor, /^2\.[0-9]+$/u);
	exactKeys(runtime, ["platform", "arch", "glibc"]);
	assert.equal(runtime.platform, "linux"); assert.equal(runtime.arch, "x64"); assert.match(runtime.glibc, /^2\.[0-9]+$/u);
	assert.ok(Number(runtime.glibc.slice(2)) >= Number(floor.slice(2)));
	const json = async path => {
		const bytes = await read(path), value = JSON.parse(bytes);
		assert.equal(bytes.toString(), canonicalJson(value), path); return value;
	};
	const report = await json("report.json");
	exactKeys(report, [
		"schemaVersion", "route", "mode", "profiles", "producerCommit"
		, "configuration", "builds", "reports", "expectedBindingIrSha256", "runtime"
		, "reproducible", "independentBuilds", "authorInputsUnchanged"
		, "declaredGlibcFloor"]);
	assert.equal(report.schemaVersion, 1); assert.equal(report.route, route); assert.equal(report.mode, mode);
	assert.equal(report.producerCommit, producerCommit); assert.deepEqual(report.profiles, profiles);
	assert.deepEqual(report.configuration, nominalPrimitiveSubtypeNativeConfiguration(route, mode));
	assert.equal(report.reproducible, true); assert.equal(report.authorInputsUnchanged, true);
	assert.equal(report.independentBuilds, 2); assert.equal(report.declaredGlibcFloor, floor);
	const observed = { platform: runtime.platform, arch: runtime.arch
		, glibc: { code: 0, stdout: `glibc ${runtime.glibc}\n`, stderr: "" } };
	assert.deepEqual(report.runtime, observed); assert.deepEqual(await json("runtime.json"), observed);
	const { model, receipt } = await checkNominalPrimitiveSubtypeNativeModels({ report, read, json, route, mode, producerCommit });
	assert.deepEqual(report.reports.map(item => item.profile), profiles);
	for(const item of report.reports)
	{
		const { profile } = item, counts = nominalPrimitiveSubtypeNativeCounts[profile][mode];
		exactKeys(item, [
			"profile", "checks", "result", "consumerSha256", "offlineInstall"
			, "compilerFreePath", "executableSha256", "runs", "packages", "sourceSha256"
			, "compiler", "relocatedInstallation", "sourceRemovedBeforeInstallation"
			, "compilerFreeReplay", "dispatch"]);
		assert.deepEqual(await json(profile + "/report.json"), item);
		assert.deepEqual(item.result, counts); assert.equal(item.checks, counts.checks);
		for(const key of ["offlineInstall", "compilerFreePath", "relocatedInstallation", "sourceRemovedBeforeInstallation", "compilerFreeReplay"])
			assert.equal(item[key], true, key);
		assert.deepEqual(item.dispatch, { observed: false, reason: "Separate constructor/source entry probe remains required" });
		assert.match(item.executableSha256, /^[a-f0-9]{64}$/u);
		const original = nominalPrimitiveSubtypeNativeOriginal(producerCommit, `tests/fixtures/nominal-primitive-subtype-consumers/${profile}.${profile}`);
		const source = (mode === "result-only" ? "#define PRIMITIVE_RESULT_ONLY\n" : "")
			+ (route === "reviewed" ? '#define PRIMITIVE_PARAMETER_PREFIX "value"\n' : "") + original;
		assert.equal((await read(`consumers/${profile}.${profile}`)).toString(), source);
		assert.equal(item.sourceSha256, sha256(source)); assert.equal(item.consumerSha256, sha256(source));
		assert.deepEqual(item.packages, receipt.packages.filter(pkg => pkg.target === profile));
		const compiler = await json(profile + "/compiler.json"); assert.deepEqual(item.compiler, compiler);
		assert.equal(compiler.code, 0); assert.equal(compiler.stderr, "");
		assert.match(compiler.stdout, profile === "c" ? /^cc \(.+\) [0-9]+\.[0-9]+\.[0-9]+\n/u : /^c\+\+ \(.+\) [0-9]+\.[0-9]+\.[0-9]+\n/u);
		assert.equal(item.runs.length, 2);
		// Reject malformed execution records before inflating the large native archives.
		// The final archive check authenticates these exact receipt bytes before success.
		const packageBytes = await read(profile + "/lean-bridge-package.json");
		const packaged = JSON.parse(packageBytes);
		assert.equal(packageBytes.toString(), canonicalJson(packaged));
		const closure = { receiptSha256: sha256(packageBytes)
			, packageFileSetSha256: sha256(canonicalJson([...Object.keys(packaged.files), "lean-bridge-package.json"].sort())) };
		for(const [position, name] of ["installed", "relocated"].entries())
		{
			const run = await json(`${profile}/${name}.json`); assert.deepEqual(run, item.runs[position]);
			assert.deepEqual(run, {
				code: 0, stdout: JSON.stringify(counts) + "\n", stderr: ""
				, receiptSha256: closure.receiptSha256
				, packageFileSetSha256: closure.packageFileSetSha256
				, relocated: position === 1 });
		}
	}
	const packages = await checkNominalPrimitiveSubtypeNativePackages({ read, model, receipt, floor, producerCommit });
	return { route, mode, producerCommit, profiles, runtime, floor
		, counts: Object.fromEntries(profiles.map(profile => [profile, nominalPrimitiveSubtypeNativeCounts[profile][mode]]))
		, executions: 4, initialExecutions: 2, dispatchObserved: false
		, packages: packages.packages, generatorPaths: packages.generatorPaths };
};
