/**
 * Authenticate scoped address/UB executions separately from unsuccessful LSan.
 *
 * @file
 */
import assert from "node:assert/strict";
import { callbackCarrierCDigest } from "./callback-compiler-identity.mjs";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { createCompiledNativeModel } from "../../src/build/native-graph-model.mjs";
import { generateOwnedAggregateCarriers } from "../../src/build/owned-aggregate-carriers.mjs";
import { generateOwnedPerlXs } from "../../src/backends/perl/owned-xs.mjs";
import { brokerSource } from "../../src/backends/native/runtime-broker.mjs";
import { nativeCallbackBroker } from "../../src/backends/native/callback-broker.mjs";
import { ownedPerlProbeInstrumentation } from "./owned-perl-native.mjs";
import { assertOwnedPerlCallbackSources } from "./owned-perl-callback-result-runtime-evidence.mjs";
import { assertOwnedPerlCallbackFaultObservation } from "./owned-perl-callback-result-fault-evidence.mjs";
import { assertOwnedPerlCallbackLifetimeObservation } from "./owned-perl-callback-result-lifetime-evidence.mjs";
import { assertOwnedPerlReceiverMatrix, ownedPerlReceiverVariant } from "./owned-perl-receiver-evidence.mjs";

export const ownedPerlCallbackSanitizerReports = Object.freeze(["ordinary.json", "reviewed.json"]);
const keys = (value, expected) => assert.deepEqual(Object.keys(value).sort(), [...expected].sort());
const hash = value => sha256(canonicalJson(value));
const compact = value => JSON.stringify(JSON.parse(canonicalJson(value)));
const positive = ["cold", "runtime", "faults", "process-reentry", "reentrant-shutdown"];
const controls = ["native-address", "xs-address", "native-undefined", "xs-undefined"];
const strict = [...positive, "native-leak", "xs-leak"];
const flags = ["-O1", "-g", "-fPIC", "-fsanitize=address,undefined", "-fno-omit-frame-pointer"];
const environment = { PATH: "/usr/bin:/bin" };
const asanAllocatorName = /^(?:__interceptor_)?(?:malloc|calloc|realloc)$/u;
const asanAllocatorLocation = /^(?:\.\.\/)*src\/libsanitizer\/asan\/asan_malloc_linux\.cpp:[1-9][0-9]*(?::[1-9][0-9]*)?$/u;
const fingerprintArgs = ["-MConfig", "-MJSON::PP", "-e"
	, 'print JSON::PP->new->canonical->encode({perlVersion => "$^V", threaded => $Config{useithreads} ? 1 : 0})'];
const success = stdout => ({ code: 0, signal: null, stdout, stderr: "" });
const leakEnvironment = preload => ({ ...environment, LD_PRELOAD: preload
	, PERL_DESTRUCT_LEVEL: "2", ASAN_OPTIONS: "detect_leaks=1:halt_on_error=1"
	, UBSAN_OPTIONS: "halt_on_error=1:print_stacktrace=1"
	, LSAN_OPTIONS: "exitcode=23" });

// Observed compiler-output baselines, NOT independently rerun compilers. The
// reconstructed source identity binds these bytes to their authored inputs.
const compilerC = {
	"Owned.c": "548eb1e30a48a01b5b0023c8e4c2e4465231485d023356af3eee84c83f6af7e9"
	, "Witness.c": "02568afb0b8a9ec59623a12d4ddf52f63b0ea79f71c5a312087fa240d0be9d96"
};
const carrierC = {
	ordinary: "7a441eb3f6386e334f7a8dafb365e01085e9aa47d77b370f79f87ebd9d4c069b"
	, reviewed: "40a7b574519eedd1643e91b33d86a42bb186cf77a71fe210a9515d99787ca9a1"
};
const parseXsC = {
	"5.36.3": "60eb8c65bc8127a596e8b49ce46cd809c6fed2d5e247ad14d3fee525fbd6372e"
	, "5.38.2": "c94464b8a93169b168fba5b8822ea8b6a337951a15283c4544f9cea2c000a495"
};

/**
 * Recognize only the complete observed tracer-fatal LSan diagnostic family.
 *
 * @param diagnostic - Original stderr, without trimming or rewriting.
 */
