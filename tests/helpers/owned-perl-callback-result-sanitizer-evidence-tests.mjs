/**
 * Reject coordinated forged sanitizer scope, sources, commands and raw outputs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { assertOwnedPerlCallbackSanitizers, assertOwnedPerlCallbackSanitizerMatrix
	, ownedPerlCallbackSanitizerReports, isOwnedPerlCallbackLsanUnavailable } from "./owned-perl-callback-result-sanitizer-evidence.mjs";

const enabled = process.env.LEAN_BRIDGE_OWNED_PERL_CALLBACK_RESULT_EVIDENCE_TEST === "1";
const directory = process.env.LEAN_BRIDGE_OWNED_PERL_CALLBACK_RESULT_SANITIZER_REPORTS ?? "build/owned-perl-callback-result-sanitizers";
const reports = async () => Object.fromEntries(await Promise.all(ownedPerlCallbackSanitizerReports
	.map(async name => [name, JSON.parse(await readFile(join(directory, name), "utf8"))])));
const compact = value => JSON.stringify(JSON.parse(canonicalJson(value)));
const commandFields = record => Object.fromEntries(["command", "args", "environment", "execution"].map(key => [key, structuredClone(record[key])]));
// Deliberately update redundant command copies in coordinated attacks. Rejecting
// a stale duplicate alone would not test the independent semantic invariant.
const syncCommands = item => {
	const original = item.commands;
	const observed = item.observations.flatMap((observation, index) => [
		commandFields(observation.fingerprintExecution)
		, original[9 + 20 * index]
		, commandFields(observation.coldPerlDefault)
		, commandFields(observation.coldPerlFull)
		, ...observation.strictLeakExecutions.map(commandFields)
		, ...observation.executions.map(commandFields)
	]);
	item.commands = [...original.slice(0, 8), ...observed];
};
const fixMessage = record => {
	if(record.execution.code !== 0)
		record.execution.message = `Command failed: ${record.command} ${record.args.join(" ")}\n${record.execution.stderr}`;
};
const executionChange = (variant, change, strict = false) => item => {
	const observation = strict ? item.observations.find(observation => observation.strictLeakExecutions
		.some(record => record.variant === variant && record.leakStatus === "not-clean")) ?? item.observations[0] : item.observations[0];
	const record = observation[strict ? "strictLeakExecutions" : "executions"].find(record => record.variant === variant);
	change(record); fixMessage(record); syncCommands(item);
};
const hasLeakDiagnostic = variant => item => item.observations.some(observation => observation.strictLeakExecutions
	.some(record => record.variant === variant && record.leakStatus === "not-clean"));
const observedChange = (variant, change) => executionChange(variant, record => {
	change(record.observed);
	record.execution.stdout = compact(record.observed) + (["cold", "runtime"].includes(variant) ? "\n" : "");
});
const sourceChange = (path, change) => item => {
	const record = item.sources[path]; record.source = change(record.source); record.sha256 = sha256(record.source);
};
const counterChange = (variant, index) => observedChange(variant, value => {
	if(variant === "runtime") value[["managedLive", "nativeLive", "identities", "owners", "active", "cleanupStatus"][index]]++;
	else value.final[index]++;
});
const driftBaseline = executionChange("runtime", record => {
	const bytes = record.observedBaseline.bytes;
	record.execution.stderr = record.execution.stderr.replace(`${bytes} byte(s)`, `${bytes + 1} byte(s)`)
		.replace(`${bytes} byte(s) leaked`, `${bytes + 1} byte(s) leaked`);
	record.observedBaseline.bytes++;
}, true);
const wrongLeakDelta = executionChange("native-leak", record => {
	const bytes = record.observedBaseline.bytes + 73;
	record.execution.stderr = record.execution.stderr.replace("73 byte(s)", "74 byte(s)")
		.replace(`${bytes} byte(s) leaked`, `${bytes + 1} byte(s) leaked`);
}, true);
const wrongLeakSite = executionChange("xs-leak", record => {
	record.execution.stderr = record.execution.stderr.replace("sanitizer_xs_leak", "sanitizer_native_leak");
}, true);

test("Perl callback sanitizer evidence reconstructs scoped address/UB and separate strict LSan matrices", { skip: !enabled }, async () => {
	const original = await reports(), before = canonicalJson(original);
	await assertOwnedPerlCallbackSanitizerMatrix(original);
	// Synthetic grammar fixtures only: prove that valid addresses/PIDs/roots and
	// system-library identity shapes are not mistaken for immutable executions.
	// They are never saved as observed reports or included in acceptance evidence.
	const relocated = JSON.parse(JSON.stringify(original)
		.replaceAll("/app/.toolchains/perl/", "/ci/.toolchains/perl/")
		.replaceAll("/tmp/lean-bridge-owned-native-", "/ci/scratch/lean-bridge-owned-native-")
		.replaceAll("/usr/lib/gcc/x86_64-linux-gnu/12/", "/usr/lib/gcc/x86_64-linux-gnu/13/"));
	for(const item of Object.values(relocated))
	{
		for(const observation of item.observations)
		{
			const records = [observation.coldPerlDefault, observation.coldPerlFull
				, ...observation.executions, ...observation.strictLeakExecutions];
			for(const record of records)
			{
				record.execution.stderr = record.execution.stderr
					.replaceAll(/0x[0-9a-f]+/gu, value => "0x" + (BigInt(value) + 65536n).toString(16))
					.replaceAll(/==([0-9]+)==/gu, (_, pid) => "==" + (Number(pid) + 10000) + "==");
				fixMessage(record);
			}
			const coldBaseline = observation.strictLeakExecutions[0].observedBaseline;
			for(const record of observation.strictLeakExecutions)
			{
				if(record.leakStatus === "detector-unavailable") continue;
				const leaking = record.variant.endsWith("-leak");
				record.execution.stderr = record.execution.stderr
					.replace(`Direct leak of ${coldBaseline.bytes} byte(s) in ${coldBaseline.allocations} object(s)`
						, `Direct leak of ${coldBaseline.bytes + 17} byte(s) in ${coldBaseline.allocations + 1} object(s)`)
					.replace(`SUMMARY: AddressSanitizer: ${coldBaseline.bytes + (leaking ? 73 : 0)} byte(s) leaked in ${coldBaseline.allocations + Number(leaking)} allocation(s).`
						, `SUMMARY: AddressSanitizer: ${coldBaseline.bytes + 17 + (leaking ? 73 : 0)} byte(s) leaked in ${coldBaseline.allocations + 1 + Number(leaking)} allocation(s).`);
				record.observedBaseline = { ...coldBaseline, bytes: coldBaseline.bytes + 17, allocations: coldBaseline.allocations + 1 };
				fixMessage(record);
			}
		}
		syncCommands(item);
	}
	await assertOwnedPerlCallbackSanitizerMatrix(relocated);
	// GCC/ASan symbolizers expose the same allocator interceptor either with
	// the legacy __interceptor_ prefix or as the public allocator name. Preserve
	// the raw diagnostic while authenticating both names against ASan's source.
	const publicAllocator = structuredClone(original);
	for(const item of Object.values(publicAllocator))
	{
		for(const observation of item.observations)
		{
			const records = [observation.coldPerlDefault, observation.coldPerlFull
				, ...observation.executions, ...observation.strictLeakExecutions];
			for(const record of records)
			{
				record.execution.stderr = record.execution.stderr.replaceAll(" in __interceptor_malloc ", " in malloc ");
				fixMessage(record);
			}
			syncCommands(item);
		}
	}
	await assertOwnedPerlCallbackSanitizerMatrix(publicAllocator);
	assert.equal(canonicalJson(original), before, "original reports remain byte-equivalent JSON; no diagnostic rewriting");
});

test("Perl callback sanitizer evidence rejects forged source, execution, cleanup and leak claims", { skip: !enabled }, async t => {
	const originals = await reports();
	const mutations = [
		["additional acceptance", item => { item.acceptance = "passed"; }]
		, ["schema", item => { item.schemaVersion++; }]
		, ["kind", item => { item.kind = "installed-sanitizers"; }]
		, ["compiler path", item => { item.mode = item.mode === "ordinary" ? "reviewed" : "ordinary"; }]
		, ["installed claim", item => { item.installedPackage = true; }]
		, ["whole reply capability", item => { item.options.callbackResultAnchors = false; }]
		, ["compiler identity", item => { item.input.sourceIdentity.leanCompilerSha256 = "0".repeat(64); }]
		, ["compiler metadata", item => { item.input.metadata.unknown = true; }]
		, ["instrumented Lean claim", item => { item.instrumented.push("prebuilt Lean runtime"); }]
		, ["hidden uninstrumented scope", item => { item.uninstrumented.pop(); }]
		, ["leak-free claim", item => { item.coverage.leakSanitizer = "clean"; }]
		, ["child leak checkpoint claim", item => { item.coverage.forkChild = "fully checked"; }]
		, ["six counters as LSan claim", item => { item.coverage.ownershipCleanup = "leak-free"; }]
		, ["sanitizer library hash shape", item => { item.sanitizerLibraries[0].sha256 = "not-a-sha256"; }]
		, ["sanitizer library path", item => { item.sanitizerLibraries[1].path = "/tmp/fake.so"; }]
		, ["prebuilt Lean bytes", item => { item.prebuiltRuntimeManifest.files["lib/libleanshared.so"].bytes--; }]
		, ["prebuilt broker promotion", item => { item.prebuiltRuntimeManifest.files["lib/liblean_bridge_native.so"].instrumented = true; }]
		, ["unknown source", item => { item.sources["unknown.c"] = { source: "", sha256: sha256("") }; }]
		, ["missing source", item => { delete item.sources["Callbacks.c"]; }]
		, ["source self-hash", item => { item.sources["Owned.c"].sha256 = "0".repeat(64); }]
		, ["sanitizer disabled in XS build", sourceChange("sanitized/build.pl", value => value.replaceAll("-fsanitize=address,undefined", ""))]
		, ["native control disabled", sourceChange("sanitized/public-api.c", value => value.replace("value[index] = 1;", "value[0] = 1;"))]
		, ["XS UB control disabled", sourceChange("sanitized/Probe.xs", value => value.replace("RETVAL = value << shift;", "RETVAL = value;"))]
		, ...Object.keys(originals["ordinary.json"].sources).map(path => ["coordinated source hash " + path, sourceChange(path, value => value + "\n")])
		, ["missing ABI", item => { item.observations.pop(); }]
		, ["duplicated ABI", item => { item.observations[1] = structuredClone(item.observations[0]); }]
		, ["unknown ABI", item => { item.observations[0].perl = "/usr/bin/perl"; }]
		, ["unknown observation", item => { item.observations[0].clean = true; }]
		, ["actual ParseXS output", item => { item.observations[0].xsC += "\n"; item.observations[0].xsCSha256 = sha256(item.observations[0].xsC); }]
		, ["fingerprint coordinated", item => {
			const observation = item.observations[0]; observation.fingerprint.threaded = 0;
			observation.fingerprintExecution.execution.stdout = compact(observation.fingerprint); syncCommands(item);
		}]
		, ["strict list omitted", item => { item.observations[0].strictLeakExecutions.pop(); syncCommands(item); }]
		, ["accepted list omitted", item => { item.observations[0].executions.pop(); syncCommands(item); }]
		, ["accepted list duplicated", item => { item.observations[0].executions[1] = structuredClone(item.observations[0].executions[0]); syncCommands(item); }]
		, ["extra original command", item => { item.commands.push(structuredClone(item.commands[0])); }]
		, ["compiler stderr", item => { item.commands[0].execution.stderr = "warning"; }]
		, ["native linker failure", item => { item.commands[5].execution.code = 1; }]
		, ["native sanitizer flag removed", item => { item.commands[5].args = item.commands[5].args.filter(value => !value.startsWith("-fsanitize=")); }]
		, ["broker resolves original library", item => { item.commands[5].args[item.commands[5].args.indexOf("sanitized/lib")] = "runtime/lib"; }]
		, ["forged XS build", item => { item.commands[9].args[0] = "unsanitized/build.pl"; }]
		, ["cold full destruction failure", item => { item.observations[0].coldPerlFull.execution.code = 23; fixMessage(item.observations[0].coldPerlFull); syncCommands(item); }]
		, ...["sanitizerEnvironment", "strictLeakEnvironment"].flatMap(field => [
			[field + " relaxed failfast", item => { item[field].UBSAN_OPTIONS = "halt_on_error=0"; }]
			, [field + " suppressed leak", item => { item[field].LSAN_OPTIONS += ":suppressions=all"; }]
		])
		, ...["cold", "runtime", "faults", "process-reentry", "reentrant-shutdown"].flatMap(variant => [
			[variant + " successful false status", executionChange(variant, record => { record.execution.code = 23; })]
			, [variant + " stderr ignored", executionChange(variant, record => { record.execution.stderr = "ERROR: AddressSanitizer: heap-use-after-free\n"; })]
			, [variant + " signal ignored", executionChange(variant, record => { record.execution.signal = "SIGSEGV"; })]
			, [variant + " uninstrumented env", executionChange(variant, record => { delete record.environment.LD_PRELOAD; })]
			, [variant + " relabelled LSan", executionChange(variant, record => { record.environment.ASAN_OPTIONS = "detect_leaks=1:halt_on_error=1"; })]
			, [variant + " actual ABI", observedChange(variant, value => { value.threaded = 0; })]
			, [variant + " extra observed claim", observedChange(variant, value => { value.acceptance = true; })]
			, ...[0, 1, 2, 3, 4, 5].map(index => [variant + " final counter " + index, counterChange(variant, index)])
		])
		, ["fault real handoff", observedChange("faults", value => { value.attempts.find(attempt => attempt.handoffDelta).handoffDelta = 0; })]
		, ["fault alias consumed before handoff", observedChange("faults", value => { value.attempts.find(attempt => !attempt.handoffDelta).closed = [1, 1, 1]; })]
		, ["fault retained exception class", observedChange("faults", value => { value.exception.actualClass = "other"; })]
		, ["fault exception swallowed", observedChange("faults", value => { value.heldErrors--; })]
		, ["lifetime creator", observedChange("process-reentry", value => { value.events.creator.resultSerial = 0; })]
		, ["lifetime fork wait", observedChange("process-reentry", value => { value.events.fork.waitStatus = 256; })]
		, ["lifetime thread skip", observedChange("process-reentry", value => { value.events.thread = { skipped: "not tested" }; })]
		, ["lifetime probe path", observedChange("process-reentry", value => { value.errors[0].error = value.errors[0].error.replace("./lifetime.pl", "consumer.pl"); })]
		, ["lifetime reply pin", observedChange("process-reentry", value => { value.events.replyPin.after[1]--; })]
		, ["shutdown pin", observedChange("reentrant-shutdown", value => { value.events.shutdownDuringCallback.after[1] = 0; })]
		, ...["native-address", "xs-address", "native-undefined", "xs-undefined"].flatMap(variant => [
			[variant + " detector silent", executionChange(variant, record => { record.execution.stderr = ""; })]
			, [variant + " detector exit", executionChange(variant, record => { record.execution.code = 9; })]
			, [variant + " detector signal", executionChange(variant, record => { record.execution.signal = "SIGSEGV"; })]
			, [variant + " wrong actual site", executionChange(variant, record => { record.execution.stderr = record.execution.stderr.replaceAll("sanitizer_", "unrelated_"); })]
			, [variant + " extra crash", executionChange(variant, record => { record.execution.stderr += "Segmentation fault (core dumped)\n"; })]
			, [variant + " fake stdout", executionChange(variant, record => { record.execution.stdout = "ok"; })]
		])
		, ...["cold", "runtime", "faults", "process-reentry", "reentrant-shutdown", "native-leak", "xs-leak"].flatMap(variant => [
			[variant + " LSan clean relabel", executionChange(variant, record => { record.leakStatus = "clean"; }, true)]
			, [variant + " LSan status hidden", executionChange(variant, record => { record.execution.code = 0; delete record.execution.message; }, true)]
			, [variant + " LSan diagnostics omitted", executionChange(variant, record => { record.execution.stderr = ""; }, true)]
			, [variant + " LSan scope changed", executionChange(variant, record => { record.observedBaseline = { ...record.observedBaseline, source: "generated XS" }; }, true)]
			, [variant + " LSan raw counters", executionChange(variant, record => { const value = JSON.parse(record.execution.stdout); value.cleanupStatus = 1; record.execution.stdout = compact(value); }, true)]
			, [variant + " extra LSan error", executionChange(variant, record => { record.execution.stderr += "ERROR: AddressSanitizer: heap-use-after-free\n"; }, true)]
		])
		, ["strict exercised baseline drift", driftBaseline, hasLeakDiagnostic("runtime")]
		, ["native leak wrong delta", wrongLeakDelta, hasLeakDiagnostic("native-leak")]
		, ["XS leak wrong site", wrongLeakSite, hasLeakDiagnostic("xs-leak")]
	];
	let rejected = 0;
	for(const [name, original] of Object.entries(originals))
	{
		for(const [label, change, applicable] of mutations)
		{
			if(applicable && !applicable(original)) continue;
			const item = structuredClone(original); change(item);
			await assert.rejects(() => assertOwnedPerlCallbackSanitizers(name, item), undefined, `${name}: ${label}`); ++rejected;
		}
		for(let index = 0; index < original.commands.length; index++)
		{
			const item = structuredClone(original); item.commands[index].args.push("--not-the-original-command");
			await assert.rejects(() => assertOwnedPerlCallbackSanitizers(name, item), undefined, `${name}: original command ${index}`); ++rejected;
		}
		const missing = { ...originals }; delete missing[name];
		await assert.rejects(() => assertOwnedPerlCallbackSanitizerMatrix(missing)); ++rejected;
	}
	await assert.rejects(() => assertOwnedPerlCallbackSanitizerMatrix({ ...originals, "extra.json": originals["ordinary.json"] })); ++rejected;
	// Exact diagnostic-family unit fixtures; never represented as executed runs.
	for(const address of ["0xc0", "0xd0"])
	{
		const diagnostic = `Tracer caught signal 11: addr=${address} pc=0x123 sp=0x456\n==123==LeakSanitizer has encountered a fatal error.\n==123==HINT: For debugging, try setting environment variable LSAN_OPTIONS=verbosity=1:log_threads=1\n==123==HINT: LeakSanitizer does not work under ptrace (strace, gdb, etc)\n`;
		assert.equal(isOwnedPerlCallbackLsanUnavailable(diagnostic), true);
		const unknown = ["Segmentation fault (core dumped)\n"
			, "ERROR: AddressSanitizer: heap-use-after-free\n"
			, diagnostic.replace("signal 11", "signal 6")
			, diagnostic.replace("==123==HINT:", "==124==HINT:")
			, diagnostic.replace("fatal error.", "unexpected error.")
			, diagnostic + "extra diagnostic\n", diagnostic.slice(1)];
		for(const changed of unknown)
		{
			assert.equal(isOwnedPerlCallbackLsanUnavailable(changed), false); ++rejected;
		}
	}
	// A fresh matrix need not encounter the nondeterministic tracer failure.
	// This synthetic fixture tests classification, never claims an executed run.
	const unavailable = structuredClone(originals["ordinary.json"]);
	const record = unavailable.observations[0].strictLeakExecutions.find(record => record.variant === "runtime");
	record.leakStatus = "detector-unavailable"; delete record.observedBaseline;
	record.execution.stderr = "Tracer caught signal 11: addr=0xc0 pc=0x123 sp=0x456\n==123==LeakSanitizer has encountered a fatal error.\n==123==HINT: For debugging, try setting environment variable LSAN_OPTIONS=verbosity=1:log_threads=1\n==123==HINT: LeakSanitizer does not work under ptrace (strace, gdb, etc)\n";
	fixMessage(record); syncCommands(unavailable);
	await assertOwnedPerlCallbackSanitizers("ordinary.json", unavailable);
	const unavailableMutations = [
		value => { value.observedBaseline = { bytes: 128, allocations: 12, source: "prebuilt Lean/GMP" }; }
		, value => { value.leakStatus = "not-clean"; }
		, value => { value.execution.stderr += "ERROR: AddressSanitizer: heap-use-after-free\n"; }
		, value => { value.execution.stderr = "Segmentation fault (core dumped)\n"; }
		, value => { value.execution.stderr = value.execution.stderr.replace("==123==HINT:", "==124==HINT:"); }
		, value => { value.execution.code = 0; delete value.execution.message; }
		, value => { value.execution.signal = "SIGSEGV"; }
	];
	for(const change of unavailableMutations)
	{
		const item = structuredClone(unavailable);
		const changed = item.observations[0].strictLeakExecutions.find(record => record.variant === "runtime");
		change(changed); fixMessage(changed); syncCommands(item);
		await assert.rejects(() => assertOwnedPerlCallbackSanitizers("ordinary.json", item)); ++rejected;
	}
	const unknownCold = structuredClone(unavailable);
	const cold = unknownCold.observations[0].strictLeakExecutions[0];
	cold.leakStatus = "detector-unavailable"; delete cold.observedBaseline;
	cold.execution.stderr = record.execution.stderr; fixMessage(cold); syncCommands(unknownCold);
	await assert.rejects(() => assertOwnedPerlCallbackSanitizers("ordinary.json", unknownCold)); ++rejected;
	t.diagnostic(`${rejected} altered sanitizer report, command, matrix and diagnostic claims rejected`);
});
