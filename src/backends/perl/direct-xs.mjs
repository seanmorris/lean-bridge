/** @file Opaque native owners for immediate, list-context Perl cursors. */
const direct = methods => methods.filter(m => m.delivery === "iterator");

/**
 * Emit only the open, next and close native symbols authenticated for this component.
 *
 * @param methods - Reconciled public declarations and private wire symbols.
 */
export const immediateDeclarations = methods => {
	const selected = direct(methods);
	if(!selected.length) return "";
	return `
#include <unistd.h>
typedef struct lbd_owner {
    uint64_t h[2]; pid_t pid; PerlInterpreter *interp; unsigned method; int (*close)(uint64_t *);
    struct lbd_owner **prev, *next;
} lbd_owner;
static lbd_owner *lbd_live;
static void lbd_unlink(lbd_owner *o) {
    if (o->prev) {
        *o->prev=o->next;
        if (o->next) o->next->prev=o->prev;
        o->next=NULL; o->prev=NULL;
    }
}
static void lbd_link(lbd_owner *o) {
    o->prev=&lbd_live; o->next=lbd_live;
    if (o->next) o->next->prev=&o->next;
    lbd_live=o;
}
static int lbd_free(pTHX_ SV *sv, MAGIC *mg) {
    (void)sv; lbd_owner *o=(lbd_owner *)mg->mg_ptr;
    if (o && o->interp==LBP_CONTEXT) {
        if (o->pid==getpid()) { lbd_unlink(o); if (o->h[0]) o->close(o->h); }
        Safefree(o);
    }
    mg->mg_ptr=NULL; return 0;
}
static MGVTBL lbd_magic={.svt_free=lbd_free};
static SV *lbd_new(pTHX_ const char *klass, unsigned i, int (*close)(uint64_t *), lbd_owner **ptr) {
    SV *s=sv_2mortal(newSV(0)), *rv=sv_2mortal(newRV_inc(s));
    sv_bless(rv,gv_stashpv(klass,GV_ADD));
    MAGIC *mg=sv_magicext(s,NULL,PERL_MAGIC_ext,&lbd_magic,NULL,0);
    lbd_owner *o; Newxz(o,1,lbd_owner); mg->mg_ptr=(char *)o;
    o->pid=getpid(); o->interp=LBP_CONTEXT; o->method=i; o->close=close; *ptr=o; return rv;
}
static lbd_owner *lbd_get(pTHX_ SV *rv, unsigned i) {
    lbp_check_interpreter(aTHX);
    MAGIC *mg=SvROK(rv) && SvMAGICAL(SvRV(rv)) ? mg_findext(SvRV(rv),PERL_MAGIC_ext,&lbd_magic) : NULL;
    lbd_owner *o=mg ? (lbd_owner *)mg->mg_ptr : NULL;
    if (!o || o->interp!=LBP_CONTEXT || o->pid!=getpid() || o->method!=i) croak("Invalid or mismatched Lean cursor");
    return o;
}
${selected.map(({names:n}) => `extern int ${n.open}(const uint64_t *,uint64_t *,uint64_t *,uint8_t *);
extern int ${n.next}(uint64_t *,uint64_t *,uint8_t *);
extern int ${n.close}(uint64_t *);`).join("\n")}`;
};

/**
 * Project a checked constructor and its immediate pull into private XS calls.
 *
 * @param m - Authenticated native cursor and its failure channels.
 * @param ns - Public Perl component namespace.
 * @param index - Method identity stored in the opaque owner.
 * @param input - Encode one checked Perl argument.
 * @param decode - Decode an owned or copied result.
 */
