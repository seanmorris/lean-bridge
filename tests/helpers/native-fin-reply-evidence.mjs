/**
 * Authenticate the archived host reply evidence (VO #1453): the source-free installed C/C++ run, its
 * fresh Lean source gate, the separate generated-wrapper sanitizer run and every failed installed attempt.
 * Validators take archived bytes only; they never open producer paths or Git objects.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { sha256 } from "../../src/capsule/node.mjs";

export const finReplyArchiveDirectory = "docs/evidence/native-fin-replies-20261008";
export const finReplyInstalledRevision = "5459b7fbdd7d60e9e4411daae1ea8ba8b3febaec";
export const finReplyWrapperRevision = "65f7dd7e442236e9ad2cfcdd932bba092b09a2b8";
export const finReplyFailedRevisions = Object.freeze({
	a65a937: "a65a937a7b1a4652ba623b84121786a44351ccad"
	, "0dffe44": "0dffe4486ca3c426ee08d1c83d6ea9621b8c4d50"
	, c02c760: "c02c760e18b6f9046fd95ac817358d52b57490e9"
});

/** Original producer outputs, relative to the producing checkout, with the digests posted at each terminal state. */
export const finReplyOriginals = Object.freeze({
	"installed.json": { original: "build/vo1453-fin-replies-installed-5459b7f.json", sha256: "0e2099292d2826d5b8ab3104a592d0a197c0a1a237c249a109129311049f9e3d" }
	, "installed.tap": { original: "build/vo1453-fin-replies-installed-5459b7f.tap", sha256: "25ab545a1c136ea58406b9236ab3981c9269bb7b042f923f060ca746523c8e48" }
	, "installed.queue": { original: "build/vo1453-fin-replies-installed-5459b7f.queue", sha256: "90333e1332f1c1abf510da0a20f2d7dce5ca73407bed448b9e9ab2b6cc58784c" }
	, "fresh-lean.tap": { original: "build/vo1453-fresh-lean-replies-10-5459b7f.txt", sha256: "fbf8cc113b04ca71db40b5aa4706b3287874b8a87b85aef2ca3a50bd5273e936" }
	, "wrapper.json": { original: "build/vo1453-fin-replies-65f7dd7-report.json", sha256: "2848189bddc5ba2d1424cde517bb0ab3c1add073e434a0ea55adeb8e8d849b18" }
	, "wrapper.tap": { original: "build/vo1453-fin-replies-65f7dd7.tap", sha256: "dd4cbdc1e18928922fcc144a7a397ed9729a4fb812146d0c934b0506631f512e" }
	, "wrapper.queue": { original: "build/vo1453-fin-replies-65f7dd7-queue.json", sha256: "f5f3115c7411256bcd3bf69336e60d6bfedb2244c835c7c03d13be49ec24c968" }
	, "failed/a65a937.queue": { original: "build/vo1453-fin-replies-installed-a65a937.queue", sha256: "83bb49f3207ff3516d971450f0dce7c9c445883e0ee7737f15913d4d7ba94bed" }
	, "failed/a65a937.tap": { original: "build/vo1453-fin-replies-installed-a65a937.tap", sha256: "2b267dd737943b0c4a5df62659e8867ebe8db38ae9dc9963979b777f5172db87" }
	, "failed/a65a937.c-failure.json": { original: "build/vo1453-fin-replies-installed-a65a937.json.c.failure.json", sha256: "14fd3b166e863f74df8b6283dabcfa83c2eb841b6fda3a0f74ebe33c251cc743" }
	, "failed/0dffe44.queue": { original: "build/vo1453-fin-replies-installed-0dffe44.queue", sha256: "9ca57364903478986bb91d31ee6672feb23ad764fa52ff103253136e4389a94b" }
	, "failed/0dffe44.tap": { original: "build/vo1453-fin-replies-installed-0dffe44.tap", sha256: "9787e1fae967d2cefc6a37bdea12e99994295c46299986a635365ea447715cf8" }
	, "failed/0dffe44.c-failure.json": { original: "build/vo1453-fin-replies-installed-0dffe44.json.c.failure.json", sha256: "b7bb50190210feaf971290dc12805fad95dd8487fe83c5b90a58d68ea365e574" }
	, "failed/c02c760.queue": { original: "build/vo1453-fin-replies-installed-c02c760.queue", sha256: "14fc9132bf63ca5a6dd3365a2ae7e17acfd0b52cda767c6491c7af0f8758acd4" }
	, "failed/c02c760.tap": { original: "build/vo1453-fin-replies-installed-c02c760.tap", sha256: "c0b857d7e159889b46eeb2081329b38c489151e0e9d9bc3d2dc03a869cf83fe3" }
	, "failed/c02c760.cpp-failure.json": { original: "build/vo1453-fin-replies-installed-c02c760.json.cpp.failure.json", sha256: "b0b6409a57fbfdfa1538439dd0eb4b3021466d8ed499223463c3169a2a04bc4e" }
});

