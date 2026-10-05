#include "instrumentation.h"
#include "@PREFIX@.h"
#include "native-probe.h"
#include "runtime.h"

MODULE = LeanBridge::OwnedProbe PACKAGE = LeanBridge::OwnedProbe
PROTOTYPES: DISABLE

BOOT:
    lpo_boot(aTHX);

void
new_ticket(number, partial=0)
    UV number
    int partial
  PPCODE:
    ENTER;
    lpo_enter_call(aTHX);
    lpo_owner *owner = lpo_begin_owner(aTHX_ 0);
    lpg_scope *scope = lpg_begin(aTHX_ NULL);
    void *handle = NULL;
    lpo_status(aTHX_ owned_test_new(lpo_state.session, number, &handle, &owner->result));
    SV *output = lpo_wrap(aTHX_ scope, owner, handle, @TICKET_TYPE@, "LeanBridge::OwnedProbe::Ticket");
    if (partial) {
      sv_setsv(get_sv("LeanBridge::OwnedProbe::leaked", GV_ADD), output);
      croak("injected partial output");
    }
    lpo_publish(aTHX_ owner);
    LEAVE;
    SPAGAIN; SP = PL_stack_base + ax - 1; EXTEND(SP, 1); XPUSHs(output);

void
retain(ticket)
    SV *ticket
  PPCODE:
    ENTER;
    lpo_enter_call(aTHX);
    void *input = lpo_borrow(aTHX_ ticket, @TICKET_TYPE@), *handle = NULL;
    lpo_owner *owner = lpo_begin_owner(aTHX_ 0);
    lpg_scope *scope = lpg_begin(aTHX_ NULL);
    lpo_status(aTHX_ owned_test_retain(lpo_state.session, input, &handle, &owner->result));
    SV *output = lpo_wrap(aTHX_ scope, owner, handle, @TICKET_TYPE@, "LeanBridge::OwnedProbe::Ticket");
    lpo_publish(aTHX_ owner);
    LEAVE;
    SPAGAIN; SP = PL_stack_base + ax - 1; EXTEND(SP, 1); XPUSHs(output);

void
serial(ticket, reenter=&PL_sv_undef)
    SV *ticket
    SV *reenter
  PPCODE:
    ENTER;
    lpo_enter_call(aTHX);
    void *input = lpo_borrow(aTHX_ ticket, @TICKET_TYPE@);
    lpo_owner *owner = lpo_begin_owner(aTHX_ 0);
    if (SvOK(reenter)) {
      PUSHMARK(SP); PUTBACK;
      call_sv(reenter, G_VOID | G_DISCARD);
      SPAGAIN;
    }
    uint64_t number = 0;
    lpo_status(aTHX_ owned_test_serial(lpo_state.session, input, &number, &owner->result));
    SV *output = sv_2mortal(newSVuv(number));
    LEAVE;
    SPAGAIN; SP = PL_stack_base + ax - 1; EXTEND(SP, 1); XPUSHs(output);

void
with_borrow(ticket, callback)
    SV *ticket
    SV *callback
  PPCODE:
    ENTER;
    lpo_enter_call(aTHX);
    void *handle = lpo_borrow(aTHX_ ticket, @TICKET_TYPE@);
    lpo_owner *owner = lpo_begin_owner(aTHX_ 1);
    lpg_scope *scope = lpg_begin(aTHX_ NULL);
    SV *borrow = lpo_wrap(aTHX_ scope, owner, handle, @TICKET_TYPE@, "LeanBridge::OwnedProbe::Ticket");
    PUSHMARK(SP); XPUSHs(borrow); PUTBACK;
    int count = call_sv(callback, G_SCALAR);
    SPAGAIN;
    if (count != 1) croak("probe callback must return one value");
    SV *output = POPs; PUTBACK;
    lpg_pin(aTHX_ output);
    LEAVE;
    SPAGAIN; SP = PL_stack_base + ax - 1; EXTEND(SP, 1); XPUSHs(output);

void
close(ticket)
    SV *ticket
  PPCODE:
    lpo_wrapper_close(aTHX_ lpo_get(aTHX_ ticket, @TICKET_TYPE@));

int
closed(ticket)
    SV *ticket
  CODE:
    RETVAL = lpo_closed(lpo_get(aTHX_ ticket, @TICKET_TYPE@));
  OUTPUT:
    RETVAL

void
shutdown()
  PPCODE:
    lpo_context(aTHX);
    lpo_shutdown(aTHX_ NULL);

void
reset(fail=0, exception=0, native=-1)
    UV fail
    UV exception
    IV native
  PPCODE:
    lpo_context(aTHX);
    probe_attempts = probe_points = 0;
    probe_fail = fail; probe_die = exception;
    owned_test_fail_after(native);

void
snapshot()
  PPCODE:
    lpo_context(aTHX);
    size_t owners = 0;
    for (lpo_owner *owner = lpo_state.owners; owner; owner = owner->next) ++owners;
    EXTEND(SP, 8);
    PUSHs(sv_2mortal(newSVuv(probe_live)));
    PUSHs(sv_2mortal(newSVuv(owned_test_live())));
    PUSHs(sv_2mortal(newSVuv(owned_test_identities())));
    PUSHs(sv_2mortal(newSVuv(owners)));
    PUSHs(sv_2mortal(newSVuv(probe_attempts)));
    PUSHs(sv_2mortal(newSVuv(probe_points)));
    PUSHs(sv_2mortal(newSVuv(lpo_state.active)));
    PUSHs(sv_2mortal(newSViv(lpo_state.cleanup_status)));
