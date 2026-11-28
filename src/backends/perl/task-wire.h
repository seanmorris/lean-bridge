/* Only generated XS owns these pointers. A Perl object carries unforgeable
   per-image magic rather than an integer, symbol name or writable handle. */
#include <unistd.h>
typedef int (*lbs_close_fn)(uint64_t *);
typedef struct {
    uint64_t handle[2];
    int gate[2];
    unsigned method;
    pid_t pid;
    PerlInterpreter *interpreter;
    lbs_close_fn close;
} lbs_owner;

static void lbs_drop(lbs_owner *o) {
    LBS_WAIT_CLOSE(o->gate);
    if (o->handle[0]) o->close(o->handle);
}
static int lbs_free(pTHX_ SV *sv, MAGIC *mg) {
    (void)sv;
    lbs_owner *o=(lbs_owner *)mg->mg_ptr;
    if (o && o->interpreter==LBP_CONTEXT) {
        if (o->pid==getpid()) lbs_drop(o);
        Safefree(o);
    }
    mg->mg_ptr=NULL;
    return 0;
}
static MGVTBL lbs_magic={.svt_free=lbs_free};
static SV *lbs_new_owner(pTHX_ const char *klass, unsigned method, lbs_close_fn closefn, lbs_owner **out) {
    SV *referent=sv_2mortal(newSV(0));
    SV *rv=sv_2mortal(newRV_inc(referent));
    sv_bless(rv,gv_stashpv(klass,GV_ADD));
    MAGIC *mg=sv_magicext(referent,NULL,PERL_MAGIC_ext,&lbs_magic,NULL,0);
    lbs_owner *o; Newxz(o,1,lbs_owner);
    mg->mg_ptr=(char *)o;
    o->method=method; o->pid=getpid(); o->interpreter=LBP_CONTEXT;
    o->close=closefn; o->gate[0]=o->gate[1]=-1;
    *out=o; return rv;
}
static lbs_owner *lbs_owner_for(pTHX_ SV *rv, unsigned method) {
    lbp_check_interpreter(aTHX);
    MAGIC *mg=SvROK(rv) && SvMAGICAL(SvRV(rv)) ? mg_findext(SvRV(rv),PERL_MAGIC_ext,&lbs_magic) : NULL;
    lbs_owner *o=mg ? (lbs_owner *)mg->mg_ptr : NULL;
    if (!o || o->method!=method || o->pid!=getpid() || o->interpreter!=LBP_CONTEXT)
        croak("Invalid, foreign or mismatched Lean asynchronous owner");
    return o;
}
static SV *lbs_ready(pTHX_ lbs_owner *o, int (*poll)(uint64_t *,int *), const char *name) {
    int source=-1, status=poll(o->handle,&source);
    if (!status) return &PL_sv_undef;
    if (status==1 && source>=0) {
        if (o->gate[0]<0) status=LBS_WAIT_OPEN(source,-1,o->gate); else status=0;
        if (!status) return sv_2mortal(newSViv(o->gate[0]));
    }
    croak("Lean bridge failure in %s (readiness status %d)",name,status);
}