const fixture = "tests/fixtures/onboarding/native-fin-replies";
const compiler = ["src/analyze/NativeExports.lean"
	, "src/analyze/native-types.mjs"
	, "src/build/native-model.mjs"
	, "src/build/native-component.mjs"
	, "src/backends/c/native-callables.mjs"
	, "src/backends/c/primitive-surface.mjs"
	, "src/release/native-c-family.mjs"];
/** Selected producer sources, not a dependency closure. The installed run and the fresh Lean gate share 5459b7f. */
export const finReplyInstalledSourcePaths = Object.freeze([...compiler
	, "tests/native-fin-callbacks.test.mjs"
	, "tests/helpers/fin-reply-install.mjs"
	, "tests/helpers/fin-reply-installed-tests.mjs"
	, "tests/helpers/fin-reply-compiled-tests.mjs"
	, "tests/helpers/fin-reply-model.mjs"
	, "tests/helpers/fin-callback-model.mjs"
	, "tests/helpers/fin-callback-install.mjs"
	, "tests/helpers/copied-fixture-install.mjs"
	, `${fixture}/FinReplies.lean`
	, `${fixture}/lakefile.toml`
	, `${fixture}/lean-toolchain`
	, "tests/fixtures/fin-reply-consumers/c.c"
	, "tests/fixtures/fin-reply-consumers/cpp.cpp"]);
/** The wrapper run's selected sources; only these three differ from their 5459b7f bytes. */
export const finReplyWrapperChangedPaths = Object.freeze(["tests/native-fin-callbacks.test.mjs", "tests/helpers/fin-reply-compiled-tests.mjs", `${fixture}/FinReplies.lean`]);
export const finReplyWrapperSourcePaths = Object.freeze([...compiler
	, "tests/native-fin-callbacks.test.mjs"
	, "tests/helpers/fin-reply-compiled-tests.mjs"
	, "tests/helpers/fin-callback-model.mjs"
	, "tests/helpers/fin-callback-install.mjs"
	, "tests/helpers/copied-fixture-install.mjs"
	, `${fixture}/FinReplies.lean`
	, `${fixture}/lakefile.toml`
	, `${fixture}/lean-toolchain`
	, "tests/fixtures/fin-reply-consumers/bypass.c"]);

/**
 * Where a selected producer source is archived as text.
 *
 * @param revision - Producer revision.
 * @param path - Repository-relative source path.
 */
export const finReplySnapshot = (revision, path) => `${finReplyArchiveDirectory}/sources/${revision.slice(0, 7)}/${path}.txt`;

const host = type => `(host : Nat → ${type})`;
const earlySignatures = {
	maybe: host("Option (Fin 5)")
	, digits: host("Array (Fin 3)")
	, none0: host("Option (Fin 0)")
	, wide: host("Option (Fin 184467440737095516170)")
	, failure: host("Except (Fin 7) Nat")
	, late: host("Trailing")
	, maybeTile: host("Option Tile")
	, twice: "(first : Nat → Option (Fin 5)) (second : Nat → Nat)"
	, plain: "(n : Nat)"
};
const earlyTypes = ["inductive Trailing where\n  | label (text : String)\n  | digit (value : Fin 10)\n", "structure Tile where\n  digit : Fin 5\n  count : Nat\n"];
/** Exact exported signatures and nominal reply shapes of each producer's fixture. */
export const finReplySignatures = Object.freeze({
	wrapper: { signatures: earlySignatures, types: earlyTypes }
	, installed: {
		signatures: { ...earlySignatures
			, aliased: host("MaybeDigit")
			, empty0: host("List (Fin 0)")
			, nested: host("Option (Array (Fin 3))")
			, product: host("Option (Fin 5) × Nat")
			, slotted: host("Slot")
			, success: host("Except Nat (Array (Fin 3))")
			, listed: host("List (Fin 3)") }
		, types: [...earlyTypes, "abbrev MaybeDigit := Option (Fin 5)\n", "structure Slot where\n  digit : Option (Fin 5)\n  count : Nat\n"]
	}
});

