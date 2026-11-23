#include "EXTERN.h"
#include "perl.h"
#include "XSUB.h"
#include "lean_bridge_native_runtime.h"
#include <dlfcn.h>

MODULE = TestObserver    PACKAGE = TestObserver
PROTOTYPES: DISABLE

void
retire()
  PPCODE:
    void (*f)(void) = (void (*)(void))dlsym(RTLD_DEFAULT,"lean_bridge_native_runtime_retire");
    if (!f) croak("Shared runtime retirement operation is unavailable");
    f(); XSRETURN_EMPTY;

void
snapshot()
  PPCODE:
    lean_bridge_native_snapshot s={0};
    void (*f)(lean_bridge_native_snapshot *) = (void (*)(lean_bridge_native_snapshot *))dlsym(RTLD_DEFAULT,"lean_bridge_native_snapshot_read");
    if (!f) croak("Shared runtime snapshot operation is unavailable");
    f(&s);
    EXTEND(SP,5);
    PUSHs(sv_2mortal(newSVuv(s.runtime_state)));
    PUSHs(sv_2mortal(newSVuv(s.runtime_init_runs)));
    PUSHs(sv_2mortal(newSVuv(s.component_init_runs)));
    PUSHs(sv_2mortal(newSVuv(s.attached_components)));
    PUSHs(sv_2mortal(newSVuv(s.live_identities)));
