/* A record is a Perl value, not a Lean pointer or a binding-scoped handle.
   The per-component, per-type magic table distinguishes it from anything
   the application can create with bless. Its AV holds ordinary strong Perl
   references. Returned records and getter results may outlive with_hosts. */
typedef struct {
    const char *package;
    unsigned count;
    const int *tags;
    MGVTBL magic;
} phr_type;

static MAGIC *phr_magic(pTHX_ phr_type *t, SV *self) {
    lbp_check_interpreter(aTHX);
    if (SvGMAGICAL(self)) self=sv_mortalcopy(self);
    SV *target=SvROK(self)?SvRV(self):NULL;
    MAGIC *m=target && SvOBJECT(target) && SvSTASH(target)==gv_stashpv(t->package,0) && SvMAGICAL(target)
        ? mg_findext(target,PERL_MAGIC_ext,&t->magic) : NULL;
    if (!m) croak("invalid or foreign Perl host record");
    return m;
}
static AV *phr_borrow(pTHX_ phr_type *t, SV *self) {
    MAGIC *m=phr_magic(aTHX_ t,self);
    if (!m->mg_obj) croak("closed Perl host record");
    /* Later arguments may execute application code which closes the row. */
    return (AV *)sv_2mortal(SvREFCNT_inc(m->mg_obj));
}
static SV *phr_field(pTHX_ AV *fields, unsigned index) {
    SV **item=av_fetch(fields,(SSize_t)index,0);
    if (!item) croak("incomplete Perl host record");
    return *item;
}
static SV *phr_adopt(pTHX_ phr_type *t, AV *fields) {
    if (av_top_index(fields)!=(SSize_t)t->count-1) croak("incomplete Perl host record");
    SV *self=sv_2mortal(newRV_noinc(newSV(0)));
    sv_bless(self,gv_stashpv(t->package,GV_ADD));
    MAGIC *m=sv_magicext(SvRV(self),(SV *)fields,PERL_MAGIC_ext,&t->magic,NULL,0);
    if (!m || !(m->mg_flags&MGf_REFCOUNTED)) croak("cannot retain Perl host record");
    return self;
}
static void phr_close(pTHX_ phr_type *t, SV *self) {
    MAGIC *m=phr_magic(aTHX_ t,self);
    SV *fields=m->mg_obj;
    if (!fields) return;
    /* Make reentrant getters and close calls see the closed state before
       releasing any application object capable of running DESTROY. */
    m->mg_obj=NULL; m->mg_flags&=~MGf_REFCOUNTED; SvREFCNT_dec(fields);
}
static SV *phr_get(pTHX_ phr_type *t, SV *self, unsigned i) {
    SV *v=phr_field(aTHX_ phr_borrow(aTHX_ t,self),i);
    if (t->tags[i]==PH_NAT || t->tags[i]==PH_INT) {
        STRLEN length; const char *digits=ph_integer_bytes(aTHX_ v,t->tags[i]==PH_NAT,&length);
        return lbp_bigint_from_text(aTHX_ digits,length);
    }
    return sv_2mortal(newSVsv(v)); /* Copy scalar storage, not its referent. */
}
static void phr_charge(pTHX_ size_t *budget, size_t n) {
    if (n>*budget) croak("Perl host record exceeds copy budget");
    *budget-=n;
}
/* Charge the compiled representation before allocating the Perl output.
   The frame spans every field; restarting the budget per field would allow
   a partial result to become several oversized individually-valid copies. */
static void phr_charge_value(pTHX_ size_t *budget,int tag,b_lean_obj_arg v) {
    if (tag==PH_BYTES) phr_charge(aTHX_ budget,lean_sarray_size(v));
    else if (tag==PH_STRING) phr_charge(aTHX_ budget,lean_string_size(v)-1);
    else if (tag==PH_INT || tag==PH_NAT) {
        SSGROW(4); lean_inc(v);
        lean_object *s=tag==PH_NAT?PH_NAT_TEXT(v):PH_INT_TEXT(v);
        SAVEDESTRUCTOR_X(ph_drop_lean,s);
        phr_charge(aTHX_ budget,lean_string_size(s)-1);
    }
}
/* XS pins its argument SVs before conversion: overloading BigInt or FETCH
   on a tied scalar can call Perl and relocate the interpreter stack. */
static SV *phr_construct(pTHX_ phr_type *t,SV *class,SV *const *args) {
    lbp_check_interpreter(aTHX);
    if (!SvPOK(class) || SvROK(class) || SvCUR(class)!=strlen(t->package) ||
        memcmp(SvPVX(class),t->package,SvCUR(class))) croak("wrong Perl host record class");
    if (!ph_start()) croak("Lean component unavailable");
    size_t budget=LBS_MAX;
    AV *fields=(AV *)sv_2mortal((SV *)newAV());
    for (unsigned i=0;i<t->count;i++) {
        int tag=t->tags[i];
        SV *arg=args[i];
        if (SvGMAGICAL(arg)) arg=sv_mortalcopy(arg);
        if (tag>=PH_NOMINAL) {
            if (!SvROK(arg) || !SvOBJECT(SvRV(arg))) croak("expected a Perl host object in record");
            av_push(fields,newRV_inc(SvRV(arg)));
        } else {
            SSGROW(4);
            lean_object *value=ph_in(aTHX_ NULL,tag,arg,NULL);
            SAVEDESTRUCTOR_X(ph_drop_lean,value);
            phr_charge_value(aTHX_ &budget,tag,value);
            av_push(fields,newSVsv(ph_out(aTHX_ NULL,tag,value)));
        }
    }
    return phr_adopt(aTHX_ t,fields);
}
static SV *phr_result(pTHX_ phr_type *t,lbp_host_session *s,b_lean_obj_arg v,size_t *budget) {
    AV *fields=(AV *)sv_2mortal((SV *)newAV());
    b_lean_obj_arg owners[64]={0};
    for (unsigned i=0;i<t->count;i++) {
        if (lean_is_scalar(v) || !lean_is_ctor(v) || lean_obj_tag(v)!=0 || lean_ctor_num_objs(v)!=2)
            croak("invalid compiled Perl host record result");
        b_lean_obj_arg field=lean_ctor_get(v,0);
        int tag=t->tags[i];
        phr_charge_value(aTHX_ budget,tag,field);
        av_push(fields,newSVsv(ph_out(aTHX_ s,tag,field)));
        if (tag>=PH_NOMINAL) owners[i]=field;
        v=lean_ctor_get(v,1);
    }
    if (v!=lean_box(0)) croak("invalid compiled Perl host record tail");
    SV *row=phr_adopt(aTHX_ t,fields);
    for (unsigned i=0;i<t->count;i++) if (owners[i]) lbp_host_admit(aTHX_ s,t->tags[i]-PH_NOMINAL,owners[i]);
    return row;
}
