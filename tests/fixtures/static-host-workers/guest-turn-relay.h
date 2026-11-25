/* Private channel test. This store thread only ever gives the native owner
 * tickets. The independently compiled guest owns and implements the callback. */
typedef wasmtime_component_val_t RV;
typedef struct {host *h;wasmtime_component_instance_t *instance;wasmtime_context_t *ctx;} relay_probe;
static RV ru32(unsigned v){return (RV){.kind=WASMTIME_COMPONENT_U32,.of.u32=v};}
static RV ru64(uint64_t v){return (RV){.kind=WASMTIME_COMPONENT_U64,.of.u64=v};}
static RV rcall(relay_probe *p,const char *iface,const char *name,RV *args,size_t argc){
    wasmtime_component_export_index_t *scope=NULL;
    if(iface){scope=wasmtime_component_instance_get_export_index(p->instance,p->ctx,NULL,iface,strlen(iface));assert(scope);}
    wasmtime_component_export_index_t *idx=wasmtime_component_instance_get_export_index(p->instance,p->ctx,scope,name,strlen(name));
    wasmtime_component_func_t fn;assert(idx && wasmtime_component_instance_get_func(p->instance,p->ctx,idx,&fn));
    wasmtime_component_export_index_delete(idx);if(scope)wasmtime_component_export_index_delete(scope);
    RV out={0};check(wasmtime_component_func_call(&fn,p->ctx,args,argc,&out,1));return out;
}
static unsigned rcount(relay_probe *p,const char *name){
    RV v=rcall(p,NULL,name,NULL,0);assert(v.kind==WASMTIME_COMPONENT_U32);return v.of.u32;
}
static lb_wit_message advance(relay_probe *p,unsigned op,uint64_t a,uint64_t b,uint64_t c){
    lb_wit_turns *s=&p->h->s.turns;lb_wit_event ev={0};
    assert(lb_wit_turn_begin(s,(lb_wit_message){op,{a,b,c}},&ev));
    while(!ev.done){
        unsigned event=ev.message.op,kind=(unsigned)ev.message.words[0];
        uint64_t x=ev.message.words[1],y=ev.message.words[2];lb_wit_message reply={0};
        if(event==LB_TC_INVOKE){
            assert(!kind);RV args[]={ru64(x),ru64(y)},v=rcall(p,NULL,"invoke",args,2);
            assert(v.kind==WASMTIME_COMPONENT_RESULT && v.of.result.val && v.of.result.val->kind==WASMTIME_COMPONENT_U64);
            reply=(lb_wit_message){LB_TC_CALLBACK_REPLY,{!v.of.result.is_ok,v.of.result.val->of.u64}};wasmtime_component_val_delete(&v);
        }else{
            assert(event==LB_TC_SAME || event==LB_TC_RELEASE);RV args[]={ru32(kind),ru64(x),ru64(y)};
            RV v=rcall(p,NULL,event==LB_TC_SAME?"same":"release",args,event==LB_TC_SAME?3:2);
            assert(v.kind==WASMTIME_COMPONENT_BOOL);reply=(lb_wit_message){LB_TC_REPLY,{v.of.boolean}};
        }
        assert(lb_wit_turn_reply(s,ev.ticket,reply,&ev));
    }
    assert(ev.message.op==LB_TC_DONE);return ev.message;
}
static void rdrop(relay_probe *p,RV *v){
    assert(v->kind==WASMTIME_COMPONENT_RESOURCE);check(wasmtime_component_resource_any_drop(p->ctx,v->of.resource));
}
static void run_relays(host *h,wasmtime_component_instance_t *inst,wasmtime_context_t *ctx){
    relay_probe p={h,inst,ctx};
    for(unsigned mode=0;mode<4;mode++){
        unsigned channel=mode==2?528:512,before=rcount(&p,"visits"),drops=rcount(&p,"cb-drops");
        RV n=ru32(42),box=rcall(&p,"objects","[static]box.create",&n,1);assert(box.kind==WASMTIME_COMPONENT_RESULT && box.of.result.is_ok);
        RV *original=box.of.result.val;n=ru32(mode==1 || mode==2);RV cb=rcall(&p,"callbacks","[static]call-box-to-box.make",&n,1);
        RV held=rcall(&p,NULL,"hold-box",original,1),retained=rcall(&p,NULL,"hold-cb",&cb,1);
        assert(held.kind==WASMTIME_COMPONENT_U64 && retained.kind==WASMTIME_COMPONENT_U64 && held.of.u64!=retained.of.u64);
        RV wrong[]={ru32(2),held};assert(!rcall(&p,NULL,"release",wrong,2).of.boolean);
        wrong[0]=ru32(0);wrong[1]=retained;assert(!rcall(&p,NULL,"release",wrong,2).of.boolean);
        rdrop(&p,&cb);wasmtime_component_val_delete(&cb);
        lb_wit_message open=advance(&p,channel+LB_TF_OPEN,0,held.of.u64,retained.of.u64);
        uint64_t key=open.words[0],ready=open.words[2];assert(key && key<=64 && ready && rcount(&p,"visits")==before);
        for(unsigned i=0;;i++){
            assert(i<100 && ready && ready<=(uint64_t)INT_MAX+1);
            struct pollfd fd={.fd=(int)(ready-1),.events=POLLIN};
            assert(poll(&fd,1,5000)==1 && (fd.revents&(POLLIN|POLLHUP)));
            if(mode==3)break; /* callback has arrived, no invocation yet */
            lb_wit_message tick=advance(&p,channel+LB_TF_POLL,key,0,0);
            if(tick.words[0]){assert(tick.words[0]==1 && !tick.words[2]);break;}
            ready=tick.words[2];
        }
        if(mode!=3){
            lb_wit_message peek=advance(&p,channel+LB_TF_PEEK,key,0,0);assert(peek.words[0]==mode);
            RV token=ru64(peek.words[1]);
            if(!mode){
                RV received=rcall(&p,NULL,"copy-box",&token,1);assert(received.kind==WASMTIME_COMPONENT_OPTION && received.of.option);
                RV pair[]={*original,*received.of.option};assert(rcall(&p,"objects","same-box",pair,2).of.boolean);
                RV level=rcall(&p,"objects","[method]box.get-level",received.of.option,1);
                assert(level.kind==WASMTIME_COMPONENT_RESULT && level.of.result.is_ok && level.of.result.val->of.u32==73);
                wasmtime_component_val_delete(&level);rdrop(&p,received.of.option);wasmtime_component_val_delete(&received);
            }else if(mode==1){
                RV received=rcall(&p,NULL,"take-fault",&token,1);assert(received.kind==WASMTIME_COMPONENT_OPTION && received.of.option);
                RV msg=rcall(&p,"objects","[method]member-error.message",received.of.option,1);
                assert(msg.kind==WASMTIME_COMPONENT_STRING && msg.of.string.size==11 && !memcmp(msg.of.string.data,"other error",11));
                wasmtime_component_val_delete(&msg);unsigned d=rcount(&p,"drops");rdrop(&p,received.of.option);assert(rcount(&p,"drops")==d+1);
                wasmtime_component_val_delete(&received);
            }else{
                const char expected[]="late λ";assert(peek.words[1]==sizeof expected-1);
                lb_wit_message bytes=advance(&p,channel+LB_TF_TEXT,key,0,0);assert(bytes.words[0]==sizeof expected-1);
                for(unsigned i=0;i<sizeof expected-1;i++)assert(((bytes.words[1]>>(8*i))&255)==(unsigned char)expected[i]);
            }
        }
        (void)advance(&p,channel+LB_TF_CLOSE,key,0,0);rdrop(&p,original);wasmtime_component_val_delete(&box);
        assert(rcount(&p,"visits")==before+(mode!=3) && rcount(&p,"cb-drops")==drops+2+(mode!=3));
    }
    lb_wit_event ev={0};assert(lb_wit_turn_begin(&h->s.turns,(lb_wit_message){.op=242},&ev) && ev.done);
    (void)advance(&p,512+LB_TF_DRAIN,0,0,0);assert(!rcount(&p,"live-owners"));
    wasmtime_component_func_t close=lookup(inst,ctx,"close-owners");check(wasmtime_component_func_call(&close,ctx,NULL,0,NULL,0));
}
