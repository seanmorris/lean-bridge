/* Installed as the C delivery adapter's private task-notification.h. The
   shared Wasm-to-Wasm notification ABI is supplied by the runtime, not
   recompiled by every component. No POSIX wait descriptor crosses into JS. */
#include "wasm-task-notification.h"
#include "lean_bridge_native_runtime.h"
#include <errno.h>
#include <stdlib.h>
#if !defined(__wasm32__) || !defined(__EMSCRIPTEN_PTHREADS__)
#error Expected a threaded wasm32 task component
#endif
typedef struct { lean_object *source; int listening; } lb_task_watch;
static int lb_watch_start(lb_task_watch *w, b_lean_obj_arg task) {
  lean_mark_mt(task); lean_inc(task); w->source = task; w->listening = 0;
  return 0;
}
static int lb_watch_ready(lb_task_watch *w) {
  return w->source && lean_io_get_task_state_core(w->source) == LEAN_TASK_STATE_FINISHED;
}
/* The common C header defines a private lb_poll helper. No Wasm adapter
   exports or invokes it; only the token-based listen operation is emitted. */
static int lb_watch_fd(lb_task_watch *w) { (void)w; return -1; }
static void lb_watch_close(lb_task_watch *w, int cancel) {
  if (!w->source) return;
  if (cancel && !lb_watch_ready(w)) lean_io_cancel_core(w->source);
  lean_dec(w->source); w->source = NULL; w->listening = 0;
}
