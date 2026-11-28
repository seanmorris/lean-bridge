/* Exercise the public Component Model union layout, not native wire words. */
static void limbs(V *v,const uint32_t *want,size_t n) {
    CHECK(v->kind==WASMTIME_COMPONENT_LIST && v->of.list.size==n);
    for (size_t i=0;i<n;i++) CHECK(v->of.list.data[i].kind==WASMTIME_COMPONENT_U32 && v->of.list.data[i].of.u32==want[i]);
}
static void scalar_checks(const char *msg,size_t len) {
#define RT(NAME,KIND,FIELD,X) do { \
    V a={.kind=WASMTIME_COMPONENT_##KIND,.of.FIELD=(X)}; V b=call("rt-" NAME,&a,1); \
    CHECK(b.kind==a.kind && !memcmp(&b.of.FIELD,&a.of.FIELD,sizeof(a.of.FIELD))); wasmtime_component_val_delete(&b); \
} while (0)
    RT("bool",BOOL,boolean,true); RT("char",CHAR,character,0x1f5dd);
    RT("uint8",U8,u8,UINT8_MAX); RT("int8",S8,s8,INT8_MIN);
    RT("uint16",U16,u16,UINT16_MAX); RT("int16",S16,s16,INT16_MIN);
    RT("uint32",U32,u32,UINT32_MAX); RT("int32",S32,s32,INT32_MIN);
    RT("uint64",U64,u64,UINT64_MAX); RT("int64",S64,s64,INT64_MIN);
    RT("usize",U64,u64,UINT64_MAX); RT("isize",S64,s64,INT64_MIN);
    RT("float32",F32,f32,-0.0f); RT("float64",F64,f64,-3.141592653589793);
#undef RT
    V u={.kind=WASMTIME_COMPONENT_ENUM}; wasm_name_new(&u.of.enumeration,4,"unit");
    V out=call("rt-unit",&u,1); CHECK(out.kind==u.kind && out.of.enumeration.size==4 && !memcmp(out.of.enumeration.data,"unit",4));
    wasmtime_component_val_delete(&out); wasmtime_component_val_delete(&u);
    V st=str(msg,len); out=call("rt-string",&st,1); text(&out,msg,len); wasmtime_component_val_delete(&out);
    V bs[2]={{.kind=WASMTIME_COMPONENT_U8,.of.u8=255},{.kind=WASMTIME_COMPONENT_U8,.of.u8=0}};
    V bytes={.kind=WASMTIME_COMPONENT_LIST,.of.list={.size=2,.data=bs}};
    out=call("rt-bytes",&bytes,1);
    CHECK(out.kind==bytes.kind && out.of.list.size==2 && out.of.list.data[0].of.u8==255 && !out.of.list.data[1].of.u8);
    wasmtime_component_val_delete(&out);
    const uint32_t ns[]={UINT32_MAX,0x80000000,17}; V items[3];
    for (size_t i=0;i<3;i++) items[i]=(V){.kind=WASMTIME_COMPONENT_U32,.of.u32=ns[i]};
    V nat={.kind=WASMTIME_COMPONENT_LIST,.of.list={.size=3,.data=items}};
    out=call("rt-nat",&nat,1); limbs(&out,ns,3); wasmtime_component_val_delete(&out);
    wasmtime_component_valrecord_entry_t fields[2]={0};
    wasm_name_new(&fields[0].name,8,"negative"); fields[0].val=boolean(true);
    wasm_name_new(&fields[1].name,5,"limbs"); fields[1].val=nat;
    V integer={.kind=WASMTIME_COMPONENT_RECORD,.of.record={.size=2,.data=fields}};
    out=call("rt-int",&integer,1);
    CHECK(out.kind==integer.kind && out.of.record.size==2 && out.of.record.data[0].val.of.boolean);
    limbs(&out.of.record.data[1].val,ns,3); wasmtime_component_val_delete(&out);
    for (unsigned fail=0;fail<2;fail++) for (unsigned tag=0;tag<3;tag++) {
        V args[]={boolean(fail),{.kind=WASMTIME_COMPONENT_U8,.of.u8=tag},integer,st,bytes};
        out=call("nested",args,5); V *outer=arm(arm(&out,!fail),tag==0);
        if (!tag) text(outer,msg,len);
        else {
            V *inner=arm(outer,tag==1);
            if (tag==1) { CHECK(inner->kind==integer.kind && inner->of.record.data[0].val.of.boolean); limbs(&inner->of.record.data[1].val,ns,3); }
            else CHECK(inner->kind==bytes.kind && inner->of.list.size==2 && inner->of.list.data[0].of.u8==255);
        }
        wasmtime_component_val_delete(&out);
    }
    fields[1].val.of.list.size=0; /* negative zero is never canonical */
    V keep={.kind=WASMTIME_COMPONENT_U8,.of.u8=72};
    wasmtime_error_t *e=API(_wasmtime_call)(s,"rt-int",&integer,1,&keep);
    CHECK(e && keep.kind==WASMTIME_COMPONENT_U8 && keep.of.u8==72); wasmtime_error_delete(e);
    fields[0].val=boolean(false); out=call("rt-int",&integer,1); limbs(&out.of.record.data[1].val,NULL,0);
    wasmtime_component_val_delete(&out);
    wasm_name_delete(&fields[0].name); wasm_name_delete(&fields[1].name); wasmtime_component_val_delete(&st);
}
