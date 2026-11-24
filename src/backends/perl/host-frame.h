/* Component-private ingress for synchronous application-owned Perl members.
   Include once in the XS translation unit. The verified shared runtime checks
   the initiating interpreter/thread before entering a fresh Perl scope. */
#ifndef LEAN_BRIDGE_PERL_HOST_FRAME_H
#define LEAN_BRIDGE_PERL_HOST_FRAME_H
#include "EXTERN.h"
#include "perl.h"
#include "XSUB.h"
#include <lean/lean.h>
#include <unistd.h>

typedef lean_object *(*ph_body)(pTHX_ void *);
typedef struct {
    ph_body body;
    void *data;
    lean_object *answer;
    SV *replacement;
    int finished;
} ph_invocation;
typedef struct ph_fault {
    lean_object *error;
    SV *original;
    struct ph_fault *next;
} ph_fault;
typedef struct ph_frame {
    PerlInterpreter *interpreter;
    pid_t pid;
    SV *binding;
    CV *trampoline;
    ph_fault *faults;
    unsigned count;
    int failed;
    ph_invocation *pending;
    struct ph_frame *parent;
} ph_frame;
static _Thread_local ph_frame *ph_active;

XS_INTERNAL(ph_invoke_xs) {
    dXSARGS;
    ph_frame *f = ph_active;
    if (items || !f || !f->pending || cv != f->trampoline || f->pid != getpid())
        croak("no pending Perl host member");
    ph_invocation *i = f->pending;
    f->pending = NULL;
    /* Both marshalling directions and destructors for temporary Perl values
       execute inside G_EVAL, never by longjmp through Lean. */
    ENTER; SAVETMPS;
    i->replacement = newSVpvs("");
    i->answer = i->body(aTHX_ i->data);
    FREETMPS; LEAVE;
    i->finished = 1;
    XSRETURN_EMPTY;
}

static void ph_end(pTHX_ void *data) {
    ph_frame *f = data;
    ph_active = f->parent;
    while (f->faults) {
        ph_fault *p = f->faults; f->faults = p->next;
        lean_dec(p->error); SvREFCNT_dec(p->original); free(p);
    }
    SvREFCNT_dec((SV *)f->trampoline); SvREFCNT_dec(f->binding);
    free(f);
}

/* Called only at XS ingress (after ENTER/SAVETMPS and owner validation),
   before entering Lean. Perl's scope restores $@ and the parent on croak. */
static ph_frame *ph_enter(pTHX_ SV *binding) {
    save_scalar(PL_errgv);
    SSGROW(4);
    ph_frame *f = calloc(1, sizeof(*f));
    if (!f) croak("cannot allocate Perl host frame");
    f->parent = ph_active;
    SAVEDESTRUCTOR_X(ph_end, f);
    f->pid = getpid();
#ifdef MULTIPLICITY
    f->interpreter = aTHX;
#endif
    f->binding = SvREFCNT_inc(binding);
    f->trampoline = newXS(NULL, ph_invoke_xs, __FILE__);
    ph_active = f;
    return f;
}
static lean_object *ph_error(const char *s) {
    return lean_io_result_mk_error(lean_mk_io_user_error(lean_mk_string(s)));
}
static lean_object *ph_call(ph_body body, void *data) {
    ph_frame *f = ph_active;
    if (!f || f->pid != getpid()) return ph_error("no active Perl host binding");
#ifdef MULTIPLICITY
    if ((PerlInterpreter *)PERL_GET_CONTEXT != f->interpreter)
        return ph_error("no active Perl host binding");
#endif
    /* Reserve capacity for a new distinct failure before running a method
       with application-visible effects. Never silently forget an old cause. */
    if (f->failed || f->count >= 64) {
        f->failed = 1; return ph_error("Perl host frame unavailable");
    }
    dTHXa(f->interpreter);
    dSP;
    ph_invocation i = {.body = body, .data = data};
    f->pending = &i;
    PUSHMARK(SP); PUTBACK;
    int count = call_sv((SV *)f->trampoline, G_VOID | G_EVAL);
    SPAGAIN; SP -= count; PUTBACK;
    f->pending = NULL;
    int thrown = SvROK(ERRSV) || SvTRUE(ERRSV);
    if (i.finished && i.answer && !thrown) {
        SvREFCNT_dec(i.replacement);
        return lean_io_result_mk_ok(i.answer);
    }
    if (i.answer) lean_dec(i.answer);
    /* Keep only concrete IO.Error identities. An equal message is not proof
       that Lean rethrew this exception; a catch may have replaced the error. */
    ph_fault *p = thrown && i.replacement ? malloc(sizeof(*p)) : NULL;
    if (!p) {
        f->failed = 1; SvREFCNT_dec(i.replacement);
        return ph_error("could not retain Perl host failure");
    }
    lean_object *err = lean_mk_io_user_error(lean_mk_string("Perl host member failed"));
    p->original = GvSV(PL_errgv); GvSV(PL_errgv) = i.replacement;
    lean_inc(err); p->error = err; p->next = f->faults; f->faults = p; ++f->count;
    return lean_io_result_mk_error(err);
}
/* Borrowed until the ingress scope unwinds; only consult after Lean returns.
   The outer boundary must reject f->failed even if Lean caught the error. */
static SV *ph_original(ph_frame *f, b_lean_obj_arg err) {
    for (ph_fault *p = f->faults; p; p = p->next)
        if (p->error == err) return p->original;
    return NULL;
}
#endif
