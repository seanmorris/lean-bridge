/**
 * Contract tests for installed C/C++ and Perl callback Subtype CI.
 *
 * @file
 */
import assert from "node:assert/strict";
import {
	appendFile, mkdtemp, readFile, rm, writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import {
	packageSetReceiptName, writePackageSetReceipt
} from "../src/release/package-set-receipt.mjs";
import {
	clearCallbackSubtypeRetainedPackages, retainCallbackSubtypeRoute
	, verifyCallbackSubtypeRetainedPackages, writeCallbackSubtypeRetainedPackages
} from "./helpers/callback-subtype-retained-packages.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import {
	callbackSubtypeNativeTestName
	, callbackSubtypeNativeVerification
	, callbackSubtypeLanguageTestName
	, callbackSubtypePerlTestName
	, checkCallbackSubtypeLanguageReport
	, checkCallbackSubtypeNativeReport
	, checkCallbackSubtypePerlReport
	, parseCallbackSubtypeNativeCiArgs
} from "./helpers/callback-subtype-native-ci.mjs";
import {
	callbackSubtypeRemainingTestName
	, callbackSubtypeRemainingVerification
	, parseCallbackSubtypeRemainingCiArgs
} from "./helpers/callback-subtype-remaining-ci.mjs";

const sha = character => character.repeat(64);
const tap = name => `TAP version 13\n# Subtest: ${name}\nok 1 - ${name}\n  ---\n  duration_ms: 1\n  type: 'test'\n  ...\n1..1\n# tests 1\n# suites 0\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n# duration_ms 2\n`;

const nativeReport = () => {
	const reports = [];
	for(const route of ["ordinary", "reviewed"])
		for(const [index, profile] of ["c", "cpp"].entries())
			reports.push({
				bindingIrSha256: sha(route === "ordinary" ? "a" : "b")
				, checks: profile === "c" ? 16 : 13
				, compilerFreePath: true
				, consumerSha256: sha(String(index + 1))
				, offlineInstall: true
				, profile
				, receiptSha256: sha(route === "ordinary" ? "c" : "d")
				, route
				, sourceRemovedBeforeInstallation: true
			});
	return { schemaVersion: 1, reports };
};

const perlReport = () => {
	const installedFiles = {};
	for(let index = 0; index < 11; index++)
		installedFiles[`file-${index}`] = {
			bytes: index, sha256: sha((index % 10).toString())
		};
	const packages = ["component", "runtime"].map((role, index) => ({
		role
		, artifacts: [{
			bytes: index + 1
			, sha256: sha(String(index + 1))
			, path: `archives/${role}.tar.gz`
		}]
	}));
	const reports = [];
	for(const route of ["ordinary", "reviewed"])
		for(const mode of ["prebuilt-only", "build-xs"])
			for(let index = 0; index < 4; index++)
				reports.push({
					bindingIrSha256: sha(route === "ordinary" ? "a" : "b")
					, calls: 5
					, checks: 34
					, handoffRemovedBeforeExecution: true
					, hostVersion: index < 2 ? "v5.36.3" : "v5.38.2"
					, installedFiles
					, mode
					, packages
					, perlSha256: sha(String(index + 1))
					, rejected: 6
					, relocated: true
					, repeated: true
					, route
					, schemaVersion: 1
					, sourceRemovedBeforeInstallation: true
				});
	return { schemaVersion: 1, reports };
};

const languageReport = () => {
	const reports = [];
	for(const route of ["ordinary", "reviewed"])
		for(const [index, profile] of ["python", "ruby", "rust"].entries())
			reports.push({
				bindingIrSha256: sha(route === "ordinary" ? "a" : "b")
				, checks: profile === "rust" ? 17 : 15
				, compilerFreePath: true
				, consumerSha256: sha(String(index + 1))
				, offlineInstall: true
				, profile
				, receiptSha256: sha(route === "ordinary" ? "c" : "d")
				, route
				, sourceRemovedBeforeInstallation: true
			});
	return { schemaVersion: 1, reports };
};

