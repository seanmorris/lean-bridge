/* XS-only qualification helpers. In particular, Perl never sees token words
   or a raw Lean pointer. All conversions use the actual component ingress. */
#include <poll.h>
#include <errno.h>
typedef struct {uint64_t h[2],out[4]; int (*close)(uint64_t *);} test_job;
static uint64_t parked[2];
static void test_end(pTHX_ void *arg) {
    PERL_UNUSED_CONTEXT;
    test_job *job=arg;
    TEST_CLEAR(job->out);
    if (job->h[0]) (void)job->close(job->h);
    free(job);
}
static SV *test_call(pTHX_ SV *obj,int method) {
    /* The caller entered the lexical registry and owns the save scope.
       All locals must unwind even if an XS conversion croaks. */
    uint64_t args[3]={0}; uint8_t tags[8]={0};
    int (*pollfn)(uint64_t *,int *)=method==0?TEST_ECHO_POLL:TEST_OUTCOME_POLL;
    int (*take)(uint64_t *,uint64_t *,uint8_t *)=method==0?TEST_ECHO_TAKE:TEST_OUTCOME_TAKE;
    SSGROW(8);
    test_job *job=calloc(1,sizeof(*job));
    if (!job) croak("out of memory");
    SAVEDESTRUCTOR_X(test_end,job);
    job->close=method==0?TEST_ECHO_CLOSE:method==1?TEST_OUTCOME_CLOSE:TEST_REFUSE_CLOSE;
    phw_input(aTHX_ 0,obj,args); phw_admit(aTHX_ 0,args);
    int rc=(method==0?TEST_ECHO_START:method==1?TEST_OUTCOME_START:TEST_REFUSE_START)(args,job->h,job->out,tags);
    if (method==2) {
        if (rc!=3 || job->h[0]) croak("expected a typed factory failure");
    } else {
        if (rc!=0 || !job->h[0]) croak("cannot start compiled worker (%d)",rc);
        for (;;) {
            int fd=-1; rc=pollfn(job->h,&fd);
            if (rc==0) break;
            if (rc!=1 || fd<0) croak("invalid readiness result");
            struct pollfd watch={fd,POLLIN,0}; int r;
            do {r=poll(&watch,1,15000);} while (r<0 && errno==EINTR);
            if (r<=0) croak("worker did not settle");
        }
        rc=take(job->h,job->out,tags);
        if (rc!=0 || (method==1 && tags[0]!=0)) croak("expected a delivered value");
    }
    return phw_output(aTHX_ 0,job->out);
}
