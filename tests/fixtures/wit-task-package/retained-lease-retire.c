/* Retire the broker in one process. Both independently installed hosts must
 * stop accepting work; the application can still release its existing owners. */
#define _POSIX_C_SOURCE 200809L
#include <depot_wasmtime.h>
#include <peer_wasmtime.h>
#include "lean_bridge_native_runtime.h"
#include <assert.h>
#include <dlfcn.h>
#include <stdio.h>
#include <time.h>
#include <unistd.h>
#define D(n) depot_wit_##n
#define P(n) peer_wit_##n
#define DOK(x) assert((x)==D(OK))
#define POK(x) assert((x)==P(OK))
struct ctx { unsigned invocations,destructions; bool inside,retire_inside; };
static void (*retire_runtime)(void);
static bool callback(void *data,uint32_t n,uint32_t *reply,P(text) *error) {
    struct ctx *ctx=data; (void)error; assert(!ctx->inside && !ctx->destructions);
    ++ctx->invocations; ctx->inside=true; assert(ctx->retire_inside);
    retire_runtime(); *reply=n+1; assert(!ctx->destructions); ctx->inside=false; return true;
}
static void dispose(void *data) {
    struct ctx *ctx=data; assert(!ctx->inside && !ctx->destructions); ++ctx->destructions;
}
int main(int argc,char **argv) {
    (void)argv; alarm(60); struct ctx held={.retire_inside=argc==2},never={0};
    retire_runtime=dlsym(RTLD_DEFAULT,"lean_bridge_native_runtime_retire"); assert(retire_runtime);
    D(session) *d=NULL,*late_d=NULL; P(session) *p=NULL,*idle=NULL,*late_p=NULL;
    DOK(D(open)(&d)); POK(P(open)(&p)); POK(P(open)(&idle));
    D(task_issue) issue={0}; D(lease_ticket) t={0},out={0}; D(state) ds; D(string) err={0};
    DOK(D(start_issue)(d,11,&issue,&err)); DOK(D(await_issue)(d,issue,&ds,&t)); assert(ds==D(READY)); DOK(D(drop_issue)(d,&issue));
    P(callback_uint32_to_uint32) fn={0},no={0}; POK(P(make_callback_uint32_to_uint32)(p,callback,&held,dispose,&fn));
    P(task_drive) h={0}; POK(P(start_drive)(p,fn,t,true,&h));
    if (!held.retire_inside) retire_runtime();
    P(state) state=P(READY); P(drive_errors) errors={0};
    P(status) observe=P(await_drive)(p,h,&state,&out,&errors);
    assert(state==P(READY) && !out._private[0] && !errors.callback.data);
    assert(held.invocations==(unsigned)held.retire_inside && !held.destructions);
    P(status) reg=P(make_callback_uint32_to_uint32)(idle,callback,&never,dispose,&no);
    P(status) enter_p=P(open)(&late_p); D(status) enter_d=D(open)(&late_d);
    if (observe!=P(UNAVAILABLE) || reg!=P(UNAVAILABLE) || enter_p!=P(UNAVAILABLE) || enter_d!=D(UNAVAILABLE))
        fprintf(stderr,"after retirement: observe=%d register=%d open(Peer)=%d open(Depot)=%d; expected UNAVAILABLE=%d\n",observe,reg,enter_p,enter_d,P(UNAVAILABLE));
    assert(observe==P(UNAVAILABLE) && reg==P(UNAVAILABLE) && enter_p==P(UNAVAILABLE) && enter_d==D(UNAVAILABLE));
    assert(!late_p && !late_d && !no._private[0] && !never.destructions);
    P(lease_ticket) clone={0}; bool equal=false;
    assert(P(retain_lease_ticket)(t,&clone)==P(UNAVAILABLE) && !clone._private[0]);
    assert(D(same_lease_ticket)(t,t,&equal)==D(UNAVAILABLE) && !equal);
    assert(D(start_issue)(d,12,&issue,&err)==D(UNAVAILABLE));
    POK(P(drop_callback_uint32_to_uint32)(p,&fn)); POK(P(drop_drive)(p,&h)); assert(held.destructions==1);
    DOK(D(drop_lease_ticket)(&t)); POK(P(close)(&p)); POK(P(close)(&idle)); DOK(D(close)(&d));
    void (*snapshot)(lean_bridge_native_snapshot *)=dlsym(RTLD_DEFAULT,"lean_bridge_native_snapshot_read"); assert(snapshot);
    lean_bridge_native_snapshot snap={0};
    for (unsigned i=0;i<500;i++) {
        snapshot(&snap); if (snap.live_identities==0) break;
        nanosleep(&(struct timespec){.tv_nsec=10000000},NULL);
    }
    assert(snap.runtime_init_runs==1 && !snap.live_identities);
    puts("Retired WIT runtime: both packages refuse work and release existing owners");
}
