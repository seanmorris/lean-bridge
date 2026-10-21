/**
 * Reclaim native owners on platform-thread exit, independently of Java GC.
 *
 * @file
 */

/**
 * The C++ TLS destructor precedes glibc's pthread-key allocator cleanup.
 * Java Cleaners must not close another native thread's ownership session.
 *
 * @param prefix - Checked public C package identifier.
 */
export const ownedJvmThreadExit = prefix => {
	if(!/^[a-z][a-z0-9_]*$/u.test(prefix) || prefix.includes("__")) throw new TypeError("Invalid owned JVM prefix");
	return {
		source: `
extern void ${prefix}_jvm_attach_thread(void);
uint32_t ${prefix}_jvm_thread_cleanup(void) {
  if (!lean_bridge_native_process_valid()) return LB_OWNED_PROCESS;
  for (oc_session *session = oc_sessions; session; session = session->next)
    if (session->calls || session->native.top) return LB_OWNED_ORDER;
  int status = LB_OWNED_OK;
  while (oc_results) {
    oc_result *before = oc_results;
    ${prefix}_result *result = (${prefix}_result *)(uintptr_t)before->key;
    int released = ${prefix}_result_release(&result);
    if (released && !status) status = released;
    if (oc_results == before) return status ? (uint32_t)status : LB_OWNED_RUNTIME;
  }
  while (oc_sessions) {
    oc_session *before = oc_sessions;
    ${prefix}_session *session = (${prefix}_session *)(uintptr_t)before->key;
    int closed = ${prefix}_session_close(&session);
    if (closed && !status) status = closed;
    if (oc_sessions == before) return status ? (uint32_t)status : LB_OWNED_RUNTIME;
  }
  return (uint32_t)status;
}
uint32_t ${prefix}_jvm_session_open(${prefix}_session **out) {
  uint32_t status = (uint32_t)${prefix}_session_open(out);
  if (!status) ${prefix}_jvm_attach_thread();
  return status;
}
`
		, guardSource: `#include <lean/lean.h>
#include <cstdint>
#ifdef LEAN_SMALL_ALLOCATOR
#error "The prepared JVM profile requires the pinned mimalloc or system allocator"
#endif
extern "C" uint32_t ${prefix}_jvm_thread_cleanup(void);
namespace {
struct OwnedJvmThreadExit final {
  OwnedJvmThreadExit() noexcept {
    lean_object *probe = lean_alloc_array(0, 0);
    lean_dec(probe);
  }
  ~OwnedJvmThreadExit() noexcept { (void)${prefix}_jvm_thread_cleanup(); }
};
}
extern "C" void ${prefix}_jvm_attach_thread(void) {
  static thread_local OwnedJvmThreadExit cleanup;
  (void)cleanup;
}
`
	};
};
