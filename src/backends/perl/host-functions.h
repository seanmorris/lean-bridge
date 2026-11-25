/* Component-private. The callable is a real anonymous Perl CV: ordinary
   coderef invocation and a retained CODE callback use the same entry. The
   creating lexical binding, not the lifetime of the CV, bounds the capture. */
typedef struct phf_lease {
  struct phf_lease *next, **prev;
  lean_object *fn;
  lbp_host_session *owner;
  pid_t pid;
  unsigned site;
} phf_lease;
static phf_lease *phf_live;
static int phf_accepting;
static void phf_drop(phf_lease *v) {
  if (!v->fn) return;
  lean_object *fn=v->fn;
  *v->prev=v->next; if (v->next) v->next->prev=v->prev;
  v->fn=NULL; v->owner=NULL; v->next=NULL; v->prev=NULL;
  lean_dec(fn);
}
static void phf_retire(void) {
  phf_accepting=0;
  while (phf_live) phf_drop(phf_live);
}
static int phf_free(pTHX_ SV *sv,MAGIC *mg) {
  (void)sv; PERL_UNUSED_CONTEXT;
  phf_lease *v=(phf_lease *)mg->mg_ptr; mg->mg_ptr=NULL;
  if (v && v->pid==getpid()) { phf_drop(v); free(v); }
  return 0;
}
#ifdef USE_ITHREADS
/* Clone only the Perl shell, never a reference to the parent's binding. */
static int phf_dup(pTHX_ MAGIC *mg,CLONE_PARAMS *params) {
  PERL_UNUSED_CONTEXT; (void)params; mg->mg_ptr=NULL; mg->mg_len=0; return 0;
}
#endif
static MGVTBL phf_magic={
  .svt_free=phf_free,
#ifdef USE_ITHREADS
  .svt_dup=phf_dup,
#endif
};
static phf_lease *phf_checked(pTHX_ SV *cv,unsigned site) {
  MAGIC *mg=(cv && SvTYPE(cv)==SVt_PVCV && SvMAGICAL(cv))?mg_findext(cv,PERL_MAGIC_ext,&phf_magic):NULL;
  phf_lease *v=mg?(phf_lease *)mg->mg_ptr:NULL;
  if (!v || v->pid!=getpid() || v->site!=site) croak("invalid or foreign returned Perl function");
  return v;
}
static lean_object *phf_retain(pTHX_ CV *cv,unsigned site) {
  phf_lease *v=phf_checked(aTHX_ (SV *)cv,site);
  if (!phf_accepting || !v->fn || v->owner!=ph_session) croak("expired returned Perl function");
  lean_inc(v->fn); return v->fn;
}
static void phf_close(pTHX_ SV *self,unsigned site) {
  lbp_check_interpreter(aTHX);
  phf_lease *v=phf_checked(aTHX_ SvROK(self)?SvRV(self):NULL,site);
  if (!v->fn) return;
  if (v->owner!=ph_session) croak("foreign returned Perl function");
  /* Leave sweeps the host-object domain, including after self-close. */
  ENTER; SAVETMPS; lbp_host_enter(aTHX_ ph_session); phf_drop(v); FREETMPS; LEAVE;
}
static SV *phf_publish(pTHX_ unsigned site,const char *package,XSUBADDR_t apply,lean_object *fn) {
  if (!phf_accepting || !ph_session) croak("closed Perl function binding");
  HV *stash=gv_stashpv(package,GV_ADD);
  CV *cv=newXS(NULL,apply,__FILE__);
  SV *rv=sv_2mortal(newRV_noinc((SV *)cv)); sv_bless(rv,stash);
  MAGIC *mg=sv_magicext((SV *)cv,NULL,PERL_MAGIC_ext,&phf_magic,NULL,0);
#ifdef USE_ITHREADS
  mg->mg_flags|=MGf_DUP;
#endif
  phf_lease *v=calloc(1,sizeof(*v)); if (!v) croak("cannot allocate returned Perl function");
  v->site=site; v->pid=getpid(); v->owner=ph_session;
  lean_inc(fn); v->fn=fn; v->prev=&phf_live; v->next=phf_live;
  if (v->next) v->next->prev=&v->next;
  phf_live=v; mg->mg_ptr=(char *)v; return rv;
}
