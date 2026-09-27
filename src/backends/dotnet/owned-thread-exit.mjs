/**
 * Native creator-thread cleanup for the private resource-bearing .NET adapter.
 *
 * @file
 */

/**
 * Keep managed finalizers out of thread-bound C sessions. The C++ TLS guard
 * runs before glibc's pthread-key destructors, including mimalloc's cleanup.
 * This private adapter shares the unchanged C ownership implementation.
 *
 * @param prefix - Checked public C package identifier.
 */
export const ownedDotnetThreadExit = prefix => {
	if(!/^[a-z][a-z0-9_]*$/u.test(prefix) || prefix.includes("__")) throw new TypeError("Invalid owned .NET prefix");
	return {
		source: `
extern void ${prefix}_dotnet_attach_thread(void);
uint32_t ${prefix}_dotnet_thread_cleanup(void) {
  /* Reject inherited locks before consulting the native thread registries. */
  if (!lean_bridge_native_process_valid()) return LB_OWNED_PROCESS;
  /* An explicit cleanup probe during a callback must not invalidate its stack.
     Normal CLR thread exit follows the completed synchronous native call. */
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
uint32_t ${prefix}_dotnet_session_open(${prefix}_session **out) {
  uint32_t status = (uint32_t)${prefix}_session_open(out);
  if (!status) ${prefix}_dotnet_attach_thread();
  return status;
}
`
		, guardSource: `#include <lean/lean.h>
#include <cstdint>

#ifdef LEAN_SMALL_ALLOCATOR
#error "The prepared .NET profile requires the pinned mimalloc or system allocator"
#endif

extern "C" uint32_t ${prefix}_dotnet_thread_cleanup(void);
namespace {
struct OwnedThreadExit final {
  OwnedThreadExit() noexcept {
    /* Initialize allocator TLS before registering this destructor. Do not
       finalize Lean's shared thread state while other components can use it. */
    lean_object *probe = lean_alloc_array(0, 0);
    lean_dec(probe);
  }
  ~OwnedThreadExit() noexcept {
    (void)${prefix}_dotnet_thread_cleanup();
  }
};
}
extern "C" void ${prefix}_dotnet_attach_thread(void) {
  static thread_local OwnedThreadExit cleanup;
  (void)cleanup;
}
`
	};
};
