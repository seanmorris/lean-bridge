/* Relocated consumer: the installed, generated header is the only bridge API. */
#include <meter_wasmtime.h>
#include <assert.h>
#include <errno.h>
#include <fcntl.h>
#include <poll.h>
#include <pthread.h>
#include <stdio.h>
#include <string.h>
#include <sys/wait.h>
#include <unistd.h>
#define M(x) meter_wit_##x
#define OK(expr) assert((expr)==M(OK))
static void *wrong_thread(void *p) {
    M(task_immediate) h={0}; assert(M(start_immediate)(p,0,&h)==M(UNAVAILABLE)); return NULL;
}
static void resume(M(session) *s,bool expected) {
    M(task_resume) h={0}; bool b=!expected; M(state) state;
    OK(M(start_resume)(s,&h)); OK(M(await_resume)(s,h,&state,&b));
    assert(state==M(READY) && b==expected); OK(M(drop_resume)(s,&h));
}
#ifdef ALL_SCALARS
#define ROUND(name,T,x) do { M(task_##name) h={0}; T got=0; M(state) st; \
    OK(M(start_##name)(s,(x),&h)); OK(M(await_##name)(s,h,&st,&got)); \
    assert(st==M(READY) && got==(x)); OK(M(drop_##name)(s,&h)); } while (0)
static M(string) scalars(M(session) *s) {
    ROUND(letter,uint32_t,0x1f642); ROUND(byte,uint8_t,UINT8_MAX); ROUND(short,uint16_t,UINT16_MAX);
    ROUND(wide,uint64_t,UINT64_MAX); ROUND(small,int8_t,INT8_MIN); ROUND(narrow,int16_t,INT16_MIN);
    ROUND(signed,int32_t,INT32_MIN); ROUND(single,float,3.25f); ROUND(double_precision,double,-15.125);
    M(task_letter) letter={0}; assert(M(start_letter)(s,0xd800,&letter)==M(INVALID));
    M(task_text) h={0}; char b[]={'a',0,(char)0xce,(char)0xbb};
    assert(M(start_text)(s,(M(text)){NULL,1},&h)==M(INVALID));
    assert(M(start_text)(s,(M(text)){"\xc0",1},&h)==M(INVALID));
    OK(M(start_text)(s,(M(text)){b,sizeof b},&h)); b[0]='z';
    M(string) out={0}; M(state) st; OK(M(await_text)(s,h,&st,&out));
    assert(st==M(READY) && out.size==sizeof b && !memcmp(out.data,"a\0\xce\xbb",4) && out.data[4]==0);
    OK(M(drop_text)(s,&h)); return out;
}
#endif
int main(void) {
    alarm(90); M(session) *s=NULL,*peer=NULL; OK(M(open)(&s)); OK(M(open)(&peer));
    M(task_immediate) a={0}; M(state) st; uint32_t u=55; int fd=41;
    OK(M(start_immediate)(s,UINT32_MAX,&a));
    assert(M(start_immediate)(s,7,&a)==M(INVALID));
    assert(M(poll_immediate)(peer,a,&st,&u,&fd)==M(STALE) && u==55 && fd==41);
    pthread_t th; assert(!pthread_create(&th,NULL,wrong_thread,s)); assert(!pthread_join(th,NULL));
    pid_t child=fork(); assert(child>=0); if (!child) { M(session) *x=s; _exit(M(close)(&x)==M(UNAVAILABLE)?0:1); }
    int status; assert(waitpid(child,&status,0)==child && WIFEXITED(status) && !WEXITSTATUS(status));
    OK(M(await_immediate)(s,a,&st,&u)); assert(st==M(READY) && !u);
    u=19; OK(M(poll_immediate)(s,a,&st,&u,&fd)); assert(st==M(CLOSED) && u==19 && fd==-1);
    M(task_immediate) stale=a; OK(M(drop_immediate)(s,&a));
    OK(M(start_immediate)(s,12,&a)); assert(M(drop_immediate)(s,&stale)==M(STALE));
    OK(M(await_immediate)(s,a,&st,&u)); assert(st==M(READY) && u==13); OK(M(drop_immediate)(s,&a));
    /* A completed Lean computation need not have delivered its result yet.
       If cancellation wins that race, the public owner never yields the value. */
    bool won=false; OK(M(start_immediate)(s,40,&a)); OK(M(cancel_immediate)(s,a,&won)); assert(won);
    u=7; OK(M(await_immediate)(s,a,&st,&u)); assert(st==M(CANCELLED) && u==7);
    OK(M(await_immediate)(s,a,&st,&u)); assert(st==M(CLOSED)); OK(M(drop_immediate)(s,&a));
    M(task_parked) parked={0}; int64_t v=5;
    OK(M(start_parked)(s,INT64_MIN,&parked)); OK(M(poll_parked)(s,parked,&st,&v,&fd)); assert(st==M(PENDING) && v==5 && fd>=0);
    resume(peer,true); struct pollfd gate={fd,POLLIN,0}; assert(poll(&gate,1,10000)==1 && (gate.revents&POLLIN));
    OK(M(await_parked)(s,parked,&st,&v)); assert(st==M(READY) && v==INT64_MIN);
    assert(fcntl(fd,F_GETFD)==-1 && errno==EBADF); OK(M(drop_parked)(s,&parked));
    OK(M(start_parked)(s,97,&parked)); OK(M(poll_parked)(s,parked,&st,&v,&fd)); assert(st==M(PENDING));
    bool accepted=false; OK(M(cancel_parked)(s,parked,&accepted)); assert(accepted);
    OK(M(cancel_parked)(s,parked,&accepted)); assert(!accepted); resume(peer,true);
    v=63; OK(M(await_parked)(s,parked,&st,&v)); assert(st==M(CANCELLED) && v==63);
    OK(M(await_parked)(s,parked,&st,&v)); assert(st==M(CLOSED)); OK(M(drop_parked)(s,&parked));
#ifdef ALL_SCALARS
    M(string) independently_owned=scalars(s);
#endif
    OK(M(start_parked)(s,9,&parked)); OK(M(poll_parked)(s,parked,&st,&v,&fd)); assert(st==M(PENDING));
    OK(M(close)(&s)); assert(!s && fcntl(fd,F_GETFD)==-1 && errno==EBADF);
    resume(peer,true); resume(peer,false); OK(M(close)(&peer)); OK(M(close)(&peer));
#ifdef ALL_SCALARS
    assert(independently_owned.data[0]=='a'); M(string_dispose)(&independently_owned);
    assert(!independently_owned.data && !independently_owned.size);
#endif
    puts("installed Wasmtime task consumer: passed");
}
