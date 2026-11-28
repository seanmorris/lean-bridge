#define _GNU_SOURCE
#include "host-registry.h"
#include <errno.h>
#include <stdlib.h>
#include <string.h>
#include <sys/random.h>
#include <sys/syscall.h>
#include <unistd.h>

/* A ticket owns one reference. Copied ticket bits are aliases; a clone is
 * independently droppable. Only the original process's main thread enters.
 * A bounded store makes generation exhaustion and allocation failure explicit. */
enum { OBJECT=1, TYPE=2, BINDING=3, CAP=4096 };
typedef struct entity {
    struct entity *next;
    char key[65]; unsigned tag,owners,retiring;
    void *payload; lb_cr_fn destructor; lb_cr_dispose dispose;
} entity;
typedef struct { uint32_t generation; entity *value; } slot;
static slot slots[CAP];
static entity *entities;
static pid_t origin;
static uint64_t stamp;
static int owner(void) {
    pid_t p=getpid();
    if((pid_t)syscall(SYS_gettid)!=p || (origin && origin!=p)) return 0;
    if(!stamp) {
        uint64_t nonce=0; ssize_t n;
        do { n=getrandom(&nonce,sizeof nonce,0); } while(n<0 && errno==EINTR);
        if(n!=(ssize_t)sizeof nonce || !nonce) return 0;
        origin=p; stamp=nonce;
    }
    return 1;
}
static int key_ok(const char *key) {
    return key && strlen(key)==64 && strspn(key,"0123456789abcdef")==64;
}
static int fresh(lb_cr_ref *out) { return out && !out->domain && !out->ticket; }
static slot *resolve(uint64_t t) {
    uint32_t n=(uint32_t)t, g=(uint32_t)(t>>32);
    if(!n || n>CAP || !g) return NULL;
    slot *s=slots+n-1;
    return s->value && s->generation==g ? s : NULL;
}
static int check(unsigned tag,const char *key,lb_cr_ref h,entity **out) {
    if(!owner()) return CR_UNAVAILABLE;
    slot *s=h.domain==stamp ? resolve(h.ticket) : NULL;
    if(!s) return CR_STALE;
    if(s->value->tag!=tag || (key && strcmp(key,s->value->key))) return CR_INVALID;
    *out=s->value; return CR_OK;
}
static int ticket(entity *e,lb_cr_ref *out) {
    for(size_t i=0;i<CAP;i++) {
        slot *s=slots+i;
        if(s->value || s->generation==UINT32_MAX) continue;
        ++s->generation; s->value=e; ++e->owners;
        *out=(lb_cr_ref){stamp,((uint64_t)s->generation<<32)|(i+1)};
        return CR_OK;
    }
    return CR_LIMIT;
}
static int put(unsigned tag,const char *key,void *ptr,lb_cr_fn d,lb_cr_dispose shim,lb_cr_ref *out) {
    if(!owner()) return CR_UNAVAILABLE;
    if(!fresh(out) || !key_ok(key) || (tag!=TYPE && !ptr) || (!!d!=!!shim))
        return CR_INVALID;
    for(entity *e=entities;e;e=e->next) {
        if(e->tag!=tag || (tag==TYPE ? strcmp(e->key,key)!=0 : e->payload!=ptr)) continue;
        if(tag==BINDING || e->retiring || (key && strcmp(e->key,key)) || d!=e->destructor) return CR_INVALID;
        return ticket(e,out);
    }
    entity *e=calloc(1,sizeof *e);
    if(!e) return CR_LIMIT;
    e->tag=tag; e->payload=ptr; e->destructor=d; e->dispose=shim;
    if(key) memcpy(e->key,key,65);
    int rc=ticket(e,out);
    if(rc!=CR_OK) { free(e); return rc; }
    e->next=entities; entities=e; return CR_OK;
}
static void release(slot *s) {
    entity *e=s->value; s->value=NULL;
    if(--e->owners) return;
    e->retiring=1;
    /* The application may re-enter and change the list during disposal. */
    if(e->dispose) e->dispose(e->destructor,e->payload);
    entity **p=&entities; while(*p!=e) p=&(*p)->next;
    *p=e->next; free(e);
}
int LB_CR(adopt)(const char *k,void *p,lb_cr_fn d,lb_cr_dispose shim,lb_cr_ref *out) {
    return put(OBJECT,k,p,d,shim,out);
}
int LB_CR(binding)(const char *k,void *p,lb_cr_fn d,lb_cr_dispose shim,lb_cr_ref *out) {
    return put(BINDING,k,p,d,shim,out);
}
int LB_CR(clone)(const char *k,lb_cr_ref h,lb_cr_ref *out) {
    if(!fresh(out) || !key_ok(k)) return CR_INVALID;
    entity *e=NULL; int rc=check(OBJECT,k,h,&e); return rc==CR_OK ? ticket(e,out) : rc;
}
static int drop(unsigned tag,const char *k,lb_cr_ref *h) {
    if(!h) return CR_INVALID;
    entity *e=NULL; int rc=check(tag,k,*h,&e);
    if(rc==CR_OK) { slot *s=resolve(h->ticket); *h=(lb_cr_ref){0}; release(s); }
    return rc;
}
int LB_CR(drop)(const char *k,lb_cr_ref *h) { return key_ok(k)?drop(OBJECT,k,h):CR_INVALID; }
int LB_CR(binding_drop)(const char *k,lb_cr_ref *h) { return key_ok(k)?drop(BINDING,k,h):CR_INVALID; }
int LB_CR(same)(const char *k,lb_cr_ref a,lb_cr_ref b,int *out) {
    if(!out || !key_ok(k)) return CR_INVALID;
    entity *l=NULL,*r=NULL; int rc=check(OBJECT,k,a,&l);
    if(rc==CR_OK) rc=check(OBJECT,k,b,&r);
    if(rc==CR_OK) *out=l==r;
    return rc;
}
static int get(unsigned tag,const char *k,lb_cr_ref h,void **out) {
    if(!out) return CR_INVALID;
    entity *e=NULL; int rc=check(tag,k,h,&e);
    if(rc==CR_OK) *out=e->payload;
    return rc;
}
int LB_CR(get)(const char *k,lb_cr_ref h,void **out) { return key_ok(k)?get(OBJECT,k,h,out):CR_INVALID; }
int LB_CR(binding_get)(const char *k,lb_cr_ref h,void **out) { return key_ok(k)?get(BINDING,k,h,out):CR_INVALID; }
int LB_CR(lift)(const char *k,uint64_t t,lb_cr_ref *out) {
    if(!fresh(out) || !key_ok(k)) return CR_INVALID;
    if(!owner()) return CR_UNAVAILABLE;
    lb_cr_ref h={stamp,t}; entity *e=NULL; int rc=check(OBJECT,k,h,&e);
    if(rc==CR_OK) *out=h; /* The private caller already owns this ticket. */
    return rc;
}
int LB_CR(refop)(uint64_t binding,const char *const *keys,size_t nk,int op,const uint64_t *args,size_t n,uint64_t *out) {
    if(!owner() || !keys || !args || n!=2 || !out) return 2;
    slot *self=resolve(binding), *a=resolve(args[0]), *b=resolve(args[1]);
    if(!self || self->value->tag!=BINDING) return 2;
    lb_cr_ref result={0};
    switch(op) {
    case -1: if(ticket(self->value,&result)!=CR_OK) return 2; break;
    case -2: out[0]=!!(a && a->value->tag==BINDING); return 0;
    case -3: out[0]=!!(a && a->value==self->value); return 0;
    case -4: if(args[0]>=nk || put(TYPE,keys[args[0]],NULL,NULL,NULL,&result)!=CR_OK) return 2; break;
    case -5: if(!a || !b) return 2; out[0]=a->value==b->value; return 0;
    case -6: out[0]=!!(a && b && a->value->tag==OBJECT && b->value->tag==TYPE && !strcmp(a->value->key,b->value->key)); return 0;
    case -7: case -9: if(!a || a->value->tag!=OBJECT || ticket(a->value,&result)!=CR_OK) return 2; break;
    case -8: if(!a) return 2; release(a); out[0]=0; return 0;
    default: return 2;
    }
    out[0]=result.ticket; return 0;
}
