/* Included only in the generated XS for class-bearing Perl workers. Never
   hand an SV, interpreter pointer, or public writable token to a Lean task. */
typedef struct {
    pid_t pid;
    PerlInterpreter *interp;
    unsigned kind;
    uint64_t token[2];
} phw_pin;

static void phw_end(pTHX_ void *arg) {
    PERL_UNUSED_CONTEXT;
    if (getpid()==(pid_t)(intptr_t)arg) { phw_retire_all(); (void)PHW_END(); }
}

static void phw_guard_end(pTHX_ void *arg) {
    phw_pin *p=arg;
    if (p->pid==getpid() && p->interp==LBP_CONTEXT && p->token[0])
        (void)PHW_RELEASE(phw_keys[p->kind],p->token);
    free(p);
}

/* Called inside an entered host session. Leave the provisional lease on
   Perl's save stack so a later bad argument or magical fetch unwinds it. */
static void phw_input(pTHX_ unsigned i,SV *obj,uint64_t out[3]) {
    lbp_check_interpreter(aTHX);
    if (i>=PH_KIND_COUNT) croak("unknown Perl worker kind");
    SSGROW(8);
    phw_pin *p=calloc(1,sizeof(*p));
    if (!p) croak("cannot allocate Perl worker argument");
    p->pid=getpid(); p->interp=LBP_CONTEXT; p->kind=i;
    SAVEDESTRUCTOR_X(phw_guard_end,p);
    lean_object *v=lbp_host_wrap(aTHX_ ph_session,i,obj,NULL);
    SAVEDESTRUCTOR_X(ph_drop_lean,v);
    lean_mark_mt(v);
    if (PHW_CREATE(phw_keys[i],v,p->token)!=0) croak("unavailable Perl worker lease");
    out[0]=p->token[0]; out[1]=p->token[1]; out[2]=0;
}
static void phw_admit(pTHX_ unsigned i,const uint64_t in[3]) {
    if (i>=PH_KIND_COUNT) croak("unknown Perl worker kind");
    lbp_host_admit(aTHX_ ph_session,i,PHW_BORROW(phw_keys[i],in));
}
/* The output buffer keeps its own lease until its XS cleanup guard runs.
   Build the independent Perl reference before dropping that lease. */
static SV *phw_output(pTHX_ unsigned i,const uint64_t out[4]) {
    if (i>=PH_KIND_COUNT || out[3]!=(uint64_t)(3+i)) croak("invalid Perl worker result kind");
    return lbp_host_object(aTHX_ ph_session,i,PHW_BORROW(phw_keys[i],out));
}
