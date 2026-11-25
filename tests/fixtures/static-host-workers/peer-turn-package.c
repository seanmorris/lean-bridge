#include "peer-turn-state.h"

/* Both independently compiled DSOs implement the same local opcode. */
bool peer_dispatch(lb_wit_turns *route,void *ptr,lb_wit_message in,lb_wit_message *out){
    peer_turn_state *p=ptr;
    assert(pthread_equal(pthread_self(),p->owner) && route==&p->route);
    assert(in.op==7);
    ++p->active;++p->calls;
    lb_wit_message reply={0};
    assert(!lb_wit_turn_request(p->other,(lb_wit_message){0},&reply));
    bool ok=lb_wit_turn_request(route,(lb_wit_message){.op=PEER_TAG,.words={in.words[0]}},&reply);
    --p->active;
    if(!ok){++p->unwound;return false;}
    assert(reply.op==8 && reply.words[0]==in.words[0]);
    ++p->returned;*out=(lb_wit_message){.op=PEER_TAG,.words={reply.words[0]+PEER_TAG}};return true;
}
