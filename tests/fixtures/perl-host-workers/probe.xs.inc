
void
_probe_call(obj, method)
    SV *obj
    int method
  PPCODE:
    ENTER; SAVETMPS; lbp_host_enter(aTHX_ ph_session);
    if (method<0 || method>2) croak("unknown fixture operation");
    SV *answer=newSVsv(test_call(aTHX_ obj,method));
    FREETMPS; LEAVE; SPAGAIN; SP=PL_stack_base+ax-1; XPUSHs(sv_2mortal(answer));

void
_probe_rollback(obj, bad)
    SV *obj
    SV *bad
  PPCODE:
    ENTER; SAVETMPS; lbp_host_enter(aTHX_ ph_session);
    uint64_t a[3]={0},b[3]={0};
    phw_input(aTHX_ 0,obj,a); phw_input(aTHX_ 0,bad,b);
    phw_admit(aTHX_ 0,a); phw_admit(aTHX_ 0,b);
    FREETMPS; LEAVE; XSRETURN_EMPTY;

void
_probe_park(obj)
    SV *obj
  PPCODE:
    ENTER; SAVETMPS; lbp_host_enter(aTHX_ ph_session);
    uint64_t a[3]={0}; phw_input(aTHX_ 0,obj,a);
    if (PHW_BORROW(phw_keys[0],parked)) croak("old lease survived rebind");
    parked[0]=parked[1]=0;
    if (PHW_CREATE(phw_keys[0],PHW_BORROW(phw_keys[0],a),parked)!=0)
        croak("could not park a fixture lease");
    uint64_t wrong[2]={parked[0],parked[1]^1};
    if (PHW_BORROW(phw_keys[0],wrong) || PHW_RELEASE(phw_keys[0],wrong)==0)
        croak("wrong domain accepted");
    FREETMPS; LEAVE; XSRETURN_EMPTY;

int
_probe_stale()
  CODE:
    lbp_check_interpreter(aTHX);
    RETVAL=parked[0] && !PHW_BORROW(phw_keys[0],parked) && PHW_RELEASE(phw_keys[0],parked)!=0;
  OUTPUT:
    RETVAL

size_t
_probe_live()
  CODE:
    RETVAL=lbp_host_live(aTHX);
  OUTPUT:
    RETVAL
