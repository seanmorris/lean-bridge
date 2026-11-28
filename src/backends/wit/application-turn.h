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
typedef struct lb_wit_loop lb_wit_loop;
typedef struct { uint32_t op; uint64_t words[3]; } lb_wit_message;
typedef struct { lb_wit_turns *owner; uint64_t id; } lb_wit_ticket;
typedef struct { lb_wit_ticket ticket; bool done; lb_wit_message message; } lb_wit_event;
typedef bool (*lb_wit_enter)(lb_wit_turns *,void *,lb_wit_message,lb_wit_message *);
enum lb_wit_phase { LB_WIT_NEW,LB_WIT_RUNNING,LB_WIT_READY,LB_WIT_DELIVERED,LB_WIT_REPLY,LB_WIT_DONE };
typedef struct { uint64_t id; enum lb_wit_phase phase; lb_wit_message message; lb_wit_turns *route; } lb_wit_frame;
#define LB_WIT_TURN_DEPTH 32
struct lb_wit_turns {
    lb_wit_loop *loop; lb_wit_turns *next;
    lb_wit_enter enter; void *context; uint64_t serial;
};
struct lb_wit_loop {
    pthread_mutex_t lock; pthread_cond_t changed; pthread_t guest,worker;
    lb_wit_turns *root,*routes; void (*finish)(void *);
    bool (*guest_main)(lb_wit_turns *,void *);void *guest_data;
    unsigned depth; bool stop,drained,failed,guest_ok,guest_left;
    lb_wit_frame frames[LB_WIT_TURN_DEPTH];
};

/* Register a package's native dispatcher on the store thread, outside any
 * active call. Routes contain no thread or store of their own. Their storage
 * must outlive turn_run, which detaches them after the shared owner drains. */
static inline bool lb_wit_turn_attach(lb_wit_turns *root,lb_wit_turns *route,lb_wit_enter enter,void *ctx){
    lb_wit_loop *s=root?root->loop:NULL;
    if(!s || root!=s->root || !route || route->loop || !enter || !pthread_equal(pthread_self(),s->guest))return false;
    pthread_mutex_lock(&s->lock);bool ok=!s->stop && !s->depth;
    if(ok){route->loop=s;route->enter=enter;route->context=ctx;route->next=s->routes;s->routes=route;}
    pthread_mutex_unlock(&s->lock);return ok;
}
/* Called with the lock held on the native owner. A frame address remains
 * stable if enter() itself requests a member which re-enters Lean. */
static inline void lb_wit_dispatch(lb_wit_loop *s,lb_wit_frame *f){
    lb_wit_message arg=f->message,out={0};f->phase=LB_WIT_RUNNING;
    pthread_mutex_unlock(&s->lock);
    bool ok=f->route->enter(f->route,f->route->context,arg,&out);
    pthread_mutex_lock(&s->lock);
    if(!ok && !s->stop){s->failed=true;s->stop=true;}
    f->message=out;f->phase=LB_WIT_DONE;pthread_cond_broadcast(&s->changed);
}
static inline void lb_wit_serve(lb_wit_loop *s){
    pthread_mutex_lock(&s->lock);
    while(!s->stop){
        if(s->depth && s->frames[s->depth-1].phase==LB_WIT_NEW)
            lb_wit_dispatch(s,&s->frames[s->depth-1]);
        else pthread_cond_wait(&s->changed,&s->lock);
    }
    pthread_mutex_unlock(&s->lock);
    if(s->finish)s->finish(s->root->context);
    pthread_mutex_lock(&s->lock);s->drained=true;pthread_cond_broadcast(&s->changed);pthread_mutex_unlock(&s->lock);
}
/* Native member dispatch: return only when this exact, topmost call has a
 * reply. An invoked guest method may first run another complete Lean call. */
