/* Closing a native watch rejects new calls immediately. Its observer keeps
 * a runtime lease until it has actually returned on the Lean worker. */
#include <time.h>
static void check_quiescent(void) {
    lean_bridge_native_snapshot state={0};
    for (unsigned i=0;i<500;i++) {
        lean_bridge_native_snapshot_read(&state); assert(state.runtime_init_runs==1);
        if (!state.live_identities) return;
        nanosleep(&(struct timespec){.tv_nsec=10000000},NULL);
    }
    fprintf(stderr,"Callback workers still hold %u identities\n",state.live_identities);
    assert(state.live_identities==0);
}
