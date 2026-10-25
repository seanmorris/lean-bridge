/**
 * Independently replay one owned checked-record hosted output tree.
 *
 * The tree is the extracted original artifact: the CI log directory and the
 * packaging directory with its aggregate report and the retained package set
 * for every route. The PHP-Wasm lane instead retains its acceptance and
 * runtime logs beside per-mode reports and one handoff per mode and author. Nothing here trusts the producer's own gates; the Node TAP,
 * the canonical report, every retained archive byte and every consumer source
 * digest are checked against each other and against the lane contract.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { lstat, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	packageSetReceiptName, readVerifiedPackageSetReceipt
} from "../../src/release/package-set-receipt.mjs";
import {
	ownedCheckedRecordHostedLanes, ownedCheckedRecordHostedRoutes
	, ownedCheckedRecordHostedTestNames
} from "./owned-checked-record-hosted-contracts.mjs";
import {
	verifyOwnedCheckedRecordJavaScriptEvidence
} from "./owned-checked-record-javascript-evidence.mjs";
import { moduleAtProducerWithSourceReads } from "./producer-module.mjs";
import {
	assertOwnedCheckedRecordPhpWasmModelCorpus, ownedCheckedRecordPhpWasmCorpus
} from "./owned-checked-record-php-wasm-corpus.mjs";
import {
	checkOwnedCheckedRecordPhpWasmContextsEvidence
	, ownedCheckedRecordPhpWasmContextModule
	, requiresOwnedCheckedRecordPhpWasmContexts
} from "./owned-checked-record-php-wasm-context-evidence.mjs";

const summaryKeys = Object.freeze(["tests", "suites", "pass", "fail"
	, "cancelled", "skipped", "todo"]);

/**
 * Parse the terminal Node TAP stream written after the npm script preamble.
 *
 * @param text - Complete acceptance log.
 */
