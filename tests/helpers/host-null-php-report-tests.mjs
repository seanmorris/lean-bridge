/**
 * Mutation controls for PHP HostNull report verification. Synthetic reports are not evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson } from "../../src/capsule/node.mjs";
import { assertHostNullPhpReport } from "./host-null-php-report.mjs";

const digest = "1".repeat(64), positions = ["parameter", "result", "field", "callback-parameter", "callback-result"];
const observation = (profile, path, mode) => ({
	api: profile === "php-native" ? "/tmp/consumer/relocated/vendor/host-null-demo/api/src/Api.php" : "/vendor/host-null-demo/wasm/src/Api.php"
	, callerMode: mode
	, checks: profile === "php-native" ? 215 : 214
	, hostVersion: profile === "php-native" ? "8.3.0" : "8.4.1"
	, libraries: profile === "php-native" ? Object.fromEntries(["component", "host", "runtime", "lean"].map(name => [`/tmp/${name}.so`, digest])) : []
	, nestedOptionDistinct: true
	, path
	, positions: [...positions]
	, profile
	, rejections: 30
	, wordBits: profile === "php-native" ? 64 : 32
});
const artifact = path => ({ path, bytes: 10, sha256: digest });
const pkg = (target, ecosystem, name, role, profile) => ({
	target
	, ecosystem
	, name
	, version: "1.0.0"
	, profile
	, role
	, runtimeIdentity: digest
	, runtimeDelivery: role === "component" && target === "php-native" ? "embedded" : "dependency"
	, requires: []
	, artifacts: [artifact(`archives/${name.replaceAll("/", "-").replaceAll("@", "")}.pkg`)] });
const packages = profile => profile === "php-native"
	? [pkg("php-native", "composer", "host-null-demo/api", "component", "native-library-v1")]
	: [pkg("php-wasm", "composer", "host-null-demo/wasm", "api", "php-wasm-copied-v1")
		, pkg("php-wasm", "npm", "@lean-bridge/php-wasm-copied-runtime", "runtime", "php-wasm-copied-v1")
		, pkg("php-wasm", "npm", "host-null-demo-wasm", "component", "php-wasm-copied-v1")];
const phases = loading => ["ready", "autoload", "invalid", "complete"].map((stage, index) => ({ stage
	, libraries: loading === "lazy" && index < 3 ? [] : ["component.so", "runtime.so"] }));
const executions = (profile, path) => profile === "php-native"
	? ["weak", "strict"].map(mode => ({ mode, observation: observation(profile, path, mode) }))
	: [...["embedded", "composer"].flatMap(arrangement => ["startup", "lazy"].flatMap(loading => ["weak", "strict"].map(mode => ({ realm: "node", arrangement, loading, mode, observation: observation(profile, path, mode), phases: phases(loading) }))))
		, ...["startup", "lazy"].flatMap(loading => ["weak", "strict"].map(mode => ({ realm: "chromium", arrangement: "bundled", loading, mode, observation: observation(profile, path, mode), phases: phases(loading), requests: ["request"] })))];
const runtime = (profile, path) => {
	const rows = executions(profile, path);
	return profile === "php-native" ? { compilerFreeExecution: true, offline: true, lockedInstall: true, emptyCache: true, emptyComposerHome: true, publicApiOnly: true, relocated: true, repeatExecution: true, unchangedDeployment: true, iniDisabled: true, runtimeOverridesDisabled: true, exactPublicSignatures: true, executions: rows }
		: { compilerFreeExecution: true, offlineInstall: true, lockedInstall: true, emptyCaches: true, publicApiOnly: true, relocated: true, repeatExecution: true, unchangedDeployment: true, executions: rows };
};
const synthetic = profile => ({
	schemaVersion: 1
	, reports: ["ordinary-source", "reviewed-ir"].map(path => {
		const field = profile === "php-native" ? "php" : "phpWasm", value = runtime(profile, path);
		return {
			profile
			, path
			, [field]: value
			, observation: value.executions[0].observation
			, packages: packages(profile)
			, receiptSha256: digest
			, bindingIrSha256: digest
			, sourceTreeSha256: digest
			, modelSha256: digest
			, sourceRemovedBeforeInstallation: true
			, handoffRemovedBeforeExecution: true
		};
	})
});

test("PHP HostNull report gate admits both complete installed profile matrices", async () => {
	assert.deepEqual(await assertHostNullPhpReport(synthetic("php-native"), "php-native"), {
		profile: "php-native"
		, routes: ["ordinary-source", "reviewed-ir"]
		, positions
		, executions: 4
		, packagesVerified: false
	});
	assert.equal((await assertHostNullPhpReport(synthetic("php-wasm"), "php-wasm")).executions, 24);
});

test("PHP HostNull report gate rejects weaker behavior and forged package claims", async () => {
	const mutations = [
		value => { value.extra = true; }
		, value => { value.reports.pop(); }
		, value => { value.reports[0].path = "ordinary"; }
		, value => { value.reports[0].observation.nestedOptionDistinct = false; }
		, value => { value.reports[0].observation.positions.pop(); }
		, value => { value.reports[0].phpWasm.executions[0].observation.checks--; }
		, value => { value.reports[0].phpWasm.executions[0].observation.rejections--; }
		, value => { value.reports[0].phpWasm.compilerFreeExecution = false; }
		, value => { value.reports[0].phpWasm.executions.pop(); }
		, value => { value.reports[0].phpWasm.executions[0].arrangement = "invented"; }
		, value => { value.reports[0].phpWasm.executions[0].phases[0].libraries = []; }
		, value => { value.reports[0].packages[0].name = "unrelated/api"; }
		, value => { value.reports[0].packages[0].artifacts[0].path = "../outside.pkg"; }
		, value => { value.reports[0].packages[1].runtimeIdentity = "2".repeat(64); }
		, value => { value.reports[0].receiptSha256 = "bad"; }
		, value => { value.reports[0].sourceRemovedBeforeInstallation = false; }
	];
	for(const mutate of mutations)
	{
		const value = synthetic("php-wasm"); mutate(value);
		await assert.rejects(() => assertHostNullPhpReport(value, "php-wasm"));
	}
});

test("PHP HostNull report CLI requires one exact profile and complete report", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-host-null-php-report-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const path = join(root, "report.json"); await writeFile(path, canonicalJson(synthetic("php-native")));
	const run = args => spawnSync(process.execPath, ["scripts/check-host-null-php-reports.mjs", ...args], { encoding: "utf8" });
	const passed = run(["--profile", "php-native", "--report", path]);
	assert.equal(passed.status, 0, passed.stderr); assert.match(passed.stdout, /"executions":4/u);
	assert.notEqual(run(["--profile", "php-native"]).status, 0);
	assert.notEqual(run(["--profile", "unknown", "--report", path]).status, 0);
	assert.notEqual(run(["--profile", "php-native", "--report", path, "--extra", "bad"]).status, 0);
});
