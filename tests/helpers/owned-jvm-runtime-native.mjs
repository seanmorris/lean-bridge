/**
 * Compile the JVM lifetime probe against fresh Lean owners and native TLS.
 *
 * @file
 */
import assert from "node:assert/strict";
import { join } from "node:path";
import { generateOwnedCPackage } from "../../src/backends/c/owned-package.mjs";
import { ownedJvmThreadExit } from "../../src/backends/jvm/owned-thread-exit.mjs";
import { compileOwnedAggregateFixture } from "./owned-aggregate-native.mjs";
import { ownedHostCallbackReviewedIr } from "./owned-host-callback-fixture.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { runCopied } from "./copied-fixture-install.mjs";

/**
 * Reproduce the exact C and TLS inputs from captured compiler evidence.
 *
 * @param input - Fresh metadata, source identity and explicit host callbacks.
 */
export const ownedJvmRuntimeProbeSources = input => {
	const generated = generateOwnedCPackage(input);
	const p = generated.values.prefix, exit = ownedJvmThreadExit(p);
	const implementation = `#include <stdlib.h>
#include <stddef.h>
#include <stdint.h>
#include <stdatomic.h>
#include <sys/wait.h>
#include <signal.h>
static _Atomic size_t live, exits, exit_errors;
static _Thread_local ptrdiff_t fail_after = -1;
static _Thread_local int invalid_process;
static void *allocate(size_t size) {
  if (fail_after == 0) return NULL;
  if (fail_after > 0) --fail_after;
  void *value = malloc(size); if (value) atomic_fetch_add(&live, 1); return value;
}
static void deallocate(void *value) { if (value) { atomic_fetch_sub(&live, 1); free(value); } }
#define LB_OWNED_ALLOC allocate
#define LB_OWNED_FREE deallocate
${generated.source}
${exit.source}
size_t owned_test_live(void) { return atomic_load(&live); }
void owned_test_fail_after(ptrdiff_t value) { fail_after = value; }
size_t owned_test_identities(void) { lean_bridge_native_snapshot s; lean_bridge_native_snapshot_read(&s); return s.live_identities; }
void owned_test_thread_exit(uint32_t status) { atomic_fetch_add(&exits, 1); if (status) atomic_fetch_add(&exit_errors, 1); }
size_t owned_test_exits(void) { return atomic_load(&exits); }
size_t owned_test_exit_errors(void) { return atomic_load(&exit_errors); }
int owned_test_process_valid(void) { return !invalid_process && lean_bridge_native_process_valid(); }
void owned_test_invalid_process(int value) { invalid_process = value; }
void owned_test_retire(void) { lean_bridge_native_runtime_retire(); }
uint32_t owned_test_new(${p}_session *session, uint64_t serial, void **out, ${p}_result **owner) {
  ${p}_ticket_t value = NULL; ${p}_scalar_string_t label = {"jvm", 3};
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
uint32_t owned_test_closure(${p}_session *session, void **out, ${p}_result **owner) {
  ${p}_callback_record_argument1_t closure = NULL;
  ${p}_status status = ${p}_identity_closure(session, 0, &closure, owner);
  if (!status) *out = closure;
  return (uint32_t)status;
}
uint32_t owned_test_close_during_call(${p}_session *session, void *ticket, uint32_t (*callback)(void)) {
  oc_session *context = oc_session_find(session); if (!context) return LB_OWNED_INVALID;
  lb_owned_scope scope = {0}; uint32_t status = lb_owned_scope_begin(&context->native, &scope);
  if (status) return status;
  lean_object *value = NULL;
  status = lb_owned_scope_borrow(&scope, ${JSON.stringify(generated.values.nodes.find(node => node.kind === "resource").identityKind)}, (uint64_t)(uintptr_t)ticket, &value);
  if (${p}_jvm_thread_cleanup() != LB_OWNED_ORDER) abort();
  ++context->calls; uint32_t closed = callback();
  uint32_t ended = lb_owned_scope_abort(&scope);
  --context->calls; oc_session_collect(context);
  return status ? status : closed ? closed : ended;
}
static void *held_lock_fork(uint8_t unit) {
  (void)unit; pid_t child = fork(); if (child < 0) abort();
  if (!child) {
    alarm(3); ${p}_session *session = NULL;
    if (${p}_jvm_thread_cleanup() != LB_OWNED_PROCESS) _exit(1);
    if (${p}_jvm_session_open(&session) != LB_OWNED_PROCESS || session) _exit(2);
    if (lean_bridge_native_process_valid()) _exit(3);
    _exit(0);
  }
  int status = 0;
  if (waitpid(child, &status, 0) != child || !WIFEXITED(status) || WEXITSTATUS(status)) abort();
  return lean_io_result_mk_ok(lean_box(0));
}
int owned_test_fork(void) { return lean_bridge_native_component_initialize("owned-jvm-held-lock-fork", held_lock_fork); }
_Static_assert(sizeof(unsigned long) == sizeof(uint64_t), "Probe targets Linux x86-64");
`;
	const cleanup = `(void)${p}_jvm_thread_cleanup();`;
	assert.equal(exit.guardSource.split(cleanup).length, 2);
	const guard = exit.guardSource.replace("#include <cstdint>", '#include <cstdint>\nextern "C" void owned_test_thread_exit(uint32_t);')
		.replace(cleanup, `owned_test_thread_exit(${p}_jvm_thread_cleanup());`);
	return { generated, prefix: p, implementation, guard };
};

