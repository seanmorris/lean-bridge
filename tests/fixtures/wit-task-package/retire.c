/* Fault injection only: normal applications do not access the runtime broker. */
#define _POSIX_C_SOURCE 200809L
#include <meter_wasmtime.h>
#include <assert.h>
#include <dlfcn.h>
#include <errno.h>
#include <fcntl.h>
#include <pthread.h>
#include <stdio.h>
#include <time.h>
#include <unistd.h>
static void *retire(void *unused) {
    (void)unused; struct timespec delay={.tv_nsec=50000000};
    while (nanosleep(&delay,&delay)<0 && errno==EINTR) {}
    void (*stop)(void)=(void (*)(void))dlsym(RTLD_DEFAULT,"lean_bridge_native_runtime_retire");
    assert(stop); stop(); return NULL;
}
int main(void) {
    alarm(30); meter_wit_session *s=NULL; meter_wit_task_parked h={0};
    meter_wit_state state=meter_wit_CLOSED; int fd=-1; int64_t value=9;
    assert(meter_wit_open(&s)==meter_wit_OK);
    assert(meter_wit_start_parked(s,4,&h)==meter_wit_OK);
    assert(meter_wit_poll_parked(s,h,&state,&value,&fd)==meter_wit_OK && state==meter_wit_PENDING && fd>=0);
    pthread_t worker; assert(!pthread_create(&worker,NULL,retire,NULL));
    assert(meter_wit_await_parked(s,h,&state,&value)==meter_wit_UNAVAILABLE);
    assert(state==meter_wit_PENDING && value==9);
    assert(!pthread_join(worker,NULL)); assert(meter_wit_close(&s)==meter_wit_OK);
    assert(fcntl(fd,F_GETFD)==-1 && errno==EBADF);
    puts("parked await woke on retirement");
}
