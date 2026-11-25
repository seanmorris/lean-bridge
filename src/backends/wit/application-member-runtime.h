/* Used only by generated glue between authenticated WIT members and compiled
 * Lean. The application never supplies a native object pointer or error ID. */
#ifndef LB_WIT_APPLICATION_MEMBER_RUNTIME_H
#define LB_WIT_APPLICATION_MEMBER_RUNTIME_H
#include "application-object-store.h"
#include <stdlib.h>

typedef struct lwit_fault {
    struct lwit_fault *next;
    uint32_t id;
    lwit_owner owner;
} lwit_fault;
typedef struct lwit_call_frame {
    struct lwit_call_frame *parent;
    lwit_fault *faults;
    unsigned count;
} lwit_call_frame;
static inline bool lwit_no_error(wasmtime_error_t *error){
    if(!error)return true;
    wasmtime_error_delete(error);return false;
}
static inline uint32_t lwit_capture(lwit_call_frame *frame,lwit_store *s,
    wasmtime_component_resource_type_t *type,wasmtime_component_val_t *value){
    if(!frame || frame->count>=4096)return UINT32_MAX;
    lwit_fault *record=calloc(1,sizeof *record);
    if(!record || !lwit_take_type(s,type,value,&record->owner)){free(record);return UINT32_MAX;}
    record->id=++frame->count;record->next=frame->faults;frame->faults=record;return record->id;
}
/* Move only the failure actually returned through Lean. Caught/mapped and
 * intervening failures are released even if the guest reported several. */
static inline bool lwit_finish_frame(lwit_call_frame *f,uint32_t id,lwit_owner *out){
    bool found=!id,ok=true;
    while(f->faults){
        lwit_fault *p=f->faults;f->faults=p->next;
        if(id && id==p->id && out && !out->any && !out->source && lwit_open(p->owner.source)){
            *out=p->owner;*out->prev=out;if(out->next)out->next->prev=&out->next;
            p->owner=(lwit_owner){0};found=true;
        }
        if(!lwit_no_error(lwit_drop(&p->owner)))ok=false;
        free(p);
    }
    return found && ok;
}
struct lwit_box {
    lwit_owner owner;
    const char *key;
    void (*dispose)(void *);
    unsigned pins;
    bool retired;
};
typedef bool (*lwit_adopter)(void *,void (*)(void *),void *);
static inline void lwit_box_free(lwit_box *b){
    (void)lwit_no_error(lwit_drop(&b->owner));free(b);
}
static inline void lwit_box_dispose(void *data){
    lwit_box *b=data;b->retired=true;if(!b->pins)lwit_box_free(b);
}
/* An independently built package may pass a C registry reference. Check
 * its payload against this store's live objects before dereferencing it. */
static inline lwit_owner *lwit_unwrap(lwit_class *k,const char *key,const void *data){
    if(!k || !lwit_open(k->store) || !data)return NULL;
    for(lwit_owner *o=k->store->owners;o;o=o->next)
        if(o->box==data && !o->box->retired && !strcmp(o->box->key,key) && lwit_is(k,o))return o;
    return NULL;
}
/* ResourceAny has no globally stable representation identity. Compare via
 * the defining guest, holding the candidates alive over reentrant guest
 * code. If reentry installed a new candidate, search again before insertion. */
static inline bool lwit_intern(lwit_class *k,const char *key,wasmtime_component_val_t *result,
                               lwit_adopter adopt,void *out){
    lwit_store *s=k->store;lwit_box *fresh=calloc(1,sizeof *fresh);
    if(!fresh || !lwit_take(s,k,result,&fresh->owner)){free(fresh);return false;}
    fresh->key=key;fresh->dispose=lwit_box_dispose;
    bool ok=false;++s->active;
    for(unsigned retry=0;retry<64;retry++){
        uint64_t revision=s->revision;size_t count=0;
        for(lwit_owner *o=s->owners;o;o=o->next)if(o->box && !o->box->retired && !strcmp(o->box->key,key))count++;
        if(count>4096)break;
        lwit_box **candidates=count?calloc(count,sizeof *candidates):NULL;
        if(count && !candidates)break;
        size_t i=0;
        for(lwit_owner *o=s->owners;o;o=o->next)if(o->box && !o->box->retired && !strcmp(o->box->key,key)){
            candidates[i++]=o->box;o->box->pins++;
        }
        bool stop=false;
        for(i=0;i<count && !stop;i++){
            lwit_box *b=candidates[i];bool same=false;
            if(b->retired || !lwit_is(k,&b->owner))continue;
            if(!lwit_no_error(lwit_same(k,&fresh->owner,&b->owner,&same))){stop=true;break;}
            if(same && !b->retired){ok=adopt(b,b->dispose,out);stop=true;}
        }
        for(i=0;i<count;i++)if(!--candidates[i]->pins && candidates[i]->retired)lwit_box_free(candidates[i]);
        free(candidates);
        if(stop || !lwit_open(s))break;
        if(s->revision!=revision)continue;
        if(s->revision!=UINT64_MAX && adopt(fresh,fresh->dispose,out)){
            fresh->owner.box=fresh;s->revision++;fresh=NULL;ok=true;
        }
        break;
    }
    if(fresh)lwit_box_free(fresh);
    --s->active;return ok && lwit_open(s);
}
#endif
