/**
 * Validate installed PHP HostNull reports and, when supplied, their package handoffs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { sha256 } from "../../src/capsule/node.mjs";
import { verifyPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";

const digest = /^[0-9a-f]{64}$/u;
const positions = ["parameter", "result", "field", "callback-parameter", "callback-result"];
const routes = ["ordinary-source", "reviewed-ir"];
const modes = ["strict", "weak"];
const keys = (value, expected) => assert.deepEqual(Object.keys(value).sort(), [...expected].sort());
const hash = (value, label) => assert.match(value, digest, label);
const safePath = path => {
	assert.equal(path.startsWith("/") || path.split("/").includes(".."), false, `Unsafe package path ${path}`);
};

const assertPackage = pkg => {
	keys(pkg, ["target", "ecosystem", "name", "version", "profile", "role", "runtimeIdentity", "runtimeDelivery", "requires", "artifacts"]);
	assert.ok(pkg.name && pkg.version && pkg.artifacts.length > 0);
	hash(pkg.runtimeIdentity, `${pkg.name} runtime identity`);
	for(const requirement of pkg.requires) keys(requirement, ["ecosystem", "name", "version"]);
	for(const artifact of pkg.artifacts)
	{
		keys(artifact, ["path", "bytes", "sha256"]); safePath(artifact.path);
		assert.ok(Number.isSafeInteger(artifact.bytes) && artifact.bytes > 0); hash(artifact.sha256, artifact.path);
	}
};

const assertObservation = (observation, profile, route, mode) => {
	keys(observation, ["api", "callerMode", "checks", "hostVersion", "libraries", "nestedOptionDistinct", "path", "positions", "profile", "rejections", "wordBits"]);
	assert.deepEqual(observation.positions, positions); assert.equal(observation.profile, profile);
	assert.equal(observation.path, route); assert.equal(observation.callerMode, mode);
	assert.equal(observation.nestedOptionDistinct, true); assert.equal(observation.rejections, 30);
	assert.match(observation.hostVersion, /^\d+\.\d+\.\d+/u);
	if(profile === "php-native")
	{
		assert.equal(observation.checks, 215); assert.equal(observation.wordBits, 64);
		assert.match(observation.api, /\/relocated\/vendor\/host-null-demo\/api\/src\/Api\.php$/u);
		assert.equal(Object.keys(observation.libraries).length, 4);
		for(const value of Object.values(observation.libraries)) hash(value, "native library");
	}
	else
	{
		assert.equal(observation.checks, 214); assert.equal(observation.wordBits, 32);
		assert.equal(observation.api, "/vendor/host-null-demo/wasm/src/Api.php");
		assert.deepEqual(observation.libraries, []);
	}
};

const assertNative = (report, route) => {
	const runtime = report.php;
	for(const field of ["compilerFreeExecution", "offline", "lockedInstall", "emptyCache", "emptyComposerHome", "publicApiOnly", "relocated", "repeatExecution", "unchangedDeployment", "iniDisabled", "runtimeOverridesDisabled", "exactPublicSignatures"])
		assert.equal(runtime[field], true, `Native ${field}`);
	assert.equal(runtime.executions.length, 2);
	assert.deepEqual(runtime.executions.map(item => item.mode).sort(), modes);
	for(const execution of runtime.executions)
	{
		keys(execution, ["mode", "observation"]);
		assertObservation(execution.observation, "php-native", route, execution.mode);
	}
	assert.deepEqual(report.observation, runtime.executions[0].observation);
};

const wasmSelection = execution => [execution.realm, execution.arrangement, execution.loading, execution.mode].join(":");
const expectedWasmSelections = [
	...["embedded", "composer"].flatMap(arrangement => ["startup", "lazy"].flatMap(loading => modes.map(mode => `node:${arrangement}:${loading}:${mode}`)))
	, ...["startup", "lazy"].flatMap(loading => modes.map(mode => `chromium:bundled:${loading}:${mode}`))
].sort();
const assertWasm = (report, route) => {
	const runtime = report.phpWasm;
	for(const field of ["compilerFreeExecution", "offlineInstall", "lockedInstall", "emptyCaches", "publicApiOnly", "relocated", "repeatExecution", "unchangedDeployment"])
		assert.equal(runtime[field], true, `PHP-Wasm ${field}`);
	assert.equal(runtime.executions.length, 12);
	assert.deepEqual(runtime.executions.map(wasmSelection).sort(), expectedWasmSelections);
	for(const execution of runtime.executions)
	{
		keys(execution, [
			"realm"
			, "arrangement"
			, "loading"
			, "mode"
			, "observation"
			, "phases"
			, ...(execution.realm === "chromium" ? ["requests"] : [])
		]);
		if(execution.realm === "chromium") assert.ok(Array.isArray(execution.requests) && execution.requests.length > 0);
		assertObservation(execution.observation, "php-wasm", route, execution.mode);
		assert.deepEqual(execution.phases.map(phase => phase.stage), ["ready", "autoload", "invalid", "complete"]);
		const expected = execution.loading === "lazy" ? [0, 0, 0, 2] : [2, 2, 2, 2];
		assert.deepEqual(execution.phases.map(phase => phase.libraries.length), expected);
	}
	assert.deepEqual(report.observation, runtime.executions[0].observation);
};

const expectedPackages = {
	"php-native": [["composer", "host-null-demo/api", "component", "native-library-v1"]]
	, "php-wasm": [
		["composer", "host-null-demo/wasm", "api", "php-wasm-copied-v1"]
		, ["npm", "@lean-bridge/php-wasm-copied-runtime", "runtime", "php-wasm-copied-v1"]
		, ["npm", "host-null-demo-wasm", "component", "php-wasm-copied-v1"]
	]
};

const assertRetainedHandoff = async (report, root) => {
	const receiptPath = join(root, report.path, "package-set-receipt.json");
	const bytes = await readFile(receiptPath); hash(report.receiptSha256, "receipt");
	assert.equal(sha256(bytes), report.receiptSha256);
	const receipt = JSON.parse(bytes); assert.deepEqual(receipt.packages, report.packages);
	await verifyPackageSetReceipt({ receiptPath });
};

/**
 * Validate both author routes for one PHP HostNull profile.
 *
 * @param {object} value Report document.
 * @param {"php-native"|"php-wasm"} profile Consumer profile.
 * @param {string|null} packageRoot Optional root containing one retained handoff per route.
 * @returns {Promise<object>} A compact verification summary.
 */
