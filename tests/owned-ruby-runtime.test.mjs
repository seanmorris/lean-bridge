/**
 * Execute Ruby ownership leases against real ordinary and reviewed Lean code.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { generateOwnedCPackage } from "../src/backends/c/owned-package.mjs";
import { ownedRubyRuntime } from "../src/backends/ruby/owned-runtime.mjs";
import { compileOwnedAggregateFixture } from "./helpers/owned-aggregate-native.mjs";
import { ownedHostCallbackReviewedIr } from "./helpers/owned-host-callback-fixture.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";

test("Ruby ownership support rejects injected package identifiers", () => {
	for(const name of ["Bad", "a__b", "a;\n#error injected", ""])
		assert.throws(() => ownedRubyRuntime(name));
});

for(const reviewed of [false, true]) test(`Ruby leases clean real Lean results on their owning thread (${reviewed ? "reviewed" : "ordinary"})`, {
	skip: process.env.LEAN_BRIDGE_OWNED_NATIVE_TEST !== "1", timeout: 600000
}, async t => {
	const compiled = await compileOwnedAggregateFixture(t, { fixture: "owned-host-callbacks"
		, hostCallbacks: true
		, ...(reviewed ? { reviewedIr: ownedHostCallbackReviewedIr() } : {}) });
	const generated = generateOwnedCPackage({ metadata: compiled.metadata
		, sourceIdentity: compiled.sourceIdentity
		, component: compiled.model.component, hostCallbacks: true });
	const p = generated.values.prefix;
	const implementation = `#include <stdlib.h>
#include <stddef.h>
static size_t live = 0; static ptrdiff_t fail_after = -1;
static void *allocate(size_t size) {
  if (fail_after == 0) return NULL;
  if (fail_after > 0) --fail_after;
  void *value = malloc(size); if (value) ++live; return value;
}
static void deallocate(void *value) { if (value) { --live; free(value); } }
#define LB_OWNED_ALLOC allocate
#define LB_OWNED_FREE deallocate
${generated.source}
size_t owned_test_live(void) { return live; }
void owned_test_fail_after(ptrdiff_t value) { fail_after = value; }
size_t owned_test_identities(void) { lean_bridge_native_snapshot snapshot; lean_bridge_native_snapshot_read(&snapshot); return snapshot.live_identities; }
uint32_t owned_test_new(${p}_session *session, uint64_t serial, void **out, ${p}_result **owner) {
  ${p}_ticket_t value = NULL; ${p}_scalar_string_t label = {"ruby", 4};
  mpz_t number; mpz_init_set_ui(number, serial);
  ${p}_status status = ${p}_new_ticket(session, number, label, &value, owner);
  mpz_clear(number);
  if (!status) *out = value;
  return (uint32_t)status;
}
uint32_t owned_test_retain(${p}_session *session, void *input, void **out, ${p}_result **owner) {
  ${p}_ticket_t value = NULL;
  ${p}_status status = ${p}_ticket_t_retain(session, input, &value, owner);
  if (!status) *out = value;
  return (uint32_t)status;
}
uint32_t owned_test_serial(${p}_session *session, void *input, uint64_t *out, ${p}_result **owner) {
  mpz_srcptr value = NULL; ${p}_status status = ${p}_serial(session, input, &value, owner);
  if (!status) {
    if (mpz_sgn(value) < 0 || !mpz_fits_ulong_p(value)) return ${p.toUpperCase()}_MALFORMED_RESULT;
    *out = mpz_get_ui(value);
  }
  return (uint32_t)status;
}
_Static_assert(sizeof(unsigned long) == sizeof(uint64_t), "Probe targets Linux x86-64");
${["OK", "INVALID_ARGUMENT", "LIMIT", "ALLOCATION_FAILED", "CLOSED", "WRONG_THREAD", "WRONG_PROCESS", "RUNTIME_UNAVAILABLE", "CALL_ORDER", "MALFORMED_RESULT", "CALLBACK_FAILED"].map((name, value) => `_Static_assert(${p.toUpperCase()}_${name} == ${value}, "Ruby status ABI");`).join("\n")}
`;
	for(const [path, source] of Object.entries(generated.files))
		await saveLakeFile(compiled.directory, path.startsWith("src/") ? "public-api.c" : path.split("/").at(-1), path.startsWith("src/") ? implementation : source);
	const runtime = ownedRubyRuntime(p), probe = await readFile("tests/fixtures/structured-types/owned-ruby-runtime.rb", "utf8");
	await saveLakeFile(compiled.directory, "runtime.rb", `module TestBinding\n${runtime}\nend\n`);
	await saveLakeFile(compiled.directory, "consumer.rb", probe);
	const environment = { PATH: "/usr/bin:/bin" };
	await runCopied("/usr/bin/cc", ["-std=c11", "-O1", "-g", "-Wall"
		, "-Wextra", "-Werror", "-fPIC", "-shared"
		, "-I", join(compiled.directory, "runtime/include"), "public-api.c"
		, "Owned.o", "Carriers.o", "Witness.o", "Callbacks.o"
		, "-L", join(compiled.directory, "runtime/lib")
		, "-llean_bridge_native", "-lleanshared", "-lgmp"
		, "-Wl,-rpath," + join(compiled.directory, "runtime/lib")
		, "-o", "libowned-ruby.so"], compiled.directory, environment);
	const interpreter = resolve(process.env.LEAN_BRIDGE_RUBY ?? ".toolchains/ruby33/bin/ruby");
	const result = await runCopied(interpreter, ["--disable-gems", "consumer.rb", join(compiled.directory, "libowned-ruby.so")], compiled.directory, environment);
	assert.equal(result.stderr, "");
	const observed = JSON.parse(result.stdout);
	t.diagnostic(JSON.stringify(observed));
	assert.ok(observed.checks > 300); assert.ok(observed.rubyFailures > 0); assert.ok(observed.nativeFailures > 0);
	assert.ok(observed.copyFailures > 0); assert.equal(observed.live, 0); assert.equal(observed.identities, 0);
	const mn = await runCopied(interpreter, ["--disable-gems", "-e", 'begin; require_relative "runtime"; abort "unexpected M:N admission"; rescue LoadError => error; abort error.message unless error.message.include?("1:1 threads"); end'], compiled.directory, { ...environment, RUBY_MN_THREADS: "1" });
	assert.equal(mn.stderr, ""); assert.equal(mn.stdout, "");
	await saveLakeFile(resolve("build/owned-ruby-runtime"), `${reviewed ? "reviewed" : "ordinary"}.json`, canonicalJson({
		observations: [observed], compiledLean: true, installedPackage: false
		, rejectsMnThreads: true
		, sourceIdentitySha256: compiled.sourceIdentitySha256
		, runtimeSha256: sha256(runtime), probeSha256: sha256(probe)
	}));
});
