/* Private rendezvous for guest-owned WIT operations. Wasmtime stays on the
 * store thread. A single native owner runs the original synchronous Lean call
 * to completion, yielding member requests to the guest's Wasm facade. Nested
 * Lean calls use that same owner. Neither side polls or moves its stack.
 * Only copied protocol words cross here, never a Wasm handle or a pointer. */
#ifndef LB_WIT_APPLICATION_TURN_H
#define LB_WIT_APPLICATION_TURN_H
#include <pthread.h>
#include <stdbool.h>
#include <stdint.h>

typedef struct lb_wit_turns lb_wit_turns;
typedef struct { uint32_t op; uint64_t words[3]; } lb_wit_message;
typedef struct { lb_wit_turns *owner; uint64_t id; } lb_wit_ticket;
typedef struct { lb_wit_ticket ticket; bool done; lb_wit_message message; } lb_wit_event;
typedef bool (*lb_wit_enter)(lb_wit_turns *,void *,lb_wit_message,lb_wit_message *);
enum lb_wit_phase { LB_WIT_NEW,LB_WIT_RUNNING,LB_WIT_READY,LB_WIT_DELIVERED,LB_WIT_REPLY,LB_WIT_DONE };
typedef struct { uint64_t id; enum lb_wit_phase phase; lb_wit_message message; } lb_wit_frame;
#define LB_WIT_TURN_DEPTH 32
struct lb_wit_turns {
    pthread_mutex_t lock; pthread_cond_t changed; pthread_t guest,worker;
    lb_wit_enter enter; void (*finish)(void *); void *context;
    bool (*guest_main)(lb_wit_turns *,void *);void *guest_data;
    uint64_t next; unsigned depth; bool opened,stop,drained,failed,guest_ok;
    lb_wit_frame frames[LB_WIT_TURN_DEPTH];
};

/* Called with the lock held on the native owner. A frame address remains
 * stable if enter() itself requests a member which re-enters Lean. */
static inline void lb_wit_dispatch(lb_wit_turns *s,lb_wit_frame *f){
    lb_wit_message arg=f->message,out={0};f->phase=LB_WIT_RUNNING;
    pthread_mutex_unlock(&s->lock);
    bool ok=s->enter(s,s->context,arg,&out);
    pthread_mutex_lock(&s->lock);
    if(!ok && !s->stop){s->failed=true;s->stop=true;}
    f->message=out;f->phase=LB_WIT_DONE;pthread_cond_broadcast(&s->changed);
}
static inline void lb_wit_serve(lb_wit_turns *s){
    pthread_mutex_lock(&s->lock);
    while(!s->stop){
        if(s->depth && s->frames[s->depth-1].phase==LB_WIT_NEW)
            lb_wit_dispatch(s,&s->frames[s->depth-1]);
        else pthread_cond_wait(&s->changed,&s->lock);
    }
    pthread_mutex_unlock(&s->lock);
    if(s->finish)s->finish(s->context);
    pthread_mutex_lock(&s->lock);s->drained=true;pthread_cond_broadcast(&s->changed);pthread_mutex_unlock(&s->lock);
}
/* Native member dispatch: return only when this exact, topmost call has a
 * reply. An invoked guest method may first run another complete Lean call. */
