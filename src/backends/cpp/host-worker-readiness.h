/* Included only in the private C++ worker facade, after host-worker.h.
 * The coroutine dispatcher must distinguish a completed operation (resume)
 * from a callback request (service, stay suspended). Both may be readable. */
static lw_status lcpp_watch(const lw_ops *ops,const uint64_t handle[2],int *fd,bool callback) {
    if(!fd) return LBW(INVALID);
    *fd=-1;lw_job *job=NULL;
    lw_status s=lw_lookup(ops,handle,&job);
    if(s || (s=lw_begin(job))) return s;
    lw_call q={0};
    if(job->fault) s=job->fault;
    else if(callback) {
        s=lw_status_of(lw_run(job,&q,LW_FD)); if(!s) *fd=q.fd;
    } else {
        int rc=lw_run(job,&q,LW_POLL);s=lw_status_of(rc);
        if(rc==1) {
            if(job->gate[0]<0) {
                int n=LBW_WAIT_OPEN(q.fd,-1,job->gate);
                if(n) s=lw_status_of(n);
            }
            if(s==LBW(PENDING)) *fd=job->gate[0];
        }
    }
    lw_end(job);
    if(job->cancel) { lw_finish(job); return LBW(CANCELLED); }
    return s;
}
