/* Same error payload at startup and in a worker. The installed ABI, not an
 * exception message or caller guess, determines which operation failed. */
#include <meter_wasmtime.h>
#include <assert.h>
#include <stdio.h>
#include <string.h>
#include <unistd.h>
#define M(x) meter_wit_##x
#define OK(e) assert((e)==M(OK))
static void message(M(string) s,M(text) expected) {
    assert(s.size==expected.size && !memcmp(s.data,expected.data,s.size) && s.data[s.size]==0);
}
int main(void) {
    alarm(60); M(session) *s=NULL; OK(M(open)(&s));
    M(text) msg={"same\0\xce\xbb",7}; uint32_t payload=0xdecafbad;
    M(task_checked) h={0}; uint32_t start=0;
    /* More failures than the store's slot budget; none may acquire a task. */
    for (unsigned i=0;i<260;i++)
        assert(M(start_checked)(s,1,payload,msg,&h,&start)==M(START_ERROR) && start==payload);
    for (uint8_t mode=2;mode<=4;mode++) {
        M(checked_value) out={0}; M(state) state=M(PENDING);
        start=8; OK(M(start_checked)(s,mode,payload,msg,&h,&start)); assert(start==8);
        OK(M(await_checked)(s,h,&state,&out)); assert(state==M(READY));
        if(mode==2) assert(!out.ok && out.error==payload);
        else if(mode==3) { assert(out.ok && !out.value.ok); message(out.value.error,msg); }
        else assert(out.ok && out.value.ok && out.value.value==payload);
        M(checked_value_dispose)(&out); M(checked_value_dispose)(&out);
        out.error=19; OK(M(await_checked)(s,h,&state,&out)); assert(state==M(CLOSED) && out.error==19);
        OK(M(drop_checked)(s,&h));
    }
    M(task_branch) branch={0}; M(branch_start_error) tree={0}; M(string) copy={0}; M(state) state=M(PENDING);
    assert(M(start_branch)(s,1,msg,&branch,&tree)==M(START_ERROR) && !tree.ok); message(tree.error,msg);
    assert(M(start_branch)(s,0,msg,&branch,&tree)==M(INVALID));
    M(branch_start_error_dispose)(&tree);
    assert(M(start_branch)(s,2,msg,&branch,&tree)==M(START_ERROR) && tree.ok && tree.value==65535);
    OK(M(start_branch)(s,0,msg,&branch,&tree)); OK(M(await_branch)(s,branch,&state,&copy));
    assert(state==M(READY)); message(copy,msg); OK(M(drop_branch)(s,&branch));
    M(task_phase) task={0}; M(string) early={0},late={0}; uint32_t n=42;
    assert(M(start_phase)(s,1,msg,&task,&early)==M(START_ERROR)); message(early,msg);
    assert(M(start_phase)(s,2,msg,&task,&early)==M(INVALID)); /* an occupied output rejects before starting */
    M(string_dispose)(&early); OK(M(start_phase)(s,2,msg,&task,&early)); assert(!early.data);
    OK(M(await_phase)(s,task,&state,&n,&late)); assert(state==M(FAILED) && n==42); message(late,msg);
    M(string) second={0}; int fd=45;
    OK(M(poll_phase)(s,task,&state,&n,&second,&fd)); assert(state==M(CLOSED) && fd==-1 && !second.data && n==42);
    OK(M(drop_phase)(s,&task)); OK(M(start_phase)(s,0,msg,&task,&early));
    OK(M(await_phase)(s,task,&state,&n,&second)); assert(state==M(READY) && n==97 && !second.data);
    OK(M(drop_phase)(s,&task)); OK(M(start_phase)(s,2,msg,&task,&early));
    bool won=false; OK(M(cancel_phase)(s,task,&won)); assert(won);
    OK(M(await_phase)(s,task,&state,&n,&second)); assert(state==M(CANCELLED) && n==97 && !second.data);
    OK(M(drop_phase)(s,&task)); OK(M(close)(&s)); message(late,msg); M(string_dispose)(&late);
    message(copy,msg); M(string_dispose)(&copy);
    puts("factory failure, returned nested Except and worker failure are distinct");
}
