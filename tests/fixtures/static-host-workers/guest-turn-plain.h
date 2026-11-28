/* The two Wasm consumers check their own original objects, the tag and both
 * ends of the u32 range. This driver observes scheduling, not result values. */
static unsigned plain_count(lb_tf_driver *d,bool writers){
    unsigned n=0;for(unsigned k=0;k<64;k++)n+=writers?d->port.delivered[k]:d->port.port.active[k];
    return n;
}
static void plain_ready(lb_tf_driver *d,unsigned expected){
    struct timespec delay={0,1000000};unsigned changed=0;
    for(unsigned t=0;plain_count(d,true)!=expected;t++){
        assert(t<2000);check(lb_tf_advance(d,&changed));nanosleep(&delay,NULL);
    }
}
static void plain_cases(host *h,wasmtime_component_instance_t *inst,wasmtime_context_t *ctx){
    relay_probe p={h,inst,ctx};unsigned changed=0;
    wasmtime_component_func_t reject=lookup(inst,ctx,"case-reject"),start=lookup(inst,ctx,"case-start-case");
    wasmtime_component_func_t receive=lookup(inst,ctx,"case-receive-case"),discard=lookup(inst,ctx,"case-discard-case");
    wasmtime_component_func_t a=lookup(inst,ctx,"echo-start"),b=lookup(inst,ctx,"echo-other-start");
    lb_tf_driver *echo=&h->tasks.rows[LB_TG_I_echo].future;step(&a,ctx);step(&b,ctx);
    assert(plain_count(echo,false)==2);
    /* A failed factory must not disturb another pending future, exhaust the
       64-row native table, or allocate a canonical reader for the failure. */
    for(unsigned n=0;n<65;n++){
        step(&reject,ctx);assert(!plain_count(&h->tasks.rows[LB_TG_I_reject].future,false) && plain_count(echo,false)==2);
    }
    plain_ready(echo,2);
    RV ok=rcall(&p,NULL,"echo-other-receive",NULL,0);assert(ok.kind==WASMTIME_COMPONENT_BOOL && ok.of.boolean);
    check(lb_tf_reap(echo,&changed));assert(plain_count(echo,false)==1);
    ok=rcall(&p,NULL,"echo-receive",NULL,0);assert(ok.kind==WASMTIME_COMPONENT_BOOL && ok.of.boolean);
    check(lb_tf_reap(echo,&changed));assert(!plain_count(echo,false));
    step(&a,ctx);wasmtime_component_func_t req=lookup(inst,ctx,"echo-request");step(&req,ctx);
    for(unsigned t=0;plain_count(echo,false);t++){
        assert(t<2000);check(lb_tf_advance(echo,&changed));struct timespec delay={0,1000000};nanosleep(&delay,NULL);
    }
    ok=rcall(&p,NULL,"echo-collect",NULL,0);assert(ok.kind==WASMTIME_COMPONENT_BOOL && ok.of.boolean);
    const unsigned channels[]={LB_TG_I_outcome,LB_TG_I_completed,LB_TG_I_accept};
    for(unsigned mode=0;mode<3;mode++)for(unsigned phase=0;phase<3;phase++){
        lb_tf_driver *d=&h->tasks.rows[channels[mode]].future;RV arg=ru32(mode);
        check(wasmtime_component_func_call(&start,ctx,&arg,1,NULL,0));assert(plain_count(d,false)==1);
        if(phase!=2)plain_ready(d,1);
        step(phase?&discard:&receive,ctx);
        for(unsigned t=0;plain_count(d,false);t++){
            assert(t<2000);check(lb_tf_advance(d,&changed));struct timespec delay={0,1000000};nanosleep(&delay,NULL);
        }
    }
    /* Terminal shutdown with two live readers: one blocked writer holding a
       copied original, and another source started but not yet polled. */
    wasmtime_component_func_t release=lookup(inst,ctx,"echo-release-original"),release2=lookup(inst,ctx,"echo-other-release-original");
    step(&a,ctx);step(&release,ctx);plain_ready(echo,1);step(&b,ctx);step(&release2,ctx);
    assert(plain_count(echo,false)==2 && plain_count(echo,true)==1);
    check(lb_tg_retire_all(&h->tasks));assert(!plain_count(echo,false));
    puts("canonical object tasks: 65 immediate factory rejections, returned errors, both u32 bounds, independent readers and early drops");
}
