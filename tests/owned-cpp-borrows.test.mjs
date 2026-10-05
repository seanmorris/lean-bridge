/**
 * Original-owner C++ borrowed results through compiled Lean and checked C views.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { generateOwnedCPackage } from "../src/backends/c/owned-package.mjs";
import { generateOwnedCppPackage } from "../src/backends/cpp/owned-package.mjs";
import { ownedAggregateReviewedIr } from "./helpers/owned-aggregate-fixture.mjs";
import { ownedBorrowReviewedIr } from "./helpers/owned-borrow-fixture.mjs";
import { compileOwnedAggregateFixture } from "./helpers/owned-aggregate-native.mjs";
import { ownedCppBorrowReviewedIr, ownedCppBorrowConfiguration, ownedCppBorrowSource } from "./helpers/owned-cpp-borrow-fixture.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";

const fixture = "tests/fixtures/structured-types/owned-cpp-borrows.cpp";
const writeHeaders = async (directory, generated) => {
	for(const [path, source] of Object.entries({ ...generated.files, [`include/${generated.c.prefix}.h`]: generated.c.header }))
		await saveLakeFile(directory, path, source);
};

test("C++ borrowed results require whole-value owners without changing unanchored headers", async t => {
	const ir = ownedCppBorrowReviewedIr(), before = structuredClone(ir);
	assert.throws(() => generateOwnedCppPackage(ir, { transferredInputs: true }), /explicit output leases/u);
	const generated = generateOwnedCppPackage(ir, { transferredInputs: true, anchoredResults: true });
	assert.deepEqual(ir, before); assert.equal(generated.contract.schemaVersion, 3);
	assert.equal(generated.c.functions.filter(item => item.anchor !== undefined).length, 19);
	const reversed = structuredClone(ir); reversed.types.reverse();
	assert.deepEqual(generateOwnedCppPackage(reversed, { transferredInputs: true, anchoredResults: true }).files, generated.files);
	assert.deepEqual(generateOwnedCppPackage(ownedAggregateReviewedIr(), { anchoredResults: true }).files, generateOwnedCppPackage(ownedAggregateReviewedIr()).files);
	assert.match(generated.header, /retain_ticket\(const Value<Ticket>& a0\)/u);
	assert.match(generated.header, /transfer_ticket\(Value<Ticket>&& a0\)/u);
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-cpp-borrow-headers-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	await writeHeaders(directory, generated);
	await saveLakeFile(directory, "consumer.cpp", await readFile(fixture));
	await runCopied("/usr/bin/c++", ["-std=c++20", "-Wall", "-Wextra", "-Werror", "-pthread", "-I", "include", "-fsyntax-only", "consumer.cpp"], directory, { PATH: "/usr/bin:/bin" });
	const borrowOnly = generateOwnedCppPackage(ownedBorrowReviewedIr(), { anchoredResults: true });
	assert.equal(borrowOnly.contract.inputTransfers, undefined);
	assert.equal(borrowOnly.c.functions.filter(item => item.anchor !== undefined).length, 18);
	await writeHeaders(join(directory, "borrow-only"), borrowOnly);
	await runCopied("/usr/bin/c++", ["-std=c++20", "-Wall", "-Wextra"
		, "-Werror", "-pthread", "-I", "include", "-fsyntax-only"
		, `src/${borrowOnly.c.prefix}.cpp`], join(directory, "borrow-only"), { PATH: "/usr/bin:/bin" });
});

for(const mode of ["ordinary", "reviewed"]) test(`C++ borrowed results expire with their original owner (${mode})`, {
	skip: process.env.LEAN_BRIDGE_OWNED_CPP_BORROW_TEST !== "1", timeout: 900000
}, async t => {
	const compiled = await compileOwnedAggregateFixture(t, {
		...mode === "ordinary" ? { configuration: await ownedCppBorrowConfiguration() } : { reviewedIr: ownedCppBorrowReviewedIr() }
		, hostCallbacks: true, sourceSuffix: ownedCppBorrowSource
		, evidenceName: `cpp-borrows-${mode}-inputs.json`
	});
	const generated = generateOwnedCPackage({ metadata: compiled.metadata
		, sourceIdentity: compiled.sourceIdentity, component: compiled.model.component
		, hostCallbacks: true, transferredInputs: true, anchoredResults: true });
	const cpp = generateOwnedCppPackage(generated.layout.model.bindingIr, { transferredInputs: true, anchoredResults: true });
	const implementation = `#include <stddef.h>
extern void *owned_test_allocate(size_t);
extern void owned_test_free(void *);
#define LB_OWNED_ALLOC owned_test_allocate
#define LB_OWNED_FREE owned_test_free
${generated.source}
size_t owned_test_identities(void) {
  lean_bridge_native_snapshot snapshot; lean_bridge_native_snapshot_read(&snapshot);
  return snapshot.live_identities;
}
`;
	for(const [path, source] of Object.entries(generated.files))
		await saveLakeFile(compiled.directory, path.startsWith("src/") ? "public-api.c" : path.split("/").at(-1), path.startsWith("src/") ? implementation : source);
	await writeHeaders(compiled.directory, cpp);
	const source = await readFile(fixture, "utf8"); await saveLakeFile(compiled.directory, "consumer.cpp", source);
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
			, "Callbacks.o", "-L", join(compiled.directory, "runtime/lib")
			, "-llean_bridge_native", "-lleanshared", "-lgmp"
			, "-Wl,-rpath," + join(compiled.directory, "runtime/lib")
			, "-o", `libowned-cpp-borrows${suffix}.so`]
		, compiled.directory, environment);
		await runCopied("/usr/bin/c++", ["-std=c++20", "-O1", "-g", "-Wall"
			, "-Wextra", "-Werror", "-pthread", ...flags
			, ...sanitized ? ["-no-pie"] : [], "-I", "include", "consumer.cpp"
			, "-L", compiled.directory, `-l:libowned-cpp-borrows${suffix}.so`
			, "-lgmp", "-Wl,--export-dynamic", "-Wl,-rpath," + compiled.directory
			, "-o", `consumer${suffix}`], compiled.directory, environment);
		return extra => runCopied("/bin/sh", ["-c", 'ulimit -c 0\nexec "$@"', "owned-cpp-borrows", join(compiled.directory, `consumer${suffix}`)], compiled.directory
			, { ...environment, ASAN_OPTIONS: "detect_leaks=1:halt_on_error=1", UBSAN_OPTIONS: "halt_on_error=1:print_stacktrace=1", LSAN_OPTIONS: "exitcode=0", ...extra });
	};
	const normal = await (await compile(false))({}); assert.equal(normal.stderr, "");
	const result = JSON.parse(normal.stdout); t.diagnostic(JSON.stringify({ mode, ...result }));
	const sanitized = await compile(true), cold = await sanitized({ LEAN_BRIDGE_OWNED_COLD_ONLY: "1" }), exercised = await sanitized({});
	assert.deepEqual(JSON.parse(cold.stdout), { cold: true });
	const sanitizer = JSON.parse(exercised.stdout);
	for(const observed of [result, sanitizer])
	{
		assert.ok(observed.checks > 100);
		assert.equal(observed.live, 0); assert.equal(observed.identities, 0);
		for(const key of ["cppFaults", "nativeFaults", "before", "after"]) assert.ok(observed[key] > 0, key);
	}
	const normalize = text => text.replace(/==\d+==/gu, "==PID==").replace(/0x[0-9a-f]+/gu, "ADDRESS").replaceAll(compiled.directory, "<probe>");
	assert.doesNotMatch(exercised.stderr, /ERROR: AddressSanitizer|runtime error:/u);
	assert.equal(normalize(exercised.stderr), normalize(cold.stderr));
	const mutations = [
		{ name: "missing-whole-value-validation"
			, file: `include/${cpp.c.prefix}-values.hpp`
			, before: "storage_->lease->require(); return storage_->value;"
			, after: "return storage_->value;" }
		, { name: "empty-owner-dropped", file: `include/${cpp.c.prefix}-values.hpp`
			, before: "lease->require(); return Value<T>(std::move(lease), std::move(value));"
			, after: "if constexpr (requires { value.empty(); }) { if (value.empty()) return {}; }\n    lease->require(); return Value<T>(std::move(lease), std::move(value));" }
		, { name: "callback-wrapper-escape"
			, file: `include/${cpp.c.prefix}-values.hpp`
			, before: "~BorrowFrame() { scope->active.store(false); }"
			, after: "~BorrowFrame() {}" }
		, { name: "raw-pointer-equality", file: `include/${cpp.c.prefix}.hpp`
			, before: `checked(${cpp.c.prefix}_ticket_t_equal(state->require(), left, right, &result)); return result;`
			, after: "result = left == right; return result;" }
	];
	for(const mutation of mutations)
	{
		await writeHeaders(compiled.directory, cpp);
		assert.equal(cpp.files[mutation.file].split(mutation.before).length, 2, mutation.name);
		await saveLakeFile(compiled.directory, mutation.file, cpp.files[mutation.file].replace(mutation.before, mutation.after));
		await runCopied("/usr/bin/c++", ["-std=c++20", "-O0", "-Wall"
			, "-Wextra", "-Werror", "-pthread", "-I", "include", "consumer.cpp"
			, "-L", compiled.directory, "-l:libowned-cpp-borrows.so"
			, "-lgmp", "-Wl,--export-dynamic", "-Wl,-rpath," + compiled.directory
			, "-o", mutation.name], compiled.directory, environment);
		await assert.rejects(() => runCopied("/bin/sh", ["-c", 'ulimit -c 0\nexec "$@"', mutation.name, join(compiled.directory, mutation.name)], compiled.directory, environment), /owned C\+\+ borrow check failed/u, mutation.name);
	}
	await writeHeaders(compiled.directory, cpp);
	await saveLakeFile(resolve("build/owned-cpp-borrows"), `${mode}.json`, canonicalJson({
		mode, actualLean: true, compiledLean: true, installedPackage: false
		, result, sanitizer, contract: cpp.contract
		, input: { metadata: compiled.metadata, sourceIdentity: compiled.sourceIdentity, component: compiled.model.component }
		, probeSha256: sha256(source), sourceSha256: sha256(generated.source)
		, startupLeakBaseline: normalize(cold.stderr)
		, rejectedMutations: mutations.map(item => item.name)
	}));
});
