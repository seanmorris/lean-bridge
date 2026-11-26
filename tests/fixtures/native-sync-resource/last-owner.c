#define _GNU_SOURCE
#include <lbc_lease_desk.h>
#include <lbc_lease_counter.h>
#include "audit.h"
#include <stdio.h>
#define D(x) lbc_lease_desk_##x
#define P(x) lbc_lease_counter_##x
#define DESK(x) assert((x) == D(OK))
#define PEER(x) assert((x) == P(OK))

int main(int argc, char **argv) {
    assert(argc == 2);
    uint32_t n = 999; bool same = false; uint8_t unit = 1;
    D(resource_ticket_t) original = {0}, value = {0}, error = {0};
    if (!strcmp(argv[1], "peer-first")) {
        PEER(P(closes_call)(&n, NULL));
    } else {
        assert(!strcmp(argv[1], "desk-first"));
        DESK(D(issue_call)(0, &original, NULL));
        DESK(D(resource_ticket_release)(&original));
    }
    PEER(P(closes_call)(&n, NULL));
    uint32_t start = live(); unsigned fds = descriptors(); assert(!start);
    DESK(D(issue_call)(41, &original, NULL));
    DESK(D(check_ticket_call)(false, original, &value, &error));
    DESK(D(resource_ticket_same)(original, value, &same)); assert(same);
    DESK(D(resource_ticket_release)(&value));
    assert(D(check_ticket_call)(true, original, &value, &error) == D(TYPED_ERROR));
    PEER(P(resource_ticket_same)(original, error, &same)); assert(same);
    D(resource_ticket_t) stale = original; /* not a retained lease */
    DESK(D(resource_ticket_release)(&original));
    n = 91; assert(P(count_call)(stale, &n, NULL) == P(CLOSED) && n == 91);
    assert(live() == start + 1 && descriptors() == fds + 1);
    PEER(P(add_call)(error, 1, &unit, NULL)); DESK(D(count_call)(error, &n, NULL)); assert(n == 42);
    PEER(P(resource_ticket_release)(&error));
    baseline(start); descriptors_at(fds);
    DESK(D(issue_call)(7, &value, NULL)); PEER(P(count_call)(value, &n, NULL)); assert(n == 7);
    DESK(D(resource_ticket_release)(&value)); baseline(start); descriptors_at(fds);
    puts("typed error retained the last ticket; peer wrote 42, stale read refused, zero owners and descriptor delta");
}
