/* Test two separately loaded native dispatchers on one actual owner thread. */
#include "application-turn.h"
#include <assert.h>
typedef struct {
    lb_wit_turns route,*other;
    pthread_t owner;
    unsigned active,calls,returned,unwound;
} peer_turn_state;