/**
 * Build independent raw probes; this does not install or admit a Maven package.
 *
 * @param t - Test context owning the scratch tree.
 * @param reviewed - Select independently reviewed IR rather than annotations.
 */
export const compileOwnedJvmRuntimeProbe = async (t, reviewed) => {
	const compiled = await compileOwnedAggregateFixture(t, {
		fixture: "owned-host-callbacks", hostCallbacks: true
		, ...(reviewed ? { reviewedIr: ownedHostCallbackReviewedIr() } : {}) });
	const { generated, prefix, implementation, guard } = ownedJvmRuntimeProbeSources({
		metadata: compiled.metadata, sourceIdentity: compiled.sourceIdentity
		, component: compiled.model.component, hostCallbacks: true });
	for(const [path, source] of Object.entries(generated.files))
		await saveLakeFile(compiled.directory, path.startsWith("src/") ? "public-api.c" : path.split("/").at(-1), path.startsWith("src/") ? implementation : source);
	await saveLakeFile(compiled.directory, "guard.cpp", guard);
	const env = { PATH: "/usr/bin:/bin" }, includes = ["-I", join(compiled.directory, "runtime/include")];
	await runCopied("/usr/bin/cc", ["-std=c11", "-O1", "-g", "-Wall", "-Wextra", "-Werror", "-fPIC", ...includes, "-c", "public-api.c", "-o", "public-api.o"], compiled.directory, env);
	await runCopied("/usr/bin/c++", ["-std=c++17", "-O1", "-g", "-Wall", "-Wextra", "-Werror", "-fPIC", ...includes, "-c", "guard.cpp", "-o", "guard.o"], compiled.directory, env);
	await runCopied("/usr/bin/c++", [
		"-shared", "-pthread", "public-api.o", "guard.o"
		, "Owned.o", "Carriers.o", "Witness.o", "Callbacks.o"
		, "-L", join(compiled.directory, "runtime/lib")
		, "-lgmp", "-llean_bridge_native", "-lleanshared"
		, "-Wl,-rpath," + join(compiled.directory, "runtime/lib")
		, "-Wl,-z,defs", "-Wl,-z,nodelete", "-o", "libowned-jvm.so"
	], compiled.directory, env);
	return { ...compiled, prefix, implementation, guard, library: join(compiled.directory, "libowned-jvm.so") };
};
