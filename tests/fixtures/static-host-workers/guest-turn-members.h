/* Call the Wasm member adapters, not the C model of an object. Private
 * tickets never leave this audit harness; the defining guest tests identity. */
static RV member_result(relay_probe *p,const char *name,RV *args,unsigned argc,bool good){
    RV r=rcall(p,"members",name,args,argc);
    assert(r.kind==WASMTIME_COMPONENT_RESULT && r.of.result.is_ok==good);
    RV v={0};if(r.of.result.val)wasmtime_component_val_clone(r.of.result.val,&v);
    wasmtime_component_val_delete(&r);return v;
}
static void member_release(relay_probe *p,unsigned kind,RV v){
    RV args[]={ru32(kind),v};assert(rcall(p,NULL,"release",args,2).of.boolean);
}
static void check_members(host *h,wasmtime_component_instance_t *inst,wasmtime_context_t *ctx){
    relay_probe p={h,inst,ctx};RV n=ru32(42),a=member_result(&p,"create",&n,1,true),b=member_result(&p,"create",&n,1,true);
    assert(a.kind==WASMTIME_COMPONENT_U64 && b.kind==a.kind && a.of.u64!=b.of.u64);
    RV pair[]={ru32(0),a,b};assert(!rcall(&p,NULL,"same",pair,3).of.boolean);
    const char *ops[]={"identity","anchored","keep-other","take-other"};
    RV args[]={a,b};
    for(unsigned i=0;i<4;i++){
        RV v=member_result(&p,ops[i],args,i<2?1:2,true);assert(v.kind==a.kind);
        pair[1]=i<2?a:b;pair[2]=v;assert(rcall(&p,NULL,"same",pair,3).of.boolean);member_release(&p,0,v);
    }
    args[1]=ru32(73);(void)member_result(&p,"set-level",args,2,true);
    assert(member_result(&p,"read",&a,1,true).of.u32==73 && member_result(&p,"get-level",&b,1,true).of.u32==42);
    const char text[]="a\0λ🌿";args[1]=(RV){.kind=WASMTIME_COMPONENT_STRING};
    wasm_name_new(&args[1].of.string,sizeof text-1,text);RV copied=member_result(&p,"echo-text",args,2,true);
    assert(copied.kind==WASMTIME_COMPONENT_STRING && copied.of.string.size==sizeof text-1 && !memcmp(text,copied.of.string.data,sizeof text-1));
    wasmtime_component_val_delete(&args[1]);wasmtime_component_val_delete(&copied);
    args[1]=(RV){.kind=WASMTIME_COMPONENT_LIST};wasmtime_component_vallist_new_uninit(&args[1].of.list,257);
    for(unsigned i=0;i<257;i++)args[1].of.list.data[i]=(RV){.kind=WASMTIME_COMPONENT_U8,.of.u8=(uint8_t)(255-i)};
    copied=member_result(&p,"echo-bytes",args,2,true);assert(copied.kind==WASMTIME_COMPONENT_LIST && copied.of.list.size==257);
    for(unsigned i=0;i<257;i++)assert(copied.of.list.data[i].kind==WASMTIME_COMPONENT_U8 && copied.of.list.data[i].of.u8==(uint8_t)(255-i));
    wasmtime_component_val_delete(&args[1]);wasmtime_component_val_delete(&copied);
    args[1]=(RV){.kind=WASMTIME_COMPONENT_RECORD};wasmtime_component_valrecord_new_uninit(&args[1].of.record,2);
    wasmtime_component_valrecord_entry_t *fields=args[1].of.record.data;
    wasm_name_new_from_string(&fields[0].name,"negative");fields[0].val=(RV){.kind=WASMTIME_COMPONENT_BOOL,.of.boolean=true};
    wasm_name_new_from_string(&fields[1].name,"limbs");fields[1].val=(RV){.kind=WASMTIME_COMPONENT_LIST};
    wasmtime_component_vallist_new_uninit(&fields[1].val.of.list,13);
    for(unsigned i=0;i<13;i++)fields[1].val.of.list.data[i]=ru32(UINT32_MAX-i);
    copied=member_result(&p,"shift",args,2,true);assert(copied.kind==WASMTIME_COMPONENT_RECORD && copied.of.record.size==2);
    fields=copied.of.record.data;assert(fields[0].val.of.boolean && fields[1].val.of.list.size==13);
    for(unsigned i=0;i<13;i++)assert(fields[1].val.of.list.data[i].of.u32==UINT32_MAX-i);
    wasmtime_component_val_delete(&args[1]);wasmtime_component_val_delete(&copied);
    member_release(&p,0,b);member_release(&p,0,a);assert(!rcount(&p,"live-owners"));
    /* Two distinct, non-copyable exceptions outlive their calls independently. */
    n=ru32(UINT32_MAX);a=member_result(&p,"create",&n,1,false);n=ru32(UINT32_MAX-1);b=member_result(&p,"create",&n,1,false);
    for(unsigned i=0;i<2;i++){
        RV token=i?a:b,taken=rcall(&p,NULL,"take-fault",&token,1);assert(taken.kind==WASMTIME_COMPONENT_OPTION && taken.of.option);
        RV msg=rcall(&p,"objects","[method]member-error.message",taken.of.option,1);
        assert(msg.kind==WASMTIME_COMPONENT_STRING && msg.of.string.size==11 && !memcmp(msg.of.string.data,i?"invalid box":"other error",11));
        wasmtime_component_val_delete(&msg);rdrop(&p,taken.of.option);wasmtime_component_val_delete(&taken);
    }
    assert(!rcount(&p,"live-owners"));puts("eleven generated defining-member adapters: identity, transfers, mutation, copied buffers, wide limbs and original exceptions");
}
