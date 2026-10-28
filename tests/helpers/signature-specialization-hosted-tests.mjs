/**
 * Refusal controls for the closed hosted specialization archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { canonicalJson } from "../../src/capsule/node.mjs";
import {
	parseSignatureSpecializationHostedArchiveArgs
	, signatureSpecializationHostedConsumerSha256
	, signatureSpecializationHostedLanes
	, signatureSpecializationHostedProducer
} from "./signature-specialization-hosted-archive.mjs";
import {
	validateSignatureSpecializationHostedReport
} from "./signature-specialization-hosted-evidence.mjs";
import {
	signatureSpecializationBrowserExpected
	, signatureSpecializationBrowserProfiles
} from "./signature-specialization-browser.mjs";

const hash = "0".repeat(64);
const clone = value => structuredClone(value);
const bytes = value => Buffer.from(canonicalJson(value));
const nativeChecks = {
	python: 2020, ruby: 2020, rust: 2011, dotnet: 2030
	, java: 2070, kotlin: 2036, "php-native": 2020
	, "wit-wasi": 2021, perl: 2019
};
const nativeExtensions = {
	python: "py", ruby: "rb", rust: "rs", dotnet: "cs"
	, java: "java", kotlin: "kt", "php-native": "php"
	, "wit-wasi": "c", perl: "pl"
};
const nativeTargets = {
	python: "pypi", ruby: "rubygems", rust: "cargo", dotnet: "nuget"
	, java: "maven", kotlin: "maven", "php-native": "php-native"
	, "wit-wasi": "wit-wasi", perl: "cpan"
};

const nativeReport = lane => {
	const reports = lane.profiles.map(profile => {
		const path = `archives/${profile}.tgz`;
		return {
			profile, path: "reviewed-source", checks: nativeChecks[profile]
			, consumerSha256: signatureSpecializationHostedConsumerSha256(
				signatureSpecializationHostedProducer
				, `tests/fixtures/specialization-consumers/${profile}.${nativeExtensions[profile]}`)
			, bindingIrSha256: hash, reviewedBindingIrSha256: hash
			, modelSha256: hash, receiptSha256: hash
			, packages: [{ target: nativeTargets[profile]
				, artifacts: [{ path, bytes: 1, sha256: hash }] }]
			, sourceRemovedBeforeInstallation: true
			, offlineInstall: true, compilerFreePath: true
		};
	});
	return { schemaVersion: 1, reports
		, archives: Object.fromEntries(reports.flatMap(item =>
			item.packages.flatMap(pkg => pkg.artifacts.map(artifact =>
				[artifact.path, artifact.sha256]))))
		, reproducible: true };
};
const tap = Buffer.from(`TAP version 13
ok 17 - independently reviewed native packages install every chosen specialization without its generic
1..17
# tests 17
# suites 0
# pass 1
# fail 0
# cancelled 0
# skipped 16
# todo 0
# duration_ms 1
`);

const result = (route, profile) => ({
	profile, module: "specialized"
	, realm: profile === "browser-worker" ? "dedicated-worker" : "window"
	, results: { module: "specialized", route
		, ...signatureSpecializationBrowserExpected }
	, hostVersion: "1"
});
const browserProfile = (route, profile) => {
	const observation = result(route, profile);
	const variants = profile === "browser-react"
		? ["production", "strict"] : ["production"];
	const executions = ["chromium", "firefox", "webkit"].flatMap(
		engine => variants.map(variant => ({
			engine, variant, observation, failedAssetRecovery: true
			, ...(profile === "browser-react"
				? { pendingUnmount: true } : {})
		}))
	);
	return {
		profile
		, browser: { observation
			, browser: { installedSourcesRemoved: true
				, externalNetworkBlocked: true, executions } }
	};
};
const browserReport = () => ({
	schemaVersion: 1, kind: "signature-specialization-browser-installed-v1"
	, routes: ["ordinary", "reviewed"].map(route => ({
		route, producerCommit: signatureSpecializationHostedProducer
		, reviewedBindingIrSha256: hash
		, builds: [{ receipt: hash }, { receipt: hash }]
		, independentBuilds: 2, reproducible: true
		, authorInputsUnchanged: true, sourceRemovedBeforeInstallation: true
		, producerBuildsRemovedBeforeInstallation: true, offlineInstall: true
		, compilerFreePath: true, relocatedInstallation: true
		, browsers: { requestedEngines: ["chromium", "firefox", "webkit"]
			, observations: signatureSpecializationBrowserProfiles.map(
				profile => browserProfile(route, profile)) }
	}))
});

const phpTuples = [];
for(const arrangement of ["embedded", "composer"])
	for(const loading of ["startup", "lazy"])
		for(const mode of ["weak", "strict"])
			phpTuples.push({
				realm: "node", arrangement, loading, mode, checks: 2020
			});
for(const loading of ["startup", "lazy"])
	for(const mode of ["weak", "strict"])
		phpTuples.push({
			realm: "chromium", arrangement: "bundled", loading, mode
			, checks: 2020
		});
const phpReport = () => ({
	schemaVersion: 1, kind: "signature-specialization-php-wasm-installed-v1"
	, reports: ["ordinary-source", "reviewed-ir"].map(path => ({
		path, profile: "php-wasm"
		, producerCommit: signatureSpecializationHostedProducer
		, reviewedBindingIrSha256: hash, driverSha256: hash
		, consumerSha256: signatureSpecializationHostedConsumerSha256(
			signatureSpecializationHostedProducer
			, "tests/fixtures/specialization-consumers/php-native.php")
		, builds: [{ receipt: hash }, { receipt: hash }]
		, independentBuilds: 2, reproducible: true
		, sourceRemovedBeforeInstallation: true
		, producerBuildsRemovedBeforeInstallation: true
		, handoffRelocatedBeforeInstallation: true, offlineInstall: true
		, compilerFreePath: true, unchangedDeployment: true
		, handoffRemovedBeforeExecution: true, checks: 2020
		, executions: clone(phpTuples)
	}))
});

test("the hosted specialization archive accepts only one canonical input root", () => {
	assert.equal(parseSignatureSpecializationHostedArchiveArgs([
		"--input-root", "/tmp/signature-hosted"
	]), "/tmp/signature-hosted");
	for(const args of [[], ["--input-root", "relative"]
		, ["--input-root", "/tmp/../tmp/signature-hosted"]
		, ["--other", "/tmp/signature-hosted"]])
		assert.throws(() => parseSignatureSpecializationHostedArchiveArgs(args));
});

test("the ten closed lanes retain all nine native profiles plus browser and PHP-Wasm", () => {
	assert.deepEqual(signatureSpecializationHostedLanes.map(lane => lane.id), [
		"python", "ruby", "rust", "dotnet", "jvm", "php-native"
		, "wit-wasi", "perl", "browser", "php-wasm"
	]);
	const nativeProfiles = signatureSpecializationHostedLanes.flatMap(
		lane => lane.kind === "native" ? lane.profiles : []);
	assert.deepEqual(nativeProfiles, [
		"python", "ruby", "rust", "dotnet", "java", "kotlin"
		, "php-native", "wit-wasi", "perl"
	]);
});

test("native reports require every exact profile result, source and terminal TAP pass", () => {
	const nativeLanes = signatureSpecializationHostedLanes.filter(
		item => item.kind === "native");
	for(const lane of nativeLanes)
	{
		const report = nativeReport(lane);
		assert.equal(validateSignatureSpecializationHostedReport(
			lane, bytes(report), tap).kind, "native");
		const changed = clone(report); changed.reports[0].checks--;
		assert.throws(() => validateSignatureSpecializationHostedReport(
			lane, bytes(changed), tap));
	}
	const lane = signatureSpecializationHostedLanes[0];
	assert.throws(() => validateSignatureSpecializationHostedReport(
		lane, bytes(nativeReport(lane)), Buffer.from(tap.toString().replace(
			"# fail 0", "# fail 1"))));
});

test("browser reports require every engine, variant and lifecycle recovery", () => {
	const lane = signatureSpecializationHostedLanes.find(
		item => item.kind === "browser");
	const report = browserReport();
	assert.equal(validateSignatureSpecializationHostedReport(
		lane, bytes(report)).executions, 24);
	const missing = clone(report);
	missing.routes[0].browsers.observations[0].browser.browser.executions.pop();
	assert.throws(() => validateSignatureSpecializationHostedReport(
		lane, bytes(missing)));
	const recovery = clone(report);
	recovery.routes[0].browsers.observations[1]
		.browser.browser.executions[0].pendingUnmount = false;
	assert.throws(() => validateSignatureSpecializationHostedReport(
		lane, bytes(recovery)));
});

test("PHP-Wasm reports require the exact twelve arrangements and 2020 checks", () => {
	const lane = signatureSpecializationHostedLanes.find(
		item => item.kind === "php-wasm");
	const report = phpReport();
	assert.equal(validateSignatureSpecializationHostedReport(
		lane, bytes(report)).executions, 24);
	const missing = clone(report); missing.reports[0].executions.pop();
	assert.throws(() => validateSignatureSpecializationHostedReport(
		lane, bytes(missing)));
	const weakened = clone(report); weakened.reports[0].checks--;
	assert.throws(() => validateSignatureSpecializationHostedReport(
		lane, bytes(weakened)));
});
