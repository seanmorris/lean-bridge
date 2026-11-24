/* Private to the generated XS. Only the lexical with_hosts call can open
   a binding; application code never receives a native token or slot table. */
static lbp_host_session *ph_session;
static SV *ph_slots;
static void ph_unbind_scope(pTHX_ void *data) {
  if (getpid() != (pid_t)(intptr_t)data) return;
  SV *slots=ph_slots; ph_slots=NULL;
  lbp_host_unbind(aTHX_ &ph_session);
  SvREFCNT_dec(slots);
}
static AV *ph_vector(pTHX_ SV *v, SSize_t n) {
  if (!v || !SvROK(v) || SvTYPE(SvRV(v))!=SVt_PVAV || SvMAGICAL(SvRV(v)) ||
      av_top_index((AV *)SvRV(v))!=n-1) croak("invalid captured Perl host binding");
  return (AV *)SvRV(v);
}
static SV *ph_item(pTHX_ AV *a,SSize_t i) {
  SV **v=av_fetch(a,i,0);
  if (!v || SvMAGICAL(*v)) croak("incomplete Perl host binding");
  return *v;
}
static AV *ph_scope(pTHX_ SV *input,SV *body,I32 context) {
  lbp_check_interpreter(aTHX);
  if (ph_session) croak("already bound Perl host session");
  if (!SvROK(body) || SvTYPE(SvRV(body))!=SVt_PVCV) croak("with_hosts requires a code reference");
  AV *out=(AV *)sv_2mortal((SV *)newAV());
  ENTER; SAVETMPS; save_scalar(PL_errgv);
  SV *callback=sv_2mortal(newRV_inc(SvRV(body)));
  dSP; PUSHMARK(SP); XPUSHs(input); PUTBACK;
  int n=call_pv(PH_CAPTURE,G_SCALAR); SPAGAIN;
  if (n!=1) croak("missing captured Perl host binding");
  SV *v=POPs; PUTBACK;
  v=sv_2mortal(SvREFCNT_inc(v));
  AV *pair=ph_vector(aTHX_ v,2), *names=ph_vector(aTHX_ ph_item(aTHX_ pair,0),PH_KIND_COUNT);
  SV *slots=ph_item(aTHX_ pair,1);
  (void)ph_vector(aTHX_ slots,PH_SLOT_COUNT);
  const char *classes[PH_KIND_COUNT];
  for (size_t i=0;i<PH_KIND_COUNT;++i) {
    SV *c=ph_item(aTHX_ names,i);
    if (!SvPOK(c) || SvROK(c) || strlen(SvPVX(c))!=SvCUR(c)) croak("invalid captured Perl host class");
    classes[i]=SvPVX(c);
  }
  lbp_check_interpreter(aTHX);
  if (!ph_start()) croak("Lean component unavailable");
  SSGROW(4);
  lbp_host_bind(aTHX_ &ph_session,ph_specs,PH_KIND_COUNT,classes);
  SAVEDESTRUCTOR_X(ph_unbind_scope,(void *)(intptr_t)getpid());
  ph_slots=SvREFCNT_inc(slots);
  SPAGAIN; PUSHMARK(SP); PUTBACK;
  n=call_sv(callback,context); SPAGAIN;
  /* Copy in order; Perl magic may relocate the stack, including while
     fetching a returned tied scalar. Hold stack indices, not SV **. */
  SSize_t base=SP-PL_stack_base-n+1;
  for (int i=0;i<n;++i) av_push(out,newSVsv(PL_stack_base[base+i]));
  SP=PL_stack_base+base-1; PUTBACK;
  lbp_check_interpreter(aTHX);
  FREETMPS; LEAVE;
  return out;
}
