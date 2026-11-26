/* A downstream application. No Lean headers, generated private hooks or registry API. */
#include "workshop.h"
#include "peer.h"
#include <assert.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

typedef struct { uint32_t level; } meter;
typedef struct { unsigned calls; uint32_t fault; workshop_binding *busy; peer_binding *nested; bool corrupt, catch_terminal, propagate; } state;
static unsigned destroyed;
static void dispose(void *p) { ++destroyed; free(p); }
static meter *payload(workshop_box b) {
    void *p=NULL; assert(workshop_box_data(b,&p)==workshop_OK); return p;
}
static uint32_t read_meter(void *ctx,workshop_box b,uint32_t *out) {
    state *s=ctx; ++s->calls;
    if(s->busy) assert(workshop_close(s->busy)==workshop_BUSY);
    if(s->nested) {
        peer_diagnostic d={0}; uint32_t inner=101;
        if(s->catch_terminal) {
            peer_box missing={0};
            assert(peer_identity(*s->nested,b,&missing,&d)==peer_UNAVAILABLE);
            peer_box empty={0}; assert(!memcmp(&empty,&missing,sizeof empty));
            peer_diagnostic_clear(&d);
            *out=101; return 0; /* A host success must not undo the caught fatal fault. */
        }
        assert(peer_read(*s->nested,b,&inner,&d)==peer_HOST_ERROR);
        assert(d.host_code==91 && inner==101);
        uint32_t code=d.host_code; peer_diagnostic_clear(&d);
        if(s->propagate) return code;
    }
    if(s->fault) return s->fault;
    *out=payload(b)->level; return 0;
}
static uint32_t create_meter(void *ctx,uint32_t n,workshop_box *out) {
    (void)ctx; meter *p=malloc(sizeof *p); assert(p); p->level=n;
    assert(workshop_box_adopt(p,dispose,out)==workshop_OK); return 0;
}
static uint32_t set_meter(void *ctx,workshop_box b,uint32_t n) {
    ++((state *)ctx)->calls; payload(b)->level=n; return 0;
}
static uint32_t identity(void *ctx,workshop_box b,workshop_box *out) {
    state *s=ctx; ++s->calls;
    if(s->corrupt) return 0; /* Invalid successful reply: required owner was never supplied. */
    assert(workshop_box_clone(b,out)==workshop_OK); return 0;
}
int main(void) {
    workshop_hosts am={.box_read=read_meter,.box_create=create_meter,.box_get_level=read_meter,.box_set_level=set_meter,.box_identity=identity};
    peer_hosts bm={.box_read=read_meter,.box_create=create_meter,.box_get_level=read_meter,.box_set_level=set_meter,.box_identity=identity};
    workshop_binding a={0}; peer_binding b={0}; state first={0},second={0};
    workshop_diagnostic d={0}; peer_diagnostic e={0};
    assert(workshop_with_hosts(&am,&first,&a)==workshop_OK);
    assert(peer_with_hosts(&bm,&second,&b)==peer_OK);
    memset(&am,0,sizeof am); memset(&bm,0,sizeof bm);
    workshop_box x={0},returned={0}; peer_box aliased={0},failure={0};
    assert(workshop_make(a,23,&x,&d)==workshop_OK);
    uint32_t n=0;
    assert(peer_update(b,x,47,&n,&e)==peer_OK && n==47);
    first.busy=&a; first.nested=&b; second.fault=91;
    assert(workshop_read(a,x,&n,&d)==workshop_OK && n==47);
    assert(d.host_code==0 && !d.message.data);
    n=87; first.propagate=true;
    assert(workshop_read(a,x,&n,&d)==workshop_HOST_ERROR && d.host_code==91 && n==87);
    workshop_diagnostic_clear(&d);
    workshop_buffer mapped={0};
    assert(workshop_mapped(a,x,&n,&mapped,&d)==workshop_DECLARED_ERROR && n==87);
    assert(!d.host_code && mapped.len==16 && !memcmp(mapped.data,"host read failed",16));
    workshop_buffer_clear(&mapped); first.propagate=false;
    first.busy=NULL; first.nested=NULL; second.fault=0;
    assert(peer_identity(b,x,&aliased,&e)==peer_OK);
    bool equal=false;
    assert(workshop_box_same(x,aliased,&equal)==workshop_OK && equal);
    workshop_choose_value chosen={0};
    assert(workshop_choose(a,aliased,true,&chosen,&d)==workshop_OK && chosen.ok);
    assert(peer_box_same(aliased,chosen.value,&equal)==peer_OK && equal);
    workshop_choose_value_clear(&chosen);
    assert(workshop_choose(a,aliased,false,&chosen,&d)==workshop_OK && !chosen.ok && chosen.error==17);
    workshop_choose_value_clear(&chosen);
    assert(peer_fail_with(b,x,&n,&failure,&e)==peer_DECLARED_ERROR);
    assert(peer_box_same(failure,x,&equal)==peer_OK && equal);
    second.fault=37; n=99;
    assert(peer_read(b,x,&n,&e)==peer_HOST_ERROR && e.host_code==37 && !e.message.len && n==99);
    peer_diagnostic_clear(&e);
    peer_buffer msg={0};
    assert(peer_mapped(b,x,&n,&msg,&e)==peer_DECLARED_ERROR);
    assert(!e.host_code && msg.len==16 && memcmp(msg.data,"host read failed",16)==0);
    workshop_box stale=x; assert(workshop_box_drop(&x)==workshop_OK);
    unsigned before=second.calls;
    assert(peer_read(b,stale,&n,&e)==peer_STALE && second.calls==before);
    peer_box wrong; memcpy(&wrong,&b,sizeof wrong);
    assert(peer_read(b,wrong,&n,&e)==peer_INVALID && second.calls==before);
    second.fault=0;
    assert(workshop_identity(a,failure,&returned,&d)==workshop_OK);
    workshop_binding old=a;
    assert(workshop_close(&a)==workshop_OK);
    assert(workshop_read(old,aliased,&n,&d)==workshop_STALE);
    assert(peer_read(b,returned,&n,&e)==peer_OK && n==47);
    assert(peer_close(&b)==peer_OK);
    assert(peer_box_drop(&failure)==peer_OK && !destroyed);
    assert(peer_box_drop(&aliased)==peer_OK && !destroyed);
    assert(workshop_box_drop(&returned)==workshop_OK && destroyed==1);
    assert(!memcmp(msg.data,"host read failed",16)); peer_buffer_clear(&msg);
    /* A malformed reply must retire the shared Lean runtime. Teardown and
     * native owner disposal must still work on both sides of that boundary. */
    workshop_hosts bad={.box_read=read_meter,.box_create=create_meter,.box_get_level=read_meter,.box_set_level=set_meter,.box_identity=identity};
    peer_hosts observer={.box_read=read_meter,.box_create=create_meter,.box_get_level=read_meter,.box_set_level=set_meter,.box_identity=identity};
    assert(workshop_with_hosts(&bad,&first,&a)==workshop_OK);
    assert(peer_with_hosts(&observer,&second,&b)==peer_OK);
    /* Use the release under review as the throwing component, not the fixed peer. */
    workshop_box only={0};
    assert(workshop_make(a,23,&x,&d)==workshop_OK);
    n=71; assert(workshop_fail_with(a,x,&n,&only,&d)==workshop_DECLARED_ERROR && n==71);
    assert(workshop_box_drop(&x)==workshop_OK && workshop_close(&a)==workshop_OK && destroyed==1);
    assert(peer_read(b,only,&n,&e)==peer_OK && n==23);
    assert(peer_update(b,only,42,&n,&e)==peer_OK && n==42);
    assert(workshop_box_drop(&only)==workshop_OK && destroyed==2);
    assert(workshop_with_hosts(&bad,&first,&a)==workshop_OK);
    assert(workshop_make(a,72,&x,&d)==workshop_OK);
    first.nested=&b; first.catch_terminal=true; second.corrupt=true;
    unsigned outer=first.calls, inner=second.calls;
    n=93; assert(workshop_read(a,x,&n,&d)==workshop_UNAVAILABLE && n==93);
    second.corrupt=false; first.nested=NULL;
    assert(workshop_read(a,x,&n,&d)==workshop_UNAVAILABLE && n==93);
    assert(peer_read(b,x,&n,&e)==peer_UNAVAILABLE && n==93);
    assert(first.calls==outer+1 && second.calls==inner+1);
    assert(peer_close(&b)==peer_OK && workshop_close(&a)==workshop_OK);
    assert(workshop_box_drop(&x)==workshop_OK && destroyed==3);
    printf("error policy: sole owner 23->42; nested calls %u,%u; destructions %u\n",
           first.calls-outer,second.calls-inner,destroyed);
    puts("public C owners: exactly one destruction per payload, including after runtime retirement");
    return 0;
}
