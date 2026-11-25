/* A store-owned readiness snapshot. Every package contributes borrowed
 * descriptors to the same poll. Nothing here reads or closes a worker fd. */
#ifndef LB_WIT_APPLICATION_TURN_WAIT_H
#define LB_WIT_APPLICATION_TURN_WAIT_H
#include <errno.h>
#include <poll.h>
#include <stdbool.h>
#include <stddef.h>
typedef struct {
    struct pollfd *fds;
    nfds_t capacity,used;
    bool immediate;
} lb_wit_wait_set;
/* A delivered future no longer contributes interest. A pending fd-less
 * future is immediately actionable; an fd-less cursor has no pull demand. */
static inline int lb_wit_wait_collect(lb_wit_wait_set *s,const bool *active,const int *fd,const bool *delivered,size_t count){
    if(!s || (!s->fds && s->capacity) || s->used>s->capacity || !active || !fd)return EINVAL;
    for(size_t i=0;i<count;i++)if(active[i] && !(delivered && delivered[i])){
        if(fd[i]>=0){
            if(s->used==s->capacity)return ENOSPC;
            s->fds[s->used++]=(struct pollfd){.fd=fd[i],.events=POLLIN};
        }else if(delivered)s->immediate=true;
    }
    return 0;
}
static inline int lb_wit_wait_poll(lb_wit_wait_set *s,int timeout,bool *ready){
    if(!s || (!s->fds && s->capacity) || s->used>s->capacity || !ready || timeout<0)return EINVAL;
    *ready=s->immediate;
    if(*ready)return 0;
    /* Even if no worker is waiting on I/O, return to the store for reader
     * cancellation and guest notifications. Never block indefinitely. */
    int rc=poll(s->fds,s->used,s->used || timeout<1?timeout:1);
    if(rc<0)return errno==EINTR?0:errno;
    for(nfds_t i=0;i<s->used;i++)if(s->fds[i].revents){
        if(s->fds[i].revents&~(POLLIN|POLLHUP))return EBADF;
        *ready=true;
    }
    return 0;
}
#endif