const remainingReport = profiles => {
	const reports = ["ordinary", "reviewed"].flatMap(route => profiles.map(
		profile => ({
			bindingIrSha256: sha(route === "ordinary" ? "a" : "b")
			, checks: profile === "wit-wasi" ? 26 : 14
			, compilerFreePath: true
			, consumerSha256: sha("1")
			, offlineInstall: true
			, profile
			, receiptSha256: sha("2")
			, route
			, sourceRemovedBeforeInstallation: true
			, ...["java", "kotlin"].includes(profile) ? {
				componentSha256: sha("3"), dependencyClosureSha256: sha("4")
				, offlineMaven: true, repeatExecution: true, runtimeOnly: true
			} : {}
			, ...profile === "dotnet" ? {
				installedAssemblySha256: sha("3"), repeatExecution: true
				, runtimeVersion: "8.0.21", sdkFreeRuntime: true
				, sourceFreeExecution: true
			} : {}
			, ...profile === "php-native" ? {
				closedComposerInstall: true, packageFileSetSha256: sha("3")
				, relocatedReplay: true, repeatExecution: true
				, vendorFilesSha256: sha("4")
			} : {}
			, ...profile === "wit-wasi" ? {
				handoffRemovedBeforeReplay: true, libraryClosureSha256: sha("3")
				, packageFileSetSha256: sha("4"), relocatedReplay: true
				, repeatExecution: true, runtimeOnly: true
				, sourceFreeExecution: true
			} : {}})
	));
	return { schemaVersion: 1, reports };
};

test("callback Subtype CI checkers require the closed native and Perl matrices", () => {
	const native = nativeReport(), perl = perlReport(), language = languageReport();
	assert.deepEqual(checkCallbackSubtypeNativeReport(native), {
		routes: ["ordinary", "reviewed"]
		, profiles: ["c", "cpp"]
		, reports: 4
	});
	assert.deepEqual(checkCallbackSubtypePerlReport(perl), {
		routes: ["ordinary", "reviewed"]
		, modes: ["prebuilt-only", "build-xs"]
		, interpreterCount: 4
		, reports: 16
	});
	assert.deepEqual(checkCallbackSubtypeLanguageReport(language), {
		routes: ["ordinary", "reviewed"]
		, profiles: ["python", "ruby", "rust"]
		, reports: 6
	});
	const commit = "e".repeat(40);
	assert.equal(callbackSubtypeNativeVerification("native", commit
		, tap(callbackSubtypeNativeTestName), native).reports, 4);
	assert.equal(callbackSubtypeNativeVerification("perl", commit
		, tap(callbackSubtypePerlTestName), perl).reports, 16);
	assert.equal(callbackSubtypeNativeVerification("language", commit
		, tap(callbackSubtypeLanguageTestName), language).reports, 6);
	const changed = structuredClone(perl); changed.reports[0].rejected = 5;
	assert.throws(() => checkCallbackSubtypePerlReport(changed));
	assert.throws(() => callbackSubtypeNativeVerification("native", commit
		, tap(callbackSubtypeNativeTestName).replace("# pass 1", "# pass 0")
		, native));
	assert.deepEqual(parseCallbackSubtypeNativeCiArgs([
		"--producer", commit, "--tap", "run.tap", "--report", "report.json"
	]), { producer: commit, tap: "run.tap", report: "report.json" });
	assert.throws(() => parseCallbackSubtypeNativeCiArgs([
		"--producer", commit, "--tap", "run.tap", "--tap", "again.tap"
	]));
});