export const immediateXs = (m, ns, index, input, decode) => {
	const args = m.args.map((_,i) => "v"+i), stem = "_lb_direct_"+m.name;
	const frame = `uint8_t tags[${m.tagBytes}]={0}; uint64_t *out; Newxz(out,4,uint64_t); SAVEDESTRUCTOR_X(lbs_clear,out);`;
	const restore = "FREETMPS; LEAVE; SPAGAIN; SP=PL_stack_base+ax-1;";
	const failure = (status,klass,decl,t) => `if (s==${status}) croak_sv(lbs_failure(aTHX_ "${ns}::${klass}",${JSON.stringify(decl)},${decode(t,ns)}));`;
	return `void
${stem}_open(${args.join(", ")})
${args.map(a => "    SV *"+a+"\n").join("")}  PPCODE:
    lbp_check_interpreter(aTHX); ENTER; SAVETMPS; ${frame}
    uint64_t a[${Math.max(1,args.length*3)}]={0};
    ${m.args.map((t,i) => `if (SvGMAGICAL(v${i})) v${i}=sv_mortalcopy(v${i}); ${input(t,i)}`).join("\n    ")}
    lbd_owner *o; SV *rv=lbd_new(aTHX_ "${ns}::Cursor::${m.name}",${index},${m.names.close},&o);
    int s=${m.names.open}(a,o->h,out,tags);
    ${m.error ? failure(m.effect==="EIO"?3:4,m.effect==="EIO"?"Error::"+m.name:"IOError",m.declaration,m.error) : ""}
    if (s || !o->h[0]) croak("Lean cursor open failed (status %d)",s);
    lbd_link(o);
    SV *ret=newSVsv(rv); ${restore} XPUSHs(sv_2mortal(ret));

void
${stem}_next(rv)
    SV *rv
  PPCODE:
    lbd_owner *o=lbd_get(aTHX_ rv,${index});
    if (!o->h[0]) XSRETURN_EMPTY;
    ENTER; SAVETMPS; ${frame}
    int s=${m.names.next}(o->h,out,tags);
    if (!o->h[0]) lbd_unlink(o);
    if (s==2) { ${restore} XSRETURN_EMPTY; }
    ${m.stepIO ? failure(4,"IOError",m.stepDeclaration,"string") : m.terminal ? failure(3,"StepError::"+m.name,m.stepDeclaration,m.terminal) : ""}
    if (s) croak("Lean cursor pull failed (status %d)",s);
    SV *ret=newSVsv(${decode(m.result,ns)}); ${restore} XPUSHs(sv_2mortal(ret));

void
${stem}_close(rv)
    SV *rv
  PPCODE:
    lbd_owner *o=lbd_get(aTHX_ rv,${index});
    if (o->h[0]) { int s=o->close(o->h); if (s) croak("Lean cursor close failed (status %d)",s); }
    lbd_unlink(o);
    XSRETURN_EMPTY;
`;
};

/**
 * The Perl END hook runs this only in the interpreter that initialized the package.
 *
 * @param methods - Reconciled wire declarations; omit the hook for non-cursor packages.
 */
export const immediateShutdown = methods => !direct(methods).length ? "" : `
void
_lb_direct_shutdown()
  PPCODE:
    lbp_check_interpreter(aTHX);
    int failure=0;
    for (lbd_owner *o=lbd_live, *next; o; o=next) {
        next=o->next;
        int s=o->h[0] ? o->close(o->h) : 0;
        if (s) failure=s; else lbd_unlink(o);
    }
    if (failure) croak("Lean cursor shutdown failed (status %d)",failure);
    XSRETURN_EMPTY;
`;

/**
 * Preserve the difference between a yielded undef and an empty result at exhaustion.
 *
 * @param ns - Public Perl component namespace.
 * @param methods - Reconciled public declarations.
 */
export const immediateModules = (ns,methods) => {
	const selected = direct(methods);
	if(!selected.length) return "";
	return `
package ${ns}::_Direct;
my $pid = $$;
sub CLONE { undef $pid; }
END { ${ns}::_lb_direct_shutdown() if defined $pid && $pid == $$ && defined &${ns}::_lb_direct_shutdown; }
${selected.map(m => `package ${ns}::Cursor::${m.name};
sub next {
    my ($it)=@_; die "Use list context for Lean cursor next\\n" unless wantarray;
    local $@; my @value;
    unless (eval { @value=${ns}::_lb_direct_${m.name}_next($it); 1 }) {
        my $error=$@; eval { $it->close }; die $error;
    }
    return @value;
}
sub close { ${ns}::_lb_direct_${m.name}_close($_[0]); }
sub CLONE_SKIP { 1 }
${m.terminal && !m.stepIO ? `package ${ns}::StepError::${m.name}; our @ISA=('${ns}::EIOError');` : ""}
package ${ns};
sub ${m.name} { return _lb_direct_${m.name}_open(@_); }
`).join("\n")}`;
};
