/* A downstream application. No Lean headers, generated private hooks or registry API. */
#include "workshop.h"
#include "peer.h"
#include <assert.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

typedef struct { uint32_t level; } meter;
typedef struct { unsigned calls; uint32_t fault; workshop_binding *busy; } state;
static unsigned destroyed;
static void dispose(void *p) { ++destroyed; free(p); }
static meter *payload(workshop_box b) {
    void *p=NULL; assert(workshop_box_data(b,&p)==workshop_OK); return p;
}
static uint32_t read_meter(void *ctx,workshop_box b,uint32_t *out) {
    state *s=ctx; ++s->calls;
    if(s->busy) assert(workshop_close(s->busy)==workshop_BUSY);
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
    ++((state *)ctx)->calls; assert(workshop_box_clone(b,out)==workshop_OK); return 0;
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
    first.busy=&a;
    assert(workshop_read(a,x,&n,&d)==workshop_OK && n==47);
    first.busy=NULL;
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
    puts("public C owners: exactly one destruction");
}
