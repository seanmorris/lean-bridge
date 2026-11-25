#define _GNU_SOURCE
#define main synchronous_owner_checks
#include "sync-owners.c"
#undef main
#include <poll.h>
#include <pthread.h>

/* This application sees only the installed headers. poll() borrows a
 * descriptor; neither an application callback nor a Lean worker blocks it. */
#define WAIT(pkg,fn,h) do { \
    int ready=-1; pkg##_status wait_status_; unsigned attempts=0; \
    while((wait_status_=pkg##_##fn##_poll(h,&ready))==pkg##_PENDING){ \
        struct pollfd fd={.fd=ready,.events=POLLIN}; \
        assert(++attempts<100 && ready>=0 && poll(&fd,1,5000)==1); \
    } assert(wait_status_==pkg##_OK); \
} while(0)
enum mode { SUCCESS, ERROR, REVOKE, CANCEL, TRAP };
typedef struct {
    workshop_binding *binding; peer_binding peer; workshop_box original;
    workshop_callback_box_to_box *self; workshop_relay_handle *pending;
    enum mode mode; unsigned calls,disposed,freed;pthread_t owner;
} callback_state;
static void end_context(void *v){((callback_state *)v)->disposed++;}
static void end_error(void *v){((callback_state *)v)->freed++;}
static void count_release(void *p){++*(unsigned *)p;}
static void *foreign_thread(void *state){
    workshop_echo_handle h=*(workshop_echo_handle *)state;int fd=1;
    assert(workshop_echo_poll(h,&fd)==workshop_UNAVAILABLE && fd==-1);
    assert(workshop_echo_close(&h)==workshop_UNAVAILABLE);
    return NULL;
}
static uint32_t read_dial(void *context,workshop_dial dial,uint32_t *out){
    void *p=NULL;(void)context;assert(workshop_dial_data(dial,&p)==workshop_OK);
    *out=*(uint32_t *)p;return 0;
}
typedef struct {workshop_box box;workshop_dial dial;unsigned visits;} exchange;
static workshop_status lookup_dial(void *context,workshop_box box,workshop_dial *out,workshop_diagnostic *d){
    (void)d;exchange *x=context;bool same=false;assert(workshop_box_same(x->box,box,&same)==workshop_OK && same);
    ++x->visits;return workshop_dial_clone(x->dial,out);
}
static workshop_status measure_dial(void *context,workshop_dial dial,uint32_t *out,workshop_diagnostic *d){
    (void)d;exchange *x=context;bool same=false;assert(workshop_dial_same(x->dial,dial,&same)==workshop_OK && same);
    ++x->visits;return read_dial(NULL,dial,out)?workshop_INVALID:workshop_OK;
}
static void worker_values(workshop_binding a,workshop_box box){
    uint32_t reading=137;workshop_diagnostic d={0};exchange x={.box=box};
    assert(workshop_dial_adopt(&reading,NULL,&x.dial)==workshop_OK);
    workshop_callback_box_to_dial lookup={0};workshop_callback_dial_to_uint32 measure={0};
    assert(workshop_callback_box_to_dial_new(lookup_dial,&x,NULL,&lookup)==workshop_OK);
    assert(workshop_callback_dial_to_uint32_new(measure_dial,&x,NULL,&measure)==workshop_OK);
    workshop_handoff_handle h={0};assert(workshop_handoff_start(a,box,lookup,measure,&h,&d)==workshop_OK);
    assert(workshop_callback_box_to_dial_drop(&lookup)==workshop_OK && workshop_callback_dial_to_uint32_drop(&measure)==workshop_OK);
    WAIT(workshop,handoff,h);uint32_t n=0;assert(workshop_handoff_take(&h,&n,&d)==workshop_OK && n==137 && x.visits==2);
    int16_t signed_value=0;workshop_signed_echo_handle s={0};assert(workshop_signed_echo_start(a,-32760,&s,&d)==workshop_OK);
    WAIT(workshop,signed_echo,s);assert(workshop_signed_echo_take(&s,&signed_value,&d)==workshop_OK && signed_value==-32760);
    uint64_t words[7]={33,0,0,0,0,0,1};workshop_integer_view v={.data=words,.len=7,.negative=true};
    workshop_large_result_handle large={0};workshop_large_result_value out={0};
    assert(workshop_large_result_start(a,v,&large,&d)==workshop_OK);words[0]=0;
    WAIT(workshop,large_result,large);assert(workshop_large_result_take(&large,&out,&d)==workshop_OK && out.ok);
    assert(out.value.negative && out.value.len==7 && out.value.data[0]==33 && out.value.data[6]==1);
    workshop_large_result_value_clear(&out);
    uint8_t bytes[]={1,0,255};workshop_with_buffer_handle buf={0};workshop_buffer result={0};
    unsigned released=0;workshop_dial provisional={0},wrong={0};
    assert(workshop_dial_adopt(&released,count_release,&provisional)==workshop_OK);
    assert(workshop_with_buffer_start(a,provisional,(workshop_view){bytes,(16u<<20)+1},&buf,&d)==workshop_INVALID);
    assert(workshop_dial_drop(&provisional)==workshop_OK && released==1);
    memcpy(&wrong,&box,sizeof wrong);
    assert(workshop_with_buffer_start(a,wrong,(workshop_view){bytes,sizeof bytes},&buf,&d)==workshop_INVALID);
    assert(workshop_with_buffer_start(a,x.dial,(workshop_view){bytes,sizeof bytes},&buf,&d)==workshop_OK);
    memset(bytes,0,sizeof bytes);WAIT(workshop,with_buffer,buf);assert(workshop_with_buffer_take(&buf,&result,&d)==workshop_OK);
    assert(result.len==3 && result.data[0]==1 && !result.data[1] && result.data[2]==255);workshop_buffer_clear(&result);
    assert(workshop_dial_drop(&x.dial)==workshop_OK);
}
static workshop_status relay(void *v,workshop_box arg,workshop_box *reply,workshop_diagnostic *e){
    callback_state *ctx=v;ctx->calls++;bool same=false;
    assert(pthread_equal(ctx->owner,pthread_self()));
    assert(workshop_box_same(arg,ctx->original,&same)==workshop_OK && same);
    assert(workshop_close(ctx->binding)==workshop_BUSY);
    uint32_t value=0;peer_diagnostic d={0};assert(peer_read(ctx->peer,arg,&value,&d)==peer_OK && value==42);
    if(ctx->mode==ERROR){
        e->host_code=32;e->payload=ctx;e->dispose_payload=end_error;
        e->message.data=malloc(4);assert(e->message.data);memcpy(e->message.data,"fail",4);e->message.len=4;
        return workshop_CALLBACK_ERROR;
    }
    if(ctx->mode==REVOKE){assert(workshop_callback_box_to_box_close(ctx->self)==workshop_OK);assert(!ctx->disposed);}
    if(ctx->mode==CANCEL){assert(workshop_relay_close(ctx->pending)==workshop_OK);assert(!ctx->disposed);}
    if(ctx->mode==TRAP)return (workshop_status)99;
    return workshop_box_clone(arg,reply);
}
int main(void){
    workshop_hosts hosts={.box_read=read_meter,.box_create=create_meter,.box_get_level=read_meter,.box_set_level=set_meter,.box_identity=identity,.dial_read=read_dial};
    peer_hosts peer_hosts_={.box_read=read_meter,.box_create=create_meter,.box_get_level=read_meter,.box_set_level=set_meter,.box_identity=identity,.dial_read=read_dial};
    state s={0},t={0};workshop_binding a={0};peer_binding b={0};
    assert(workshop_with_hosts(&hosts,&s,&a)==workshop_OK);assert(peer_with_hosts(&peer_hosts_,&t,&b)==peer_OK);
    workshop_box x={0},y={0},err={0};workshop_diagnostic d={0};peer_diagnostic pd={0};
    assert(workshop_make(a,42,&x,&d)==workshop_OK);
    worker_values(a,x);
    workshop_echo_handle eh={0};assert(workshop_echo_start(a,x,&eh,&d)==workshop_OK);
    pthread_t foreign;assert(!pthread_create(&foreign,NULL,foreign_thread,&eh));assert(!pthread_join(foreign,NULL));
    workshop_echo_handle stale=eh;WAIT(workshop,echo,eh);assert(workshop_echo_take(&eh,&y,&d)==workshop_OK);
    int fd=-1;assert(workshop_echo_poll(stale,&fd)==workshop_STALE);bool same=false;
    assert(peer_box_same(x,y,&same)==peer_OK && same);assert(peer_box_drop(&y)==peer_OK);
    peer_echo_handle ph={0};assert(peer_echo_start(b,x,&ph,&pd)==peer_OK);WAIT(peer,echo,ph);
    assert(peer_echo_take(&ph,&y,&pd)==peer_OK);assert(peer_box_same(x,y,&same)==peer_OK && same);peer_box_drop(&y);
    workshop_reject_handle refused={0};assert(workshop_reject_start(a,x,&refused,&err,&d)==workshop_DECLARED_ERROR);
    assert(workshop_box_same(x,err,&same)==workshop_OK && same);workshop_box_drop(&err);
    workshop_outcome_handle oh={0};workshop_outcome_value result={0};assert(workshop_outcome_start(a,x,&oh,&d)==workshop_OK);
    WAIT(workshop,outcome,oh);assert(workshop_outcome_take(&oh,&result,&d)==workshop_OK && !result.ok);
    assert(workshop_box_same(x,result.error,&same)==workshop_OK && same);workshop_outcome_value_clear(&result);
    workshop_series_handle sh={0};assert(workshop_series_start(a,x,&sh,&d)==workshop_OK);
    assert(workshop_series_poll(sh,&fd)==workshop_IDLE);assert(workshop_series_pull(sh)==workshop_OK);
    assert(workshop_series_pull(sh)==workshop_BUSY);WAIT(workshop,series,sh);
    assert(workshop_series_take(&sh,&y,&err,&d)==workshop_OK && payload(y)->level==42);workshop_box_drop(&y);
    assert(workshop_series_pull(sh)==workshop_OK);WAIT(workshop,series,sh);
    assert(workshop_series_take(&sh,&y,&err,&d)==workshop_STEP_ERROR);assert(workshop_box_same(x,err,&same)==workshop_OK && same);
    workshop_box_drop(&err);assert(workshop_series_close(&sh)==workshop_OK);
    workshop_finite_handle finite={0};assert(workshop_finite_start(a,x,&finite,&d)==workshop_OK);
    assert(workshop_finite_pull(finite)==workshop_OK);WAIT(workshop,finite,finite);
    assert(workshop_finite_take(&finite,&y,&d)==workshop_OK);workshop_box_drop(&y);
    assert(workshop_finite_pull(finite)==workshop_OK);WAIT(workshop,finite,finite);
    assert(workshop_finite_take(&finite,&y,&d)==workshop_END);assert(workshop_finite_close(&finite)==workshop_OK);
    workshop_broken_handle broken={0};assert(workshop_broken_start(a,x,&broken,&d)==workshop_OK);
    assert(workshop_broken_pull(broken)==workshop_OK);WAIT(workshop,broken,broken);
    assert(workshop_broken_take(&broken,&y,&d)==workshop_STEP_IO_ERROR && d.message.len==7 && !memcmp(d.message.data,"step IO",7));workshop_diagnostic_clear(&d);
    workshop_prepare_io_handle prep={0};assert(workshop_prepare_io_start(a,x,true,&prep,&d)==workshop_IO_ERROR && d.message.len==10 && !memcmp(d.message.data,"factory IO",10));workshop_diagnostic_clear(&d);
    workshop_late_io_handle late={0};assert(workshop_late_io_start(a,x,true,&late,&d)==workshop_OK);WAIT(workshop,late_io,late);
    assert(workshop_late_io_take(&late,&y,&d)==workshop_TASK_IO_ERROR && d.message.len==7 && !memcmp(d.message.data,"late IO",7));workshop_diagnostic_clear(&d);
    workshop_callback_box_to_box cb={0};workshop_relay_handle job={0};
    callback_state ctx={.binding=&a,.peer=b,.original=x,.self=&cb,.pending=&job,.owner=pthread_self()};
    assert(workshop_callback_box_to_box_new(relay,&ctx,end_context,&cb)==workshop_OK);
    assert(workshop_relay_start(a,x,cb,&job,&d)==workshop_OK);WAIT(workshop,relay,job);
    assert(workshop_relay_take(&job,&y,&d)==workshop_OK && ctx.calls==1);workshop_box_drop(&y);
    ctx.mode=ERROR;assert(workshop_relay_start(a,x,cb,&job,&d)==workshop_OK);WAIT(workshop,relay,job);
    assert(workshop_relay_take(&job,&y,&d)==workshop_CALLBACK_ERROR && d.host_code==32 && d.payload==&ctx && !ctx.freed);
    uint32_t sentinel=71;assert(workshop_read(a,x,&sentinel,&d)==workshop_INVALID && sentinel==71 && !ctx.freed);
    assert(d.message.len==4 && !memcmp(d.message.data,"fail",4));workshop_diagnostic_clear(&d);assert(ctx.freed==1);
    workshop_checked_relay_handle deferred={0};assert(workshop_checked_relay_start(a,x,true,cb,&deferred,&d)==workshop_OK);WAIT(workshop,checked_relay,deferred);
    assert(workshop_checked_relay_take(&deferred,&y,&err,&d)==workshop_DECLARED_ERROR && payload(err)->level==42);workshop_box_drop(&err);
    workshop_twice_handle two={0};ctx.mode=REVOKE;assert(workshop_twice_start(a,x,cb,&two,&d)==workshop_OK);WAIT(workshop,twice,two);
    assert(workshop_twice_take(&two,&y,&d)==workshop_CALLBACK_CLOSED && ctx.disposed==1);
    assert(ctx.calls==3);workshop_diagnostic_clear(&d);
    ctx.mode=CANCEL;ctx.disposed=0;assert(workshop_callback_box_to_box_new(relay,&ctx,end_context,&cb)==workshop_OK);
    assert(workshop_relay_start(a,x,cb,&job,&d)==workshop_OK);assert(workshop_callback_box_to_box_drop(&cb)==workshop_OK);
    workshop_status r;
    while((r=workshop_relay_poll(job,&fd))==workshop_PENDING){struct pollfd f={.fd=fd,.events=POLLIN};assert(poll(&f,1,5000)==1);}
    assert(r==workshop_CANCELLED && ctx.disposed==1);assert(workshop_relay_close(&job)==workshop_OK);
    ctx.mode=SUCCESS;ctx.disposed=0;assert(workshop_callback_box_to_box_new(relay,&ctx,end_context,&cb)==workshop_OK);
    assert(workshop_relay_start(a,x,cb,&job,&d)==workshop_OK);assert(workshop_callback_box_to_box_drop(&cb)==workshop_OK);
    assert(workshop_series_start(a,x,&sh,&d)==workshop_OK);assert(workshop_series_pull(sh)==workshop_OK);
    assert(workshop_close(&a)==workshop_OK && ctx.disposed==1);
    assert(workshop_series_poll(sh,&fd)==workshop_STALE && workshop_relay_poll(job,&fd)==workshop_STALE);
    uint32_t n=0;assert(peer_read(b,x,&n,&pd)==peer_OK && n==42);
    assert(workshop_with_hosts(&hosts,&s,&a)==workshop_OK);ctx.mode=TRAP;ctx.disposed=0;job=(workshop_relay_handle){0};
    peer_dormant_handle parked={0};assert(peer_dormant_start(b,&parked,&pd)==peer_OK);
    int sleepfd=-1;assert(peer_dormant_poll(parked,&sleepfd)==peer_PENDING && sleepfd>=0);
    assert(workshop_callback_box_to_box_new(relay,&ctx,end_context,&cb)==workshop_OK);
    assert(workshop_relay_start(a,x,cb,&job,&d)==workshop_OK);
    while((r=workshop_relay_poll(job,&fd))==workshop_PENDING){struct pollfd f={.fd=fd,.events=POLLIN};assert(poll(&f,1,5000)==1);}
    assert(r==workshop_UNAVAILABLE && peer_read(b,x,&n,&pd)==peer_UNAVAILABLE);
    struct pollfd pf={.fd=sleepfd,.events=POLLIN};assert(poll(&pf,1,5000)==1);assert(peer_dormant_poll(parked,&fd)==peer_UNAVAILABLE);
    assert(workshop_callback_box_to_box_drop(&cb)==workshop_OK && workshop_close(&a)==workshop_OK && ctx.disposed==1);
    assert(peer_close(&b)==peer_OK);assert(workshop_box_drop(&x)==workshop_OK && destroyed==1);
    puts("installed C workers: identity, callbacks, errors and cleanup");
}
