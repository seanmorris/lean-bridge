/**
 * Compile C++ callback-owner APIs and execute them against fresh Lean artifacts.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { generateOwnedCPackage } from "../src/backends/c/owned-package.mjs";
import { generateOwnedCppPackage } from "../src/backends/cpp/owned-package.mjs";
import { ownedAggregateReviewedIr } from "./helpers/owned-aggregate-fixture.mjs";
import { ownedCallbackResultConfiguration, ownedCallbackResultReviewedIr, ownedCallbackResultSource
	, ownedCallbackResultCombinedConfiguration, ownedCallbackResultCombinedReviewedIr
	, ownedCallbackResultCombinedSource } from "./helpers/owned-callback-result-fixture.mjs";
import { compileOwnedAggregateFixture } from "./helpers/owned-aggregate-native.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";

const capabilities = (hostCallbacks, combined) => ({
	callbackResultAnchors: true, hostCallbacks, valueCopies: true
	, transferredInputs: combined, anchoredResults: combined
	, receiverExports: combined
});
const headers = async (root, generated) => {
	for(const [path, text] of Object.entries({ ...generated.files, [`include/${generated.c.prefix}.h`]: generated.c.header }))
		await saveLakeFile(root, path, text);
};
const probe = async (hostCallbacks, combined) => `#define HOST_CALLBACKS ${Number(hostCallbacks)}\n#define COMBINED ${Number(combined)}\n`
	+ await readFile("tests/fixtures/structured-types/owned-cpp-callback-results.cpp", "utf8");
const variants = [{ name: "base-nohost", hostCallbacks: false, combined: false }
	, { name: "base-host", hostCallbacks: true, combined: false }
	, { name: "combined", hostCallbacks: true, combined: true }];

const semanticMutations = (cpp, combined) => {
	const p = cpp.c.prefix, bundle = cpp.types.find(type => type.hostName === "Bundle");
	const entries = [
		["unchecked-result-owner", `include/${p}-values.hpp`
			, `checked(${p}_result_validate(state_->require(), owner));`
			, "(void)owner;"]
		, ["retention-shares-owner", `include/${p}-values.hpp`
			, "Value retain() const { return detail::ValueOps<T>::copy(get()); }"
			, "Value retain() const { (void)get(); return *this; }"]
		, ...combined ? [
			["host-borrow-never-expires", `include/${p}-values.hpp`
				, "~BorrowFrame() { scope->active.store(false); }", "~BorrowFrame() {}"]
			, ["host-reply-after-expiration", `include/${p}.hpp`
				, `      owned_check${bundle.index}(owned_callback_reply(reply), 0, self.call.budget, self.call.state);`
				, `      frame.scope->active.store(false);\n      owned_check${bundle.index}(owned_callback_reply(reply), 0, self.call.budget, self.call.state);`]
			, ["host-exception-identity-erased", `include/${p}.hpp`
				, "if (call.error) std::rethrow_exception(call.error);"
				, "if (call.error) throw Error(OWNED_AGGREGATES_CALLBACK_FAILED);"]
			, ["transfer-consumes-copy", `include/${p}.hpp`
				, "moves.add(ValueAccess::lease(a0, call.state), 0);"
				, "moves.add(ValueAccess::lease(a0.retain(), call.state), 0);"]
		] : []
	];
	return entries.map(([name, path, before, after]) => {
		const original = cpp.files[path], occurrences = original.split(before).length - 1;
		assert.ok(occurrences > 0, name);
		return { name, path, occurrences, source: original.replaceAll(before, after) };
	});
};

test("C++ callback result headers preserve local anchors without invented capabilities", async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-cpp-callback-result-headers-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	for(const { hostCallbacks, combined } of variants)
	{
		const ir = combined ? ownedCallbackResultCombinedReviewedIr() : ownedCallbackResultReviewedIr();
		const before = structuredClone(ir), options = capabilities(hostCallbacks, combined);
		assert.throws(() => generateOwnedCppPackage(ir, { ...options, callbackResultAnchors: false }), /explicit output leases/u);
		const generated = generateOwnedCppPackage(ir, options);
		assert.deepEqual(ir, before); assert.equal(generated.contract.schemaVersion, 5);
		assert.equal(generated.contract.callbackResultAnchors.signatures.length, 4);
		for(const callback of generated.c.callbacks.filter(value => value.anchor !== undefined))
		{
			const item = ir.types.find(type => type.id === callback.id);
			const position = item.callable.parameters.findIndex(parameter => parameter.name === item.callable.result.lifetime.anchor);
			assert.equal(callback.anchor, position + 1);
			assert.equal(generated.contract.callbackResultAnchors.signatures.find(value => value.id === callback.id).parameter, position);
		}
		for(const key of ["inputTransfers", "resultAnchors", "receiverExports"])
			assert.equal(Boolean(generated.contract[key]), combined);
		if(!hostCallbacks) assert.doesNotMatch(generated.header, /OwnedCallbackView|_host\b/u);
		await headers(directory, generated); await saveLakeFile(directory, "consumer.cpp", await probe(hostCallbacks, combined));
		await runCopied("/usr/bin/c++", ["-std=c++20", "-Wall", "-Wextra"
			, "-Werror", "-pthread", "-I", "include", "-fsyntax-only", "consumer.cpp"]
		, directory, { PATH: "/usr/bin:/bin" });
	}
	const legacy = ownedAggregateReviewedIr();
	assert.deepEqual(generateOwnedCppPackage(legacy, { callbackResultAnchors: true }).files, generateOwnedCppPackage(legacy).files);
});

for(const mode of ["ordinary", "reviewed"]) for(const { name, hostCallbacks, combined } of variants)
	test(`C++ callback owners execute ${mode}-${name}`, {
		skip: process.env.LEAN_BRIDGE_OWNED_CPP_CALLBACK_RESULT_TEST !== "1"
		, timeout: 900000
	}, async t => {
		const configuration = combined ? ownedCallbackResultCombinedConfiguration : ownedCallbackResultConfiguration;
		const reviewedIr = combined ? ownedCallbackResultCombinedReviewedIr : ownedCallbackResultReviewedIr;
		const compiled = await compileOwnedAggregateFixture(t, {
			...mode === "ordinary" ? { configuration: await configuration() } : { reviewedIr: reviewedIr() }
			, hostCallbacks
			, sourceSuffix: combined ? ownedCallbackResultCombinedSource : ownedCallbackResultSource
			, evidenceName: `cpp-callback-result-${mode}-${name}-inputs.json`
		});
		const input = { metadata: compiled.metadata
			, sourceIdentity: compiled.sourceIdentity
			, component: compiled.model.component, ...capabilities(hostCallbacks, combined) };
		const c = generateOwnedCPackage(input), cpp = generateOwnedCppPackage(c.layout.model.bindingIr, capabilities(hostCallbacks, combined));
		assert.equal(c.publicHeader, cpp.c.header);
		const handoff = "static inline void oc_transfer_consume(void *context) {";
		if(combined) assert.equal(c.source.split(handoff).length, 2);
		const implementation = `#include <stddef.h>
extern void *owned_test_allocate(size_t);
extern void owned_test_free(void *);
static size_t handoffs;
#define LB_OWNED_ALLOC owned_test_allocate
#define LB_OWNED_FREE owned_test_free
${combined ? c.source.replace(handoff, handoff + "\n  ++handoffs;") : c.source}
size_t owned_test_handoffs(void) { return handoffs; }
size_t owned_test_identities(void) {
  lean_bridge_native_snapshot snapshot; lean_bridge_native_snapshot_read(&snapshot);
  return snapshot.live_identities;
}
`;
		for(const [path, text] of Object.entries(c.files))
			await saveLakeFile(compiled.directory, path.startsWith("src/") ? "public-api.c" : path.split("/").at(-1), path.startsWith("src/") ? implementation : text);
		await headers(compiled.directory, cpp);
		const source = await probe(hostCallbacks, combined); await saveLakeFile(compiled.directory, "consumer.cpp", source);
		const environment = { PATH: "/usr/bin:/bin" };
		const compile = async sanitized => {
			const suffix = sanitized ? "-sanitized" : "", flags = sanitized ? ["-fsanitize=address,undefined", "-fno-omit-frame-pointer"] : [];
			await runCopied("/usr/bin/cc", ["-std=c11", "-O1", "-g", "-Wall"
				, "-Wextra", "-Werror", "-fPIC", ...flags
				, "-I", join(compiled.directory, "runtime/include")
				, "-c", "public-api.c", "-o", `public-api${suffix}.o`]
			, compiled.directory, environment);
			await runCopied("/usr/bin/cc", ["-shared", ...flags
				, `public-api${suffix}.o`, "Owned.o", "Carriers.o", "Witness.o"
				, ...hostCallbacks ? ["Callbacks.o"] : []
				, "-L", join(compiled.directory, "runtime/lib")
				, "-llean_bridge_native", "-lleanshared", "-lgmp"
				, "-Wl,-rpath," + join(compiled.directory, "runtime/lib")
				, "-o", `libcallback-results${suffix}.so`]
			, compiled.directory, environment);
			await runCopied("/usr/bin/c++", ["-std=c++20", "-O1", "-g", "-Wall"
				, "-Wextra", "-Werror", "-pthread", ...flags
				, ...sanitized ? ["-no-pie"] : [], "-I", "include", "consumer.cpp"
				, "-L", compiled.directory, `-l:libcallback-results${suffix}.so`
				, "-lgmp", "-Wl,--export-dynamic"
				, "-Wl,-rpath," + compiled.directory, "-o", `consumer${suffix}`]
			, compiled.directory, environment);
			return extra => runCopied("/bin/sh", ["-c", 'ulimit -c 0\nexec "$@"', "cpp-callback-results", join(compiled.directory, `consumer${suffix}`)]
				, compiled.directory, { ...environment, ASAN_OPTIONS: "detect_leaks=1:halt_on_error=1", UBSAN_OPTIONS: "halt_on_error=1:print_stacktrace=1", LSAN_OPTIONS: "exitcode=0", ...extra });
		};
		const normal = await (await compile(false))({}); assert.equal(normal.stderr, "");
		const result = JSON.parse(normal.stdout); t.diagnostic(JSON.stringify({ mode, name, ...result }));
		assert.ok(result.checks > 100); assert.ok(result.cppFaults > 0 && result.nativeFaults > 0);
		assert.equal(result.live, 0); assert.equal(result.identities, 0);
		if(combined) for(const point of ["cppBefore", "cppAfter", "nativeBefore", "nativeAfter"])
			assert.ok(result.transfers[point] > 0, point);
		const sanitized = await compile(true), cold = await sanitized({ LEAN_BRIDGE_OWNED_COLD_ONLY: "1" }), exercised = await sanitized({});
		assert.deepEqual(JSON.parse(cold.stdout), { cold: true });
		assert.deepEqual(JSON.parse(exercised.stdout), result);
		const normalize = text => text.replace(/==\d+==/gu, "==PID==").replace(/0x[0-9a-f]+/gu, "ADDRESS").replaceAll(compiled.directory, "<probe>");
		assert.doesNotMatch(exercised.stderr, /ERROR: AddressSanitizer|runtime error:/u);
		assert.equal(normalize(exercised.stderr), normalize(cold.stderr));
		const mutations = [];
		if(name !== "base-host") for(const mutation of semanticMutations(cpp, combined))
		{
			t.diagnostic(`${mode}-${name}: compile and reject ${mutation.name}`);
			await saveLakeFile(compiled.directory, mutation.path, mutation.source);
			try
			{
				const execute = await compile(false);
				await assert.rejects(() => execute({}), error => {
					assert.equal(error.code, "build-command-failed");
					assert.match(error.details.stderr, /owned C\+\+ callback result check failed|terminate called after throwing an instance of/u);
					mutations.push({ name: mutation.name, path: mutation.path
						, occurrences: mutation.occurrences
						, sourceSha256: sha256(mutation.source)
						, compiled: true, semanticRejection: true
						, diagnostic: error.details.stderr });
					return true;
				}, mutation.name);
			}
			finally
			{ await saveLakeFile(compiled.directory, mutation.path, cpp.files[mutation.path]); }
		}
		const restored = await (await compile(false))({});
		assert.equal(restored.stderr, ""); assert.deepEqual(JSON.parse(restored.stdout), result);
		await saveLakeFile("build/owned-cpp-callback-results", `${mode}-${name}.json`, canonicalJson({
			mode, name, hostCallbacks, combined, input, result
			, sanitizer: "address,undefined", startupLeakBaseline: normalize(cold.stderr)
			, probeSha256: sha256(source), sourceSha256: sha256(c.source)
			, contract: cpp.contract, mutations, restored: JSON.parse(restored.stdout)
		}));
	});