export const assertHostNullPhpReport = async (value, profile, packageRoot = null) => {
	assert.ok(Object.hasOwn(expectedPackages, profile), `Unsupported HostNull PHP profile ${profile}`);
	keys(value, ["schemaVersion", "reports"]); assert.equal(value.schemaVersion, 1);
	assert.equal(value.reports.length, 2); assert.deepEqual(value.reports.map(report => report.path), routes);
	for(const report of value.reports)
	{
		keys(report, ["profile", "path", profile === "php-native" ? "php" : "phpWasm", "observation", "packages", "receiptSha256", "bindingIrSha256", "sourceTreeSha256", "modelSha256", "sourceRemovedBeforeInstallation", "handoffRemovedBeforeExecution"]);
		assert.equal(report.profile, profile); assert.equal(report.sourceRemovedBeforeInstallation, true);
		assert.equal(report.handoffRemovedBeforeExecution, true);
		for(const field of ["receiptSha256", "bindingIrSha256", "sourceTreeSha256", "modelSha256"]) hash(report[field], field);
		assert.deepEqual(report.packages.map(pkg => [pkg.ecosystem, pkg.name, pkg.role, pkg.profile]), expectedPackages[profile]);
		for(const pkg of report.packages) assertPackage(pkg);
		assert.equal(new Set(report.packages.map(pkg => pkg.runtimeIdentity)).size, 1);
		if(profile === "php-native") assertNative(report, report.path); else assertWasm(report, report.path);
		if(packageRoot) await assertRetainedHandoff(report, packageRoot);
	}
	return { profile, routes, positions, executions: value.reports.reduce((sum, report) => sum + report[profile === "php-native" ? "php" : "phpWasm"].executions.length, 0), packagesVerified: Boolean(packageRoot) };
};
