/* Consumer API only: no Wasmtime SDK, Lean headers, or private native ports. */
#include <packet_wasmtime.h>
#include <assert.h>
#include <stdio.h>
#include <string.h>
#define P(x) packet_wit_##x
#define OK(call) assert((call)==P(OK))
static const uint8_t a[]={0xff,0,0x81,42},b[]={0xc0,0xff,0,0xfe};
static void span(P(bytes) value,const uint8_t *expected,size_t n) {
    assert(value.size==n && (!n || (value.data && !memcmp(value.data,expected,n))));
}
static void wake(P(session) *s,uint32_t slot) {
    P(task_wake) h={0};P(state) state=P(PENDING);bool opened=false;
    OK(P(start_wake)(s,slot,&h));OK(P(await_wake)(s,h,&state,&opened));
    assert(state==P(READY) && opened);OK(P(drop_wake)(s,&h));
}
static void tasks(P(session) *s) {
    uint8_t left[4],right[4];memcpy(left,a,4);memcpy(right,b,4);
    P(byte_view) l={left,4},r={right,4},empty={0};
    P(task_packet) first={0},second={0},late={0};P(bytes) fail={0};
    P(packet_value) x={0},y={0};P(state) state=P(PENDING);int fd=-1;
    assert(P(start_packet)(s,0,255,l,r,&first,&fail)==P(START_ERROR));span(fail,b,4);
    assert(!first._private[0] && P(start_packet)(s,0,0,l,r,&first,&fail)==P(INVALID));
    P(bytes_dispose)(&fail);P(bytes_dispose)(&fail);
    assert(P(start_packet)(s,0,0,l,(P(byte_view)){NULL,1},&first,&fail)==P(INVALID));
    size_t n=16u*1024u*1024u+1u;uint8_t *large=malloc(n);assert(large);
    assert(P(start_packet)(s,0,0,l,(P(byte_view)){large,n},&first,&fail)==P(LIMIT));free(large);
    OK(P(start_packet)(s,1,0,l,r,&first,&fail));OK(P(start_packet)(s,2,1,l,r,&second,&fail));
    OK(P(start_packet)(s,3,0,l,r,&late,&fail));bool accepted=false;
    OK(P(cancel_packet)(s,late,&accepted));assert(accepted);OK(P(drop_packet)(s,&late));wake(s,3);
    memset(left,0,4);memset(right,0,4);
    OK(P(poll_packet)(s,first,&state,&x,&fd));assert(state==P(PENDING) && fd>=0);
    wake(s,2);OK(P(await_packet)(s,second,&state,&y));assert(state==P(READY) && !y.ok);span(y.error,b,4);
    wake(s,1);OK(P(await_packet)(s,first,&state,&x));assert(state==P(READY) && x.ok);span(x.value,a,4);
    OK(P(drop_packet)(s,&first));OK(P(drop_packet)(s,&second));
    span(x.value,a,4);span(y.error,b,4);P(packet_value_dispose)(&x);P(packet_value_dispose)(&y);
    OK(P(start_packet)(s,4,0,empty,empty,&first,&fail));wake(s,4);
    OK(P(await_packet)(s,first,&state,&x));assert(state==P(READY) && x.ok);span(x.value,NULL,0);
    OK(P(drop_packet)(s,&first));P(packet_value_dispose)(&x);
}
static void cursors(P(session) *s) {
    P(cursor_chunks) c={0};P(state) state=P(IDLE);P(bytes) value={0},error={0};
    uint8_t src[4];memcpy(src,b,4);
    OK(P(open_chunks)(s,(P(byte_view)){0},&c));OK(P(drop_chunks)(s,&c));
    OK(P(open_chunks)(s,(P(byte_view)){src,4},&c));memset(src,0,4);
    OK(P(request_chunks)(s,c));assert(P(request_chunks)(s,c)==P(BUSY));
    OK(P(await_chunks)(s,c,&state,&value,&error));assert(state==P(ITEM));span(value,b,4);
    assert(P(next_chunks)(s,c,&state,&value,&error)==P(INVALID));P(bytes_dispose)(&value);
    OK(P(next_chunks)(s,c,&state,&value,&error));assert(state==P(ITEM));span(value,NULL,0);
    OK(P(next_chunks)(s,c,&state,&value,&error));assert(state==P(FAILED));span(error,b,4);
    assert(P(request_chunks)(s,c)==P(FINISHED));OK(P(drop_chunks)(s,&c));
    span(error,b,4);P(bytes_dispose)(&error);P(bytes_dispose)(&value);
    P(task_counts) h={0};uint32_t n=0;OK(P(start_counts)(s,&h));
    OK(P(await_counts)(s,h,&state,&n));assert(state==P(READY) && n==2);OK(P(drop_counts)(s,&h));
}
typedef struct {unsigned calls,drops,mode;} context;
static bool answer(void *ptr,P(byte_view) arg,P(byte_view) *out,P(text) *error) {
    context *ctx=ptr;assert(!ctx->drops);ctx->calls++;
    if (ctx->mode==2) {assert(arg.size==0);*out=arg;return true;}
    assert(arg.size==4 && !memcmp(arg.data,a,4));
    if (ctx->mode==1) {*error=(P(text)){(const char *)arg.data+1,1};return false;}
    if (ctx->mode==3) {*out=(P(byte_view)){NULL,1};return true;}
    *out=(P(byte_view)){arg.data+1,arg.size-1};return true;
}
static void destroyed(void *ptr) {context *ctx=ptr;assert(!ctx->drops);ctx->drops++;}
static void callbacks(P(session) *s) {
    for (unsigned phase=0;phase<2;phase++) for (unsigned mode=0;mode<4;mode++) {
        P(callback_bytes_to_bytes) cb={0};P(task_through) h={0};P(bytes) out={0};
        P(through_errors) e={0};P(state) state=P(PENDING);context ctx={.mode=mode};
        uint8_t src[4];memcpy(src,a,4);
        OK(P(make_callback_bytes_to_bytes)(s,answer,&ctx,destroyed,&cb));
        OK(P(start_through)(s,phase,cb,(P(byte_view)){src,mode==2?0:4},&h));
        OK(P(drop_callback_bytes_to_bytes)(s,&cb));assert(!ctx.drops);memset(src,0,4);
        P(status) rc=P(await_through)(s,h,&state,&out,&e);
        if (mode==3) {
            assert(rc==P(INVALID) && state==P(PENDING) && !out.data && !e.callback.data);
            rc=P(await_through)(s,h,&state,&out,&e);
        }
        if (rc!=P(OK)) fprintf(stderr,"phase=%u mode=%u status=%d calls=%u drops=%u\n",phase,mode,(int)rc,ctx.calls,ctx.drops);
        OK(rc);assert(ctx.calls==1 && ctx.drops==1);
        OK(P(drop_through)(s,&h));
        if (mode==1 || mode==3) {
            assert(state==(phase?P(FACTORY_CALLBACK_FAILED):P(WORKER_CALLBACK_FAILED)));
            if (mode==1) assert(e.callback.size==1 && e.callback.data[0]==0);
            else assert(e.callback.size==22 && !memcmp(e.callback.data,"invalid callback reply",22));
        } else {assert(state==P(READY));span(out,a+1,mode==2?0:3);}
        P(bytes_dispose)(&out);P(through_errors_dispose)(&e);
    }
}
int main(void) {
    P(session) *s=NULL;OK(P(open)(&s));tasks(s);cursors(s);callbacks(s);
    P(cursor_chunks) c={0};P(state) state=P(IDLE);P(bytes) held={0},failure={0};
    OK(P(open_chunks)(s,(P(byte_view)){a,4},&c));OK(P(next_chunks)(s,c,&state,&held,&failure));
    assert(state==P(ITEM));OK(P(close)(&s));span(held,a,4);
    P(bytes_dispose)(&held);P(bytes_dispose)(&held);
    puts("pollable binary delivery: passed");
}