export const parseOwnedCheckedRecordTap = text => {
	const lines = text.split("\n");
	const start = lines.indexOf("TAP version 13");
	assert.ok(start >= 0, "Acceptance log must contain Node TAP");
	assert.equal(lines.lastIndexOf("TAP version 13"), start
		, "Acceptance log must contain one TAP stream");
	for(const line of lines.slice(0, start))
		assert.ok(line === "" || line.startsWith("> ")
			, `Unexpected acceptance preamble: ${line}`);
	const tests = [], diagnostics = [], summary = {};
	let plan = null;
	for(const line of lines.slice(start + 1))
	{
		assert.doesNotMatch(line, /^\s*not ok\b/u, line);
		assert.doesNotMatch(line, /^Bail out!/u, line);
		const point = /^ok (\d+) - (.*)$/u.exec(line);
		if(point)
		{
			assert.doesNotMatch(point[2], /#\s*(?:SKIP|TODO)\b/iu, line);
			assert.equal(Number(point[1]), tests.length + 1, line);
			assert.equal(plan, null, "Test points must precede the plan");
			tests.push(point[2]);
			continue;
		}
		const planned = /^1\.\.(\d+)$/u.exec(line);
		if(planned)
		{
			assert.equal(plan, null, "Acceptance TAP must contain one plan");
			plan = Number(planned[1]);
			continue;
		}
		const comment = /^# (.*)$/u.exec(line);
		if(!comment)
		{
			if(line !== "") assert.equal(plan, null
				, `Unexpected TAP line after the plan: ${line}`);
			continue;
		}
		if(comment[1].startsWith("Subtest: ")) continue;
		const counted = /^(\w+) (\d+(?:\.\d+)?)$/u.exec(comment[1]);
		const totals = [...summaryKeys, "duration_ms"];
		if(plan !== null && counted && totals.includes(counted[1]))
		{
			assert.ok(!Object.hasOwn(summary, counted[1]), counted[1]);
			summary[counted[1]] = Number(counted[2]);
			continue;
		}
		assert.equal(plan, null, `Unexpected comment after the plan: ${line}`);
		diagnostics.push(comment[1]);
	}
	assert.equal(plan, tests.length, "TAP plan must count every test point");
	assert.deepEqual(Object.keys(summary).filter(key => key !== "duration_ms")
		.toSorted(), [...summaryKeys].toSorted());
	assert.deepEqual({ ...summary, duration_ms: undefined }, {
		tests: tests.length, suites: 0, pass: tests.length, fail: 0
		, cancelled: 0, skipped: 0, todo: 0, duration_ms: undefined
	});
	return { tests, diagnostics };
};

const regularFiles = async (root, prefix = "") => {
	const files = [];
	for(const entry of await readdir(join(root, prefix), { withFileTypes: true }))
	{
		const path = prefix ? `${prefix}/${entry.name}` : entry.name;
		const information = await lstat(join(root, path));
		if(information.isDirectory()) files.push(...await regularFiles(root, path));
		else
		{
			assert.ok(information.isFile(), `Hosted output must be regular: ${path}`);
			files.push(path);
		}
	}
	return files.toSorted();
};

const routeShape = route => {
	const match = /^(ordinary|reviewed)-(full|result-only)$/u.exec(route);
	assert.ok(match, route);
	return { authorRoute: match[1], mode: match[2]
		, resultOnly: match[2] === "result-only" };
};

const extensions = Object.freeze({ c: "c", cpp: "cpp", python: "py"
	, ruby: "rb", rust: "rs", dotnet: "cs", java: "java", kotlin: "kt"
	, "php-native": "php" });

/**
 * Reproduce the exact consumer source bytes a lane fed to one profile.
 *
 * @param original - Reader of committed producer source bytes.
 * @param lane - Contract selecting the lane's fixture naming.
 * @param profile - Installed host whose consumer source is selected.
 * @param resultOnly - Whether the route is result-only.
 */
const consumerSource = (original, lane, profile, resultOnly) => {
	const read = name => original(`tests/fixtures/structured-types/${name}`)
		.toString("utf8");
	const installed = resultOnly ? "result-only" : "installed";
	if(lane.kind === "native")
		return read(`owned-checked-record-${installed}.${extensions[profile]}`);
	if(lane.kind === "perl") return read(`owned-checked-record-${installed}.pl`);
	if(profile === "wit-wasi")
		return read(`owned-checked-record-${installed}.c`)
			.replaceAll("owned_checked_records", "owned_checked_records_wasmtime")
			.replaceAll("OWNED_CHECKED_RECORDS", "OWNED_CHECKED_RECORDS_WASMTIME")
			.replace(`owned-checked-record-${resultOnly ? "result-only-" : ""}c:`
				, `owned-checked-record-${resultOnly ? "result-only-" : ""}wit-wasi:`);
	const name = profile === "php-native" ? "php" : profile;
	return read(`owned-checked-record-${resultOnly ? "result-only-" : ""}${name}.${extensions[profile]}`);
};

const positive = value => Number.isSafeInteger(value) && value > 0;

const replayJavaScript = async (lane, root, producer) => {
	const packagingRoot = join(root, lane.packaging);
	const reportPath = join(packagingRoot, lane.report);
	const reportBytes = await readFile(reportPath);
	const report = JSON.parse(reportBytes);
	assert.equal(reportBytes.toString("utf8"), canonicalJson(report)
		, "Hosted report must be canonical");
	const accepted = await verifyOwnedCheckedRecordJavaScriptEvidence(reportPath);
	const acceptance = await readFile(join(root, lane.acceptance), "utf8");
	const tap = parseOwnedCheckedRecordTap(acceptance);
	assert.deepEqual(tap.tests, ownedCheckedRecordHostedTestNames(lane)
		, "Acceptance TAP must contain exactly the JavaScript lane tests in order");
	const verificationBytes = await readFile(join(root, lane.verification));
	const verification = JSON.parse(verificationBytes);
	assert.equal(verificationBytes.toString("utf8"), canonicalJson(verification)
		, "Hosted JavaScript verification must be canonical");
	assert.deepEqual(verification, accepted
		, "Hosted JavaScript verification must equal independent replay");
	const members = [lane.report, lane.acceptance.slice(lane.packaging.length + 1)
		, lane.verification.slice(lane.packaging.length + 1)];
	for(const entry of report.reports)
		members.push(...entry.retainedPackageSet.files.map(file =>
			`${entry.retainedPackageSet.path}/${file}`));
	assert.deepEqual(await regularFiles(packagingRoot), members.toSorted()
		, "Hosted JavaScript output must contain exactly the retained package evidence");
	return {
		schemaVersion: 1, kind: "owned-checked-record-hosted-replay"
		, lane: "javascript", producerCommit: producer
		, reportSha256: sha256(reportBytes)
		, acceptanceLogSha256: sha256(Buffer.from(acceptance))
		, tests: tap.tests.length, routes: accepted.routes
	};
};

const digestPattern = /^[a-f0-9]{64}$/u;
const phpWasmReportKeys = Object.freeze(["cliAdmission", "compiledLean"
	, "installedCli", "installedPackage", "mode", "observations", "profile"
	, "runtimeIdentity", "runtimeManifest", "runtimeSupplied", "schemaVersion"]);
const phpWasmObservationKeys = Object.freeze(["authorRemoved", "browser"
	, "cliBuild", "consumerSha256", "deterministicReassembly", "executions"
	, "handoffRemoved", "independentlyRebuiltExactly", "inputs", "installed"
	, "model", "observer", "packageReceipt", "packageSetReceipt", "receipt"
	, "receiptVerifiedWithoutProducer", "rejected", "repeatedCliBuild"
	, "reproducedArchives", "reviewed", "runnerSha256", "sourceFreeInstallation"
	, "sourceUnchanged", "verification"]);
const phpWasmFlags = Object.freeze(["authorRemoved", "deterministicReassembly"
	, "handoffRemoved", "independentlyRebuiltExactly"
	, "receiptVerifiedWithoutProducer", "sourceFreeInstallation"
	, "sourceUnchanged"]);
const phpWasmArrangements = Object.freeze(["embedded", "composer"]);
const phpWasmChromiumCells = Object.freeze(["startup", "lazy"]
	.flatMap(loading => ["weak", "strict"]
		.map(mode => `chromium/bundled/${loading}/${mode}`)));
const phpWasmRuntimeKeys = Object.freeze(["compiler", "files", "inputs"
	, "library", "pins", "pointerBits", "profile", "schemaVersion"]);
const phpWasmNodeCells = Object.freeze(phpWasmArrangements.flatMap(arrangement =>
	["startup", "lazy"].flatMap(loading => [0, 1].map(strict =>
		`${arrangement}/${loading}/${strict}`))));
const phpWasmArchives = "packages/php-wasm/archives";

/**
 * Check one installed PHP-Wasm execution against its mode's exact claims.
 *
 * @param label - Mode, author and cell used in diagnostics.
 * @param run - One Node or Chromium execution record.
 * @param mode - Full or result-only owned checked-record mode.
 */
const checkPhpWasmRun = (label, run, mode) => {
	assert.equal(run.observed.ownedCheckedRecord, true, label);
	assert.equal(run.observed.mode, mode, label);
	if(mode === "full") assert.equal(run.observed.heldOriginalError, true, label);
	assert.equal(run.observed.phpBits, 32, label);
	assert.ok(Number.isSafeInteger(run.observed.checks)
		&& run.observed.checks >= (mode === "full" ? 101 : 4), label);
	assert.equal(run.requestRecovery, true, label);
	for(const state of [run.cleaned, run.refreshed])
	{
		assert.equal(state.liveIdentities, 0, label);
		assert.equal(state.runtimeInitRuns, 1, label);
	}
	return run.observed.checks;
};

/**
 * Require the compiled PHP-Wasm model each author actually installed.
 *
 * @param label - Mode and author used in diagnostics.
 * @param observation - One author's installed observation.
 * @param mode - Full or result-only owned checked-record mode.
 * @param lean - Original Lean fixture bytes at the producer revision.
 * @param corpus - Contract selected from the producer's original full caller.
 */
const checkPhpWasmModel = (label, observation, mode, lean, corpus) => {
	const { model, inputs } = observation;
	const resultOnly = mode === "result-only";
	assert.equal(model.pointerBits, 32, label);
	assert.equal(model.schemaVersion, resultOnly ? 6 : 8, label);
	assert.equal(model.ownedGraph.transport, "owned-zend-v1", label);
	assertOwnedCheckedRecordPhpWasmModelCorpus(model, mode, corpus, label);
	if(resultOnly)
	{
		assert.equal(model.ownedGraph.inputTransfers, undefined, label);
		assert.equal(model.ownedGraph.hostCallbacks, undefined, label);
	}
	else
	{
		assert.equal(model.ownedGraph.hostCallbacks.signatures.length, 2, label);
	}
	assert.equal(Boolean(model.sourceIdentity.reviewedBindingIr)
		, observation.reviewed, label);
	assert.deepEqual(inputs.sourceIdentity, model.sourceIdentity, label);
	assert.deepEqual(inputs.component, model.component, label);
	assert.equal(inputs.sourceIdentity.modules.find(module =>
		module.module === "OwnedCheckedRecords")?.source.sha256, sha256(lean)
	, `${label}: compiled Lean source`);
};

/**
 * Verify one retained PHP-Wasm handoff against the observation that names it.
 *
 * @param lane - PHP-Wasm hosted lane contract.
 * @param packagingRoot - Extracted packaging directory.
 * @param mode - Full or result-only owned checked-record mode.
 * @param observation - One author's installed observation.
 * @param handoffName - Primary or independently owned peer receipt directory.
 */
const checkPhpWasmPackageSet = async (lane, packagingRoot, mode, observation, handoffName = "handoff") => {
	const author = observation.reviewed ? "reviewed" : "ordinary";
	const label = `${mode}/${author}`;
	assert.ok(["handoff", "checked-peer-handoff"].includes(handoffName));
	const path = `${lane.evidence}/${mode}/${author}/${handoffName}`;
	const root = join(packagingRoot, path);
	const { receipt, result } = await readVerifiedPackageSetReceipt({
		receiptPath: join(root, packageSetReceiptName)
	});
	const artifacts = receipt.packages.flatMap(pkg => pkg.artifacts);
	const files = [packageSetReceiptName, `${packageSetReceiptName}.sha256`
		, ...artifacts.map(artifact => artifact.path)].toSorted();
	assert.deepEqual(await regularFiles(root), files
		, `${label}: retained evidence must be exactly the receipt-named set`);
	assert.deepEqual([...new Set(receipt.packages.map(pkg => pkg.target))]
		, [...lane.targets], `${label}: package targets`);
	assert.deepEqual(observation.packageSetReceipt, receipt
		, `${label}: installed receipt`);
	assert.deepEqual(receipt.component, observation.model.component
		, `${label}: installed component identity`);
	const profile = { id: "php-wasm-copied-v1"
		, bindingIrSha256: observation.model.bindingIrSha256
		, runtimeIdentity: observation.receipt.runtimeIdentity };
	assert.deepEqual(receipt.profiles, [profile]
		, `${label}: installed runtime profile`);
	assert.deepEqual(receipt.packages.map(pkg =>
		`${pkg.ecosystem}/${pkg.role}`).toSorted()
	, ["composer/api", "npm/component", "npm/runtime"]
	, `${label}: installed npm and Composer roles`);
	for(const pkg of receipt.packages)
	{
		assert.equal(pkg.profile, profile.id, `${label}: package profile`);
		assert.equal(pkg.runtimeIdentity, profile.runtimeIdentity
			, `${label}: package runtime`);
	}
	const archives = observation.packageReceipt.archives;
	assert.ok(Array.isArray(archives) && archives.length > 0, label);
	assert.deepEqual(artifacts.map(artifact => artifact.path).toSorted()
		, archives.map(item => `${phpWasmArchives}/${item.archive}`).toSorted()
		, `${label}: receipt must name exactly the verified package archives`);
	for(const item of archives)
	{
		const artifact = artifacts.find(entry =>
			entry.path === `${phpWasmArchives}/${item.archive}`);
		assert.deepEqual({ bytes: artifact.bytes, sha256: artifact.sha256 }
			, { bytes: item.bytes, sha256: item.sha256 }, `${label}: ${item.archive}`);
	}
	assert.deepEqual(observation.reproducedArchives, archives
		, `${label}: independent rebuild must reproduce every archive`);
	const archiveBytes = artifacts.reduce((total, artifact) =>
		total + artifact.bytes, 0);
	return { path, receiptSha256: result.receiptSha256
		, archives: result.archives, archiveBytes, packages: result.packages
		, files };
};

/**
 * Check every Node cell and Chromium arrangement one author executed.
 *
 * @param label - Mode and author used in diagnostics.
 * @param observation - One author's installed observation.
 * @param mode - Full or result-only owned checked-record mode.
 */
const checkPhpWasmExecutions = (label, observation, mode) => {
	assert.deepEqual(observation.executions.map(run =>
		`${run.arrangement}/${run.loading}/${run.strict}`), [...phpWasmNodeCells]
	, `${label}: every installed Node cell in order`);
	const node = observation.executions.map(run => {
		const cell = `${label}/${run.arrangement}/${run.loading}/${run.strict}`;
		assert.equal(run.invalidStayedCold, true, cell);
		assert.equal(run.libraries.length, 2, cell);
		assert.equal(new Set(run.libraries).size, 2, cell);
		return checkPhpWasmRun(cell, run, mode);
	});
	const { browser } = observation;
	assert.match(browser.bundleSha256, digestPattern, label);
	assert.deepEqual(browser.observations.map(item => item.arrangement)
		, [...phpWasmArrangements], `${label}: both Chromium arrangements`);
	assert.equal(new Set(browser.observations.map(item =>
		`${item.version}/${item.executableSha256}`)).size, 1
	, `${label}: one Chromium build for both arrangements`);
	const chromium = browser.observations.flatMap(item => {
		assert.match(item.sourceSha256, digestPattern, label);
		assert.ok(typeof item.version === "string" && item.version.length > 0, label);
		assert.match(item.executableSha256, digestPattern, label);
		assert.deepEqual(item.executions.map(run =>
			`${run.realm}/${run.arrangement}/${run.loading}/${run.mode}`)
		, [...phpWasmChromiumCells]
		, `${label}/${item.arrangement}: every Chromium cell in order`);
		return item.executions.map(run => {
			const cell = `${label}/chromium/${item.arrangement}/${run.loading}/${run.mode}`;
			assert.deepEqual(run.phases.map(phase => phase.stage)
				, ["ready", "autoload", "invalid", "complete", "recovered"], cell);
			assert.deepEqual(run.phases.map(phase => phase.libraries.length)
				, run.loading === "lazy" ? [0, 0, 0, 2, 2] : [2, 2, 2, 2, 2], cell);
			return checkPhpWasmRun(cell, run, mode);
		});
	});
	return { node, chromium };
};

const phpWasmFileIdentity = value => value && typeof value === "object"
	&& !Array.isArray(value)
	&& canonicalJson(Object.keys(value).toSorted()) === canonicalJson(["bytes", "sha256"])
	&& Number.isSafeInteger(value.bytes) && value.bytes >= 0
	&& typeof value.sha256 === "string" && digestPattern.test(value.sha256);
const phpWasmRuntimeHeaders = Object.freeze(["lean.h", "lean_gmp.h"
	, "lean_libuv.h", "config.h", "version.h"]);
const phpWasmRuntimeMembers = Object.freeze(["include/lean/lean.h"
	, "include/lean/config.h", "include/lean_bridge_native_runtime.h"]);
const phpWasmRuntimeInputMembers = Object.freeze(["cmake/lib/lean/libInit.a"
	, "cmake/lib/lean/libleanrt.a", "source/.lean-wasm-patched"]);

/**
 * Require exactly the runtime manifest record that the producer's
 * copied-runtime reader accepts, and bind its identity to the exact
 * manifest bytes. Only the recorded manifest is validated; no retained
 * runtime path is opened and nothing is rebuilt.
 *
 * @param identity - Reported runtime identity.
 * @param manifest - Reported runtime manifest.
 * @param producer - Full producer revision supplying profile, pins and compiler files.
 */
const checkPhpWasmRuntime = async (identity, manifest, producer) => {
	const artifacts = "src/build/php-wasm-copied-artifacts.mjs";
	const { phpWasmCopiedCompilerFiles, phpWasmCopiedPins, phpWasmCopiedProfile }
		= await moduleAtProducerWithSourceReads(producer, artifacts);
	assert.match(identity, digestPattern, "PHP-Wasm runtime identity");
	assert.equal(identity, sha256(canonicalJson(manifest))
		, "PHP-Wasm runtime identity must hash its exact manifest");
	assert.deepEqual(Object.keys(manifest).toSorted(), [...phpWasmRuntimeKeys]
		, "PHP-Wasm runtime manifest fields");
	assert.equal(manifest.schemaVersion, 1);
	assert.equal(manifest.profile, phpWasmCopiedProfile, "PHP-Wasm runtime profile");
	assert.equal(manifest.pointerBits, 32, "PHP-Wasm runtime pointer width");
	assert.deepEqual(manifest.pins, phpWasmCopiedPins, "PHP-Wasm runtime pins");
	const { profile, pins, compiler, inputs } = manifest;
	assert.deepEqual(Object.keys(compiler).toSorted()
		, ["emsdkCommit", "files", "version"], "PHP-Wasm compiler identity fields");
	assert.equal(compiler.emsdkCommit, phpWasmCopiedPins.emsdkCommit
		, "PHP-Wasm compiler emsdk commit");
	const release = ` ${phpWasmCopiedPins.emscriptenVersion} (${phpWasmCopiedPins.emscriptenCommit})`;
	assert.ok(typeof compiler.version === "string"
		&& compiler.version.endsWith(release), "PHP-Wasm compiler version");
	assert.deepEqual(Object.keys(compiler.files).toSorted()
		, [...phpWasmCopiedCompilerFiles].toSorted(), "PHP-Wasm compiler files");
	for(const [path, item] of Object.entries(compiler.files))
		assert.ok(phpWasmFileIdentity(item) && item.bytes > 0
			, `PHP-Wasm compiler file identity: ${path}`);
	assert.deepEqual(Object.keys(inputs).toSorted()
		, ["brokerSha256", "files", "libuvSha256"], "PHP-Wasm runtime inputs");
	for(const key of ["brokerSha256", "libuvSha256"])
		assert.match(inputs[key], digestPattern, `PHP-Wasm runtime input ${key}`);
	assert.ok(inputs.files && typeof inputs.files === "object"
		&& !Array.isArray(inputs.files), "PHP-Wasm runtime input files");
	for(const [path, item] of Object.entries(inputs.files))
		assert.ok(phpWasmFileIdentity(item)
			, `PHP-Wasm runtime input identity: ${path}`);
	const key = sha256(canonicalJson({ profile, pins, compiler, inputs }))
		.slice(0, 20);
	assert.equal(manifest.library, `lib/liblean_bridge_php_wasm_copied_${key}.so`
		, "PHP-Wasm runtime library must name its build inputs");
	for(const [path, item] of Object.entries(manifest.files))
		assert.ok(phpWasmFileIdentity(item), `PHP-Wasm runtime file identity: ${path}`);
	for(const path of [manifest.library, ...phpWasmRuntimeMembers])
		assert.ok(Object.hasOwn(manifest.files, path)
			, `PHP-Wasm runtime member: ${path}`);
	for(const name of phpWasmRuntimeHeaders)
		assert.deepEqual(manifest.files[`include/lean/${name}`]
			, inputs.files[`cmake/include/lean/${name}`]
			, `PHP-Wasm runtime header ${name} must match its target build`);
	for(const path of phpWasmRuntimeInputMembers)
		assert.ok(Object.hasOwn(inputs.files, path)
			, `PHP-Wasm runtime input member: ${path}`);
};

/**
 * Replay the PHP-Wasm lane: one acceptance log, two runtime logs, the
 * aggregate and per-mode reports, and one retained handoff per mode and
 * author. Nothing here is inferred from native PHP evidence.
 *
 * @param lane - PHP-Wasm hosted lane contract.
 * @param root - Extracted original artifact root.
 * @param producer - Full producer revision named by the hosted run.
 * @param original - Reader of committed source bytes at `producer`.
 */
const replayPhpWasm = async (lane, root, producer, original) => {
	const contexts = requiresOwnedCheckedRecordPhpWasmContexts(original);
	const contextGenerator = contexts
		? await moduleAtProducerWithSourceReads(producer, ownedCheckedRecordPhpWasmContextModule) : null;
	const corpus = ownedCheckedRecordPhpWasmCorpus(original(
		"tests/fixtures/structured-types/owned-checked-record-php-wasm.php"));
	const packagingRoot = join(root, lane.packaging);
	const reportPath = `${lane.packaging}/${lane.report}`;
	const reportBytes = await readFile(join(root, reportPath));
	const report = JSON.parse(reportBytes);
	assert.equal(reportBytes.toString("utf8"), canonicalJson(report)
		, "Hosted report must be canonical");
	assert.deepEqual(Object.keys(report).toSorted()
		, ["profile", "reports", "schemaVersion"]);
	assert.equal(report.schemaVersion, 1);
	assert.equal(report.profile, lane.reportProfile);
	assert.deepEqual(report.reports.map(entry => entry.mode), [...lane.modes]);
	const acceptance = await readFile(join(root, lane.acceptance), "utf8");
	const tap = parseOwnedCheckedRecordTap(acceptance);
	assert.deepEqual(tap.tests, ownedCheckedRecordHostedTestNames(lane)
		, "Acceptance TAP must contain exactly the PHP-Wasm lane tests in order");
	const lean = original(
		"tests/fixtures/onboarding/owned-checked-records/OwnedCheckedRecords.lean");
	for(const log of lane.logs)
	{
		const text = await readFile(join(root, log), "utf8").catch(error =>
			assert.fail(`${log} is a required hosted log (${error.code})`));
		assert.ok(text.trim().length > 0, `${log} must retain the hosted build output`);
	}
	const members = [lane.acceptance, ...lane.logs, reportPath];
	const routes = new Map(), runtimes = new Set();
	for(const [index, mode] of lane.modes.entries())
	{
		const modePath = `${lane.packaging}/${mode}.json`;
		const modeBytes = await readFile(join(root, modePath));
		const entry = JSON.parse(modeBytes);
		assert.equal(modeBytes.toString("utf8"), canonicalJson(entry)
			, `${mode}: report must be canonical`);
		assert.deepEqual(report.reports[index], entry
			, `${mode}: aggregate must equal the per-mode report`);
		members.push(modePath);
		assert.deepEqual(Object.keys(entry).toSorted(), [...phpWasmReportKeys]
			, `${mode}: exact report fields`);
		assert.equal(entry.schemaVersion, 1);
		assert.equal(entry.profile, `${lane.reportProfile}-${mode}`);
		for(const key of ["cliAdmission", "compiledLean", "installedPackage", "runtimeSupplied"])
			assert.equal(entry[key], true, `${mode}: ${key}`);
		assert.equal(entry.installedCli.packagingSourceRemoved, true, mode);
		await checkPhpWasmRuntime(entry.runtimeIdentity, entry.runtimeManifest
			, producer);
		runtimes.add(canonicalJson({ identity: entry.runtimeIdentity
			, manifest: entry.runtimeManifest }));
		assert.deepEqual(entry.observations.map(item => item.reviewed)
			, [false, true], `${mode}: ordinary then reviewed authors`);
		const consumer = sha256(original("tests/fixtures/structured-types/"
			+ `owned-checked-record-${mode === "result-only" ? "result-only-" : ""}php-wasm.php`));
		const runners = new Set();
		for(const observation of entry.observations)
		{
			const author = observation.reviewed ? "reviewed" : "ordinary";
			const label = `${mode}/${author}`;
			assert.deepEqual(Object.keys(observation).toSorted()
				, [...phpWasmObservationKeys, ...contexts ? ["crossRuntime"] : []].sort()
				, `${label}: exact observation fields`);
			for(const key of phpWasmFlags)
				assert.equal(observation[key], true, `${label}: ${key}`);
			assert.equal(observation.consumerSha256, consumer
				, `${label}: consumer source`);
			assert.match(observation.runnerSha256, digestPattern, label);
			runners.add(observation.runnerSha256);
			checkPhpWasmModel(label, observation, mode, lean, corpus);
			assert.equal(observation.receipt.runtimeIdentity, entry.runtimeIdentity
				, `${label}: component receipt runtime`);
			for(const build of [observation.cliBuild, observation.repeatedCliBuild])
			{
				assert.equal(build.status, "ok", label);
				assert.deepEqual(build.result.targets, [...lane.targets], label);
			}
			assert.equal(observation.verification.status, "ok", label);
			assert.equal(observation.verification.result.verificationType
				, "local-package-set", label);
			assert.ok(Array.isArray(observation.rejected)
				&& observation.rejected.length > 0, `${label}: drift controls`);
			const { files, ...retained } = await checkPhpWasmPackageSet(
				lane, packagingRoot, mode, observation);
			members.push(...files.map(file =>
				`${lane.packaging}/${retained.path}/${file}`));
			if(contexts)
			{
				checkOwnedCheckedRecordPhpWasmContextsEvidence(observation.crossRuntime,
					observation, mode, original, contextGenerator);
				const peer = await checkPhpWasmPackageSet(lane, packagingRoot, mode,
					observation.crossRuntime.peer, "checked-peer-handoff");
				members.push(...peer.files.map(file => `${lane.packaging}/${peer.path}/${file}`));
			}
			routes.set(`${author}-${mode}`, { route: `${author}-${mode}`
				, ...retained, checks: checkPhpWasmExecutions(label, observation, mode) });
		}
		assert.equal(runners.size, 1, `${mode}: one installed runner for both authors`);
	}
	assert.equal(runtimes.size, 1
		, "Both modes must execute the same pinned PHP-Wasm runtime");
	assert.deepEqual(await regularFiles(root), members.toSorted()
		, "Hosted PHP-Wasm output must contain exactly the logs, reports and retained package sets");
	return {
		schemaVersion: 1, kind: "owned-checked-record-hosted-replay"
		, lane: "php-wasm", producerCommit: producer
		, reportSha256: sha256(reportBytes)
		, acceptanceLogSha256: sha256(Buffer.from(acceptance))
		, tests: tap.tests.length
		, routes: ownedCheckedRecordHostedRoutes.map(route => routes.get(route))
	};
};

const checkObservations = ({ lane, entry, shape, diagnostics, source }) => {
	const route = entry.route;
	if(lane.kind === "native")
	{
		const lines = diagnostics.filter(line => line.startsWith(`{"route":"${route}",`));
		assert.equal(lines.length, 1, `${route}: one native summary diagnostic`);
		const summary = JSON.parse(lines[0]);
		assert.deepEqual(Object.keys(summary), ["route", "c", "cpp", "sanitizer"]);
		assert.deepEqual(Object.keys(entry.observed).toSorted(), ["c", "cpp"]);
		assert.deepEqual(Object.keys(entry.relocated).toSorted(), ["c", "cpp"]);
		for(const profile of ["c", "cpp"])
		{
			const observed = entry.observed[profile];
			assert.ok(positive(observed.checks), `${route}/${profile}`);
			assert.equal(summary[profile], observed.checks, `${route}/${profile}`);
			if(shape.resultOnly)
				assert.equal(observed.checks, profile === "c" ? 14 : 3);
			const digest = sha256(source(profile));
			assert.equal(observed.consumerSha256, digest, `${route}/${profile}`);
			assert.equal(entry.relocated[profile].sourceSha256, digest
				, `${route}/${profile}`);
		}
		assert.equal(summary.sanitizer, !shape.resultOnly, route);
		assert.equal(Boolean(entry.relocated.cpp.sanitizer), !shape.resultOnly
			, route);
		assert.deepEqual(entry.lifecycle, { c: "manual-owner-release"
			, cpp: shape.resultOnly ? "raii" : "raii-plus-sanitizers" });
		return { c: entry.observed.c.checks, cpp: entry.observed.cpp.checks };
	}
	if(lane.kind === "perl")
	{
		const lines = diagnostics.filter(line => line.startsWith(`{"route":"${route}",`))
			.map(line => JSON.parse(line));
		assert.equal(entry.lifecycle, "perl-destruction-plus-explicit-close");
		assert.equal(entry.consumerSha256, sha256(source("perl")), route);
		assert.ok(Array.isArray(entry.observations));
		assert.equal(entry.observations.length, 8, `${route}: four ABIs, two modes`);
		assert.equal(new Set(entry.observations.map(item => item.perl)).size, 4);
		const cells = entry.observations.map(item => {
			assert.ok(["prebuilt-only", "build-xs"].includes(item.mode), item.mode);
			assert.equal(item.runtimeOnlyRuns, 2);
			assert.ok(positive(item.observed.checks));
			return { route, perl: item.perl, mode: item.mode
				, checks: item.observed.checks };
		});
		assert.equal(new Set(cells.map(cell => `${cell.perl}/${cell.mode}`)).size, 8);
		for(const line of lines)
			assert.deepEqual(Object.keys(line), ["route", "perl", "mode", "checks"]);
		const order = cell => canonicalJson(cell);
		assert.deepEqual(lines.map(order).toSorted(), cells.map(order).toSorted()
			, `${route}: Perl diagnostics must match every observation`);
		return Object.fromEntries(cells.map(cell =>
			[`${cell.perl}/${cell.mode}`, cell.checks]));
	}
	const profiles = lane.profiles;
	const label = lane.kind === "managed" ? `${lane.group}/${route}` : route;
	assert.deepEqual(entry.profiles, profiles);
	assert.deepEqual(Object.keys(entry.observations).toSorted()
		, [...profiles].toSorted());
	const checks = {};
	for(const profile of profiles)
	{
		const observed = entry.observations[profile];
		assert.ok(positive(observed.checks), `${label}/${profile}`);
		if(shape.resultOnly && lane.kind === "language")
			assert.equal(observed.checks, lane.resultOnlyChecks[profile]);
		if(shape.resultOnly && lane.kind === "managed" && profile !== "wit-wasi")
			assert.equal(observed.checks, 4);
		assert.equal(observed.consumerSha256, sha256(source(profile))
			, `${label}/${profile}`);
		checks[profile] = observed.checks;
	}
	if(lane.kind === "language")
	{
		assert.deepEqual(entry.lifecycle, lane.lifecycle);
		assert.deepEqual(Object.keys(entry.versions), profiles);
	}
	const expected = `${label}: ${profiles.map(profile =>
		`${profile}=${checks[profile]}`).join(", ")}`;
	assert.equal(diagnostics.filter(line => line === expected).length, 1
		, `${label}: one summary diagnostic`);
	assert.equal(diagnostics.filter(line => line.startsWith(`${label}: `)
		&& /=\d+(?:, |$)/u.test(line)).length, 1, `${label}: no competing summary`);
	return checks;
};

/**
 * Verify one retained package set against the report entry that names it.
 *
 * @param lane - Hosted lane contract.
 * @param packagingRoot - Extracted packaging directory.
 * @param entry - Report entry for one route.
 */
const checkRetainedPackageSet = async (lane, packagingRoot, entry) => {
	const path = `${lane.evidence}/${entry.route}/handoff`;
	assert.equal(entry.retainedPackageSet.path, path, entry.route);
	const root = join(packagingRoot, path);
	const { receipt, result } = await readVerifiedPackageSetReceipt({
		receiptPath: join(root, packageSetReceiptName)
	});
	const artifacts = receipt.packages.flatMap(pkg => pkg.artifacts);
	const files = [packageSetReceiptName, `${packageSetReceiptName}.sha256`
		, ...artifacts.map(artifact => artifact.path)].toSorted();
	assert.deepEqual(await regularFiles(root), files
		, `${entry.route}: retained evidence must be exactly the receipt-named set`);
	assert.deepEqual([...new Set(receipt.packages.map(pkg => pkg.target))]
		.toSorted(), [...lane.targets].toSorted(), `${entry.route}: package targets`);
	const archiveBytes = artifacts.reduce((total, artifact) =>
		total + artifact.bytes, 0);
	assert.deepEqual(entry.retainedPackageSet, { path
		, receiptSha256: result.receiptSha256, archives: result.archives
		, archiveBytes, files }, `${entry.route}: retained package metadata`);
	if(lane.kind === "managed")
		assert.equal(entry.packageSetReceiptSha256, sha256(canonicalJson(receipt))
			, entry.route);
	else assert.deepEqual(entry.packageSetReceipt, receipt, entry.route);
	return { path, receiptSha256: result.receiptSha256
		, archives: result.archives, archiveBytes
		, packages: result.packages };
};

/**
 * Replay a complete hosted output tree for one lane.
 *
 * @param laneName - Lane whose contract the output must satisfy.
 * @param root - Extracted original artifact root.
 * @param producer - Full producer revision named by the hosted run.
 * @param original - Reader of committed source bytes at `producer`.
 */
export const replayOwnedCheckedRecordHostedOutput = async (
	laneName, root, producer, original = path => execFileSync("git"
		, ["show", `${producer}:${path}`], { maxBuffer: 64 * 1024 ** 2 })
) => {
	assert.ok(Object.hasOwn(ownedCheckedRecordHostedLanes, laneName), laneName);
	assert.match(producer, /^[a-f0-9]{40}$/u);
	const lane = ownedCheckedRecordHostedLanes[laneName];
	if(lane.kind === "javascript")
		return replayJavaScript(lane, root, producer);
	if(lane.kind === "php-wasm")
		return replayPhpWasm(lane, root, producer, original);
	const packagingRoot = join(root, lane.packaging);
	const reportPath = `${lane.packaging}/${lane.report}`;
	const reportBytes = await readFile(join(root, reportPath));
	const report = JSON.parse(reportBytes);
	assert.equal(reportBytes.toString("utf8"), canonicalJson(report)
		, "Hosted report must be canonical");
	assert.deepEqual(Object.keys(report).toSorted(), ["profile", "reports"
		, "schemaVersion", ...lane.kind === "language" ? ["selectedProfiles"] : []
		, ...lane.kind === "managed" ? ["group"] : []].toSorted());
	assert.equal(report.schemaVersion, 1);
	assert.equal(report.profile, lane.reportProfile);
	if(lane.kind === "language")
		assert.deepEqual(report.selectedProfiles, lane.profiles);
	if(lane.kind === "managed") assert.equal(report.group, lane.group);
	assert.deepEqual(report.reports.map(entry => entry.route)
		, [...ownedCheckedRecordHostedRoutes]);
	const acceptancePath = `${lane.ci}/acceptance.log`;
	const acceptance = await readFile(join(root, acceptancePath), "utf8");
	const tap = parseOwnedCheckedRecordTap(acceptance);
	assert.deepEqual(tap.tests, ownedCheckedRecordHostedTestNames(lane)
		, "Acceptance TAP must contain exactly the lane's tests in order");
	const read = path => original(path);
	const routes = [], members = [`${lane.ci}/toolchain.log`, acceptancePath
		, reportPath];
	for(const entry of report.reports)
	{
		const shape = routeShape(entry.route);
		assert.deepEqual(Object.keys(entry).toSorted(), [...lane.keys]
			, `${entry.route}: exact report fields`);
		assert.equal(entry.authorRoute, shape.authorRoute, entry.route);
		assert.equal(entry.mode, shape.mode, entry.route);
		if(lane.kind === "managed") assert.equal(entry.group, lane.group);
		for(const key of lane.always) assert.equal(entry[key], true
			, `${entry.route}: ${key}`);
		for(const key of lane.fullOnly) assert.equal(entry[key], !shape.resultOnly
			, `${entry.route}: ${key}`);
		const retained = await checkRetainedPackageSet(lane, packagingRoot, entry);
		members.push(...entry.retainedPackageSet.files.map(file =>
			`${lane.packaging}/${retained.path}/${file}`));
		const checks = checkObservations({ lane, entry, shape
			, diagnostics: tap.diagnostics
			, source: profile => consumerSource(read, lane, profile, shape.resultOnly) });
		routes.push({ route: entry.route, ...retained, checks });
	}
	assert.deepEqual(await regularFiles(root), members.toSorted()
		, "Hosted output must contain exactly the logs, report and retained package sets");
	return {
		schemaVersion: 1, kind: "owned-checked-record-hosted-replay"
		, lane: laneName, producerCommit: producer
		, reportSha256: sha256(reportBytes)
		, acceptanceLogSha256: sha256(Buffer.from(acceptance))
		, tests: tap.tests.length, routes
	};
};
