/* Private C11 driver included only by the generated provider. Registry
 * tickets expire with their binding. Word-ABI object leases exist only
 * inside a single owner visit; no application code runs on a Lean worker. */
typedef LBW(status) lw_status;
typedef LBW(diagnostic) lw_error;
typedef struct lw_callback lw_callback;
typedef struct lw_ops {
    const char *key;
    int (*start)(const uint64_t *,uint64_t *,uint64_t *,uint8_t *);
    int (*take)(uint64_t *,uint64_t *,uint8_t *);
    int (*poll)(uint64_t *,int *), (*close)(uint64_t *), (*pull)(uint64_t *);
    int (*callbacks)(uint64_t *,int *), (*next)(uint64_t *,uint32_t *);
    int (*arg)(uint64_t *,uint32_t,uint64_t *), (*reply)(uint64_t *,uint32_t,const uint64_t *);
    int (*fail)(uint64_t *,const uint64_t *,uint32_t *);
} lw_ops;
struct lw_callback {
    unsigned refs,active; bool open; void *context; void (*dispose)(void *);
    lw_status (*invoke)(lw_callback *,struct lw_job *,unsigned);
};
typedef struct lw_failure { lw_error error; lw_status status; } lw_failure;
typedef struct lw_job {
    struct lw_job *next,**prev; lb_app *app; lb_cr_ref owner,ticket;
    const lw_ops *ops; uint64_t h[2]; int gate[2]; bool busy,cancel;lw_status fault;
    lw_failure *failures; unsigned count,capacity,nargs; size_t message_bytes;
    lw_callback *cb[];
} lw_job;
static bool lw_empty(const lw_error *e){
    return e && !e->host_code && !e->message.data && !e->message.len && !e->payload && !e->dispose_payload;
}
static bool lw_fresh(const uint64_t h[2]){return h && !h[0] && !h[1];}
static void lw_revoke(lw_callback *c){
    c->open=false;
    if(!c->active && c->dispose){void (*d)(void *)=c->dispose;void *ctx=c->context;c->dispose=NULL;c->context=NULL;d(ctx);}
}
static void lw_unref(lw_callback *c){if(c && !--c->refs){lw_revoke(c);free(c);}}
static void lw_unref_payload(void *c){lw_unref(c);}
static lw_status lw_callback_ticket(const char *key,lw_callback *c,uint64_t out[2]){
    lb_cr_ref r={0};int n=LB_CR(binding)(key,c,(lb_cr_fn)lw_unref_payload,lb_dispose,&r);
    if(n) return lb_status(n);c->refs=1;c->open=true;out[0]=r.domain;out[1]=r.ticket;return LBW(OK);
}
static lw_status lw_callback_drop(const char *key,uint64_t h[2],bool revoke){
    if(!h)return LBW(INVALID);if(lw_fresh(h))return LBW(OK);
    lb_cr_ref r={h[0],h[1]};void *v=NULL;int n=LB_CR(binding_get)(key,r,&v);if(n)return lb_status(n);
    lw_callback *c=v;c->refs++;h[0]=h[1]=0;
    n=LB_CR(binding_drop)(key,&r);if(!n && revoke)lw_revoke(c);lw_unref(c);return lb_status(n);
}
static lw_status lw_keep(lw_job *j,unsigned i,const char *key,const uint64_t h[2]){
    void *v=NULL;int n=LB_CR(binding_get)(key,(lb_cr_ref){h[0],h[1]},&v);if(n)return lb_status(n);
    lw_callback *c=v;if(!c->open)return LBW(CALLBACK_CLOSED);
    if(c->refs==UINT32_MAX)return LBW(LIMIT);c->refs++;j->cb[i]=c;return LBW(OK);
}
enum lw_op { LW_START,LW_TAKE,LW_POLL,LW_PULL,LW_CLOSE,LW_FD,LW_NEXT,LW_ARG,LW_REPLY,LW_FAIL };
typedef struct lw_call {
    lb_scope scope; lw_job *job; enum lw_op op; uint64_t *args; const int *kinds;
    unsigned argc,slot; uint32_t number; int fd,rc; uint64_t out[4];uint8_t tags[65];
} lw_call;
static void lw_discard(uint64_t w[4]){
    uint64_t tag=w[3];
    if(tag==1 || tag==2)free((void *)(uintptr_t)w[0]);
    else if(tag>=3 && tag-3<sizeof(lb_keys)/sizeof(*lb_keys)){
        lb_cr_ref r={0};const char *key=lb_keys[tag-3];
        if(!LB_CR(lift)(key,w[0],&r))LB_CR(drop)(key,&r);
    }
    memset(w,0,4*sizeof(*w));
}
static int lw_enter(uint64_t id){
    lw_call *q=(lw_call *)(uintptr_t)id;lw_job *j=q->job;const lw_ops *m=j->ops;
    uint64_t out[4]={0},unused=0;
    for(unsigned i=0;i<q->argc;i++)if(q->kinds[i]>=0){
        uint64_t *w=q->args+3*i,input=w[0];w[0]=0;
        int n=LBW_OBJECT(0,(unsigned)q->kinds[i],input,w,&unused);
        if(n){q->rc=n;return 0;}
    }
    switch(q->op){
    case LW_START:q->rc=m->start(q->args,j->h,out,q->tags);break;
    case LW_TAKE:q->rc=m->take(j->h,out,q->tags);break;
    case LW_POLL:q->rc=m->poll(j->h,&q->fd);break;
    case LW_PULL:q->rc=m->pull(j->h);break;
    case LW_CLOSE:q->rc=m->close(j->h);break;
    case LW_FD:q->rc=m->callbacks(j->h,&q->fd);break;
    case LW_NEXT:q->rc=m->next(j->h,&q->number);break;
    case LW_ARG:q->rc=m->arg(j->h,q->slot,out);break;
    case LW_REPLY:q->rc=m->reply(j->h,q->slot,q->args);break;
    case LW_FAIL:q->rc=m->fail(j->h,q->args,&q->number);break;
    }
    int trap=0;
    if((q->op==LW_START && (q->rc==0 || q->rc==3 || q->rc==4)) || (q->op==LW_REPLY && q->rc==0)){
        for(unsigned i=0;i<q->argc;i++)if(q->kinds[i]>=0 && LBW_OBJECT(2,(unsigned)q->kinds[i],0,q->args+3*i,&unused)){trap=-1;break;}
    }
    if(!trap){
        if(out[3]>=3){uint64_t kind=out[3]-3,ticket=0;
            if(kind>=sizeof(lb_keys)/sizeof(*lb_keys) || out[2] || LBW_OBJECT(1,(unsigned)kind,0,out,&ticket))trap=-1;
            else {q->out[0]=ticket;q->out[3]=out[3];}
        }else{memcpy(q->out,out,sizeof q->out);out[3]=0;}
    }
    LBW_CLEAR(out);return trap;
}
static int lw_run(lw_job *j,lw_call *q,enum lw_op op){
    q->job=j;q->op=op;q->scope.binding=j->owner;q->scope.app=j->app;
    int n=LBW_VISIT((uintptr_t)q,lb_dispatch,op==LW_CLOSE,lw_enter);
    lb_reset(&q->scope);if(n){lw_discard(q->out);return n;}return q->rc;
}
static lw_status lw_status_of(int rc){
    switch(rc){case 0:return LBW(OK);case 1:return LBW(PENDING);case 2:return LBW(END);case 3:return LBW(DECLARED_ERROR);
    case 4:case 13:return LBW(IO_ERROR);case 5:return LBW(INVALID);case 6:return LBW(STALE);case 7:return LBW(BUSY);
    case 8:return LBW(IDLE);case 11:case 12:return LBW(LIMIT);default:return LBW(UNAVAILABLE);}
}
static lw_status lw_new(lb_cr_ref owner,const lw_ops *ops,unsigned n,lw_job **out){
    void *v=NULL;int c=LB_CR(binding_get)(lb_component_key,owner,&v);if(c)return lb_status(c);
    lb_app *app=v;if(app->closing || app->depth>=64)return LBW(BUSY);
    lw_job *j=calloc(1,sizeof(*j)+sizeof(*j->cb)*n);if(!j)return LBW(LIMIT);
    j->gate[0]=j->gate[1]=-1;j->app=app;j->owner=owner;j->ops=ops;j->nargs=n;
    if((c=LB_CR(binding)(ops->key,j,NULL,NULL,&j->ticket))){free(j);return lb_status(c);}
    j->prev=&app->jobs;j->next=app->jobs;if(j->next)j->next->prev=&j->next;app->jobs=j;
    *out=j;return LBW(OK);
}
static lw_status lw_lookup(const lw_ops *ops,const uint64_t h[2],lw_job **out){
    if(!h)return LBW(INVALID);void *v=NULL;int c=LB_CR(binding_get)(ops->key,(lb_cr_ref){h[0],h[1]},&v);
    if(c)return lb_status(c);*out=v;return LBW(OK);
}
static lw_status lw_begin(lw_job *j){
    if(j->busy || j->app->closing || j->app->depth>=64)return LBW(BUSY);
    j->busy=true;j->app->depth++;return LBW(OK);
}
static void lw_end(lw_job *j){j->busy=false;--j->app->depth;}
/* Unlink and invalidate before invoking any application destructor. A caller
 * guarantees the binding cannot be closed until disposal has finished. */
