#define _GNU_SOURCE
#include "tariff_quotes_wasmtime.h"
#include <assert.h>
#include <dlfcn.h>
#include <inttypes.h>
#include <stdio.h>
#include <string.h>

typedef struct { uint32_t abi,state,starts,components,attached,live; uint64_t runtime,domain; } snapshot;
static void (*read_snapshot)(snapshot *);
static void observe(const char *label) {
    snapshot s={0}; read_snapshot(&s); assert(s.abi==1);
    if (!strcmp(label,"held")) assert(s.live>1);
    else assert(s.live==(!strcmp(label,"afterShutdown") ? 0U : 1U));
    printf("%s:%" PRIu32 "\n",label,s.live);
}
void wit_direct_consumer(tariff_quotes_wasmtime_session *,void (*)(const char *));
int main(int argc,char **argv) {
    assert(argc==2);
    tariff_quotes_wasmtime_session *session=NULL;
    assert(tariff_quotes_wasmtime_session_open(&session)==TARIFF_QUOTES_WASMTIME_OK);
    void *broker=dlopen(argv[1],RTLD_NOW|RTLD_NOLOAD); assert(broker);
    read_snapshot=(void (*)(snapshot *))dlsym(broker,"lean_bridge_native_snapshot_read"); assert(read_snapshot);
    wit_direct_consumer(session,observe);
    assert(tariff_quotes_wasmtime_session_close(&session)==TARIFF_QUOTES_WASMTIME_OK && !session);
    observe("afterShutdown"); dlclose(broker); return 0;
}