static inline bool lb_wit_turn_request(lb_wit_turns *s,lb_wit_message req,lb_wit_message *out){
    if(!s || !out || !s->opened || !pthread_equal(pthread_self(),s->worker))return false;
    pthread_mutex_lock(&s->lock);bool ok=false;
    if(s->stop || !s->depth)goto done;
    lb_wit_frame *f=&s->frames[s->depth-1];
    if(f->phase!=LB_WIT_RUNNING)goto done;
    f->message=req;f->phase=LB_WIT_READY;pthread_cond_broadcast(&s->changed);
    while(!s->stop){
        lb_wit_frame *top=&s->frames[s->depth-1];
        if(top==f && f->phase==LB_WIT_REPLY){*out=f->message;f->phase=LB_WIT_RUNNING;ok=true;break;}
        if(top!=f && top->phase==LB_WIT_NEW)lb_wit_dispatch(s,top);
        else pthread_cond_wait(&s->changed,&s->lock);
    }
done:
    pthread_mutex_unlock(&s->lock);return ok;
}
static inline bool lb_wit_observe(lb_wit_turns *s,lb_wit_frame *f,lb_wit_event *out){
    pthread_cond_broadcast(&s->changed);
    while(!s->stop && f->phase!=LB_WIT_READY && f->phase!=LB_WIT_DONE)
        pthread_cond_wait(&s->changed,&s->lock);
    if(s->stop)return false;
    *out=(lb_wit_event){.ticket={s,f->id},.done=f->phase==LB_WIT_DONE,.message=f->message};
    if(out->done){*f=(lb_wit_frame){0};--s->depth;pthread_cond_broadcast(&s->changed);}
    else f->phase=LB_WIT_DELIVERED;
    return true;
}
static inline bool lb_wit_turn_begin(lb_wit_turns *s,lb_wit_message input,lb_wit_event *out){
    if(!s || !out || !s->opened || !pthread_equal(pthread_self(),s->guest))return false;
    pthread_mutex_lock(&s->lock);bool ok=false;
    if(!s->stop && s->next!=UINT64_MAX && s->depth<LB_WIT_TURN_DEPTH &&
        (!s->depth || s->frames[s->depth-1].phase==LB_WIT_DELIVERED)){
        lb_wit_frame *f=&s->frames[s->depth++];*f=(lb_wit_frame){++s->next,LB_WIT_NEW,input};
        ok=lb_wit_observe(s,f,out);
    }
    pthread_mutex_unlock(&s->lock);return ok;
}
static inline bool lb_wit_turn_reply(lb_wit_turns *s,lb_wit_ticket ticket,lb_wit_message reply,lb_wit_event *out){
    if(!s || !out || ticket.owner!=s || !s->opened || !pthread_equal(pthread_self(),s->guest))return false;
    pthread_mutex_lock(&s->lock);bool ok=false;
    if(!s->stop && s->depth){
        lb_wit_frame *f=&s->frames[s->depth-1];
        if(f->id==ticket.id && f->phase==LB_WIT_DELIVERED){
            f->message=reply;f->phase=LB_WIT_REPLY;ok=lb_wit_observe(s,f,out);
        }
    }
    pthread_mutex_unlock(&s->lock);return ok;
}
/* A trap in a guest method may leave the native owner parked. Wake it so it
 * can release native frames on its own thread before the store disappears. */
static inline bool lb_wit_turn_retire(lb_wit_turns *s){
    if(!s || !s->opened || !pthread_equal(pthread_self(),s->guest))return false;
    pthread_mutex_lock(&s->lock);s->stop=true;pthread_cond_broadcast(&s->changed);
    while(!s->drained)pthread_cond_wait(&s->changed,&s->lock);
    pthread_mutex_unlock(&s->lock);return true;
}
static inline void *lb_wit_guest(void *ptr){
    lb_wit_turns *s=ptr;s->guest=pthread_self();
    s->guest_ok=s->guest_main(s,s->guest_data);
    (void)lb_wit_turn_retire(s);return NULL;
}
/* Run on the process main thread: it owns Lean's native host registry. A
 * single separate thread creates, drives and destroys the Wasmtime store.
 * Neither an active store context nor a borrowed guest handle crosses threads. */
static inline bool lb_wit_turn_run(lb_wit_turns *s,lb_wit_enter enter,void (*finish)(void *),void *ctx,
    bool (*guest)(lb_wit_turns *,void *),void *data){
    if(!s || !enter || !guest || s->opened || pthread_mutex_init(&s->lock,NULL))return false;
    if(pthread_cond_init(&s->changed,NULL)){pthread_mutex_destroy(&s->lock);return false;}
    s->worker=pthread_self();s->enter=enter;s->finish=finish;s->context=ctx;s->guest_main=guest;s->guest_data=data;
    s->stop=s->failed=s->drained=s->guest_ok=false;s->depth=0;s->opened=true;
    pthread_t thread;
    if(pthread_create(&thread,NULL,lb_wit_guest,s)){
        pthread_cond_destroy(&s->changed);pthread_mutex_destroy(&s->lock);s->opened=false;return false;
    }
    lb_wit_serve(s);
    if(pthread_join(thread,NULL))return false;
    pthread_cond_destroy(&s->changed);pthread_mutex_destroy(&s->lock);
    s->opened=false;s->depth=0;return !s->failed && s->guest_ok;
}
#endif