test("callback Subtype remaining checker is reusable by hosted archival", () => {
	const commit = "e".repeat(40);
	for(const profiles of [
		["dotnet"], ["java", "kotlin"], ["php-native"], ["wit-wasi"]
	]) {
		const report = remainingReport(profiles);
		const checked = callbackSubtypeRemainingVerification(
			commit, profiles, tap(callbackSubtypeRemainingTestName), report);
		assert.deepEqual(checked.profiles, [...profiles].sort());
		assert.equal(checked.reports, profiles.length * 2);
	}
	assert.deepEqual(parseCallbackSubtypeRemainingCiArgs([
		"--producer", commit, "--profiles", "kotlin,java"
		, "--tap", "run.tap", "--report", "report.json"
	]), { producer: commit, profiles: ["java", "kotlin"]
		, tap: "run.tap", report: "report.json" });
	const changed = remainingReport(["wit-wasi"]);
	changed.reports[0].handoffRemovedBeforeReplay = false;
	assert.throws(() => callbackSubtypeRemainingVerification(
		commit, ["wit-wasi"], tap(callbackSubtypeRemainingTestName), changed));
});

test("callback Subtype native workflows preserve failures and cannot narrow the matrix", async () => {
	const nativeWorkflow = await readFile(
		".github/workflows/callback-subtype-native.yml", "utf8"
	);
	const perlWorkflow = await readFile(
		".github/workflows/callback-subtype-perl.yml", "utf8"
	);
	const languageWorkflow = await readFile(
		".github/workflows/callback-subtype-languages.yml", "utf8"
	);
	const remainingWorkflow = await readFile(
		".github/workflows/callback-subtype-remaining.yml", "utf8"
	);
	const workflows = [
		[nativeWorkflow, [
			"group: callback-subtype-native-${{ github.ref }}"
			, "runs-on: ubuntu-24.04"
			, "bash scripts/run-callback-subtype-native-ci.sh"
			, "build/callback-subtype-native-ci/"
		]]
		, [perlWorkflow, [
			"group: callback-subtype-perl-${{ github.ref }}"
			, "runs-on: ubuntu-24.04"
			, "5.36.3 threaded"
			, "5.36.3 unthreaded"
			, "5.38.2 threaded"
			, "5.38.2 unthreaded"
			, "bash scripts/run-callback-subtype-perl-ci.sh"
			, "build/callback-subtype-perl-ci/"
		]]
		, [languageWorkflow, [
			"group: callback-subtype-languages-${{ github.ref }}"
			, "runs-on: ubuntu-24.04"
			, "ruby-version: '3.3.12'"
			, 'python-version: "3.12"'
			, "bash scripts/bootstrap-rust-ci.sh"
			, "bash scripts/run-callback-subtype-languages-ci.sh"
			, "build/callback-subtype-languages-ci/"
		]]
	];
	for(const [source, required] of workflows)
	{
		for(const value of [
			"push:"
			, "pull_request:"
			, "workflow_dispatch:"
			, "persist-credentials: false"
			, "if: always()"
			, "if-no-files-found: error"
			, "steps.acceptance.outcome != 'success'"
			, "run: exit 1"
			, ...required
		]) assert.ok(source.includes(value), value);
		assert.doesNotMatch(source, /continue-on-error:|strategy:|needs:/u);
	}
	const nativeShell = await readFile(
		"scripts/run-callback-subtype-native-ci.sh", "utf8"
	);
	const perlShell = await readFile(
		"scripts/run-callback-subtype-perl-ci.sh", "utf8"
	);
	const languageShell = await readFile(
		"scripts/run-callback-subtype-languages-ci.sh", "utf8"
	);
	const remainingShell = await readFile(
		"scripts/run-callback-subtype-remaining-ci.sh", "utf8"
	);
	const remainingChecker = await readFile(
		"tests/helpers/callback-subtype-remaining-ci.mjs", "utf8"
	);
	const witClosure = await readFile(
		"tests/helpers/callback-subtype-wit-install.mjs", "utf8"
	);
	for(const value of [
		"set -euo pipefail"
		, "LEAN_BRIDGE_CALLBACK_SUBTYPE_NATIVE_PROFILES=c,cpp"
		, "LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.38"
		, "--test-concurrency=1"
		, "check-callback-subtype-native-ci.mjs"
	]) assert.ok(nativeShell.includes(value), value);
	for(const value of [
		"set -euo pipefail"
		, "LEAN_BRIDGE_CALLBACK_SUBTYPE_PERL_TEST=1"
		, "LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR=2.38"
		, "--test-concurrency=1"
		, "check-callback-subtype-perl-ci.mjs"
	]) assert.ok(perlShell.includes(value), value);
	for(const value of [
		"set -euo pipefail"
		, "LEAN_BRIDGE_CALLBACK_SUBTYPE_LANGUAGE_PROFILES=python,ruby,rust"
		, "LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.38"
		, "--test-concurrency=1"
		, "check-callback-subtype-languages-ci.mjs"
	]) assert.ok(languageShell.includes(value), value);
	for(const value of [
		"group: callback-subtype-remaining-${{ github.ref }}"
		, "lane: [dotnet, jvm, php-native, wit-wasi]"
		, "runs-on: ubuntu-24.04"
		, "bash scripts/run-callback-subtype-remaining-ci.sh"
		, "build/callback-subtype-remaining-ci-${{ matrix.lane }}/"
		, "if: always()"
		, "steps.acceptance.outcome != 'success'"
	]) assert.ok(remainingWorkflow.includes(value), value);
	for(const value of [
		"set -euo pipefail"
		, "profiles=dotnet"
		, "profiles=java,kotlin"
		, "profiles=php-native"
		, "profiles=wit-wasi"
		, "LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.38"
		, "--test-concurrency=1"
		, "check-callback-subtype-remaining-ci.mjs"
	]) assert.ok(remainingShell.includes(value), value);
	for(const value of [
		"handoffRemovedBeforeReplay"
		, "libraryClosureSha256"
		, "relocatedReplay"
		, "runtimeOnly"
		, "sourceFreeExecution"
	]) assert.ok(remainingChecker.includes(value), value);
	for(const value of [
		"await rm(handoff, { recursive: true, force: true })"
		, "await rename(root, relocated)"
		, "for(let attempt = 0; attempt < 2; attempt++)"
		, "verifyNativeFiles(join(relocated, packageName), receipt.files)"
	]) assert.ok(witClosure.includes(value), value);
});

