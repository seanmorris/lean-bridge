/* Compiled into the shared Runtime.xs, never separately into components.
   Only the Perl owner releases SV references. Lean finalizers free retired
   C records and never call Perl, even if Lean drops a stale value on a worker. */
#include "host-domain.h"
#include <stdatomic.h>
typedef struct phd_kind phd_kind;
typedef struct phd_anchor { SV *target; struct phd_anchor *next; } phd_anchor;
typedef struct phd_row {
  struct phd_row *next;
  phd_kind *kind;
  SV *target; /* the referent, not the caller's mutable scalar */
  phd_anchor *anchors;
  lean_object *wrapper;
  int admitted;
} phd_row;
struct phd_kind {
  phd_kind *next;
  phd_row *rows;
  char key[65];
  HV *stash;
  size_t users;
  int strong;
};
struct lbp_host_session {
  size_t count, depth;
  pid_t pid;
  PerlInterpreter *interpreter;
  pthread_t thread;
  phd_kind *kinds[];
};
static phd_kind *phd_kinds;
static lean_external_class *phd_tag;
static size_t phd_live;
static int phd_busy;
static void phd_finalize(void *data) { free(data); }
static void phd_foreach(void *data, b_lean_obj_arg f) { (void)data; (void)f; }
static void phd_check(pTHX) {
  lbp_check_interpreter(aTHX);
  if (phd_busy) croak("Perl host identity cleanup in progress");
}
static void phd_sweep(pTHX_ phd_kind *k, int all) {
  phd_row **p=&k->rows;
  while (*p) {
    phd_row *v=*p;
    int rc=atomic_load_explicit(lean_get_rc_mt_addr(v->wrapper),memory_order_acquire);
    if (!all && (v->admitted || (rc!=1 && rc!=-1))) { p=&v->next; continue; }
    *p=v->next; v->kind=NULL; --phd_live;
    /* Reentry from Perl DESTROY cannot see a partially retired kind. */
    while (v->anchors) {
      phd_anchor *a=v->anchors; v->anchors=a->next;
      SV *target=a->target; free(a); SvREFCNT_dec(target);
    }
    SvREFCNT_dec(v->target); v->target=NULL;
    lean_dec(v->wrapper);
  }
}
static void phd_release(pTHX_ lbp_host_session *s) {
  while (s->count) {
    phd_kind *k=s->kinds[--s->count]; if (--k->users) continue;
    phd_kind **p=&phd_kinds; while (*p!=k) p=&(*p)->next;
    *p=k->next; phd_sweep(aTHX_ k,1); SvREFCNT_dec((SV *)k->stash); free(k);
  }
  free(s);
}
typedef struct { lbp_host_session *s; } phd_bind_guard;
static void phd_rollback(pTHX_ void *data) {
  phd_bind_guard *g=data;
  if (g->s) phd_release(aTHX_ g->s);
  free(g);
}
void lbp_host_bind(pTHX_ lbp_host_session **slot, const lbp_host_spec *spec, size_t n, const char *const *classes) {
  phd_check(aTHX);
  if (*slot || !n || n>64) croak("invalid or already bound Perl host session");
  if (!phd_tag) phd_tag=lean_register_external_class(phd_finalize,phd_foreach);
  ENTER; SAVEINT(phd_busy); phd_busy=1; SSGROW(4);
  phd_bind_guard *g=calloc(1,sizeof(*g)); if (!g) croak("cannot allocate bind guard");
  SAVEDESTRUCTOR_X(phd_rollback,g);
  lbp_host_session *s=g->s=calloc(1,sizeof(*s)+n*sizeof(phd_kind *));
  if (!s) croak("cannot allocate Perl host session");
  s->pid=getpid(); s->interpreter=LBP_CONTEXT; s->thread=pthread_self();
  for (size_t i=0;i<n;++i) {
    const char *key=spec[i].key;
    if (!key || strlen(key)!=64 || strspn(key,"0123456789abcdef")!=64 ||
        (spec[i].strong!=0 && spec[i].strong!=1)) croak("invalid Perl host kind");
    for (size_t j=0;j<i;++j) if (!strcmp(s->kinds[j]->key,key)) croak("duplicate Perl host kind");
    HV *stash=classes[i] ? gv_stashpv(classes[i],0) : NULL;
    if (!stash || !HvNAME(stash)) croak("unknown Perl host class");
    phd_kind *k=phd_kinds;
    while (k && strcmp(k->key,key)) k=k->next;
    if (k && (k->stash!=stash || k->strong!=spec[i].strong)) croak("incompatible Perl host kind binding");
    if (!k) {
      k=calloc(1,sizeof(*k)); if (!k) croak("cannot allocate Perl host kind");
      memcpy(k->key,key,65); k->strong=spec[i].strong; k->stash=(HV *)SvREFCNT_inc((SV *)stash);
      k->next=phd_kinds; phd_kinds=k;
    }
    ++k->users; s->kinds[s->count++]=k;
  }
  *slot=s; g->s=NULL; LEAVE;
}
void lbp_host_unbind(pTHX_ lbp_host_session **slot) {
  phd_check(aTHX); lbp_host_session *s=*slot;
  if (!s || s->depth) croak("missing or active Perl host binding");
  ENTER; SAVEINT(phd_busy); phd_busy=1;
  *slot=NULL; phd_release(aTHX_ s); LEAVE;
}
static void phd_leave(pTHX_ void *data) {
  lbp_host_session *s=data;
  /* A child inherits the save stack but must never mutate the parent's Lean
     objects or enter inherited allocator locks when unwinding. */
  if (s->pid!=getpid() || s->interpreter!=LBP_CONTEXT || !pthread_equal(s->thread,pthread_self())) return;
  ENTER; SAVEINT(phd_busy); phd_busy=1;
  for (size_t i=0;i<s->count;++i) phd_sweep(aTHX_ s->kinds[i],0);
  --s->depth; LEAVE;
}
void lbp_host_enter(pTHX_ lbp_host_session *s) {
  phd_check(aTHX); if (!s) croak("no active Perl host binding");
  SSGROW(4); SAVEDESTRUCTOR_X(phd_leave,s); ++s->depth;
}
static phd_kind *phd_kind_at(pTHX_ lbp_host_session *s, unsigned i) {
  phd_check(aTHX);
  if (!s || !s->depth || i>=s->count) croak("unknown or inactive Perl host kind");
  return s->kinds[i];
}
static phd_row *phd_read(pTHX_ lbp_host_session *s, unsigned i, b_lean_obj_arg o) {
  phd_kind *k=phd_kind_at(aTHX_ s,i);
  if (o && !lean_is_scalar(o) && lean_is_external(o) && lean_get_external_class(o)==phd_tag) {
    phd_row *v=lean_get_external_data(o); if (v->kind==k) return v;
  }
  croak("stale, foreign or wrong-kind Perl host reference");
}
lean_object *lbp_host_wrap(pTHX_ lbp_host_session *s, unsigned i, SV *obj, SV *anchor) {
  phd_kind *k=phd_kind_at(aTHX_ s,i);
  SvGETMAGIC(obj);
  if (!SvROK(obj) || !SvOBJECT(SvRV(obj)) || !sv_derived_from(obj,HvNAME(k->stash)))
    croak("wrong nominal Perl host object");
  if (anchor && !SvROK(anchor)) croak("invalid Perl host borrow anchor");
  SV *target=SvRV(obj); phd_row *v=k->rows;
  while (v && v->target!=target) v=v->next;
  if (!v) {
    v=calloc(1,sizeof(*v)); if (!v) croak("cannot allocate Perl host object");
    v->wrapper=lean_alloc_external(phd_tag,v); v->kind=k; v->target=SvREFCNT_inc(target);
    v->next=k->rows; k->rows=v; ++phd_live;
  }
  if (anchor && SvRV(anchor)!=target) {
    phd_anchor *a=v->anchors; while (a && a->target!=SvRV(anchor)) a=a->next;
    if (!a) {
      a=malloc(sizeof(*a)); if (!a) croak("cannot retain Perl host borrow anchor");
      a->target=SvREFCNT_inc(SvRV(anchor)); a->next=v->anchors; v->anchors=a;
    }
  }
  lean_inc(v->wrapper); return v->wrapper;
}
void lbp_host_admit(pTHX_ lbp_host_session *s, unsigned i, b_lean_obj_arg o) {
  phd_row *v=phd_read(aTHX_ s,i,o); if (v->kind->strong) v->admitted=1;
}
SV *lbp_host_object(pTHX_ lbp_host_session *s, unsigned i, b_lean_obj_arg o) {
  phd_row *v=phd_read(aTHX_ s,i,o);
  SV *value=sv_2mortal(newRV_inc(v->target));
  if (!SvOBJECT(v->target) || !sv_derived_from(value,HvNAME(v->kind->stash)))
    croak("Perl host object no longer has its bound class");
  return value;
}
size_t lbp_host_live(pTHX) { phd_check(aTHX); return phd_live; }
