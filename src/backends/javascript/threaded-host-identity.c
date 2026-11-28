/* Private, once per pthread Wasm heap. The owner is the only agent that
 * touches the index or JS. Workers may retain and release the Lean wrapper.
 * Never increment through a weak raw pointer racing the last worker release:
 * the index always owns one MT reference until eviction or retirement. */
#include <lean/lean.h>
#include <emscripten.h>
#include <emscripten/threading.h>
#include <stdatomic.h>
#include <stdlib.h>
#if !defined(__wasm32__) || !defined(__EMSCRIPTEN_PTHREADS__)
#error Expected a threaded Emscripten Wasm heap
#endif
extern uint32_t bridge_lean_runtime_status(void);
enum { LB_JST_BUCKETS=256, LB_JST_CAPACITY=4096 };
typedef struct lb_jst_ref {
    struct lb_jst_ref *next;
    lean_object *wrapper;
    uint32_t kind,token;
    bool strong;
} lb_jst_ref;
static lb_jst_ref *table[LB_JST_BUCKETS];
static lean_external_class *wrapper_class;
static unsigned count,weak;
static bool sweeping;
static bool owner(void) {return emscripten_is_main_runtime_thread();}
static bool active(void) {return owner() && !sweeping && bridge_lean_runtime_status()==2;}
/* These hooks update only the private domain's pin table, not user methods. */
EM_JS(int,lb_jst_attach,(uint32_t k,uint32_t t,uint32_t a,int fresh),{
    try {Module['lbJshDomainV1'].attach(k>>>0,t>>>0,a>>>0,fresh);return 1;} catch (_) {return 0;}
});
EM_JS(void,lb_jst_detach,(uint32_t k,uint32_t t),{Module['lbJshDomainV1'].detach(k>>>0,t>>>0);});
EM_JS(int,lb_jst_strong,(uint32_t k,uint32_t t),{return Module['lbJshDomainV1'].strong(k>>>0,t>>>0)?1:0;});
/* After unlinking, the last Lean release may occur on any worker. The
 * finalizer owns plain C storage only; it must never enter the host. */
static void finalize(void *ptr) {free(ptr);}
static void visit(void *ptr,b_lean_obj_arg f) {(void)ptr;(void)f;}
static lb_jst_ref *ref(b_lean_obj_arg o) {
    if (!o || !wrapper_class || lean_is_scalar(o) || !lean_is_external(o) || lean_get_external_class(o)!=wrapper_class) return NULL;
    lb_jst_ref *r=lean_get_external_data(o);
    return r->kind && r->wrapper==o?r:NULL;
}
static void unlink_ref(lb_jst_ref **at) {
    lb_jst_ref *r=*at;*at=r->next;r->next=NULL;
    uint32_t k=r->kind;r->kind=0;
    count--;if (!r->strong) weak--;
    lb_jst_detach(k,r->token);lean_dec(r->wrapper);
}
/* Lean 4.32.2 stores MT counts as negative integers. Exactly -1 means
 * the index holds the only reference. No worker can acquire a first
 * reference then: a legal copy requires a live owner. The owner thread
 * serializes all lookups and eviction. Never read an unpinned header. */
static void sweep(uint32_t kind,bool all) {
    if (!owner() || sweeping || !count || (!all && !kind && !weak)) return;
    sweeping=true;
    for (size_t i=0;i<LB_JST_BUCKETS;i++) {
        lb_jst_ref **at=&table[i];
        while (*at) {
            lb_jst_ref *r=*at;
            if (all || (kind?r->kind==kind:(!r->strong && atomic_load_explicit(lean_get_rc_mt_addr(r->wrapper),memory_order_acquire)==-1)))
                unlink_ref(at);
            else at=&r->next;
        }
    }
    sweeping=false;
}
/* A ticket follows the exact Lean IO.Error through tasks. Holding one MT
   reference prevents pointer reuse. Catching, replacing, or discarding the
   error drops the JS ticket at the next owner collection point. */