const producedRelease = async (root, route) => {
	const abi = { id: "native-library-v1", bindingIrSha256: sha("1")
		, runtimeIdentity: sha("2") };
	const packages = [];
	for(const target of ["c", "cpp"])
	{
		const path = `archives/${target}/callbacksubtypes-${route}.fixture`;
		const bytes = Buffer.from(`Inert ${target} archive for ${route}\n`);
		await saveLakeFile(root, path, bytes);
		const artifacts = [{ path, bytes: bytes.length, sha256: sha256(bytes) }];
		packages.push({ target, ecosystem: target, name: "callbacksubtypes"
			, version: "1.0.0", profile: abi.id, role: "component"
			, runtimeIdentity: abi.runtimeIdentity, runtimeDelivery: "embedded"
			, requires: [], artifacts });
	}
	return writePackageSetReceipt({ root
		, component: { id: "callbacksubtypes@1.0.0", name: "callbacksubtypes"
			, version: "1.0.0" }
		, source: { treeSha256: sha("9") }, profiles: [abi], packages });
};

const retainedLane = async (t, { perl = false } = {}) => {
	const root = await mkdtemp(join(tmpdir(), "lean-callback-subtype-retained-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const output = join(root, "lane-ci/report.json");
	await clearCallbackSubtypeRetainedPackages(output);
	const entries = [], reports = [];
	for(const route of ["ordinary", "reviewed"])
	{
		const release = join(root, `${route}-release`);
		await producedRelease(release, route);
		const handoff = join(root, `${route}-handoff`);
		const { receipt, entry } = await retainCallbackSubtypeRoute({ output, route
			, source: release, handoff });
		entries.push(entry);
		const installed = await readFile(join(handoff, packageSetReceiptName));
		assert.equal(sha256(installed), entry.receiptSha256);
		reports.push(perl ? { route, packages: receipt.packages }
			: { route, receiptSha256: entry.receiptSha256 });
	}
	await writeCallbackSubtypeRetainedPackages(output, entries.toReversed());
	return { root, outputRoot: join(root, "lane-ci"), output
		, report: { schemaVersion: 1, reports } };
};

test("callback Subtype lanes install from and verify their retained package sets", async t => {
	for(const perl of [false, true])
	{
		const lane = await retainedLane(t, { perl });
		const summary = await verifyCallbackSubtypeRetainedPackages(
			lane.outputRoot, lane.report);
		assert.deepEqual(summary.routes.map(route => route.route)
			, ["ordinary", "reviewed"]);
		for(const route of summary.routes)
			assert.ok(route.archives === 2 && route.archiveBytes > 0);
	}
	const exists = await retainedLane(t);
	await assert.rejects(retainCallbackSubtypeRoute({ output: exists.output
		, route: "ordinary", source: join(exists.root, "ordinary-release")
		, handoff: join(exists.root, "again") }), /must not already exist/u);
});

test("callback Subtype retained package verification rejects every tampering", async t => {
	const rejects = async (change, pattern) => {
		const lane = await retainedLane(t);
		await change(lane);
		await assert.rejects(verifyCallbackSubtypeRetainedPackages(
			lane.outputRoot, lane.report), pattern);
	};
	await rejects(({ outputRoot }) => appendFile(join(outputRoot
		, "evidence/ordinary/handoff/archives/c/callbacksubtypes-ordinary.fixture"), "x")
	, /Archive differs|archive-mismatch/u);
	await rejects(({ outputRoot }) => writeFile(join(outputRoot
		, "evidence/reviewed/handoff/CallbackSubtypes.lean"), "-- source\n")
	, /exactly the receipt-named set/u);
	await rejects(({ outputRoot }) => saveLakeFile(outputRoot
		, "evidence/stale/handoff/extra.fixture", "stale\n")
	, /only route package sets/u);
	await rejects(async ({ outputRoot }) => {
		const path = join(outputRoot, "retained-packages.json");
		await writeFile(path, JSON.stringify(JSON.parse(await readFile(path, "utf8"))));
	}, /must be canonical/u);
	await rejects(async ({ outputRoot }) => {
		const path = join(outputRoot, "retained-packages.json");
		const record = JSON.parse(await readFile(path, "utf8"));
		record.routes[1].archiveBytes += 1;
		await writeFile(path, canonicalJson(record));
	}, /retained package metadata/u);
	await rejects(async ({ report }) => {
		report.reports[0].receiptSha256 = sha("0");
	}, /reported receipt is the retained receipt/u);
	await rejects(async ({ report }) => {
		report.reports = report.reports.slice(1);
	}, /report covers the route/u);
	const perl = await retainedLane(t, { perl: true });
	perl.report.reports[1].packages[0].name = "forged";
	await assert.rejects(verifyCallbackSubtypeRetainedPackages(perl.outputRoot
		, perl.report), /reported packages are the retained set/u);
});

test("callback Subtype producers, checkers and archives require retained packages", async () => {
	for(const lane of ["native", "language", "perl", "remaining"])
	{
		const source = await readFile(`tests/callback-subtype-${lane}-installed.test.mjs`, "utf8");
		for(const required of ["await clearCallbackSubtypeRetainedPackages(output);"
			, "await retainCallbackSubtypeRoute({\n\t\t\toutput, route, source: outputRoot, handoff });"
			, "await writeCallbackSubtypeRetainedPackages(output, retainedEntries);"])
			assert.ok(source.includes(required), `${lane}: ${required}`);
		assert.doesNotMatch(source, /copyPackageSetHandoff\(outputRoot/u, lane);
	}
	for(const lane of ["native", "languages", "perl", "remaining"])
		assert.match(await readFile(`scripts/check-callback-subtype-${lane}-ci.mjs`, "utf8")
			, /retainedPackages: await verifyCallbackSubtypeRetainedPackages\(\n\t\tdirname\(selected\.report\), report\)/u, lane);
	for(const path of ["scripts/archive-callback-subtype-evidence.mjs"
		, "tests/helpers/callback-subtype-hosted-evidence.mjs"])
		assert.match(await readFile(path, "utf8")
			, /retainedPackages: await verifyCallbackSubtypeRetainedPackages\(/u, path);
});
