/* Private per-component table for WIT-owned record reps. Never export a native
   address or truncate a 64-bit C lease to the canonical ABI's 32-bit rep.
   The Wasmtime store serializes access, but a destructor may reenter. */
#ifndef LWIT_APPLICATION_RECORD_TABLE_H
#define LWIT_APPLICATION_RECORD_TABLE_H
#include <stdbool.h>
#include <stdint.h>
#include <stdlib.h>

typedef bool (*lwit_record_drop_fn)(uint64_t [2]);
typedef struct {
    uint64_t owner[2];
    lwit_record_drop_fn drop;
    uint32_t generation, next;
} lwit_record_slot;
typedef struct {
    lwit_record_slot *slots;
    uint32_t capacity, free_head;
    bool closed;
} lwit_record_table;

enum { LWIT_RECORD_BITS = 12, LWIT_RECORD_LIMIT = 1u << LWIT_RECORD_BITS };
#define LWIT_RECORD_LAST_GEN (UINT32_MAX >> LWIT_RECORD_BITS)

/* Move only after all allocations succeed. Zero is not a valid record rep. */
static inline bool lwit_record_save(lwit_record_table *t, lwit_record_drop_fn drop,
                                    uint64_t owner[2], uint32_t *rep) {
    if (!t || t->closed || !drop || !owner || !owner[0] || !owner[1] || !rep || *rep) return false;
    if (!t->free_head) {
        uint32_t old=t->capacity, cap=old ? old*2u : 8u;
        if (cap>LWIT_RECORD_LIMIT) return false;
        lwit_record_slot *v=realloc(t->slots,cap*sizeof *v);
        if (!v) return false;
        t->slots=v; t->capacity=cap;
        for (uint32_t i=cap;i>old;--i) {
            v[i-1]=(lwit_record_slot){.generation=1u,.next=t->free_head};
            t->free_head=i;
        }
    }
    uint32_t i=t->free_head-1u;
    lwit_record_slot *s=&t->slots[i];
    t->free_head=s->next;
    s->drop=drop; s->owner[0]=owner[0]; s->owner[1]=owner[1];
    owner[0]=owner[1]=0;
    *rep=(s->generation<<LWIT_RECORD_BITS)|i;
    return true;
}

/* Copy the private token, never a pointer into a reallocatable table. The
   caller must clone the underlying native lease before invoking guest code. */
static inline bool lwit_record_lookup(const lwit_record_table *t,uint32_t rep,
                                      lwit_record_drop_fn expected,uint64_t owner[2]) {
    uint32_t i=rep & (LWIT_RECORD_LIMIT-1u);
    if (!t || t->closed || !expected || !owner || owner[0] || owner[1] || i>=t->capacity) return false;
    const lwit_record_slot *s=&t->slots[i];
    if (s->drop!=expected || s->generation!=(rep>>LWIT_RECORD_BITS)) return false;
    owner[0]=s->owner[0];owner[1]=s->owner[1];
    return true;
}

static inline bool lwit_record_remove(lwit_record_table *t,uint32_t rep,lwit_record_drop_fn expected) {
    uint64_t owner[2]={0};
    if (!lwit_record_lookup(t,rep,expected,owner)) return false;
    uint32_t i=rep & (LWIT_RECORD_LIMIT-1u);
    lwit_record_slot *s=&t->slots[i];
    s->drop=NULL; s->owner[0]=s->owner[1]=0;
    /* Retire permanently rather than wrap and make an old rep valid again. */
    if (s->generation<LWIT_RECORD_LAST_GEN) {
        ++s->generation;s->next=t->free_head;t->free_head=i+1u;
    }
    return expected(owner);
}

static inline bool lwit_record_table_close(lwit_record_table *t) {
    if (!t) return false;
    if (t->closed) return true;
    t->closed=true;
    bool ok=true;
    for (uint32_t i=0;i<t->capacity;++i) {
        lwit_record_slot *s=&t->slots[i];
        if (s->drop && !s->drop(s->owner)) ok=false;
    }
    free(t->slots);t->slots=NULL;t->capacity=t->free_head=0;
    return ok;
}
#endif