export const isOwnedPerlCallbackLsanUnavailable = diagnostic =>
	/^Tracer caught signal 11: addr=0x[0-9a-f]+ pc=0x[0-9a-f]+ sp=0x[0-9a-f]+\n==(?<pid>\d+)==LeakSanitizer has encountered a fatal error\.\n==\k<pid>==HINT: For debugging, try setting environment variable LSAN_OPTIONS=verbosity=1:log_threads=1\n==\k<pid>==HINT: LeakSanitizer does not work under ptrace \(strace, gdb, etc\)\n$/u.test(diagnostic);

/**
 * Recognize ASan allocator frames across GCC symbolizer spellings.
 *
 * @param name - Symbolized allocator name.
 * @param location - ASan source location emitted for the frame.
 */
export const isOwnedPerlAsanAllocatorFrame = (name, location) =>
	asanAllocatorName.test(name) && asanAllocatorLocation.test(location);

const authoredLiteral = (source, name) => {
	const expression = new RegExp("const " + name + " = `([^]*?)`;", "gu");
	const matches = [...source.matchAll(expression)]; assert.equal(matches.length, 1, name);
	assert.doesNotMatch(matches[0][1], /\$\{|\\/u);
	return matches[0][1];
};
const assertSources = async (mode, item) => {
	const producer = await readFile("tests/helpers/owned-perl-callback-result-sanitizer-tests.mjs", "utf8");
	const nativeControls = authoredLiteral(producer, "nativeControls");
	const xsControls = authoredLiteral(producer, "xsControls"), prefix = authoredLiteral(producer, "xsPrefix");
	const native = item.sources["sanitized/public-api.c"].source, xsSource = item.sources["sanitized/Probe.xs"].source;
	assert.ok(native.endsWith(nativeControls));
	assert.ok(xsSource.startsWith(prefix) && xsSource.endsWith(xsControls));
	const baseNative = native.slice(0, -nativeControls.length), baseXs = xsSource.slice(prefix.length, -xsControls.length);
	const model = createCompiledNativeModel(item.input, {
		ownedGraphs: true, ownedHostCallbacks: true
		, ownedCallbackResultAnchors: true, ownedInputTransfers: true
		, ownedAnchoredResults: true, ownedReceiverExports: true });
	const generatedXs = generateOwnedPerlXs(model.bindingIr, "LeanBridge::OwnedProbe", item.options);
	// The report records native/XS bytes, but NOT a separate installed .pm file.
	// Declaration/value hashes here describe reconstructed context only; they are
	// not promoted to independently observed compiler or installation evidence.
	const { c, xs, sources } = await assertOwnedPerlCallbackSources(mode, "combined", {
		input: item.input, options: item.options
		, nativeSourceSha256: sha256(baseNative), xsSha256: sha256(baseXs)
		, declarationsSha256: sha256(generatedXs.declarations)
		, valuesSha256: sha256(generatedXs.valuesSource)
	});
	assert.equal(native, sources.native + nativeControls); assert.equal(xsSource, prefix + sources.xs + xsControls);
	const carriers = generateOwnedAggregateCarriers({ ...item.input, hostCallbacks: true });
	const expected = {
		"sanitized/public-api.c": native, "sanitized/Probe.xs": xsSource
		, "sanitized/broker.c": `${brokerSource}\n${nativeCallbackBroker}`
		, "sanitized/lib/.keep": ""
		, "instrumentation.h": ownedPerlProbeInstrumentation
		, "carriers.h": carriers.header, "Callbacks.c": carriers.callbackSource
	};
	for(const [path, source] of Object.entries(c.files).filter(([path]) => path.endsWith(".h"))) expected[path.split("/").at(-1)] = source;
	for(const [file, name] of [["consumer.pl", "owned-perl-callback-result-sanitizers.pl"]
		, ["runtime.pl", "owned-perl-callback-results.pl"]
		, ["faults.pl", "owned-perl-callback-result-faults.pl"]
		, ["lifetime.pl", "owned-perl-callback-result-lifetime.pl"]])
		expected[file] = await readFile("tests/fixtures/structured-types/" + name, "utf8");
	for(const [path, digest] of Object.entries({ ...compilerC, "Carriers.c": await callbackCarrierCDigest(item.input, carriers, carrierC[mode]) }))
	{ expected[path] = item.sources[path].source; assert.equal(sha256(expected[path]), digest, path); }
	const scripts = [...producer.matchAll(/await save\("sanitized\/build\.pl", `([^]*?)`\);/gu)];
	assert.equal(scripts.length, 1); expected["sanitized/build.pl"] = scripts[0][1];
	assert.equal(sha256(expected["sanitized/build.pl"]), "cdf5c64b2f8ff413c9d66afc73a549df0588df1693a71dc2d4627c94f11f5e22");
	keys(item.sources, Object.keys(expected));
	for(const [path, source] of Object.entries(expected)) assert.deepEqual(item.sources[path], { source, sha256: sha256(source) }, path);
	// Preserve the prepared runtime inventory. The compiler-built original broker
	// is replaced below; its opaque binary hash is not a regenerated-source claim.
	const manifest = structuredClone(item.prebuiltRuntimeManifest);
	const originalBroker = manifest.files["lib/liblean_bridge_native.so"];
	keys(originalBroker, ["bytes", "sha256"]);
	assert.ok(Number.isSafeInteger(originalBroker.bytes) && originalBroker.bytes > 0);
	assert.match(originalBroker.sha256, /^[a-f0-9]{64}$/u);
	delete manifest.files["lib/liblean_bridge_native.so"];
	assert.equal(hash(manifest), "38a5eb3b34b3e7614e9648932e093828c3611a5bf4b99083821ff21151012714");
	return xs;
};
const assertCommand = (record, command, args, env) => {
	assert.equal(record.command, command); assert.deepEqual(record.args, args); assert.deepEqual(record.environment, env);
	const execution = record.execution;
	keys(execution, ["code", "signal", "stdout", "stderr", ...execution.code === 0 ? [] : ["message"]]);
	assert.equal(execution.signal, null); assert.equal(typeof execution.stdout, "string"); assert.equal(typeof execution.stderr, "string");
	if(execution.code !== 0)
		assert.equal(execution.message, `Command failed: ${command} ${args.join(" ")}\n${execution.stderr}`);
};
const assertPositive = (variant, observed, perl, item, xs) => {
	const abi = ownedPerlReceiverVariant(perl);
	const fingerprint = { perlVersion: "v" + abi.split("-")[0], threaded: Number(!abi.endsWith("unthreaded")) };
	if(["cold", "native-leak", "xs-leak"].includes(variant))
		assert.deepEqual(observed, { mode: variant, final: [0, 0, 0, 0, 0, 0], ...fingerprint });
	else if(variant === "runtime") assert.deepEqual(observed, {
		actualLean: true, installedPackage: false, variant: "combined", checks: 92
		, phases: { native: 37, host: 21, combined: 32 }
		, managedLive: 0, nativeLive: 0
		, identities: 0, owners: 0, active: 0, cleanupStatus: 0, ...fingerprint
	});
	else if(variant === "faults") assertOwnedPerlCallbackFaultObservation(observed, perl);
	else assertOwnedPerlCallbackLifetimeObservation(observed, perl, variant
		, item.sources["lifetime.pl"].source, xs.valuesSource, "./lifetime.pl");
};
const assertOutput = (record, perl, item, xs) => {
	const observed = JSON.parse(record.execution.stdout);
	assert.equal(record.execution.stdout, compact(observed) + (["cold", "runtime", "native-leak", "xs-leak"].includes(record.variant) ? "\n" : ""));
	assertPositive(record.variant, observed, perl, item, xs);
	if(record.observed !== undefined) assert.deepEqual(record.observed, observed);
};
const sourceSite = (sources, file, needle) => {
	const lines = sources[file].source.split("\n").flatMap((line, index) => line.includes(needle) ? [index + 1] : []);
	assert.equal(lines.length, 1, needle); return `${file}:${lines[0]}`;
};
const controlSites = sources => Object.fromEntries([
	["sanitizer_allocate", "sanitized/public-api.c", "static void *sanitizer_allocate("]
	, ["sanitizer_native_address", "sanitized/public-api.c", "value[index] = 1;"]
	, ["sanitizer_native_undefined", "sanitized/public-api.c", "return value << shift;"]
	, ["sanitizer_native_leak", "sanitized/public-api.c", "void sanitizer_native_leak(void) {"]
	, ["sanitizer_xs_allocate", "sanitized/Probe.xs", "static void *sanitizer_xs_allocate("]
	, ["XS_LeanBridge__OwnedProbe_sanitizer_native_address", "sanitized/Probe.xs", "    sanitizer_native_address(index);"]
	, ["XS_LeanBridge__OwnedProbe_sanitizer_native_undefined", "sanitized/Probe.xs", "    RETVAL = sanitizer_native_undefined(shift);"]
	, ["XS_LeanBridge__OwnedProbe_sanitizer_native_leak", "sanitized/Probe.xs", "    sanitizer_native_leak();"]
	, ["XS_LeanBridge__OwnedProbe_sanitizer_xs_address", "sanitized/Probe.xs", "value[index] = 1;"]
	, ["XS_LeanBridge__OwnedProbe_sanitizer_xs_undefined", "sanitized/Probe.xs", "RETVAL = value << shift;"]
	, ["XS_LeanBridge__OwnedProbe_sanitizer_xs_leak", "sanitized/Probe.xs", "sanitizer_xs_allocate(73);"]
].map(([name, file, needle]) => [name, sourceSite(sources, file, needle)]));
const escape = value => value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
const binaryOffsetPattern = path => new RegExp("^\\(" + escape(path)
	+ "\\+0x[0-9a-f]+\\)(?: \\(BuildId: [0-9a-f]{40}\\))?$", "u");

/**
 * Recognize a path-bound unsymbolized ELF frame with an optional GNU BuildId.
 *
 * @param location - Symbolizer location text.
 * @param path - Exact binary path expected for the frame.
 */
export const isOwnedPerlBinaryOffsetLocation = (location, path) => binaryOffsetPattern(path).test(location);

const assertStack = (text, context, allowed = []) => {
	const frames = text.split("\n").map((line, index) => {
		const match = /^[ ]{4}#(\d+) 0x[0-9a-f]+ (?:in ([A-Za-z0-9_]+) | )([^\n]+)$/u.exec(line);
		assert.ok(match, "complete sanitizer stack frame: " + line); assert.equal(Number(match[1]), index);
		const name = match[2] ?? "", location = match[3];
		if(context.sites[name])
		{
			assert.ok(allowed.includes(name), "unexpected instrumented frame: " + name);
			assert.match(location, new RegExp("^(?:" + escape(context.directory + "/") + ")?" + escape(context.sites[name]) + "(?::[1-9][0-9]*)?$", "u"));
		}
		else if(asanAllocatorName.test(name))
			assert.equal(isOwnedPerlAsanAllocatorFrame(name, location), true);
		else if(name === "__gmp_default_allocate")
			assert.equal(isOwnedPerlBinaryOffsetLocation(location, context.directory + "/runtime/lib/libleanshared.so"), true);
		else
		{
			const perlFunctions = ["Perl_pp_entersub", "Perl_runops_standard"
				, "perl_run", "main", "_start", "Perl_safesysmalloc"
				, "Perl_safesyscalloc", "Perl_safesysrealloc", "Perl_my_cxt_init"
				, "Perl_savepv", "Perl_savepvn"];
			if(perlFunctions.includes(name))
				assert.equal(isOwnedPerlBinaryOffsetLocation(location, context.perl), true);
			else
			{
				assert.ok(["", "__libc_start_main", "__libc_start_call_main"].includes(name), "unknown sanitizer frame: " + name);
				assert.match(location, /^\((?:\/usr)?\/lib\/x86_64-linux-gnu\/libc\.so\.6\+0x[0-9a-f]+\)(?: \(BuildId: [0-9a-f]{40}\))?$/u);
			}
		}
		return name;
	});
	assert.ok(frames.length > 0); return frames;
};
const allowedControlFrames = variant => {
	const suffix = variant.replace("-", "_");
	return ["sanitizer_" + suffix, "XS_LeanBridge__OwnedProbe_sanitizer_" + suffix
		, variant.startsWith("native-") ? "sanitizer_allocate" : "sanitizer_xs_allocate"];
};
const assertLeakDiagnostic = (diagnostic, context, variant, baseline) => {
	const match = /^\n={65}\n==([1-9][0-9]*)==ERROR: LeakSanitizer: detected memory leaks\n\n([^]+)\n\nSUMMARY: AddressSanitizer: ([1-9][0-9]*) byte\(s\) leaked in ([1-9][0-9]*) allocation\(s\)\.\n$/u.exec(diagnostic);
	assert.ok(match, "complete typed LeakSanitizer diagnostic");
	const blocks = match[2].split("\n\n").map(block => {
		const header = /^(Direct|Indirect) leak of ([1-9][0-9]*) byte\(s\) in ([1-9][0-9]*) object\(s\) allocated from:\n([^]+)$/u.exec(block);
		assert.ok(header, "complete LeakSanitizer allocation block");
		return { kind: header[1], bytes: Number(header[2])
			, allocations: Number(header[3])
			, frames: assertStack(header[4], context, variant === "cold-perl" ? [] : allowedControlFrames(variant)) };
	});
	assert.equal(blocks.reduce((sum, block) => sum + block.bytes, 0), Number(match[3]));
	assert.equal(blocks.reduce((sum, block) => sum + block.allocations, 0), Number(match[4]));
	if(variant === "cold-perl")
	{
		for(const block of blocks)
		{
			assert.match(block.frames[0], asanAllocatorName);
			assert.ok(block.frames.slice(1).every(name => /^Perl_(?:safesysmalloc|safesyscalloc|safesysrealloc|my_cxt_init|savepv|savepvn)$/u.test(name)));
			assert.ok(block.frames.length > 1);
		}
		return;
	}
	if(variant === "cold")
	{
		for(const block of blocks)
		{
			assert.equal(block.kind, "Direct");
			assert.equal(block.frames.length, 2); assert.match(block.frames[0], asanAllocatorName);
			assert.equal(block.frames[1], "__gmp_default_allocate");
		}
		return blocks;
	}
	const leaking = variant.endsWith("-leak"); assert.ok(baseline);
	assert.equal(blocks.length, baseline.length + Number(leaking));
	const control = leaking ? blocks.filter(block => block.frames.some(frame => frame.includes("sanitizer_"))) : [];
	assert.equal(control.length, Number(leaking));
	assert.deepEqual(blocks.filter(block => !control.includes(block)), baseline, "actual per-ABI cold baseline");
	if(leaking)
	{
		const [block] = control; assert.equal(block.kind, "Direct"); assert.equal(block.bytes, 73); assert.equal(block.allocations, 1);
		assert.match(block.frames[0], asanAllocatorName);
		assert.ok(block.frames.includes(variant === "native-leak" ? "sanitizer_native_leak" : "XS_LeanBridge__OwnedProbe_sanitizer_xs_leak"));
	}
};
const shadowLegend = `Shadow byte legend (one shadow byte represents 8 application bytes):
  Addressable:           00
  Partially addressable: 01 02 03 04 05 06 07 
  Heap left redzone:       fa
  Freed heap region:       fd
  Stack left redzone:      f1
  Stack mid redzone:       f2
  Stack right redzone:     f3
  Stack after return:      f5
  Stack use after scope:   f8
  Global redzone:          f9
  Global init order:       f6
  Poisoned by user:        f7
  Container overflow:      fc
  Array cookie:            ac
  Intra object redzone:    bb
  ASan internal:           fe
  Left alloca redzone:     ca
  Right alloca redzone:    cb
`;
const assertAddressDiagnostic = (diagnostic, context, variant, name) => {
	const pattern = /^={65}\n==(?<pid>[1-9][0-9]*)==ERROR: AddressSanitizer: heap-buffer-overflow on address (?<address>0x[0-9a-f]+) at pc 0x[0-9a-f]+ bp 0x[0-9a-f]+ sp 0x[0-9a-f]+\nWRITE of size 1 at \k<address> thread T0\n(?<stack>[^]+?)\n\n\k<address> is located 7 bytes (?:to the right of|after) 1-byte region \[(?<base>0x[0-9a-f]+),(?<end>0x[0-9a-f]+)\)\nallocated by thread T0 here:\n(?<allocated>[^]+?)\n\nSUMMARY: AddressSanitizer: heap-buffer-overflow (?<site>[^\n]+) in (?<name>[^\n]+)\nShadow bytes around the buggy address:\n(?<shadow>[^]+?)\n(?<legend>Shadow byte legend[^]+)\n==\k<pid>==ABORTING\n$/u;
	const match = pattern.exec(diagnostic); assert.ok(match, "complete typed AddressSanitizer control diagnostic");
	const value = match.groups;
	assert.equal(BigInt(value.address), BigInt(value.base) + 8n); assert.equal(BigInt(value.end), BigInt(value.base) + 1n);
	assert.equal(value.name, name); assert.equal(value.site, context.sites[name]);
	assert.equal(assertStack(value.stack, context, allowedControlFrames(variant))[0], name);
	assert.match(assertStack(value.allocated, context, allowedControlFrames(variant))[0], asanAllocatorName);
	assert.equal(value.legend + "\n", shadowLegend);
	const rows = value.shadow.split("\n"); assert.equal(rows.length, 11);
	let previous, stride;
	for(const [index, row] of rows.entries())
	{
		const parsed = /^([ ]{2}|=>)(0x[0-9a-f]+): ((?:[0-9a-f]{2}|\[[0-9a-f]{2}\]| )+)$/u.exec(row);
		assert.ok(parsed, "typed ASan shadow row"); assert.equal(parsed[1], index === 5 ? "=>" : "  ");
		const address = BigInt(parsed[2]);
		if(previous !== undefined)
		{
			const delta = address - previous;
			if(stride === undefined)
			{ assert.ok([16n, 128n].includes(delta), "known ASan shadow label stride"); stride = delta; }
			else assert.equal(delta, stride);
		}
		previous = address;
		const bytes = parsed[3].match(/\[[0-9a-f]{2}\]|[0-9a-f]{2}/gu); assert.equal(bytes.length, 16);
		assert.equal(bytes.filter(byte => byte.startsWith("[")).length, index === 5 ? 1 : 0);
		if(index === 5) assert.ok(bytes.includes("[fa]"));
		for(const byte of bytes) assert.match(byte, /^(?:0[0-7]|f[1-9acd]|ac|bb|ca|cb|fe|\[fa\])$/u);
	}
};
const assertControl = (record, context) => {
	const { variant, execution } = record, native = variant.startsWith("native-");
	const address = variant.endsWith("-address");
	const name = `${native ? "" : "XS_LeanBridge__OwnedProbe_"}sanitizer_${variant.replace("-", "_")}`;
	assert.equal(execution.code, address ? 23 : 1); assert.equal(execution.stdout, "");
	if(address) assertAddressDiagnostic(execution.stderr, context, variant, name);
	else
	{
		const match = /^([^\n]+):([1-9][0-9]*): runtime error: shift exponent 40 is too large for 32-bit type 'int'\n([^]+)\n\n$/u.exec(execution.stderr);
		assert.ok(match, "complete typed UndefinedBehaviorSanitizer control diagnostic");
		assert.equal(match[1], context.sites[name]);
		assert.equal(assertStack(match[3], context, allowedControlFrames(variant))[0], name);
	}
};

/**
 * Verify one original four-ABI report without claiming LeakSanitizer cleanliness.
 *
 * @param name - Independently required report basename.
 * @param item - Original source, command and raw execution evidence.
 */
export const assertOwnedPerlCallbackSanitizers = async (name, item) => {
	assert.ok(ownedPerlCallbackSanitizerReports.includes(name)); const mode = name.slice(0, -5);
	keys(item, ["schemaVersion", "kind", "mode", "installedPackage"
		, "options", "sources", "commands", "observations", "input"
		, "instrumented", "uninstrumented", "coverage", "prebuiltRuntimeManifest"
		, "sanitizerEnvironment", "sanitizerLibraries", "strictLeakEnvironment"]);
	assert.equal(item.schemaVersion, 1); assert.equal(item.kind, "owned-perl-callback-result-sanitizers");
	assert.equal(item.mode, mode); assert.equal(item.installedPackage, false);
	assert.deepEqual(item.instrumented, [
		"native ownership adapter", "shared native broker", "generated Perl XS"
		, "compiler-emitted Owned.c", "compiler-emitted Carriers.c"
		, "compiler-emitted Witness.c", "generated Callbacks.c"]);
	assert.deepEqual(item.uninstrumented, ["prebuilt Perl interpreter and standard XS modules", "prebuilt Lean runtime", "GMP"]);
	assert.deepEqual(item.coverage, {
		addressAndUndefined: "fail-fast executions with leak detection disabled"
		, ownershipCleanup: "six explicit counters, separate from sanitizer coverage"
		, leakSanitizer: "not clean or detector unavailable: strict diagnostics retained separately; no leak-free claim"
		, forkChild: "foreign-context checks use _exit without a child leak checkpoint"
	});
	// Opaque system-library hashes are recorded identities, not regenerated
	// production code. Cross-bind paths with discovery commands and LD_PRELOAD;
	// a future immutable receipt pins the original bytes without requiring those
	// exact libraries to exist on the verification machine.
	const libraries = item.sanitizerLibraries; assert.equal(libraries.length, 2);
	for(const [index, library] of libraries.entries())
	{
		keys(library, ["path", "sha256"]); assert.match(library.sha256, /^[a-f0-9]{64}$/u);
		assert.match(library.path, new RegExp("^/usr/lib/gcc/x86_64-linux-gnu/[1-9][0-9]*/lib" + (index ? "ubsan" : "asan") + "\\.so$", "u"));
	}
	assert.equal(libraries[0].path.replace(/libasan\.so$/u, ""), libraries[1].path.replace(/libubsan\.so$/u, ""));
	const strictEnvironment = leakEnvironment(libraries.map(library => library.path).join(":"));
	const addressEnvironment = { ...strictEnvironment, ASAN_OPTIONS: "detect_leaks=0:halt_on_error=1" };
	assert.deepEqual(item.sanitizerEnvironment, addressEnvironment); assert.deepEqual(item.strictLeakEnvironment, strictEnvironment);
	const xs = await assertSources(mode, item);
	assertOwnedPerlReceiverMatrix(item.observations);
	let commandIndex = 0;
	const command = (executable, args, env, record, output) => {
		const actual = item.commands[commandIndex++]; keys(actual, ["command", "args", "environment", "execution"]);
		assertCommand(actual, executable, args, env);
		if(record) assert.deepEqual(actual, Object.fromEntries(["command", "args", "environment", "execution"].map(key => [key, record[key]])));
		if(output !== undefined) assert.deepEqual(actual.execution, success(output));
		return actual;
	};
	for(const source of ["Owned", "Carriers", "Witness", "Callbacks"])
	{
		const args = [...flags, "-I", "runtime/include"
			, ...source === "Carriers" ? ["-include", "carriers.h"] : []
			, "-c", source + ".c", "-o", "sanitized/" + source + ".o"];
		command("/usr/bin/cc", args, environment, null, "");
	}
	const rpaths = item.commands[4].args.filter(arg => arg.startsWith("-Wl,-rpath,")); assert.equal(rpaths.length, 1);
	const match = /^-Wl,-rpath,((?:\/[A-Za-z0-9._-]+)+\/lean-bridge-owned-native-[A-Za-z0-9]+)\/runtime\/lib$/u.exec(rpaths[0]); assert.ok(match);
	const directory = match[1];
	assert.ok(directory.split("/").every(part => ![".", ".."].includes(part)));
	const brokerArgs = [...flags, "-shared", "-pthread", "-I", "runtime/include"
		, "sanitized/broker.c"
		, "-L", "runtime/lib", "-Wl,--no-as-needed", "-lleanshared", "-Wl,-z,defs"
		, "-Wl,-soname,liblean_bridge_native.so"
		, "-Wl,-rpath," + directory + "/runtime/lib"
		, "-o", "sanitized/lib/liblean_bridge_native.so"];
	command("/usr/bin/cc", brokerArgs, environment, null, "");
	const adapterArgs = ["-std=c11", ...flags, "-shared", "-Wall"
		, "-Wextra", "-Werror"
		, "-I", ".", "-I", "runtime/include", "sanitized/public-api.c"
		, ...["Owned", "Carriers", "Witness", "Callbacks"].map(source => "sanitized/" + source + ".o")
		, "-L", "sanitized/lib", "-L", "runtime/lib"
		, "-llean_bridge_native", "-lleanshared", "-lgmp", "-Wl,-z,defs"
		, `-Wl,-rpath,${directory}/sanitized/lib:${directory}/runtime/lib`
		, "-o", "libowned-perl.so"];
	command("/usr/bin/cc", adapterArgs, environment, null, "");
	for(const library of libraries) command("/usr/bin/cc", ["-print-file-name=" + library.path.split("/").at(-1)], environment, null, library.path + "\n");
	for(const observation of item.observations)
	{
		keys(observation, ["perl", "fingerprintExecution", "fingerprint"
			, "xsC", "xsCSha256"
			, "executions", "strictLeakExecutions", "coldPerlDefault", "coldPerlFull"]);
		const { perl } = observation, abi = ownedPerlReceiverVariant(perl);
		assert.match(perl, /^\/(?:[A-Za-z0-9._-]+\/)+perl\/[A-Za-z0-9.-]+\/bin\/perl$/u);
		const context = { sites: controlSites(item.sources), perl, directory };
		const fingerprint = { perlVersion: "v" + abi.split("-")[0], threaded: Number(!abi.endsWith("unthreaded")) };
		assert.deepEqual(observation.fingerprint, fingerprint);
		assert.equal(observation.xsCSha256, sha256(observation.xsC)); assert.equal(observation.xsCSha256, parseXsC[abi.split("-")[0]]);
		for(const field of ["fingerprintExecution", "coldPerlDefault", "coldPerlFull"])
			keys(observation[field], ["command", "args", "environment", "execution"]);
		command(perl, fingerprintArgs, environment, observation.fingerprintExecution, compact(fingerprint));
		command(perl, ["sanitized/build.pl"], environment, null, "");
		const defaultEnvironment = { ...strictEnvironment }; delete defaultEnvironment.PERL_DESTRUCT_LEVEL;
		command(perl, fingerprintArgs, defaultEnvironment, observation.coldPerlDefault);
		assert.equal(observation.coldPerlDefault.execution.stdout, compact(fingerprint));
		assert.equal(observation.coldPerlDefault.execution.code, fingerprint.threaded ? 23 : 0);
		if(!fingerprint.threaded) assert.deepEqual(observation.coldPerlDefault.execution, success(compact(fingerprint)));
		else assertLeakDiagnostic(observation.coldPerlDefault.execution.stderr, context, "cold-perl");
		command(perl, fingerprintArgs, strictEnvironment, observation.coldPerlFull, compact(fingerprint));
		assert.deepEqual(observation.strictLeakExecutions.map(record => record.variant), strict);
		const cold = observation.strictLeakExecutions[0];
		assert.equal(isOwnedPerlCallbackLsanUnavailable(cold.execution.stderr), false, "cold detector unavailable: no baseline comparison can be claimed");
		const baseline = assertLeakDiagnostic(cold.execution.stderr, context, "cold");
		const observedBaseline = {
			bytes: baseline.reduce((sum, block) => sum + block.bytes, 0)
			, allocations: baseline.reduce((sum, block) => sum + block.allocations, 0)
			, source: "prebuilt Lean/GMP"
		};
		for(const record of observation.strictLeakExecutions)
		{
			const unavailable = isOwnedPerlCallbackLsanUnavailable(record.execution.stderr);
			keys(record, ["variant", "command", "args", "environment", "execution", "leakStatus", ...unavailable ? [] : ["observedBaseline"]]);
			command(perl, ["-I.", "consumer.pl", record.variant], strictEnvironment, record);
			assert.equal(record.execution.code, 23);
			assertOutput(record, perl, item, xs);
			assert.equal(record.leakStatus, unavailable ? "detector-unavailable" : "not-clean");
			if(unavailable) continue;
			assert.deepEqual(record.observedBaseline, observedBaseline);
			assertLeakDiagnostic(record.execution.stderr, context, record.variant, baseline);
		}
		assert.deepEqual(observation.executions.map(record => record.variant), [...positive, ...controls]);
		for(const record of observation.executions)
		{
			const accepted = positive.includes(record.variant);
			keys(record, ["variant", "command", "args", "environment", "execution", ...accepted ? ["observed"] : []]);
			command(perl, ["-I.", "consumer.pl", record.variant], addressEnvironment, record);
			if(accepted)
			{
				assert.deepEqual(record.execution, success(record.execution.stdout));
				assertOutput(record, perl, item, xs);
			}
			else assertControl(record, context);
		}
	}
	assert.equal(commandIndex, 88); assert.equal(item.commands.length, commandIndex);
};

/**
 * Require both source paths and their four-ABI sanitized execution matrices.
 *
 * @param reports - Original reports keyed by the required basenames.
 */
export const assertOwnedPerlCallbackSanitizerMatrix = async reports => {
	keys(reports, ownedPerlCallbackSanitizerReports);
	for(const name of ownedPerlCallbackSanitizerReports) await assertOwnedPerlCallbackSanitizers(name, reports[name]);
};
