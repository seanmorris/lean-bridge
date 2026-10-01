/**
 * Compile public C++ member syntax and execute it against fresh Lean code.
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
import { ownedCppReceiverConfiguration, ownedCppReceiverReviewedIr, ownedCppReceiverProbe, ownedCppReceiverSource } from "./helpers/owned-cpp-receiver-fixture.mjs";
import { compileOwnedAggregateFixture } from "./helpers/owned-aggregate-native.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";

const capabilities = { transferredInputs: true, anchoredResults: true, receiverExports: true };
const headers = async (directory, generated) => {
	for(const [path, source] of Object.entries({ ...generated.files, [`include/${generated.c.prefix}.h`]: generated.c.header }))
		await saveLakeFile(directory, path, source);
};
const syntax = (directory, path) => runCopied("/usr/bin/c++", ["-std=c++20", "-Wall", "-Wextra", "-Werror", "-pthread", "-I", "include", "-fsyntax-only", path], directory, { PATH: "/usr/bin:/bin" });

test("C++ receiver members preserve nominal owners and consuming ref qualifiers", async t => {
	const ir = ownedCppReceiverReviewedIr(), before = structuredClone(ir);
	assert.throws(() => generateOwnedCppPackage(ir, { ...capabilities, receiverExports: false }), /only synchronous function/u);
	const generated = generateOwnedCppPackage(ir, capabilities);
	assert.deepEqual(ir, before); assert.equal(generated.contract.schemaVersion, 4);
	assert.equal(generated.contract.receiverExports.exports.length, 16);
	assert.equal(generated.c.functions.length, 27);
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-cpp-receiver-headers-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	await headers(directory, generated);
	await saveLakeFile(directory, "consumer.cpp", await ownedCppReceiverProbe());
	await syntax(directory, "consumer.cpp");
	for(const name of ["close", "get", "is_closed", "retain"])
	{
		const invalid = structuredClone(ir); invalid.declarations.find(item => item.name === "serial").name = name;
		assert.throws(() => generateOwnedCppPackage(invalid, capabilities), /receiver member is reserved/u);
	}
	const previous = ownedAggregateReviewedIr();
	assert.deepEqual(generateOwnedCppPackage(previous, { receiverExports: true }).files, generateOwnedCppPackage(previous).files);
	const permuted = structuredClone(ir); permuted.types.reverse();
	assert.deepEqual(generateOwnedCppPackage(permuted, capabilities).files, generated.files);
});

test("C++ receiver-only headers do not invent anchor or callback dependencies", async t => {
	const ir = ownedCppReceiverReviewedIr();
	ir.declarations = ir.declarations.filter(item => ["newTicket", "serial", "retainTicket", "transferTicket"].includes(item.name));
	ir.types = ir.types.filter(item => item.id === "lean:Owned.Ticket"); ir.errors = [];
	for(const item of ir.declarations) if(item.result.ownership === "borrow")
		Object.assign(item.result, { ownership: "lease", lifetime: { scope: "explicit", anchor: null } });
	const generated = generateOwnedCppPackage(ir, { receiverExports: true, transferredInputs: true, hostCallbacks: false });
	assert.equal(generated.contract.resultAnchors, undefined);
	assert.doesNotMatch(generated.valuesHeader, /_result_validate\(/u);
	assert.doesNotMatch(generated.header, /_host\b/u);
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-cpp-plain-receiver-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	await headers(directory, generated);
	await saveLakeFile(directory, "consumer.cpp", `#include "owned_aggregates.hpp"
namespace api = lean_bridge::owned_aggregates;
void consumer() {
  auto value = api::new_ticket(42, "receiver");
  auto independent = value.retain_ticket();
  auto moved = std::move(value).transfer_ticket();
  (void)independent.serial(); (void)moved.get().serial();
}
`);
	await syntax(directory, "consumer.cpp");
});

for(const mode of ["ordinary", "reviewed"]) test(`C++ member calls preserve original owners through compiled Lean (${mode})`, {
	skip: process.env.LEAN_BRIDGE_OWNED_CPP_RECEIVER_TEST !== "1", timeout: 900000
}, async t => {
	const compiled = await compileOwnedAggregateFixture(t, {
		...mode === "ordinary" ? { configuration: await ownedCppReceiverConfiguration() } : { reviewedIr: ownedCppReceiverReviewedIr() }
		, hostCallbacks: true, sourceSuffix: ownedCppReceiverSource
		, evidenceName: `cpp-receivers-${mode}-inputs.json`
	});
	const input = { metadata: compiled.metadata
		, sourceIdentity: compiled.sourceIdentity
		, component: compiled.model.component, hostCallbacks: true, ...capabilities };
	const generated = generateOwnedCPackage(input);
	const cpp = generateOwnedCppPackage(generated.layout.model.bindingIr, capabilities);
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
	await headers(compiled.directory, cpp);
	const source = await ownedCppReceiverProbe(); await saveLakeFile(compiled.directory, "consumer.cpp", source);
	for(const item of cpp.contract.receiverExports.exports)
		assert.match(source, new RegExp(`\\.${item.member}\\(`, "u"), item.member);
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
			, "Callbacks.o"
			, "-L", join(compiled.directory, "runtime/lib")
			, "-llean_bridge_native", "-lleanshared", "-lgmp"
			, "-Wl,-rpath," + join(compiled.directory, "runtime/lib")
			, "-o", `libreceivers${suffix}.so`], compiled.directory, environment);
		await runCopied("/usr/bin/c++", ["-std=c++20", "-O1", "-g", "-Wall"
			, "-Wextra", "-Werror", "-pthread", ...flags
			, ...sanitized ? ["-no-pie"] : [], "-I", "include", "consumer.cpp"
			, "-L", compiled.directory, `-l:libreceivers${suffix}.so`
			, "-lgmp", "-Wl,--export-dynamic"
			, "-Wl,-rpath," + compiled.directory, "-o", `consumer${suffix}`]
		, compiled.directory, environment);
		return extra => runCopied("/bin/sh", ["-c", 'ulimit -c 0\nexec "$@"', "cpp-receivers", join(compiled.directory, `consumer${suffix}`)], compiled.directory
			, { ...environment, ASAN_OPTIONS: "detect_leaks=1:halt_on_error=1", UBSAN_OPTIONS: "halt_on_error=1:print_stacktrace=1", LSAN_OPTIONS: "exitcode=0", ...extra });
	};
	const normal = await (await compile(false))({}); assert.equal(normal.stderr, "");
	const result = JSON.parse(normal.stdout); t.diagnostic(JSON.stringify({ mode, ...result }));
	const sanitized = await compile(true), cold = await sanitized({ LEAN_BRIDGE_OWNED_COLD_ONLY: "1" }), exercised = await sanitized({});
	assert.deepEqual(JSON.parse(cold.stdout), { cold: true });
	const sanitizer = JSON.parse(exercised.stdout);
	for(const observed of [result, sanitizer])
	{
		assert.ok(observed.checks > 300); assert.equal(observed.live, 0); assert.equal(observed.identities, 0);
		for(const key of ["cppFaults", "nativeFaults", "before", "after"]) assert.ok(observed[key] > 0, key);
	}
	const normalize = text => text.replace(/==\d+==/gu, "==PID==").replace(/0x[0-9a-f]+/gu, "ADDRESS").replaceAll(compiled.directory, "<probe>");
	assert.doesNotMatch(exercised.stderr, /ERROR: AddressSanitizer|runtime error:/u);
	assert.equal(normalize(exercised.stderr), normalize(cold.stderr));
	const index = cpp.c.functions.findIndex(item => item.name === "chooseTicket");
	const mutations = [
		{ name: "receiver-used-as-other-argument-anchor"
			, path: `include/${cpp.c.prefix}.hpp`
			, before: `return owned_invoke${index}(self.get(), a1);`
			, after: `(void)a1; return owned_invoke${index}(self.get(), self);` }
		, { name: "missing-whole-receiver-validation"
			, path: `include/${cpp.c.prefix}-values.hpp`
			, before: "storage_->lease->require(); return storage_->value;"
			, after: "return storage_->value;" }
		, { name: "callback-receiver-escape"
			, path: `include/${cpp.c.prefix}-values.hpp`
			, before: "~BorrowFrame() { scope->active.store(false); }"
			, after: "~BorrowFrame() {}" }
	];
	for(const mutation of mutations)
	{
		await headers(compiled.directory, cpp);
		const original = await readFile(join(compiled.directory, mutation.path), "utf8");
		assert.equal(original.split(mutation.before).length, 2, mutation.name);
		await saveLakeFile(compiled.directory, mutation.path, original.replace(mutation.before, mutation.after));
		await runCopied("/usr/bin/c++", ["-std=c++20", "-O0", "-Wall", "-Wextra"
			, "-Werror", "-pthread", "-I", "include", "consumer.cpp"
			, "-L", compiled.directory, "-l:libreceivers.so", "-lgmp"
			, "-Wl,--export-dynamic", "-Wl,-rpath," + compiled.directory
			, "-o", mutation.name], compiled.directory, environment);
		await assert.rejects(() => runCopied("/bin/sh", ["-c", 'ulimit -c 0\nexec "$@"', mutation.name, join(compiled.directory, mutation.name)], compiled.directory, environment), /owned C\+\+ borrow check failed/u);
	}
	await headers(compiled.directory, cpp);
	const restored = await (await compile(false))({}); assert.equal(restored.stdout, normal.stdout); assert.equal(restored.stderr, "");
	await saveLakeFile("build/owned-cpp-receivers", mode + ".json", canonicalJson({
		mode, input, result, sanitizer, contract: cpp.contract
		, probeSha256: sha256(source), sourceSha256: sha256(generated.source)
		, startupLeakBaseline: normalize(cold.stderr), restored: true
		, mutations: mutations.map(item => ({ name: item.name, compiled: true
			, sourceSha256: sha256(cpp.files[item.path].replace(item.before, item.after))
			, semanticRejection: true }))
	}));
});
