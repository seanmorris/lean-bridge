/* Included by the private WIT worker facade after host-worker.h. A Wasm
 * import may register interest but must not dispatch a guest callback until
 * the outer factory frame returns. Observe both terminal and callback fds. */
static lw_status lwit_wait(const lw_ops *ops,const uint64_t h[2],int *fd){
    if(!fd)return LBW(INVALID);
    *fd=-1;lw_job *j=NULL;lw_status s=lw_lookup(ops,h,&j);if(s || (s=lw_begin(j)))return s;
    if(j->fault)s=j->fault;
    else{
        lw_call q={0};int rc=lw_run(j,&q,LW_POLL);s=lw_status_of(rc);
        if(rc==1){
            if(j->gate[0]<0){
                int source=q.fd;int n=lw_run(j,&q,LW_FD);
                if(!n)n=LBW_WAIT_OPEN(source,q.fd,j->gate);
                if(n)s=lw_status_of(n);
            }
            if(s==LBW(PENDING))*fd=j->gate[0];
        }
    }
    lw_end(j);if(j->cancel){lw_finish(j);return LBW(CANCELLED);}return s;
}
