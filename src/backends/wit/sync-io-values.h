/* Private native-host marshalling. w[0..3] is the generated C wire, never
   exposed to a WIT caller. An output owns Wasmtime allocations, not Lean ones. */
_Static_assert(sizeof(uintptr_t)==8 && sizeof(size_t)==8, "WIT IO native host requires 64-bit pointers");
enum lb_kind { LB_UNIT, LB_BOOL, LB_CHAR, LB_STRING, LB_BYTES, LB_NAT, LB_INT,
    LB_UINT8, LB_UINT16, LB_UINT32, LB_UINT64, LB_USIZE,
    LB_INT8, LB_INT16, LB_INT32, LB_INT64, LB_ISIZE, LB_FLOAT32, LB_FLOAT64 };
enum lb_decode { LB_GOOD, LB_MALFORMED, LB_OVER_BUDGET };
typedef wasmtime_component_val_t lb_val;
static bool lb_unicode(uint64_t v) { return v<=0x10ffff && !(0xd800<=v && v<=0xdfff); }
static bool lb_input(enum lb_kind k, const lb_val *v, lb_scope *s, uint64_t *w) {
    if (!lb_buffer(v,1,sizeof(*v),_Alignof(lb_val)) || !lb_charge(s,1,sizeof(*v))) return false;
    uint64_t bits=0;
#define LB_VALUE(K,T,F) case LB_##K: if (v->kind!=WASMTIME_COMPONENT_##T) return false; bits=(uint64_t)v->of.F; break;
    switch (k) {
    LB_VALUE(UINT8,U8,u8) LB_VALUE(UINT16,U16,u16) LB_VALUE(UINT32,U32,u32) LB_VALUE(UINT64,U64,u64) LB_VALUE(USIZE,U64,u64)
    LB_VALUE(INT8,S8,s8) LB_VALUE(INT16,S16,s16) LB_VALUE(INT32,S32,s32) LB_VALUE(INT64,S64,s64) LB_VALUE(ISIZE,S64,s64)
    case LB_FLOAT32: if (v->kind!=WASMTIME_COMPONENT_F32) return false; memcpy(&bits,&v->of.f32,4); break;
    case LB_FLOAT64: if (v->kind!=WASMTIME_COMPONENT_F64) return false; memcpy(&bits,&v->of.f64,8); break;
    case LB_CHAR: if (v->kind!=WASMTIME_COMPONENT_CHAR || !lb_unicode(v->of.character)) return false; bits=v->of.character; break;
    case LB_UNIT: if (v->kind!=WASMTIME_COMPONENT_ENUM || !lb_name(&v->of.enumeration,"unit")) return false; break;
    case LB_BOOL: {
        bool b; if (v->kind!=WASMTIME_COMPONENT_BOOL || !lb_boolean(&v->of.boolean,&b)) return false;
        bits=b; break;
    }
    case LB_STRING: {
        if (v->kind!=WASMTIME_COMPONENT_STRING || !lb_charge(s,v->of.string.size,1) || !lb_utf8(v->of.string.data,v->of.string.size)) return false;
        if (w) { w[0]=(uintptr_t)v->of.string.data; w[1]=v->of.string.size; } return true;
    }
    case LB_BYTES: case LB_INT: case LB_NAT: {
        bool neg=false;
        if (k==LB_INT) {
            const wasmtime_component_valrecord_entry_t *r;
            if (v->kind!=WASMTIME_COMPONENT_RECORD || v->of.record.size!=2 ||
                !lb_buffer(r=v->of.record.data,2,sizeof(*r),_Alignof(wasmtime_component_valrecord_entry_t)) ||
                !lb_name(&r[0].name,"negative") || !lb_name(&r[1].name,"limbs") ||
                r[0].val.kind!=WASMTIME_COMPONENT_BOOL || !lb_boolean(&r[0].val.of.boolean,&neg)) return false;
            v=&r[1].val;
        }
        if (v->kind!=WASMTIME_COMPONENT_LIST) return false;
        size_t n=v->of.list.size; const lb_val *items=v->of.list.data;
        if (!lb_buffer(items,n,sizeof(*items),_Alignof(lb_val)) || !lb_charge(s,n,sizeof(*items)+(k==LB_BYTES?1:8))) return false;
        if (k==LB_BYTES) {
            uint8_t *data=w&&n?lb_alloc(s,n,1):NULL; if (w && n && !data) return false;
            for (size_t i=0;i<n;i++) { if (items[i].kind!=WASMTIME_COMPONENT_U8) return false; if (w) data[i]=items[i].of.u8; }
            if (w) { w[0]=(uintptr_t)data; w[1]=n; }
        } else {
            size_t count=(n+1)/2;
            uint64_t *data=w&&n?lb_alloc(s,count,8):NULL; if (w && n && !data) return false;
            for (size_t i=0;i<n;i++) { if (items[i].kind!=WASMTIME_COMPONENT_U32) return false; if (w) data[i/2]|=(uint64_t)items[i].of.u32<<((i%2)*32); }
            if ((!n && neg) || (n && !items[n-1].of.u32)) return false;
            if (w) { w[0]=(uintptr_t)data; w[1]=count; w[2]=neg; }
        }
        return true;
    }
    default: return false;
    }
#undef LB_VALUE
    if (w) w[0]=bits;
    return true;
}
static inline int lb_result(lb_val *out, bool ok, lb_val **child, lb_scope *s) {
    if (!lb_charge(s,1,sizeof(lb_val))) return LB_OVER_BUDGET;
    lb_val empty={0}; *child=wasmtime_component_val_new(&empty);
    if (!*child) return LB_OVER_BUDGET;
    out->kind=WASMTIME_COMPONENT_RESULT; out->of.result.is_ok=ok; out->of.result.val=*child;
    return LB_GOOD;
}
static int lb_output(enum lb_kind k, const uint64_t *w, lb_scope *s, lb_val *o) {
    if (!lb_charge(s,1,sizeof(*o))) return LB_OVER_BUDGET;
    if (k==LB_STRING || k==LB_BYTES) {
        size_t n=w[1]; const uint8_t *p=(const uint8_t *)(uintptr_t)w[0];
        if (w[3]!=1 || w[2] || !lb_buffer(p,n,1,1)) return LB_MALFORMED;
        if (!lb_charge(s,n,k==LB_BYTES?sizeof(lb_val):1)) return LB_OVER_BUDGET;
        if (k==LB_STRING) {
            if (!lb_utf8((const char *)p,n)) return LB_MALFORMED;
            o->kind=WASMTIME_COMPONENT_STRING; wasm_name_new(&o->of.string,n,p?(const char *)p:"");
        } else {
            o->kind=WASMTIME_COMPONENT_LIST; wasmtime_component_vallist_new_uninit(&o->of.list,n);
            for (size_t i=0;i<n;i++) o->of.list.data[i]=(lb_val){.kind=WASMTIME_COMPONENT_U8,.of.u8=p[i]};
        }
        return LB_GOOD;
    }
    if (k==LB_NAT || k==LB_INT) {
        size_t n=w[1]; const uint64_t *p=(const uint64_t *)(uintptr_t)w[0];
        if (w[3]!=2 || w[2]>(uint64_t)(k==LB_INT) || (!n && w[2]) || !lb_buffer(p,n,8,_Alignof(uint64_t))) return LB_MALFORMED;
        if (!lb_charge(s,n,2*sizeof(lb_val))) return LB_OVER_BUDGET;
        if (n && !p[n-1]) return LB_MALFORMED;
        size_t limbs=2*n-(n && !(p[n-1]>>32));
        if (k==LB_INT) {
            if (!lb_charge(s,2,sizeof(wasmtime_component_valrecord_entry_t))) return LB_OVER_BUDGET;
            o->kind=WASMTIME_COMPONENT_RECORD; wasmtime_component_valrecord_new_uninit(&o->of.record,2);
            wasmtime_component_valrecord_entry_t *r=o->of.record.data; memset(r,0,2*sizeof(*r));
            wasm_name_new(&r[0].name,8,"negative"); r[0].val=(lb_val){.kind=WASMTIME_COMPONENT_BOOL,.of.boolean=w[2]!=0};
            wasm_name_new(&r[1].name,5,"limbs"); o=&r[1].val;
        }
        o->kind=WASMTIME_COMPONENT_LIST; wasmtime_component_vallist_new_uninit(&o->of.list,limbs);
        for (size_t i=0;i<limbs;i++) o->of.list.data[i]=(lb_val){.kind=WASMTIME_COMPONENT_U32,.of.u32=(uint32_t)(p[i/2]>>((i%2)*32))};
        return LB_GOOD;
    }
    uint64_t v=w[0]; if (w[1] || w[2] || w[3]) return LB_MALFORMED;
#define LB_SCALAR(K,T,F,C) case LB_##K: if ((uint64_t)(C)v!=v) return LB_MALFORMED; o->kind=WASMTIME_COMPONENT_##T; o->of.F=(C)v; break;
    switch (k) {
    LB_SCALAR(UINT8,U8,u8,uint8_t) LB_SCALAR(UINT16,U16,u16,uint16_t) LB_SCALAR(UINT32,U32,u32,uint32_t)
    LB_SCALAR(UINT64,U64,u64,uint64_t) LB_SCALAR(USIZE,U64,u64,uint64_t)
    LB_SCALAR(INT8,S8,s8,int8_t) LB_SCALAR(INT16,S16,s16,int16_t) LB_SCALAR(INT32,S32,s32,int32_t)
    LB_SCALAR(INT64,S64,s64,int64_t) LB_SCALAR(ISIZE,S64,s64,int64_t)
    case LB_UNIT: if (v) return LB_MALFORMED; o->kind=WASMTIME_COMPONENT_ENUM; wasm_name_new(&o->of.enumeration,4,"unit"); break;
    case LB_BOOL: if (v>1) return LB_MALFORMED; o->kind=WASMTIME_COMPONENT_BOOL; o->of.boolean=v!=0; break;
    case LB_CHAR: if (!lb_unicode(v)) return LB_MALFORMED; o->kind=WASMTIME_COMPONENT_CHAR; o->of.character=(uint32_t)v; break;
    case LB_FLOAT32: if (v>UINT32_MAX) return LB_MALFORMED; o->kind=WASMTIME_COMPONENT_F32; memcpy(&o->of.f32,&v,4); break;
    case LB_FLOAT64: o->kind=WASMTIME_COMPONENT_F64; memcpy(&o->of.f64,&v,8); break;
    default: return LB_MALFORMED;
    }
#undef LB_SCALAR
    return LB_GOOD;
}