static lw_status lw_finish(lw_job *j){
    j->busy=true;j->app->depth++;
    lw_call q={0};int rc=j->h[0]?lw_run(j,&q,LW_CLOSE):0;
    *j->prev=j->next;if(j->next)j->next->prev=j->prev;
    LB_CR(binding_drop)(j->ops->key,&j->ticket);LBW_WAIT_CLOSE(j->gate);
    for(unsigned i=0;i<j->nargs;i++)lw_unref(j->cb[i]);
    for(unsigned i=0;i<j->count;i++)LBW(diagnostic_clear)(&j->failures[i].error);
    free(j->failures);--j->app->depth;free(j);return rc==6?LBW(OK):lw_status_of(rc);
}
static lw_status lw_close(const lw_ops *ops,uint64_t h[2]){
    if(!h)return LBW(INVALID);if(lw_fresh(h))return LBW(OK);
    lw_job *j=NULL;lw_status s=lw_lookup(ops,h,&j);if(s)return s;
    h[0]=h[1]=0;if(j->busy){j->cancel=true;return LBW(OK);}return lw_finish(j);
}
static lw_status lw_failure_record(lw_job *j,lw_error *e,lw_status status){
    size_t budget=j->message_bytes;
    if(!lb_charge(e->message.data,e->message.len,1,&budget) || !lb_utf8(e->message.data,e->message.len) || (!!e->payload!=!!e->dispose_payload))return LBW(INVALID);
    if(j->count>=4096)return LBW(LIMIT);
    if(j->count==j->capacity){unsigned capacity=j->capacity?j->capacity*2:4;
        void *v=realloc(j->failures,sizeof(*j->failures)*capacity);if(!v)return LBW(LIMIT);j->failures=v;j->capacity=capacity;}
    uint64_t words[3]={(uintptr_t)e->message.data,e->message.len,0};
    lw_call q={.args=words};int rc=lw_run(j,&q,LW_FAIL);if(rc)return lw_status_of(rc);
    if(q.number!=j->count+1){lean_bridge_native_runtime_retire();return LBW(UNAVAILABLE);}
    j->failures[j->count++]=(lw_failure){*e,status};j->message_bytes=budget;*e=(lw_error){0};return LBW(OK);
}
static lw_status lw_poll(const lw_ops *ops,const uint64_t h[2],int *fd){
    if(!fd)return LBW(INVALID);*fd=-1;lw_job *j=NULL;lw_status s=lw_lookup(ops,h,&j);if(s || (s=lw_begin(j)))return s;
    if(j->fault){lw_end(j);return j->fault;}
    lw_call q={0};int rc=lw_run(j,&q,LW_POLL);
    if(rc==1 && ops->next){
        for(unsigned batch=0;batch<16;batch++){int n=lw_run(j,&q,LW_NEXT);if(n==1)break;
            if(n){s=lw_status_of(n);goto end;}
            if(q.number>=j->nargs || !j->cb[q.number]){lean_bridge_native_runtime_retire();s=LBW(UNAVAILABLE);goto end;}
            lw_callback *c=j->cb[q.number];lw_error closed={0};
            if(c->open){c->active++;s=c->invoke(c,j,q.number);if(!--c->active && !c->open)lw_revoke(c);}
            else s=lw_failure_record(j,&closed,LBW(CALLBACK_CLOSED));
            if(j->cancel || s)goto end;
        }
        rc=lw_run(j,&q,LW_POLL);
    }
    if(rc==1){int source=q.fd;
        if(j->gate[0]<0){int callback=-1;if(ops->callbacks){int n=lw_run(j,&q,LW_FD);if(n){s=lw_status_of(n);goto end;}callback=q.fd;}
            int n=LBW_WAIT_OPEN(source,callback,j->gate);if(n){s=lw_status_of(n);goto end;}}
        *fd=j->gate[0];
    }
    s=lw_status_of(rc);
end:if(s!=LBW(OK) && s!=LBW(PENDING) && s!=LBW(IDLE))j->fault=s;
    lw_end(j);if(j->cancel){lw_finish(j);return LBW(CANCELLED);}return s;
}
