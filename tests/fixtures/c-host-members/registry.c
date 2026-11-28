/* Exercise the shared, private C reference domain without involving Lean. */
#include "host-registry.h"
#include <assert.h>
#include <pthread.h>
#include <stdio.h>
#include <sys/wait.h>
#include <unistd.h>
static const char a[]="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
static const char b[]="bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
static int payload,drops;
static lb_cr_ref first;
static void shim(lb_cr_fn fn,void *p) { ((void (*)(void *))fn)(p); }
static void destroy(void *p) {
    lb_cr_ref no={0}; ++drops; assert(p==&payload);
    assert(LB_CR(adopt)(a,p,(lb_cr_fn)destroy,shim,&no)==CR_INVALID);
}
static void *worker(void *unused) {
    (void)unused; lb_cr_ref out={0};
    assert(LB_CR(clone)(a,first,&out)==CR_UNAVAILABLE); return NULL;
}
int main(void) {
    lb_cr_ref bind={0},rebound={0},other={0},third={0},empty={0}; int eq=-1;
    assert(!LB_CR(binding)(a,&bind,NULL,NULL,&bind));
    assert(LB_CR(binding_get)(b,bind,(void **)&(void *){0})==CR_INVALID);
    assert(!LB_CR(adopt)(a,&payload,(lb_cr_fn)destroy,shim,&first));
    assert(!LB_CR(adopt)(a,&payload,(lb_cr_fn)destroy,shim,&other));
    assert(first.ticket!=other.ticket && !LB_CR(same)(a,first,other,&eq) && eq);
    assert(!LB_CR(clone)(a,first,&third));
    assert(LB_CR(adopt)(b,&payload,(lb_cr_fn)destroy,shim,&empty)==CR_INVALID);
    assert(LB_CR(drop)(b,&first)==CR_INVALID && LB_CR(binding_drop)(a,&first)==CR_INVALID);
    lb_cr_ref foreign=first; ++foreign.domain;
    assert(LB_CR(clone)(a,foreign,&empty)==CR_STALE);
    pthread_t t; assert(!pthread_create(&t,NULL,worker,NULL)); assert(!pthread_join(t,NULL));
    pid_t p=fork(); assert(p>=0);
    if(!p) { worker(NULL); _exit(0); }
    int status; assert(waitpid(p,&status,0)==p && WIFEXITED(status) && !WEXITSTATUS(status));
    lb_cr_ref stale=first; assert(!LB_CR(drop)(a,&first)); assert(!first.ticket && !drops);
    assert(LB_CR(drop)(a,&stale)==CR_STALE);
    assert(!LB_CR(drop)(a,&third)); assert(!LB_CR(drop)(a,&other)); assert(drops==1);
    assert(!LB_CR(adopt)(a,&payload,(lb_cr_fn)destroy,shim,&rebound));
    assert(LB_CR(same)(a,stale,rebound,&eq)==CR_STALE);
    assert(!LB_CR(drop)(a,&rebound)); assert(drops==2);
    assert(!LB_CR(binding_drop)(a,&bind));
    puts("C registry: independent owners; stale, kind, thread and fork rejected; two exact destructions");
}
