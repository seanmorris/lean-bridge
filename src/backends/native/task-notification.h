/* Linux completion subscription for a real Lean Task. One owner serializes
   its operations and closes the watch after consuming or cancelling. No host
   API runs on a Lean worker, and cancelling does not wait for the work. */
#ifndef LEAN_BRIDGE_TASK_NOTIFICATION_H
#define LEAN_BRIDGE_TASK_NOTIFICATION_H
#include <lean/lean.h>
#include "lean_bridge_native_runtime.h"
#include <errno.h>
#include <pthread.h>
#include <stdint.h>
#include <stdlib.h>
#include <sys/eventfd.h>
#include <unistd.h>

typedef struct { pthread_mutex_t lock; int fd; uint64_t runtime_lease; } lb_task_signal;
#define LB_TASK_KIND "lean-bridge/task-notification-v1"
typedef struct {
    lean_object *source, *observer, *signal;
    pid_t pid;
} lb_task_watch;
static lean_external_class *lb_task_signal_class;
static pthread_once_t lb_task_signal_once = PTHREAD_ONCE_INIT;
static void lb_signal_disable(lb_task_signal *s) {
    pthread_mutex_lock(&s->lock);
    if (s->fd >= 0) { close(s->fd); s->fd = -1; }
    pthread_mutex_unlock(&s->lock);
}
static void lb_signal_finalize(void *p) {
    lb_task_signal *s = p;
    lb_signal_disable(s);
    lean_bridge_native_identity_release(s->runtime_lease, LB_TASK_KIND, s);
    pthread_mutex_destroy(&s->lock); free(s);
}
static void lb_signal_visit(void *p, b_lean_obj_arg f) { (void)p; (void)f; }
static void lb_register_signal(void) {
    lb_task_signal_class = lean_register_external_class(lb_signal_finalize, lb_signal_visit);
}
static lean_object *lb_notify_completion(lean_object *sig, lean_object *value) {
    lb_task_signal *s = lean_get_external_data(sig);
    pthread_mutex_lock(&s->lock);
    if (s->fd >= 0) {
        uint64_t one = 1;
        while (write(s->fd, &one, sizeof(one)) == -1 && errno == EINTR) { }
    }
    pthread_mutex_unlock(&s->lock);
    lean_dec(value); lean_dec(sig); return lean_box(0);
}
static int lb_watch_start(lb_task_watch *w, b_lean_obj_arg source) {
    w->pid = getpid();
    if (lean_io_get_task_state_core(source) == LEAN_TASK_STATE_FINISHED) {
        /* An already settled Task needs no descriptor, observer or lease. */
        lean_mark_mt(source); lean_inc(source); w->source = source;
        return 0;
    }
    lb_task_signal *s = malloc(sizeof(*s));
    if (!s) { errno = ENOMEM; return -1; }
    int e = pthread_mutex_init(&s->lock, NULL);
    if (e) { free(s); errno = e; return -1; }
    s->fd = eventfd(0, EFD_CLOEXEC | EFD_NONBLOCK);
    if (s->fd < 0) { int err = errno; pthread_mutex_destroy(&s->lock); free(s); errno = err; return -1; }
    /* A cancelled Python wait may outlive its loop in Lean. The runtime
       must not join an outstanding non-cooperative task at process exit. */
    s->runtime_lease = lean_bridge_native_identity_acquire(LB_TASK_KIND, s);
    if (!s->runtime_lease) { close(s->fd); pthread_mutex_destroy(&s->lock); free(s); errno = EBUSY; return -1; }
    pthread_once(&lb_task_signal_once, lb_register_signal);
    w->signal = lean_alloc_external(lb_task_signal_class, s);
    lean_mark_mt(w->signal); lean_mark_mt(source);
    lean_inc(w->signal);
    lean_object *fn = lean_alloc_closure((void *)lb_notify_completion, 2, 1);
    lean_closure_set(fn, 0, w->signal);
    lean_inc(source); w->source = source;
    lean_inc(source); w->observer = lean_task_map_core(fn, source, 0, true, true);
    return 0;
}
static int lb_watch_ready(lb_task_watch *w) {
    return w->source && lean_io_get_task_state_core(w->source) == LEAN_TASK_STATE_FINISHED;
}
static int lb_watch_fd(lb_task_watch *w) {
    return w->signal ? ((lb_task_signal *)lean_get_external_data(w->signal))->fd : -1;
}
static void lb_watch_close(lb_task_watch *w, int cancel) {
    if (!w->source) return;
    if (w->pid != getpid()) {
        /* No inherited Lean locks, allocator or worker can be touched after fork. */
        int fd = lb_watch_fd(w); if (fd >= 0) close(fd);
    } else {
        if (w->signal) lb_signal_disable(lean_get_external_data(w->signal));
        if (cancel && !lb_watch_ready(w)) lean_io_cancel_core(w->source);
        if (w->observer) lean_dec(w->observer);
        lean_dec(w->source);
        if (w->signal) lean_dec(w->signal);
    }
    w->source = w->observer = w->signal = NULL;
}
#endif
