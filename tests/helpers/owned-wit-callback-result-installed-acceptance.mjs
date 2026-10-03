/**
 * Authenticate the six source-free, relocated WIT callback-result packages.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import ts from "typescript";
import { sha256 } from "../../src/capsule/node.mjs";
import { packOwnedCallbackReports, unpackOwnedCallbackReports } from "./owned-callback-result-evidence.mjs";

const keys = (value, names) => assert.deepEqual(Object.keys(value).sort(), [...names].sort());
const digest = value => { assert.match(value, /^[a-f0-9]{64}$/u); assert.notEqual(value, "0".repeat(64)); };
const positive = value => assert.ok(Number.isSafeInteger(value) && value > 0);
const successful = (execution, stdout) => assert.deepEqual(execution, { code: 0, stderr: "", stdout });

export const installedWitCallbackEvidencePath
	= "docs/evidence/owned-wit-callback-result-packages-20261003.json";
export const installedWitCallbackEvidenceDocument
	= "docs/evidence/owned-wit-callback-result-packages-20261003.md";
export const installedWitCallbackPrevious = Object.freeze({
	path: "docs/evidence/owned-wit-callback-results-20261003.json"
	, sha256: "b4d64c091761b8c929e855b0bb9df75c3a66bba6d150f95249aa757c67a05375"
});
export const installedWitCallbackReports = Object.freeze(["ordinary", "reviewed"]
	.flatMap(mode => ["no-host", "host", "combined"].map(variant => `${mode}-${variant}.json`)));
export const installedWitCallbackCounts = Object.freeze({
	reports: 6, installedExecutions: 12, publicChecks: 1582
	, dependencyLibraries: 5, loaderReports: 12
});
export const installedWitCallbackScope = Object.freeze({
	profiles: ["wit-wasi"], sourcePaths: ["ordinary-source", "reviewed-ir"]
	, configurations: ["no-host", "host", "combined"]
	, callbackResultOwners: true, callbackResultAnchors: true
	, callbackInputTransfers: true, receiverExports: true
	, actualLean: true, actualWasmtime: true, installedPackage: true
	, sourceFreeConsumption: true, producerRemoved: true, handoffRemoved: true
	, offlineInstall: true, compilerFreeExecution: true
	, deterministicReassembly: true, pkgConfig: true, relocatedPublicReruns: true
	, alteredDependencyRejection: true, localAndGlobalLoaderChecks: true
	, retainedHostCallbacks: false, asynchronousDelivery: false
	, registryPublication: false, sharedCrossLanguageRelease: false
	, counts: installedWitCallbackCounts
});
export const installedWitCallbackCommand
	= "LEAN_BRIDGE_WIT_OWNED_CALLBACK_RESULT_PACKAGE_TEST=1 node --test --test-concurrency=1 tests/wit-owned-callback-result-packaging.test.mjs";

const closureRoots = [
	"tests/wit-owned-callback-result-packaging.test.mjs"
	, "tests/wit-owned-callback-result-installed-acceptance.test.mjs"
	, "tests/helpers/owned-wit-callback-result-installed-acceptance.mjs"
];

/** Bind the complete local verifier/build closure and its publication surfaces. */
export const installedWitCallbackSourcePaths = async () => {
	const predecessor = await readFile(installedWitCallbackPrevious.path);
	assert.equal(sha256(predecessor), installedWitCallbackPrevious.sha256);
	const paths = new Set([installedWitCallbackPrevious.path
		, installedWitCallbackEvidenceDocument
		, ".github/workflows/consumer-matrix.yml"
		, "package.json", "package-lock.json", "docs/consume/wit-wasi.md"
		, "docs/publish/wit-wasi.md", "docs/lean/existing-package.md"
		, "docs/lean/export-decisions.md"]);
	const pending = [...closureRoots], visited = new Set();
	while(pending.length)
	{
		const path = pending.pop();
		if(visited.has(path)) continue;
		visited.add(path); paths.add(path);
		const tree = ts.createSourceFile(path, await readFile(path, "utf8")
			, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
		const visit = node => {
			const specifier = ts.isImportDeclaration(node) || ts.isExportDeclaration(node)
				? node.moduleSpecifier
				: ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword
					? node.arguments[0] : null;
			if(specifier && ts.isStringLiteral(specifier) && specifier.text.startsWith("."))
				pending.push(join(dirname(path), specifier.text));
			ts.forEachChild(node, visit);
		};
		visit(tree);
	}
	assert.equal(paths.has(installedWitCallbackEvidencePath), false);
	return [...paths].sort();
};

const expectedChecks = Object.freeze({ "no-host": 149, host: 263, combined: 379 });
const expectedDependencies = Object.freeze([
	"libcomponent", "libgmp.so.10", "liblean_bridge_native.so"
	, "libleanshared.so", "libwasmtime.so"
]);

/**
 * Reconstruct one immutable installed-package observation.
 *
 * @param {string} name - Canonical report basename.
 * @param {object} item - Recorded installed-package observation.
 */
export const assertInstalledWitCallbackReport = (name, item) => {
	assert.ok(installedWitCallbackReports.includes(name));
	keys(item, ["schemaVersion", "mode", "variant", "bindingIrSha256"
		, "runtimeIdentity", "sourceSha256", "result", "relocatedResult", "executions"
		, "package", "ownedValues", "dependencies", "sourceRemoved", "producerRemoved"
		, "handoffRemoved", "offlineInstall", "compilerFreeExecution", "relocated"
		, "deterministicReassembly", "pkgConfig", "loader"]);
	const [, mode, variant] = /^(ordinary|reviewed)-(no-host|host|combined)\.json$/u.exec(name);
	assert.equal(item.schemaVersion, 1); assert.equal(item.mode, mode); assert.equal(item.variant, variant);
	for(const field of ["bindingIrSha256", "runtimeIdentity", "sourceSha256"]) digest(item[field]);
	const result = { allocationFailures: 0, checks: expectedChecks[variant], identities: 0, live: 0 };
	assert.deepEqual(item.result, result); assert.deepEqual(item.relocatedResult, result);
	keys(item.executions, ["initial", "relocated"]);
	const stdout = JSON.stringify({ checks: result.checks, allocationFailures: 0, live: 0, identities: 0 }) + "\n";
	for(const execution of Object.values(item.executions)) successful(execution, stdout);
	for(const field of ["sourceRemoved"
		, "producerRemoved"
		, "handoffRemoved"
		, "offlineInstall"
		, "compilerFreeExecution"
		, "relocated"
		, "deterministicReassembly"
		, "pkgConfig"])
		assert.equal(item[field], true, field);
	keys(item.package, ["archive", "bytes", "compilerAccess", "name", "sha256", "version"]);
	const coordinates = { name: `owned-callback-${variant}`, version: "1.2.3"
		, archive: `owned-callback-${variant}-1.2.3-wit-wasi.tar.gz`
		, compilerAccess: false };
	assert.deepEqual({ name: item.package.name, version: item.package.version
		, archive: item.package.archive
		, compilerAccess: item.package.compilerAccess }, coordinates);
	positive(item.package.bytes); digest(item.package.sha256);
	const combined = variant === "combined", hostCallbacks = variant !== "no-host";
	keys(item.ownedValues, ["schemaVersion"
		, "hostCallbacks"
		, "callbackResultAnchors"
		, "headerSha256", "sourceSha256"
		, ...combined ? ["inputTransfers", "resultAnchors", "receiverExports"] : []]);
	assert.equal(item.ownedValues.schemaVersion, 5);
	for(const field of ["headerSha256", "sourceSha256"]) digest(item.ownedValues[field]);
	const anchors = item.ownedValues.callbackResultAnchors;
	keys(anchors, ["schemaVersion"
		, "ownership"
		, "lifetime"
		, "anchor"
		, "descendants"
		, "expiration", "independentOwnership", "hostResultHandoff", "maximumDepth"
		, "validation", "signatures"]);
	assert.deepEqual({ schemaVersion: anchors.schemaVersion
		, ownership: anchors.ownership
		, lifetime: anchors.lifetime
		, anchor: anchors.anchor
		, descendants: anchors.descendants
		, expiration: anchors.expiration
		, independentOwnership: anchors.independentOwnership
		, hostResultHandoff: anchors.hostResultHandoff
		, maximumDepth: anchors.maximumDepth
		, validation: anchors.validation }, { schemaVersion: 1, ownership: "borrow"
		, lifetime: "parameter"
		, anchor: "original-argument-owner"
		, descendants: "transitive"
		, expiration: "owner-release-or-transfer"
		, independentOwnership: "explicit-retain-or-copy"
		, hostResultHandoff: "before-callback-frame-expires", maximumDepth: 128
		, validation: "generation-and-owner-tree" });
	assert.equal(anchors.signatures.length, 4);
	for(const signature of anchors.signatures)
	{ keys(signature, ["id", "parameter"]); assert.match(signature.id, /^bridge:Callback[a-f0-9]{20}$/u); assert.ok([0, 1].includes(signature.parameter)); }
	if(hostCallbacks)
	{
		keys(item.ownedValues.hostCallbacks, ["schemaVersion", "lifetime", "recovery", "signatures", "trampolineSha256"]);
		assert.equal(item.ownedValues.hostCallbacks.schemaVersion, 1);
		assert.equal(item.ownedValues.hostCallbacks.lifetime, "call");
		assert.equal(item.ownedValues.hostCallbacks.recovery, "typed-value-v1");
		assert.equal(item.ownedValues.hostCallbacks.signatures.length, 6);
		digest(item.ownedValues.hostCallbacks.trampolineSha256);
	}
	else assert.equal(item.ownedValues.hostCallbacks, null);
	if(combined)
	{
		assert.equal(item.ownedValues.inputTransfers.schemaVersion, 1);
		assert.equal(item.ownedValues.resultAnchors.schemaVersion, 2);
		assert.equal(item.ownedValues.receiverExports.schemaVersion, 1);
	}
	assert.equal(item.dependencies.length, 5);
	assert.deepEqual(item.dependencies.map(value => value.name.replace(/^libcomponent_[a-f0-9]{20}\.so$/u, "libcomponent"))
		, expectedDependencies);
	for(const dependency of item.dependencies)
	{ keys(dependency, ["name", "bytes", "sha256"]); positive(dependency.bytes); digest(dependency.sha256); }
	if(mode === "reviewed" && combined)
	{
		keys(item.loader, ["sourceSha256", "executableSha256", "reports"]);
		digest(item.loader.sourceSha256); digest(item.loader.executableSha256);
		assert.equal(item.loader.reports.length, 12);
		assert.deepEqual(item.loader.reports.slice(0, 2).map(report => report.visibility), ["local", "global"]);
		assert.ok(item.loader.reports.slice(0, 2).every(report => report.compatibleAndFork === true && report.conflict === false));
		assert.ok(item.loader.reports.slice(2).every(report => report.conflict === true));
		assert.deepEqual(item.loader.reports.slice(2).map(report => report.tamperedDependency)
			, item.dependencies.flatMap(value => [value.name, value.name]));
	}
	else assert.equal(item.loader, null);
};

/**
 * Require exact TAP for one successful sequential six-case producer run.
 *
 * @param {string} text - Original complete TAP bytes.
 * @param {object} reports - Six reconstructed reports by canonical basename.
 */
export const assertInstalledWitCallbackLog = (text, reports) => {
	const lines = text.split("\n"); assert.equal(lines.pop(), ""); let cursor = 0;
	const line = expected => assert.equal(lines[cursor++], expected, `package TAP line ${cursor}`);
	const duration = prefix => {
		const value = lines[cursor++]; assert.ok(value.startsWith(prefix));
		assert.match(value.slice(prefix.length), /^(?:0|[1-9]\d*)(?:\.\d+)?$/u);
		assert.ok(Number(value.slice(prefix.length)) > 0);
	};
	line("TAP version 13");
	for(const [index, name] of installedWitCallbackReports.entries())
	{
		const item = reports[name], title = `installed WIT callback results (${item.mode}, ${item.variant}) survive source removal and relocation`;
		line(`# Subtest: ${title}`); line(`ok ${index + 1} - ${title}`);
		line("  ---"); duration("  duration_ms: "); line("  type: 'test'"); line("  ...");
		line(`# ${item.mode} ${item.variant}: Compiling checked native Lean exports`);
		line(`# ${item.mode} ${item.variant}: ${item.result.checks} installed public checks passed before and after relocation`);
	}
	for(const value of ["1..6", "# tests 6", "# suites 0", "# pass 6", "# fail 0"
		, "# cancelled 0", "# skipped 0", "# todo 0"]) line(value);
	duration("# duration_ms "); assert.equal(cursor, lines.length);
};

/**
 * Validate the frozen installed acceptance without retained build directories.
 *
 * @param {object} record - Candidate installed acceptance receipt.
 */
export const assertInstalledWitCallbackAcceptance = async record => {
	keys(record, ["schemaVersion"
		, "kind"
		, "planNode"
		, "acceptance"
		, "implementationRevision"
		, "previous", "scope", "sources", "log", "archive"]);
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "owned-wit-callback-result-packages");
	assert.equal(record.planNode, 1219); assert.equal(record.acceptance, "passed");
	assert.equal(record.implementationRevision, "3c06ada4d719597316d28b3f57bb5dbaa8104116");
	assert.deepEqual(record.previous, installedWitCallbackPrevious);
	assert.deepEqual(record.scope, installedWitCallbackScope);
	assert.equal(sha256(await readFile(record.previous.path)), record.previous.sha256);
	assert.deepEqual(Object.keys(record.sources), await installedWitCallbackSourcePaths());
	for(const [path, identity] of Object.entries(record.sources))
		assert.equal(sha256(await readFile(path)), identity, path);
	const reports = unpackOwnedCallbackReports(record.archive);
	keys(reports, installedWitCallbackReports);
	for(const name of installedWitCallbackReports) assertInstalledWitCallbackReport(name, reports[name]);
	assert.equal(new Set(Object.values(reports).map(item => item.runtimeIdentity)).size, 1);
	for(const variant of ["no-host", "host", "combined"])
	{
		const selected = installedWitCallbackReports.filter(name => reports[name].variant === variant);
		assert.equal(new Set(selected.map(name => reports[name].sourceSha256)).size, 1);
	}
	assert.equal(Object.values(reports).reduce((sum, item) => sum + item.result.checks, 0), 1582);
	keys(record.log, ["command", "sha256", "text"]);
	assert.equal(record.log.command, installedWitCallbackCommand);
	assert.equal(record.log.sha256, sha256(record.log.text));
	assertInstalledWitCallbackLog(record.log.text, reports);
	assert.deepEqual(record.archive, packOwnedCallbackReports(reports));
};
