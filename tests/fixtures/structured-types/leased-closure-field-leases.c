/* Test-only observer linked alongside the unmodified application client. */
#include "tariff_quotes.h"
#include <assert.h>
#include <dlfcn.h>
#include <inttypes.h>
#include <stdio.h>

struct snapshot { uint32_t abi, state, starts, init, attached, live; uint64_t runtime, domain; };
static uint32_t identities(void) {
    void (*read_snapshot)(struct snapshot *) = dlsym(RTLD_DEFAULT, "lean_bridge_native_snapshot_read");
    assert(read_snapshot);
    struct snapshot snap = {0};
    read_snapshot(&snap);
    assert(snap.abi == 1);
    return snap.live;
}
int tariff_fields_consumer(tariff_quotes_session *);
int main(void) {
    uint32_t counts[5] = {identities()};
    assert(counts[0] == 0);
    tariff_quotes_session *s = NULL, *client = NULL;
    assert(tariff_quotes_session_open(&s) == TARIFF_QUOTES_OK);
    counts[1] = identities();
    /* Keep an independent session alive across the whole consumer. */
    assert(tariff_quotes_session_open(&client) == TARIFF_QUOTES_OK && identities() == 2);
    int result = tariff_fields_consumer(client);
    counts[2] = identities(); /* No child may survive before client session close. */
    assert(tariff_quotes_session_close(&client) == TARIFF_QUOTES_OK);
    counts[3] = identities();
    assert(tariff_quotes_session_close(&s) == TARIFF_QUOTES_OK);
    counts[4] = identities();
    assert(counts[1] == 1 && counts[2] == 2 && counts[3] == 1 && counts[4] == 0);
    printf("identities:%" PRIu32 ",%" PRIu32 ",%" PRIu32 ",%" PRIu32 ",%" PRIu32 "\n",
           counts[0], counts[1], counts[2], counts[3], counts[4]);
    return result;
}
