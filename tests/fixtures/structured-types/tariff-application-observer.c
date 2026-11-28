#define _GNU_SOURCE
#ifdef TARIFF_NATIVE_C
#include "tariff_quotes.h"
#define Q(n) tariff_quotes_##n
#define OK TARIFF_QUOTES_OK
#else
#include "tariff_quotes_wasmtime.h"
#define Q(n) tariff_quotes_wasmtime_##n
#define OK TARIFF_QUOTES_WASMTIME_OK
#endif
#include <assert.h>
#include <dlfcn.h>
#include <inttypes.h>
#include <stdio.h>
#include <string.h>

typedef struct { uint32_t abi,state,starts,components,attached,live; uint64_t runtime,domain; } snapshot;
static void (*read_snapshot)(snapshot *);
static void observe(const char *label) {
    snapshot s={0}; read_snapshot(&s); assert(s.abi==1);
    assert(s.live==(!strcmp(label,"afterShutdown") ? 0U : 1U));
    printf("%s:%" PRIu32 "\n",label,s.live);
}
void application_consumer(Q(session) *,void (*)(const char *));
void ticket_consumer(Q(session) *,void (*)(const char *));
int main(int argc,char **argv) {
    assert(argc==2);
    Q(session) *session=NULL;
    assert(Q(session_open)(&session)==OK);
    void *broker=dlopen(argv[1],RTLD_NOW|RTLD_NOLOAD); assert(broker);
    read_snapshot=(void (*)(snapshot *))dlsym(broker,"lean_bridge_native_snapshot_read"); assert(read_snapshot);
    application_consumer(session,observe);
    ticket_consumer(session,observe);
    assert(Q(session_close)(&session)==OK && !session);
    observe("afterShutdown"); dlclose(broker); return 0;
}
