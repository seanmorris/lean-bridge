/* One process-lifetime native owner for independently loaded JVM components.
   Java platform and virtual threads may enter concurrently. Only this thread
   touches serialized Lean IO state; Java never has to run an event loop. */
#include "io-owner.h"
#include <pthread.h>
#include <stddef.h>
#include <sys/types.h>
#include <unistd.h>

extern void lean_initialize_thread(void);
typedef struct request {
    void (*fn)(void *); void *ctx; struct request *next;
    pthread_cond_t completed; int done;
} request;
static pthread_mutex_t lock = PTHREAD_MUTEX_INITIALIZER;
static pthread_cond_t available = PTHREAD_COND_INITIALIZER;
static request *first, *last;
static int started;
static pid_t process;
static _Thread_local int is_owner;

__attribute__((constructor)) static void origin(void) { process = getpid(); }
int LB_JVM_OWNER(current)(void) { return is_owner && process == getpid(); }

static void *serve(void *unused) {
    (void)unused;
    lean_initialize_thread();
    is_owner = 1;
    pthread_mutex_lock(&lock);
    for (;;) {
        while (!first) pthread_cond_wait(&available, &lock);
        request *r = first; first = r->next;
        if (!first) last = NULL;
        pthread_mutex_unlock(&lock);
        r->fn(r->ctx);
        pthread_mutex_lock(&lock);
        r->done = 1; pthread_cond_signal(&r->completed);
    }
    return NULL;
}
int LB_JVM_OWNER(call)(void (*fn)(void *), void *ctx) {
    if (!fn || process != getpid()) return 0; /* Never lock inherited state. */
    if (is_owner) { fn(ctx); return 1; }
    request r = {.fn = fn, .ctx = ctx};
    if (pthread_cond_init(&r.completed, NULL)) return 0;
    pthread_mutex_lock(&lock);
    if (!started) {
        pthread_t thread; pthread_attr_t attr;
        if (!pthread_attr_init(&attr)) {
            if (!pthread_attr_setdetachstate(&attr, PTHREAD_CREATE_DETACHED))
                started = pthread_create(&thread, &attr, serve, NULL) == 0;
            pthread_attr_destroy(&attr);
        }
    }
    if (started) {
        if (last) last->next = &r; else first = &r;
        last = &r; pthread_cond_signal(&available);
        while (!r.done) pthread_cond_wait(&r.completed, &lock);
    }
    pthread_mutex_unlock(&lock);
    pthread_cond_destroy(&r.completed);
    return r.done;
}