typedef struct lb_jst_failure { struct lb_jst_failure *next; lean_object *value; uint32_t ticket; } lb_jst_failure;
static lb_jst_failure *failures;
static unsigned failure_count;
EM_JS(void,lb_jst_discard,(uint32_t t),{Module['lbJstHostCallsV1'].discard(t>>>0);});
EM_JS(uint32_t,lb_jst_copy_ticket,(uint32_t t),{return Module['lbJstHostCallsV1'].copy(t>>>0);});
static void collect_errors(bool all) {
    if (!owner()) return;
    lb_jst_failure **at=&failures;
    while (*at) {
        lb_jst_failure *r=*at;
        if (all || atomic_load_explicit(lean_get_rc_mt_addr(r->value),memory_order_acquire)==-1) {
            *at=r->next;failure_count--;lb_jst_discard(r->ticket);lean_dec(r->value);free(r);
        } else at=&r->next;
    }
}
lean_obj_res lb_jst_new_error_v1(uint32_t status,uint32_t ticket) {
    if (!owner() || !ticket) __builtin_trap();
    if (failure_count==LB_JST_CAPACITY) collect_errors(false);
    lb_jst_failure *r=failure_count==LB_JST_CAPACITY?NULL:malloc(sizeof(*r));
    if (!r) {
        lb_jst_discard(ticket);
        /* Never relabel a thrown application value as an ordinary Lean IO
           failure just because its origin cannot be retained. */
        __builtin_trap();
    }
    r->value=lean_mk_io_user_error(lean_mk_string(status==1?"JavaScript host member failed":"Invalid JavaScript host value"));
    lean_mark_mt(r->value);lean_inc(r->value);r->ticket=ticket;
    r->next=failures;failures=r;failure_count++;return r->value;
}
uint32_t lb_jst_error_ticket_v1(b_lean_obj_arg error) {
    if (!active()) return 0;
    for (lb_jst_failure *r=failures;r;r=r->next) if (r->value==error) return lb_jst_copy_ticket(r->ticket);
    return 0;
}
void lb_jst_collect_v1(void) {sweep(0,false);collect_errors(false);}
void lb_jst_retire_all_v1(void) {sweep(0,true);collect_errors(true);}
int lb_jst_retire_v1(uint32_t kind) {if (!active() || !kind) return 0;sweep(kind,false);return 1;}
uint32_t lb_jst_token_v1(uint32_t kind,b_lean_obj_arg o) {
    if (!active()) return 0;
    lb_jst_ref *r=ref(o);return r && r->kind==kind?r->token:0;
}
lean_obj_res lb_jst_wrap_v1(uint32_t kind,uint32_t token,b_lean_obj_arg anchor) {
    if (!active() || !kind || !token) return NULL;
    lb_jst_ref *parent=anchor?ref(anchor):NULL;
    if (anchor && !parent) return NULL;
    uint32_t a=parent?parent->token:0;
    lb_jst_ref **bucket=&table[token%LB_JST_BUCKETS];
    for (lb_jst_ref *r=*bucket;r;r=r->next) if (r->token==token) {
        if (r->kind!=kind || !lb_jst_attach(kind,token,a,0)) return NULL;
        lean_inc(r->wrapper);return r->wrapper;
    }
    if (count==LB_JST_CAPACITY) {lb_jst_collect_v1();if (count==LB_JST_CAPACITY) return NULL;}
    lb_jst_ref *r=calloc(1,sizeof(*r));if (!r) return NULL;
    if (!lb_jst_attach(kind,token,a,1)) {free(r);return NULL;}
    if (!wrapper_class) wrapper_class=lean_register_external_class(finalize,visit);
    r->kind=kind;r->token=token;r->wrapper=lean_alloc_external(wrapper_class,r);lean_mark_mt(r->wrapper);
    r->next=*bucket;*bucket=r;count++;weak++;
    lean_inc(r->wrapper);return r->wrapper;
}
int lb_jst_admit_v1(uint32_t kind,b_lean_obj_arg o) {
    if (!active()) return 0;
    lb_jst_ref *r=ref(o);if (!r || r->kind!=kind) return 0;
    if (!r->strong && lb_jst_strong(kind,r->token)) {r->strong=true;weak--;}
    return 1;
}