static inline bool lb_wit_turn_request(lb_wit_turns *route,lb_wit_message req,lb_wit_message *out){
    lb_wit_loop *s=route?route->loop:NULL;
    if(!s || !out || !pthread_equal(pthread_self(),s->worker))return false;
    pthread_mutex_lock(&s->lock);bool ok=false;
    if(s->stop || !s->depth)goto done;
    lb_wit_frame *f=&s->frames[s->depth-1];
    if(f->route!=route || f->phase!=LB_WIT_RUNNING)goto done;
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
static inline bool lb_wit_observe(lb_wit_loop *s,lb_wit_frame *f,lb_wit_event *out){
    pthread_cond_broadcast(&s->changed);
    while(!s->stop && f->phase!=LB_WIT_READY && f->phase!=LB_WIT_DONE)
        pthread_cond_wait(&s->changed,&s->lock);
    if(s->stop)return false;
    *out=(lb_wit_event){.ticket={f->route,f->id},.done=f->phase==LB_WIT_DONE,.message=f->message};
    if(out->done){*f=(lb_wit_frame){0};--s->depth;pthread_cond_broadcast(&s->changed);}
    else f->phase=LB_WIT_DELIVERED;
    return true;
}
static inline bool lb_wit_turn_begin(lb_wit_turns *route,lb_wit_message input,lb_wit_event *out){
    lb_wit_loop *s=route?route->loop:NULL;
    if(!s || !route->enter || !out || !pthread_equal(pthread_self(),s->guest))return false;
    pthread_mutex_lock(&s->lock);bool ok=false;
    if(!s->stop && route->serial!=UINT64_MAX && s->depth<LB_WIT_TURN_DEPTH &&
        (!s->depth || s->frames[s->depth-1].phase==LB_WIT_DELIVERED)){
        lb_wit_frame *f=&s->frames[s->depth++];*f=(lb_wit_frame){++route->serial,LB_WIT_NEW,input,route};
        ok=lb_wit_observe(s,f,out);
    }
    pthread_mutex_unlock(&s->lock);return ok;
}
static inline bool lb_wit_turn_reply(lb_wit_turns *route,lb_wit_ticket ticket,lb_wit_message reply,lb_wit_event *out){
    lb_wit_loop *s=route?route->loop:NULL;
    if(!s || !out || ticket.owner!=route || !pthread_equal(pthread_self(),s->guest))return false;
    pthread_mutex_lock(&s->lock);bool ok=false;
    if(!s->stop && s->depth){
        lb_wit_frame *f=&s->frames[s->depth-1];
        if(f->route==route && f->id==ticket.id && f->phase==LB_WIT_DELIVERED){
            f->message=reply;f->phase=LB_WIT_REPLY;ok=lb_wit_observe(s,f,out);
        }
    }
    pthread_mutex_unlock(&s->lock);return ok;
}
/* A trap in a guest method may leave the native owner parked. Wake it so it
 * can release native frames on its own thread before the store disappears. */
static inline bool lb_wit_turn_retire(lb_wit_turns *root){
    lb_wit_loop *s=root?root->loop:NULL;
    if(!s || root!=s->root || !pthread_equal(pthread_self(),s->guest))return false;
    pthread_mutex_lock(&s->lock);s->stop=true;pthread_cond_broadcast(&s->changed);
    while(!s->drained)pthread_cond_wait(&s->changed,&s->lock);
    pthread_mutex_unlock(&s->lock);return true;
}
static inline void *lb_wit_guest(void *ptr){
    lb_wit_loop *s=ptr;s->guest=pthread_self();
    s->guest_ok=s->guest_main(s->root,s->guest_data);
    (void)lb_wit_turn_retire(s->root);
    pthread_mutex_lock(&s->lock);s->guest_left=true;pthread_cond_broadcast(&s->changed);
    pthread_mutex_unlock(&s->lock);return NULL;
}
/* Run on the process main thread: it owns Lean's native host registry. A
 * single separate thread creates, drives and destroys the Wasmtime store.
 * Neither an active store context nor a borrowed guest handle crosses threads. */
static inline bool lb_wit_turn_run(lb_wit_turns *root,lb_wit_enter enter,void (*finish)(void *),void *ctx,
    bool (*guest)(lb_wit_turns *,void *),void *data){
    lb_wit_loop s={.root=root,.routes=root,.finish=finish,.guest_main=guest,.guest_data=data,.worker=pthread_self()};
    if(!root || root->loop || !guest || pthread_mutex_init(&s.lock,NULL))return false;
    if(pthread_cond_init(&s.changed,NULL)){pthread_mutex_destroy(&s.lock);return false;}
    root->enter=enter;root->context=ctx;root->next=NULL;root->loop=&s;
    pthread_t thread;bool ok=false;
    if(!pthread_create(&thread,NULL,lb_wit_guest,&s)){
        lb_wit_serve(&s);
        /* Even a failed join must not leave the store thread with pointers
         * into the loop or its detached package routes. */
        pthread_mutex_lock(&s.lock);
        while(!s.guest_left)pthread_cond_wait(&s.changed,&s.lock);
        pthread_mutex_unlock(&s.lock);
        ok=pthread_join(thread,NULL)==0 && !s.failed && s.guest_ok;
    }
    while(s.routes){lb_wit_turns *r=s.routes;s.routes=r->next;*r=(lb_wit_turns){.serial=r->serial};}
    pthread_cond_destroy(&s.changed);pthread_mutex_destroy(&s.lock);return ok;
}
#endif
