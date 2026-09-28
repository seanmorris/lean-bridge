/**
 * Execute native PHP leases against freshly compiled Lean ownership carriers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { copyFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { generateOwnedCPackage } from "../src/backends/c/owned-package.mjs";
import { generateOwnedPhpValues } from "../src/backends/php/owned-values.mjs";
import { ownedPhpRuntime } from "../src/backends/php/owned-runtime.mjs";
import { bundledBrickMath } from "../src/backends/php/brick-math.mjs";
import { copiedPhpLoader } from "../src/backends/php/copied-assets.mjs";
import { compileOwnedAggregateFixture } from "./helpers/owned-aggregate-native.mjs";
import { ownedHostCallbackReviewedIr } from "./helpers/owned-host-callback-fixture.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";

test("native PHP ownership support rejects injected public C prefixes", () => {
	for(const value of ["Bad", "a__b", "a;\n#error injected", "", null, undefined, {}, true])
		assert.throws(() => ownedPhpRuntime(value), /prefix/u);
});

for(const reviewed of [false, true]) test(`native PHP leases clean real Lean results (${reviewed ? "reviewed" : "ordinary"})`, {
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
#include <stdio.h>
#include <stddef.h>
#include <sys/types.h>
#include <unistd.h>
static size_t live = 0; static ptrdiff_t fail_after = -1;
static pid_t creator = 0;
__attribute__((constructor)) static void probe_start(void) { creator = getpid(); }
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
size_t owned_test_identities(void) {
  lean_bridge_native_snapshot snapshot; lean_bridge_native_snapshot_read(&snapshot); return snapshot.live_identities;
}
uint32_t owned_test_new(${p}_session *session, uint64_t serial, void **out, ${p}_result **owner) {
  ${p}_ticket_t value = NULL; ${p}_scalar_string_t label = {"php", 3};
  mpz_t number; mpz_init_set_ui(number, serial);
  ${p}_status status = ${p}_new_ticket(session, number, label, &value, owner);
  mpz_clear(number); if (!status) *out = value; return (uint32_t)status;
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
__attribute__((destructor)) static void probe_final(void) {
  if (getpid() != creator) return;
  if (live || owned_test_identities()) {
    fprintf(stderr, "unreleased PHP ownership: %zu allocations, %zu identities\\n", live, owned_test_identities());
    _exit(88);
  }
}
_Static_assert(sizeof(unsigned long) == sizeof(uint64_t), "PHP probe targets Linux x86-64");
${["OK", "INVALID_ARGUMENT", "LIMIT", "ALLOCATION_FAILED", "CLOSED", "WRONG_THREAD", "WRONG_PROCESS", "RUNTIME_UNAVAILABLE", "CALL_ORDER", "MALFORMED_RESULT", "CALLBACK_FAILED"].map((name, value) => `_Static_assert(${p.toUpperCase()}_${name} == ${value}, "PHP status ABI");`).join("\n")}
`;
	for(const [path, source] of Object.entries(generated.files))
		await saveLakeFile(compiled.directory, path.startsWith("src/") ? "public-api.c" : path.split("/").at(-1), path.startsWith("src/") ? implementation : source);
	const declarations = `typedef struct ${p}_session ${p}_session;
typedef struct ${p}_result ${p}_result;
uint32_t ${p}_session_open(${p}_session **);
uint32_t ${p}_session_close(${p}_session **);
uint32_t ${p}_result_release(${p}_result **);
size_t owned_test_live(void);
size_t owned_test_identities(void);
void owned_test_fail_after(ptrdiff_t);
uint32_t owned_test_new(${p}_session *, uint64_t, void **, ${p}_result **);
uint32_t owned_test_retain(${p}_session *, void *, void **, ${p}_result **);
uint32_t owned_test_serial(${p}_session *, void *, uint64_t *, ${p}_result **);
`;
	const values = generateOwnedPhpValues(generated.layout.model.bindingIr);
	const runtime = ownedPhpRuntime(p), probe = await readFile("tests/fixtures/structured-types/owned-php-runtime.php", "utf8");
	for(const [path, source] of Object.entries({ ...values.files, ...bundledBrickMath() })) await saveLakeFile(compiled.directory, path, source);
	await saveLakeFile(compiled.directory, "native.ffi", declarations);
	await saveLakeFile(compiled.directory, "loader.php", copiedPhpLoader);
	await saveLakeFile(compiled.directory, "src/Internal/OwnedRuntime.php", `<?php\ndeclare(strict_types=1);\nnamespace ${values.namespace}\\Internal;\n${runtime}`);
	await saveLakeFile(compiled.directory, "consumer.php", probe);
	await runCopied("/usr/bin/cc", ["-std=c11", "-O1", "-g", "-Wall"
		, "-Wextra", "-Werror", "-fPIC", "-shared"
		, "-I", join(compiled.directory, "runtime/include"), "public-api.c"
		, "Owned.o", "Carriers.o", "Witness.o", "Callbacks.o"
		, "-L", join(compiled.directory, "runtime/lib")
		, "-llean_bridge_native", "-lleanshared", "-lgmp"
		, "-Wl,-rpath," + join(compiled.directory, "runtime/lib")
		, "-o", "libowned-php.so"], compiled.directory, { PATH: "/usr/bin:/bin" });
	await copyFile(join(compiled.directory, "libowned-php.so"), join(compiled.directory, "runtime/lib/libowned-php.so"));
	const loadOrder = ["libleanshared.so", "liblean_bridge_native.so", "libowned-php.so"], libraries = {};
	for(const name of loadOrder) libraries[name] = sha256(await readFile(join(compiled.directory, "runtime/lib", name)));
	await saveLakeFile(compiled.directory, "native-evidence.json", canonicalJson({ libraries
		, loadOrder, library: "libowned-php.so"
		, componentId: generated.layout.model.bindingIr.component.id
		, runtimeIdentity: sha256(canonicalJson(loadOrder.slice(0, 2).map(name => libraries[name])))
		, identity: sha256(implementation) }));
	const observations = [], php = process.env.LEAN_BRIDGE_PHP ?? "/usr/bin/php";
	for(const mode of ["normal", ...Array(32).fill("shutdown")])
	{
		const result = await runCopied(php, ["-d", "ffi.enable=1", "-d", "display_errors=stderr", "consumer.php", mode], compiled.directory);
		assert.equal(result.stderr, ""); const observation = JSON.parse(result.stdout);
		if(mode === "normal")
		{
			assert.ok(observation.checks > 150); assert.ok(observation.phpFailures > 0); assert.ok(observation.nativeFailures > 0);
			assert.equal(observation.live, 0); assert.equal(observation.identities, 0);
		}
		else assert.equal(observation.shutdownCleanup, true);
		observations.push({ mode, observation }); t.diagnostic(JSON.stringify(observation));
	}
	await saveLakeFile("build/owned-php-runtime", `${reviewed ? "reviewed" : "ordinary"}.json`, canonicalJson({
		observations, compiledLean: true, installedPackage: false
		, sourceIdentitySha256: compiled.sourceIdentitySha256
		, runtimeSha256: sha256(runtime), probeSha256: sha256(probe)
		, phpSha256: sha256(await readFile(php))
	}));
});
