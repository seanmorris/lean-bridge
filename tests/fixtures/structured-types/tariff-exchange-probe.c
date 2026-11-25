/* Keep the broker lookup out of the actual C application. */
#include "tariff_quotes.h"
#include <assert.h>
#include <dlfcn.h>
#include <inttypes.h>
#include <stdio.h>

struct snapshot { uint32_t abi, state, starts, init, attached, live; uint64_t runtime, domain; };
static uint32_t live(void) {
    void (*read_snapshot)(struct snapshot *) = dlsym(RTLD_DEFAULT, "lean_bridge_native_snapshot_read");
    assert(read_snapshot);
    struct snapshot snap = {0};
    read_snapshot(&snap);
    assert(snap.abi == 1);
    return snap.live;
}
static uint32_t counts[6];
static unsigned i;
static void checkpoint(void) {
    assert(i < 6);
    counts[i++] = live();
    assert(counts[i-1] == 1); /* Client session only, before it closes. */
}
#ifndef TARIFF_PROBE_CLIENT
#define TARIFF_PROBE_CLIENT tariff_exchange_consumer
#endif
int TARIFF_PROBE_CLIENT(tariff_quotes_session *, void (*)(void));
int main(void) {
    assert(live() == 0);
    tariff_quotes_session *s = NULL;
    assert(tariff_quotes_session_open(&s) == TARIFF_QUOTES_OK && live() == 1);
    int result = TARIFF_PROBE_CLIENT(s, checkpoint);
    assert(i == 6 && tariff_quotes_session_close(&s) == TARIFF_QUOTES_OK);
    uint32_t after = live();
    assert(after == 0);
    printf("identities:");
    for (unsigned j = 0; j < i; ++j) printf("%" PRIu32 ",", counts[j]);
    printf("%" PRIu32 "\n", after);
    return result;
}
