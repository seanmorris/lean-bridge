#define _GNU_SOURCE
#include "host-domain.h"
#include <stdatomic.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <sys/syscall.h>

/* Shared by independently compiled components. Only the process main thread
   manipulates the registry. The last binding clears all managed references
   before a stale Lean wrapper can reach its thread-independent finalizer. */
typedef struct kind kind;
typedef struct anchor {struct anchor *next; uint64_t managed;} anchor;
typedef struct row {struct row *next; kind *owner; lean_object *wrapper; uint64_t managed; anchor *anchors; int pinned;} row;
struct kind {kind *next; char *key; uint64_t type; int strong; size_t bindings, provisional; row *rows;};
struct lb_dnd_session {struct lb_dnd_session *next; uint64_t binder; char *component; size_t count,depth; kind *kinds[];};
static kind *kinds;
static lb_dnd_session *sessions;
static lean_external_class *tag;
static size_t live;
static pid_t origin;
enum { BINDER=-1, ALIVE=-2, MATCH=-3, TYPE=-4, SAME=-5, INSTANCE=-6, COPY=-7, DROP=-8, EXPORT=-9 };
static void destroy(void *r) { free(r); }
static void visit(void *r,b_lean_obj_arg fn) { (void)r; (void)fn; }
static int owner(void) { pid_t p=getpid(); return p==(pid_t)syscall(SYS_gettid) && (!origin || origin==p); }
static void fatal(lb_dn_frame *f) {
    for(lb_dn_frame *p=f;p;p=p->parent) p->fatal=1;
    f->retire();
}
static uint64_t ref(lb_dn_frame *f,int op,uint64_t a,uint64_t b) {
    uint64_t args[2]={a,b},out[3]={0}; uint32_t fault=0;
    if(f->dispatch(f->call,op,args,2,out,&fault)!=0 || fault) { fatal(f); return 0; }
    return out[0];
}
static void sweep(lb_dn_frame *f,kind *k,int all) {
    if(!all && k->strong && !k->provisional) return;
    row **cursor=&k->rows;
    while(*cursor) {
        row *v=*cursor;
        if(!all) {
            int rc=atomic_load_explicit(lean_get_rc_mt_addr(v->wrapper),memory_order_acquire);
            if(v->pinned || (rc!=1 && rc!=-1)) { cursor=&v->next; continue; }
        }
        *cursor=v->next;
        if(k->strong && !v->pinned) --k->provisional;
        while(v->anchors) {
            anchor *a=v->anchors; v->anchors=a->next;
            ref(f,DROP,a->managed,0); free(a);
        }
        ref(f,DROP,v->managed,0); v->managed=0; v->owner=NULL;
        --live; lean_dec(v->wrapper);
    }
}
static void retire_session(lb_dn_frame *f,lb_dnd_session *s) {
    while(s->count) {
        kind *k=s->kinds[--s->count]; if(--k->bindings) continue;
        kind **p=&kinds; while(*p!=k) p=&(*p)->next;
        *p=k->next; sweep(f,k,1); ref(f,DROP,k->type,0); free(k->key); free(k);
    }
    if(s->binder) ref(f,DROP,s->binder,0); free(s->component); free(s);
}
static lb_dnd_session **find(lb_dn_frame *f,const char *component) {
    lb_dnd_session **p=&sessions, **match=NULL;
    while(*p && !f->fatal) {
        lb_dnd_session *s=*p;
        if(!s->depth && !ref(f,ALIVE,s->binder,0) && !f->fatal) {
            *p=s->next; retire_session(f,s); continue;
        }
        if(component && !strcmp(s->component,component) && ref(f,MATCH,s->binder,0)) match=p;
        p=&s->next;
    }
    return f->fatal ? NULL : match ? match : p;
}
int LB_DND(open)(lb_dn_frame *f,const char *component,const lb_dnd_spec *spec,size_t n) {
    if(!owner() || !f || !component || !n || n>64) return DN_INCOMPATIBLE;
    if(!origin) origin=getpid();
    lb_dnd_session **p=find(f,component); if(!p) return DN_DOMAIN_FATAL; if(*p) return DN_ACTIVE;
    lb_dnd_session *s=calloc(1,sizeof(*s)+n*sizeof(kind *));
    if(!s) { fatal(f); return DN_DOMAIN_FATAL; }
    int reason=DN_DOMAIN_FATAL;
    if(!(s->component=strdup(component))) { fatal(f); goto fail; }
    if(!(s->binder=ref(f,BINDER,0,0))) goto fail;
    if(!tag) tag=lean_register_external_class(destroy,visit);
    for(size_t i=0;i<n;i++) {
        uint64_t type=ref(f,TYPE,i,0); if(!type) goto fail;
        kind *k=kinds; while(k && strcmp(k->key,spec[i].key)) k=k->next;
        if(k) {
            int ok=k->strong==spec[i].strong && ref(f,SAME,type,k->type);
            ref(f,DROP,type,0); if(f->fatal) goto fail;
            if(!ok) { reason=DN_INCOMPATIBLE; goto fail; }
        } else {
            k=calloc(1,sizeof(*k));
            if(!k || !(k->key=strdup(spec[i].key))) { free(k); ref(f,DROP,type,0); fatal(f); goto fail; }
            k->type=type; k->strong=spec[i].strong; k->next=kinds; kinds=k;
        }
        ++k->bindings; s->kinds[s->count++]=k;
    }
    s->next=sessions; sessions=s; return DN_BOUND;
fail: retire_session(f,s); return reason;
}
int LB_DND(close)(lb_dn_frame *f,const char *component) {
    if(!owner()) return DN_DOMAIN_FATAL;
    lb_dnd_session **p=find(f,component); if(!p) return DN_DOMAIN_FATAL;
    lb_dnd_session *s=*p; if(!s) return DN_BOUND;
    if(s->depth) return DN_ACTIVE;
    *p=s->next; retire_session(f,s); return f->fatal?DN_DOMAIN_FATAL:DN_BOUND;
}
lb_dnd_session *LB_DND(enter)(lb_dn_frame *f,const char *component) {
    if(!owner()) return NULL;
    lb_dnd_session **p=find(f,component); if(!p || !*p) return NULL;
    lb_dnd_session *s=*p;
    for(size_t i=0;i<s->count;i++) sweep(f,s->kinds[i],0);
    if(f->fatal) return NULL; ++s->depth; return s;
}
void LB_DND(leave)(lb_dn_frame *f,lb_dnd_session *s) {
    for(size_t i=0;i<s->count;i++) sweep(f,s->kinds[i],0);
    --s->depth;
}
lean_object *LB_DND(wrap)(lb_dn_frame *f,lb_dnd_session *s,unsigned i,uint64_t obj,uint64_t parent) {
    if(!s || i>=s->count || !obj || !ref(f,INSTANCE,obj,s->kinds[i]->type)) return NULL;
    kind *k=s->kinds[i]; row *v=k->rows;
    while(v && !ref(f,SAME,v->managed,obj)) { if(f->fatal) return NULL; v=v->next; }
    if(!v) {
        v=calloc(1,sizeof(*v)); if(!v) { fatal(f); return NULL; }
        if(!(v->managed=ref(f,COPY,obj,0))) { free(v); return NULL; }
        v->wrapper=lean_alloc_external(tag,v); v->owner=k; v->next=k->rows; k->rows=v;
        ++live; if(k->strong) ++k->provisional;
    }
    if(parent && !ref(f,SAME,obj,parent)) {
        anchor *a=v->anchors;
        while(a && !ref(f,SAME,a->managed,parent)) { if(f->fatal) return NULL; a=a->next; }
        if(!a && !f->fatal) {
            a=malloc(sizeof(*a)); if(!a) { fatal(f); return NULL; }
            if(!(a->managed=ref(f,COPY,parent,0))) { free(a); return NULL; }
            a->next=v->anchors; v->anchors=a;
        }
    }
    if(f->fatal) return NULL;
    lean_inc(v->wrapper); return v->wrapper;
}
void LB_DND(admit)(lean_object *wrapper) {
    row *v=lean_get_external_data(wrapper);
    if(v->owner->strong && !v->pinned) { v->pinned=1; --v->owner->provisional; }
}
uint64_t LB_DND(object)(lb_dnd_session *s,unsigned i,b_lean_obj_arg wrapper) {
    if(s && i<s->count && wrapper && !lean_is_scalar(wrapper) && lean_is_external(wrapper) && lean_get_external_class(wrapper)==tag) {
        row *v=lean_get_external_data(wrapper);
        if(v->owner==s->kinds[i]) return v->managed;
    }
    return 0;
}
uint64_t LB_DND(export)(lb_dn_frame *f,lb_dnd_session *s,unsigned i,b_lean_obj_arg wrapper) {
    uint64_t id=LB_DND(object)(s,i,wrapper); return id ? ref(f,EXPORT,id,0) : 0;
}
size_t LB_DND(live)(lb_dn_frame *f) { if(!owner()) return SIZE_MAX; find(f,NULL); return live; }