/**
 * Compare a fixture's exported signatures and nominal reply types with the exact expected shapes and bounds.
 *
 * @param lean - Archived FinReplies.lean text.
 * @param expected - One entry of finReplySignatures.
 */
export const assertFinReplySignatures = (lean, expected) => {
	const found = Object.fromEntries([...lean.matchAll(/^def (\w+) (.*?) : Nat :=/gmu)].map(match => [match[1], match[2]]));
	assert.deepEqual(found, expected.signatures);
	for(const type of expected.types) assert.ok(lean.includes(type), type);
	assert.equal([...lean.matchAll(/^(?:structure|inductive|abbrev) /gmu)].length, expected.types.length);
};

const counts = (tap, expected) => {
	for(const [key, count] of Object.entries({ cancelled: 0, skipped: 0, todo: 0, ...expected }))
		assert.deepEqual([...tap.matchAll(new RegExp(`^# ${key} (.+)$`, "gmu"))].map(match => match[1]), [String(count)], key);
};
const results = (tap, verdict) => [...tap.matchAll(new RegExp(`^${verdict} \\d+ - (.+)$`, "gmu"))].map(match => match[1]);
const diagnostics = tap => [...tap.matchAll(/^# ((?:build \d:|installing and checking) .*)$/gmu)].map(match => match[1]);

export const finReplyInstalledTest = "relocated source-free C and C++ packages check every host reply bound and recover";
export const finReplyWrapperTest = "generated C wrapper execution: C reply walks and Lean's own reconstruction both refuse host replies under ASan and UBSan";
export const finReplyFreshTests = Object.freeze(["fresh Lean admits every safe direction and compiles the generated adapter"
	, "fresh Lean refuses a host callback's result without a Fin-free failure value and admits one with it"
	, "fresh Lean admits every checked host reply family and compiles each typed reconstruction"]);
const installedSelection = "tests/native-fin-callbacks.test.mjs --test-name-pattern=\"relocated source-free C and C\\+\\+ packages check every host reply\"";
const leanPrefix = "/app/.toolchains/elan/toolchains/leanprover--lean4---v4.32.2";
export const finReplyProducerVersions = Object.freeze({
	node: "v22.23.3"
	, lean: "Lean (version 4.32.2, x86_64-unknown-linux-gnu, commit f3b06c705e6c85f5314019d5d3baab0fec5b580c, Release)"
	, cc: "cc (Debian 12.2.0-14+deb12u1) 12.2.0"
	, cxx: "c++ (Debian 12.2.0-14+deb12u1) 12.2.0"
	, ldd: "ldd (Debian GLIBC 2.36-9+deb12u14) 2.36"
});

/**
 * Check one installed producer queue: its revision, selection, CPU, environment and versions.
 *
 * @param queue - Original queue text.
 * @param revision - The producer revision this attempt ran.
 */
const assertInstalledQueue = (queue, revision) => {
	const record = JSON.parse(queue), base = `/app/build/vo1453-fin-replies-installed-${revision.slice(0, 7)}`;
	assert.deepEqual(Object.keys(record), ["node", "revision", "selection", "cpu", "concurrency", "instrumentation", "environment", "versions", "freeSpace", "tap", "report", "worktree", "startedAt"]);
	assert.equal(record.node, 1453); assert.equal(record.revision, revision);
	assert.equal(record.selection, installedSelection); assert.equal(record.cpu, "taskset -c 3"); assert.equal(record.concurrency, 1);
	assert.equal(record.instrumentation, "none");
	assert.deepEqual(record.environment, { NO_COLOR: "1"
		, FORCE_COLOR: "(unset)"
		, LEAN_BRIDGE_FIN_REPLY_PROFILES: "c,cpp"
		, LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR: "2.36"
		, LEAN_BRIDGE_LEAN_PREFIX: leanPrefix
		, LEAN_BRIDGE_FIN_REPLY_REPORT: `${base}.json` });
	assert.deepEqual(record.versions, finReplyProducerVersions);
	assert.equal(record.tap, `${base}.tap`); assert.equal(record.report, `${base}.json`);
	assert.ok(Number.parseInt(record.freeSpace, 10) >= 2048, record.freeSpace);
	return record;
};

export const finReplyInstalledChecks = Object.freeze({ c: 81, cpp: 74 });
export const finReplyInstalledIdentities = Object.freeze({
	bindingIrSha256: "c1678777f048a0258c9729d6ff0ac809dce3e9a36425cf4a045259fa21a79f9e"
	, modelSha256: "52b34a4759519adce17e0473a95fc3e866f33ae2380cc4511d399a1b69339337"
	, receiptSha256: "dbf4633052d7bdbfea47f2c503a153deb95365c0ae595f81b2ab23e3f7a7059a"
});
const hostMacros = ["HOST_aliased"
	, "HOST_digits"
	, "HOST_empty0"
	, "HOST_failure"
	, "HOST_late"
	, "HOST_listed"
	, "HOST_maybe"
	, "HOST_maybe_tile"
	, "HOST_nested"
	, "HOST_none0"
	, "HOST_product"
	, "HOST_slotted"
	, "HOST_success"
	, "HOST_twice"
	, "HOST_twice_second"
	, "HOST_wide"];

/**
 * The expanded C caller is the generated macro block followed by the exact archived consumer source.
 * Its callback names agree with the separate wrapper run's names for the same Option (Fin 5) reply.
 *
 * @param caller - Archived expanded C caller.
 * @param source - Archived tests/fixtures/fin-reply-consumers/c.c.
 * @param wrapperNames - Host callback names the wrapper report recorded.
 */
export const assertFinReplyCaller = (caller, source, wrapperNames) => {
	const lines = caller.split("\n"), header = lines.slice(0, hostMacros.length + 1);
	assert.equal(lines.slice(hostMacros.length + 1).join("\n"), source);
	const macros = Object.fromEntries(header.map(line => {
		const match = /^#define (\w+) (\w+)$/u.exec(line);
		assert.ok(match, line);
		return [match[1], match[2]];
	}));
	assert.deepEqual(Object.keys(macros), [...hostMacros, "TILE_REPLY"]);
	for(const macro of hostMacros) assert.match(macros[macro], /^finreplies_callback[0-9a-f]{20}$/u, macro);
	assert.equal(macros.TILE_REPLY, "finreplies_option_lean_fin_replies_tile_value");
	// maybe, the first reply of twice and the abbrev aliased all reply Option (Fin 5): one callback type.
	assert.equal(macros.HOST_twice, macros.HOST_maybe); assert.equal(macros.HOST_aliased, macros.HOST_maybe);
	assert.equal(new Set(hostMacros.map(macro => macros[macro])).size, hostMacros.length - 2);
	assert.equal(macros.HOST_maybe, wrapperNames.HOST_MAYBE); assert.equal(macros.HOST_twice_second, wrapperNames.HOST_TWICE_SECOND);
};

/**
 * Validate the installed report against the archived callers it executed.
 *
 * @param report - Original installed report.
 * @param callers - Archived expanded C caller and C++ consumer source.
 */
export const assertFinReplyInstalledReport = (report, callers) => {
	assert.deepEqual(Object.keys(report), ["archives", "reports", "reproducible", "schemaVersion", "scope"]);
	assert.equal(report.schemaVersion, 1); assert.equal(report.scope, "source-free installed C/C++ acceptance");
	assert.equal(report.reproducible, true);
	assert.deepEqual(report.reports.map(item => item.profile), ["c", "cpp"]);
	const archives = {};
	for(const item of report.reports)
	{
		assert.deepEqual(Object.keys(item), ["bindingIrSha256", "checks", "compilerFreePath", "consumerSha256", "instrumentation", "modelSha256", "offlineInstall", "packages", "path", "profile", "receiptSha256", "result", "sourceRemovedBeforeInstallation"]);
		const checks = finReplyInstalledChecks[item.profile];
		assert.equal(item.checks, checks); assert.deepEqual(item.result, { checks, forkHostCalls: 0, forkStatus: 5 });
		assert.equal(item.path, "ordinary-source"); assert.equal(item.instrumentation, "none: installed packages and consumers as built");
		assert.equal(item.sourceRemovedBeforeInstallation, true); assert.equal(item.offlineInstall, true); assert.equal(item.compilerFreePath, true);
		for(const [key, value] of Object.entries(finReplyInstalledIdentities)) assert.equal(item[key], value, key);
		assert.equal(item.consumerSha256, sha256(callers[item.profile]), item.profile);
		assert.equal(item.packages.length, 1);
		const [pkg] = item.packages, path = `archives/finreplies-1.0.0-${item.profile}.tar.gz`;
		assert.deepEqual([pkg.name, pkg.version, pkg.target, pkg.ecosystem, pkg.role, pkg.profile], ["finreplies", "1.0.0", item.profile, item.profile, "component", "native-library-v1"]);
		assert.deepEqual(pkg.artifacts.map(artifact => artifact.path), [path]);
		archives[path] = pkg.artifacts[0].sha256;
	}
	// One archive map for both author roots: the test refuses to write unless the second root reproduced it.
	assert.deepEqual(report.archives, archives);
};

/**
 * Validate the installed run's TAP and queue: one passing test that built twice and ran both profiles.
 *
 * @param tap - Original TAP.
 * @param queue - Original queue.
 */
export const assertFinReplyInstalledExecution = (tap, queue) => {
	assert.deepEqual(results(tap, "ok"), [finReplyInstalledTest]); assert.deepEqual(results(tap, "not ok"), []);
	counts(tap, { tests: 1, pass: 1, fail: 0 });
	assert.deepEqual(diagnostics(tap), ["build 0: c, cpp", "installing and checking c", "installing and checking cpp", "build 1: c, cpp"]);
	assertInstalledQueue(queue, finReplyInstalledRevision);
};

/**
 * Validate the fresh Lean source gate's TAP: exactly its three tests, none skipped.
 *
 * @param tap - Original TAP.
 */
export const assertFinReplyFresh = tap => {
	assert.deepEqual(results(tap, "ok"), finReplyFreshTests); assert.doesNotMatch(tap, /^not ok |# SKIP/mu);
	counts(tap, { tests: 3, pass: 3, fail: 0 });
};

/**
 * Validate the separate generated-wrapper run: ASan/UBSan on the wrapper and consumer only, a stripped
 * wrapper without exactly the C walk for the Fin 5 reply, and the same count from both variants.
 *
 * @param report - Original wrapper report.
 * @param tap - Original TAP.
 * @param queue - Original queue.
 * @param bypass - Archived tests/fixtures/fin-reply-consumers/bypass.c.
 */
export const assertFinReplyWrapper = (report, tap, queue, bypass) => {
	assert.deepEqual(Object.keys(report), ["compiler", "componentReceiptSha256", "harnessSha256", "instrumented", "key", "names", "original", "removed", "runs", "schemaVersion", "scope", "uninstrumented"]);
	assert.equal(report.schemaVersion, 1); assert.equal(report.scope, "generated C wrapper execution, not installed acceptance");
	assert.deepEqual(report.instrumented, ["wrapper", "consumer"]);
	assert.equal(report.uninstrumented.length, 3); assert.match(report.uninstrumented[0], /^libcomponent_[0-9a-f]{20}\.so$/u);
	assert.deepEqual(report.uninstrumented.slice(1), ["liblean_bridge_native.so", "libleanshared.so"]);
	assert.equal(report.compiler.expectedChecks, 27);
	for(const flags of [report.compiler.wrapper, report.compiler.consumer])
		for(const flag of ["-fsanitize=address,undefined", "-fno-sanitize-recover=undefined", "-Werror"]) assert.ok(flags.includes(flag), flag);
	assert.deepEqual(report.compiler.environment, { ASAN_OPTIONS: "detect_leaks=0:halt_on_error=1:abort_on_error=0", UBSAN_OPTIONS: "halt_on_error=1:print_stacktrace=1" });
	assert.deepEqual(Object.keys(report.names), ["HOST_MAYBE", "HOST_TWICE_FIRST", "HOST_TWICE_SECOND"]);
	assert.equal(report.names.HOST_TWICE_FIRST, report.names.HOST_MAYBE); assert.notEqual(report.names.HOST_TWICE_SECOND, report.names.HOST_MAYBE);
	assert.equal(report.harnessSha256, sha256(`${Object.entries(report.names).map(([macro, name]) => `#define ${macro} ${name}`).join("\n")}\n${bypass}`));
	// The stripped wrapper lacks exactly the bound constant and the comparison of the Fin 5 reply.
	assert.match(report.key, /^[0-9a-f]{20}$/u);
	const bound = `lb_fin_reply_${report.key}_0`;
	assert.equal(report.removed.length, 2);
	assert.equal(report.removed[0], `static const uint32_t ${bound}[1] = {0x5u};`);
	assert.ok(report.removed[1].includes(`${bound}, 1)`) && report.removed[1].includes("\"callback result is not below its Fin 5 bound\""), report.removed[1]);
	assert.deepEqual(Object.keys(report.runs), ["checked", "stripped"]);
	for(const [variant, run] of Object.entries(report.runs))
		assert.deepEqual(run.stdout, ["fork-status 5 0", `fin-reply-ok ${variant} 27`], variant);
	assert.notEqual(report.runs.checked.sourceSha256, report.runs.stripped.sourceSha256);
	assert.notEqual(report.runs.checked.librarySha256, report.runs.stripped.librarySha256);
	assert.deepEqual(results(tap, "ok"), [finReplyWrapperTest]); assert.deepEqual(results(tap, "not ok"), []);
	counts(tap, { tests: 1, pass: 1, fail: 0 });
	const record = JSON.parse(queue);
	assert.equal(record.node, 1453); assert.equal(record.revision, finReplyWrapperRevision);
	assert.equal(record.selection, "tests/native-fin-callbacks.test.mjs --test-name-pattern=\"generated C wrapper execution\"");
	assert.equal(record.cpu, "taskset -c 3"); assert.equal(record.concurrency, 1);
	assert.deepEqual(record.environment, { NO_COLOR: "1"
		, FORCE_COLOR: "(unset)"
		, LEAN_BRIDGE_NATIVE_FIN_REPLY_TEST: "1"
		, LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR: "2.36"
		, LEAN_BRIDGE_LEAN_PREFIX: leanPrefix
		, LEAN_BRIDGE_NATIVE_FIN_REPLY_REPORT: "/app/build/vo1453-fin-replies-65f7dd7-report.json" });
	assert.deepEqual(record.versions, { node: finReplyProducerVersions.node, lean: finReplyProducerVersions.lean, cc: finReplyProducerVersions.cc, ldd: finReplyProducerVersions.ldd });
	assert.equal(report.compiler.version, finReplyProducerVersions.cc);
};

/** Each failed installed attempt: its revision, the profile that failed and the retained cause. */
export const finReplyFailures = Object.freeze([
	{ attempt: "a65a937", profile: "c", code: "build-command-failed", field: "stderr", cause: "unknown type name 'finreplies_option_lean_sample_tile_value'" }
	, { attempt: "0dffe44", profile: "c", code: "ERR_ASSERTION", field: "message", cause: "assert.ok(checks >= 100)" }
	, { attempt: "c02c760", profile: "cpp", code: "build-command-failed", field: "stderr", cause: "'MaybeDigit' is not a member of 'fr'" }
]);

/**
 * Validate a retained failed installed attempt. It never counts toward acceptance.
 *
 * @param failure - One entry of finReplyFailures.
 * @param files - Its archived queue, TAP and failure record texts.
 */
export const assertFinReplyFailure = (failure, files) => {
	assertInstalledQueue(files.queue, finReplyFailedRevisions[failure.attempt]);
	assert.deepEqual(results(files.tap, "not ok"), [finReplyInstalledTest]); assert.deepEqual(results(files.tap, "ok"), []);
	counts(files.tap, { tests: 1, pass: 0, fail: 1 });
	assert.equal(diagnostics(files.tap).at(-1), `installing and checking ${failure.profile}`);
	const record = JSON.parse(files.failure);
	assert.deepEqual(Object.keys(record), ["args", "code", "command", "message", "stderr", "stdout"]);
	assert.equal(record.code, failure.code); assert.ok(record[failure.field].includes(failure.cause), failure.cause);
};

export const finReplyCallerPath = `${finReplyArchiveDirectory}/installed-c-caller.c.txt`;
const archived = name => `${finReplyArchiveDirectory}/${name}`;

/**
 * The exact archival receipt. Artifact digests and source identities come from the archived bytes; every
 * other field is fixed here, so the writer and the validator share one statement of scope.
 *
 * @param artifacts - Archived file references.
 * @param sources - Selected source identities for the installed and wrapper producers.
 */
export const finReplyReceipt = (artifacts, sources) => ({
	schemaVersion: 1
	, planNode: 1453
	, execution: "local"
	, scope: {
		profiles: ["c", "cpp"]
		, sourcePath: "ordinary-source"
		, exports: 16
		, checkedHostReplies: 15
		, installedChecks: finReplyInstalledChecks
		, forkedChild: "exits with status 5 before any host call"
		, reviewedContracts: false
		, otherNativeHosts: false
		, hostedCi: false
		, binaryArchivesRetained: false
		, dispatch: {
			installed: "not measured"
			, wrapper: "C only: a wrapper without the Fin 5 reply walk still refused through Lean's reconstruction; no source-entry or adapter counter"
		}
		, sanitizers: {
			installed: "none"
			, wrapper: "ASan and UBSan on the generated wrapper and consumer; the Lean component, bridge runtime and libleanshared are uninstrumented"
		}
	}
	, producerEnvironment: { glibc: finReplyProducerVersions.ldd, glibcFloor: "2.36", versions: finReplyProducerVersions, cpu: 3, concurrency: 1 }
	, sourceIdentityScope: "Selected producer sources archived as text, not a complete dependency closure. The installed run and the fresh Lean gate ran 5459b7f; the wrapper ran 65f7dd7, whose selected sources differ only in three test-side files."
	, producers: {
		installed: {
			revision: finReplyInstalledRevision
			, test: finReplyInstalledTest
			, report: archived("installed.json")
			, log: archived("installed.tap")
			, queue: archived("installed.queue")
			, callers: { c: finReplyCallerPath, cpp: finReplySnapshot(finReplyInstalledRevision, "tests/fixtures/fin-reply-consumers/cpp.cpp") }
			, sources: sources.installed
		}
		, freshLean: {
			revision: finReplyInstalledRevision
			, tests: finReplyFreshTests
			, selection: "tests/native-fin-callbacks.test.mjs --test-name-pattern=\"fresh Lean\""
			, environment: { NO_COLOR: "1", FORCE_COLOR: "(unset)", LEAN_BRIDGE_NATIVE_FIN_CALLBACK_LEAN_TEST: "1", LEAN_BRIDGE_LEAN_PREFIX: leanPrefix }
			, log: archived("fresh-lean.tap")
			, queue: "none written; the revision, CPU 3 and environment were announced on the coordination board before the run"
			, sources: "installed"
		}
		, wrapper: {
			revision: finReplyWrapperRevision
			, test: finReplyWrapperTest
			, report: archived("wrapper.json")
			, log: archived("wrapper.tap")
			, queue: archived("wrapper.queue")
			, sources: sources.wrapper
		}
	}
	, failedAttempts: finReplyFailures.map(failure => ({
		revision: finReplyFailedRevisions[failure.attempt]
		, profile: failure.profile
		, code: failure.code
		, cause: failure.cause
		, queue: archived(`failed/${failure.attempt}.queue`)
		, log: archived(`failed/${failure.attempt}.tap`)
		, failure: archived(`failed/${failure.attempt}.${failure.profile}-failure.json`)
	}))
	, artifacts
	, remaining: [
		"Promote only the observed C and C++ ordinary-source host reply positions in a separate inventory change."
		, "Hosted CI and supported release floors are separate from this local glibc 2.36 run."
		, "Reviewed contracts and other native hosts require separate installed acceptance."
		, "No installed dispatch counter was run; C++ dispatch is not inferred from the C wrapper."
		, "The sanitizers cover the generated wrapper and consumer, not the Lean component or runtimes."
	]
});

/**
 * Write archived bytes once. An existing file must already hold exactly these bytes, receipt included.
 *
 * @param path - Archive path.
 * @param bytes - Exact bytes.
 */
export const writeFinReplyArtifact = async (path, bytes) => {
	await mkdir(dirname(path), { recursive: true });
	try
	{ await writeFile(path, bytes, { flag: "wx" }); }
	catch(error)
	{
		if(error.code !== "EEXIST") throw error;
		assert.ok((await readFile(path)).equals(bytes), `${path} already holds different bytes`);
	}
};

/**
 * Authenticate the whole archive from its receipt: every artifact digest, the exact receipt statement,
 * each producer's selected sources and the content of every report, log, queue and caller.
 *
 * @param receipt - Parsed archival receipt.
 * @param read - Read archived bytes for a repository-relative path.
 */
export const assertFinReplyArchive = async (receipt, read) => {
	const artifacts = new Map(receipt.artifacts.map(artifact => [artifact.path, artifact]));
	assert.equal(artifacts.size, receipt.artifacts.length);
	for(const artifact of receipt.artifacts)
	{
		const bytes = await read(artifact.path);
		assert.equal(bytes.length, artifact.bytes, artifact.path); assert.equal(sha256(bytes), artifact.sha256, artifact.path);
	}
	const text = async path => (await read(path)).toString();
	const { installed, wrapper } = receipt.producers;
	assert.deepEqual(receipt, finReplyReceipt(receipt.artifacts, { installed: installed.sources, wrapper: wrapper.sources }));
	const expected = new Set();
	for(const [name, file] of Object.entries(finReplyOriginals))
	{
		const artifact = artifacts.get(archived(name));
		assert.ok(artifact, name); assert.equal(artifact.originalPath, file.original); assert.equal(artifact.sha256, file.sha256, name);
		expected.add(artifact.path);
	}
	const source = (revision, item) => {
		const artifact = artifacts.get(item.snapshot);
		assert.ok(artifact, item.snapshot);
		assert.equal(item.snapshot, finReplySnapshot(revision, item.path));
		assert.equal(artifact.originalPath, `git:${revision}:${item.path}`); assert.equal(artifact.sha256, item.sha256, item.path);
		expected.add(item.snapshot);
	};
	assert.deepEqual(installed.sources.map(item => item.path), finReplyInstalledSourcePaths);
	for(const item of installed.sources) source(finReplyInstalledRevision, item);
	assert.deepEqual(wrapper.sources.map(item => item.path), finReplyWrapperSourcePaths);
	const shared = new Map(installed.sources.map(item => [item.path, item]));
	const changed = [];
	for(const item of wrapper.sources)
	{
		const same = shared.get(item.path);
		if(same?.sha256 === item.sha256) assert.deepEqual(item, same, item.path);
		else
		{
			source(finReplyWrapperRevision, item);
			if(same) changed.push(item.path);
		}
	}
	assert.deepEqual(changed.sort(), [...finReplyWrapperChangedPaths].sort());
	const caller = artifacts.get(finReplyCallerPath);
	assert.ok(caller); assert.match(caller.originalPath, /^generated at 5459b7f: /u);
	expected.add(finReplyCallerPath);
	assert.deepEqual([...artifacts.keys()].sort(), [...expected].sort());
	const snapshot = (sources, path) => text(sources.find(item => item.path === path).snapshot);
	const lean = "tests/fixtures/onboarding/native-fin-replies/FinReplies.lean";
	assertFinReplySignatures(await snapshot(installed.sources, lean), finReplySignatures.installed);
	assertFinReplySignatures(await snapshot(wrapper.sources, lean), finReplySignatures.wrapper);
	const wrapperReport = JSON.parse(await text(wrapper.report));
	assertFinReplyWrapper(wrapperReport, await text(wrapper.log), await text(wrapper.queue), await snapshot(wrapper.sources, "tests/fixtures/fin-reply-consumers/bypass.c"));
	const callers = { c: await text(installed.callers.c), cpp: await text(installed.callers.cpp) };
	assertFinReplyCaller(callers.c, await snapshot(installed.sources, "tests/fixtures/fin-reply-consumers/c.c"), wrapperReport.names);
	assertFinReplyInstalledReport(JSON.parse(await text(installed.report)), callers);
	assertFinReplyInstalledExecution(await text(installed.log), await text(installed.queue));
	assertFinReplyFresh(await text(receipt.producers.freshLean.log));
	for(const [index, failure] of finReplyFailures.entries())
	{
		const attempt = receipt.failedAttempts[index];
		assertFinReplyFailure(failure, { queue: await text(attempt.queue), tap: await text(attempt.log), failure: await text(attempt.failure) });
	}
};
