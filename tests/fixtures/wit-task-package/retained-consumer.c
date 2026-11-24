/* Installed C API only. The callbacks run on the caller's store thread. */
#include <meter_wasmtime.h>
#include <assert.h>
#include <dlfcn.h>
#include <pthread.h>
#include <poll.h>
#include <stdio.h>
#include <unistd.h>
#define M(x) meter_wit_##x
#define OK(call) assert((call)==M(OK))
#ifdef TEST_LEDGER
/* A test-only observer: the public callback API needs no broker headers. */
#include "lean_bridge_native_runtime.h"
static void (*read_snapshot)(lean_bridge_native_snapshot *);
#define lean_bridge_native_snapshot_read read_snapshot
#include "retained-quiescence.h"
#endif
typedef M(callback_uint32_to_uint32) closure;
enum mode { ADD, FAIL, REVOKE, NEST, CLOSE, DROP, CANCEL };
struct context {
    M(session) **session;
    M(task_through) *job;
    closure *self;
    unsigned calls, destroyed, offset, scale;
    enum mode mode;
    bool inside;
};
static const char reason[]="same message", binary[]="same\0\xce\xbb";
static void span(M(string) s,const char *msg,size_t n) {
    assert(s.data && s.size==n && !memcmp(s.data,msg,n) && s.data[n]==0);
}
static void finish(void *data) {
    struct context *c=data; assert(!c->inside && !c->destroyed); c->destroyed++;
}
static bool call(void *data,uint32_t arg,uint32_t *reply,M(text) *error) {
    struct context *c=data; assert(!c->inside && !c->destroyed); c->calls++; c->inside=true;
    M(session) *s=*c->session;
    if (c->mode==REVOKE) OK(M(revoke_callback_uint32_to_uint32)(s,c->self));
    if (c->mode==NEST) {
        M(state) state=M(PENDING); M(through_errors) errors={0}; uint32_t out=0;
        assert(M(await_through)(s,*c->job,&state,&out,&errors)==M(BUSY));
        struct context inner={.session=c->session,.offset=41}; closure local={0};
        M(task_through) h={0}; OK(M(make_callback_uint32_to_uint32)(s,call,&inner,finish,&local));
        OK(M(start_through)(s,true,false,local,&h)); OK(M(drop_callback_uint32_to_uint32)(s,&local));
        OK(M(await_through)(s,h,&state,&out,&errors)); assert(state==M(READY) && out==52 && inner.destroyed==1);
        OK(M(drop_through)(s,&h)); M(through_errors_dispose)(&errors);
    }
    if (c->mode==CLOSE) OK(M(close)(c->session));
    if (c->mode==DROP) OK(M(drop_through)(s,c->job));
    if (c->mode==CANCEL) { bool accepted=false; OK(M(cancel_through)(s,*c->job,&accepted)); assert(accepted); }
    *reply=arg*(c->scale?c->scale:1)+c->offset;
    *error=c->offset?(M(text)){binary,sizeof binary-1}:(M(text)){reason,sizeof reason-1};
    assert(!c->destroyed); c->inside=false; return c->mode!=FAIL;
}
static void phases(M(session) **ps) {
    for (int phase=0;phase<2;phase++) for (int type=0;type<4;type++) {
        M(session) *s=*ps; M(task_through) h={0}; closure reg={0}; M(through_errors) e={0};
        struct context ctx={.session=ps,.offset=type==3?7:0,.mode=type>=2?FAIL:ADD};
        OK(M(make_callback_uint32_to_uint32)(s,call,&ctx,finish,&reg));
        OK(M(start_through)(s,phase,type==1,reg,&h)); OK(M(drop_callback_uint32_to_uint32)(s,&reg));
        assert(!ctx.destroyed); M(state) state=M(PENDING); uint32_t value=77;
        OK(M(await_through)(s,h,&state,&value,&e));
        assert(ctx.destroyed==1 && ctx.calls==(unsigned)(type!=1));
        if (type==0) assert(state==M(READY) && value==11);
        else if (type==1) {
            assert(state==(phase?M(FACTORY_FAILED):M(FAILED)) && !e.callback.data);
            span(phase?e.factory:e.worker,reason,sizeof reason-1);
        } else {
            assert(state==(phase?M(FACTORY_CALLBACK_FAILED):M(WORKER_CALLBACK_FAILED)) && !e.factory.data && !e.worker.data);
            span(e.callback,type==3?binary:reason,type==3?sizeof binary-1:sizeof reason-1);
        }
        if(type) assert(value==77);
        OK(M(drop_through)(s,&h)); M(through_errors_dispose)(&e); M(through_errors_dispose)(&e);
    }
}
static void chains(M(session) **ps) {
    for (int revoke=0;revoke<2;revoke++) {
        M(session) *s=*ps; closure a={0},b={0}; M(task_chain) h={0};
        struct context first={.session=ps,.offset=1,.scale=2,.self=&a,.mode=revoke?REVOKE:ADD};
        struct context second={.session=ps,.offset=79,.scale=3};
        OK(M(make_callback_uint32_to_uint32)(s,call,&first,finish,&a)); OK(M(make_callback_uint32_to_uint32)(s,call,&second,finish,&b));
        closure stale=a; OK(M(start_chain)(s,a,5,revoke?a:b,&h));
        if (!revoke) OK(M(drop_callback_uint32_to_uint32)(s,&a));
        OK(M(drop_callback_uint32_to_uint32)(s,&b));
        M(state) state=M(PENDING); uint32_t out=0; M(chain_errors) e={0};
        int fd=-1;
        do {
            unsigned before=first.calls+second.calls;
            OK(M(poll_chain)(s,h,&state,&out,&e,&fd));
            assert(first.calls+second.calls<=before+1);
            if(state==M(PENDING)) {
                struct pollfd ready={fd,POLLIN,0}; assert(fd>=0 && poll(&ready,1,5000)==1 && (ready.revents&POLLIN));
            }
        } while(state==M(PENDING));
        if(revoke) { assert(state==M(WORKER_CALLBACK_FAILED)); span(e.callback,"retained callback is closed",26); }
        else assert(state==M(READY) && out==112);
        assert(first.calls==1 && second.calls==(unsigned)!revoke && first.destroyed==1 && second.destroyed==1);
        OK(M(drop_chain)(s,&h)); M(chain_errors_dispose)(&e);
        assert(M(start_chain)(s,stale,7,stale,&h)==M(STALE) && !h._private[0]);
    }
}
static void reenter(enum mode mode) {
    M(session) *s=NULL,*other=NULL; OK(M(open)(&s)); OK(M(open)(&other));
    M(task_through) h={0}; closure reg={0}; struct context ctx={.session=&s,.job=&h,.offset=1,.mode=mode};
    OK(M(make_callback_uint32_to_uint32)(s,call,&ctx,finish,&reg));
    assert(M(start_through)(other,false,false,reg,&h)==M(STALE) && !h._private[0]); OK(M(close)(&other));
    OK(M(start_through)(s,false,false,reg,&h)); OK(M(drop_callback_uint32_to_uint32)(s,&reg));
    M(state) state=M(PENDING); M(through_errors) e={0}; uint32_t out=77;
    M(status) rc=M(await_through)(s,h,&state,&out,&e);
    if (mode==DROP) assert(rc==M(STALE) && !h._private[0] && out==77);
    else if (mode==CLOSE) assert(rc==M(UNAVAILABLE) && !s && out==77);
    else { OK(rc); assert(mode==NEST?(state==M(READY) && out==12):(state==M(CANCELLED) && out==77)); OK(M(drop_through)(s,&h)); }
    assert(ctx.calls==1 && ctx.destroyed==1); OK(M(close)(&s));
}
static void *foreign_thread(void *data) {
    M(session) *s=data; closure h={0};
    assert(M(make_callback_uint32_to_uint32)(s,call,NULL,NULL,&h)==M(UNAVAILABLE));
    assert(!h._private[0]); return NULL;
}
static void domains(void) {
    /* Both host images allocate their first registration. A local counter or
       signature alone cannot distinguish these equal-shaped foreign handles. */
    void *lib=dlopen("./other-host.so",RTLD_NOW|RTLD_LOCAL); assert(lib);
    M(status) (*open_other)(M(session) **)=dlsym(lib,"meter_wit_open");
    M(status) (*close_other)(M(session) **)=dlsym(lib,"meter_wit_close");
    M(status) (*make_other)(M(session) *,M(callback_uint32_to_uint32_fn),void *,void (*)(void *),closure *)=
        dlsym(lib,"meter_wit_make_callback_uint32_to_uint32");
    assert(open_other && close_other && make_other);
    M(session) *s=NULL,*other=NULL; OK(M(open)(&s)); OK(open_other(&other));
    struct context a={.session=&s},b={.session=&other}; closure local={0},foreign={0};
    OK(M(make_callback_uint32_to_uint32)(s,call,&a,finish,&local)); OK(make_other(other,call,&b,finish,&foreign));
    M(task_through) h={0}; assert(M(start_through)(s,false,false,foreign,&h)==M(STALE) && !h._private[0]);
    closure wrong=local; wrong._private[2]^=1;
    assert(M(start_through)(s,false,false,wrong,&h)==M(STALE) && !h._private[0]);
    pthread_t thread; assert(!pthread_create(&thread,NULL,foreign_thread,s)); assert(!pthread_join(thread,NULL));
    OK(close_other(&other)); OK(M(close)(&s)); assert(a.destroyed==1 && b.destroyed==1 && !a.calls && !b.calls);
    assert(!dlclose(lib));
}
static bool rewrite(void *data,M(text) input,M(text) *reply,M(text) *error) {
    int mode=*(int *)data;
    assert(input.size==sizeof binary-1 && !memcmp(input.data,binary,input.size));
    if (mode==4) { *error=input; return false; }
    *reply=mode==5?(M(text)){"\xff",1}:input; return true;
}
static void routes(M(session) *s) {
    for(int mode=0;mode<=5;mode++) {
        M(callback_string_to_string) fn={0}; M(task_routed) h={0}; M(routed_errors) e={0};
        M(state) state=M(PENDING); M(routed_value) result={0}; M(text) input={binary,sizeof binary-1};
        OK(M(make_callback_string_to_string)(s,rewrite,&mode,NULL,&fn));
        OK(M(start_routed)(s,(uint8_t)mode,input,fn,&h)); OK(M(drop_callback_string_to_string)(s,&fn));
        M(status) rc=M(await_routed)(s,h,&state,&result,&e);
        if (mode==5) { assert(rc==M(INVALID) && state==M(PENDING)); rc=M(await_routed)(s,h,&state,&result,&e); }
        OK(rc);
        if(mode==1) assert(state==M(FACTORY_FAILED) && e.factory==3737844653u);
        else if(mode==3) { assert(state==M(FAILED)); span(e.worker,binary,sizeof binary-1); }
        else if(mode>=4) { assert(state==M(WORKER_CALLBACK_FAILED)); span(e.callback,mode==4?binary:"invalid callback reply",mode==4?sizeof binary-1:22); }
        else {
            assert(state==M(READY) && result.ok==(mode==0));
            span(result.ok?result.value:result.error,binary,sizeof binary-1);
        }
        OK(M(drop_routed)(s,&h)); M(routed_value_dispose)(&result); M(routed_errors_dispose)(&e);
    }
}
int main(void) {
    alarm(120); domains(); M(session) *s=NULL; OK(M(open)(&s)); phases(&s); chains(&s); routes(s); OK(M(close)(&s));
    reenter(NEST); reenter(CANCEL); reenter(DROP); reenter(CLOSE);
#ifdef TEST_LEDGER
    read_snapshot=dlsym(RTLD_DEFAULT,"lean_bridge_native_snapshot_read"); assert(read_snapshot); check_quiescent();
#endif
    puts("installed Wasmtime retained callbacks: passed");
}
