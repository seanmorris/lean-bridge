#include "EXTERN.h"
#include "perl.h"
#include "XSUB.h"
#include <lean/lean.h>
#include "lean_bridge_native_runtime.h"
#include <pthread.h>

/* A separate test library drives the installed broker. No installed file changes. */
static pthread_t locker;
static pthread_mutex_t coordination = PTHREAD_MUTEX_INITIALIZER;
static pthread_cond_t changed = PTHREAD_COND_INITIALIZER;
static int entered, released, initialized;
static lean_object *pending;

static void *hold_initializer(uint8_t builtin) {
  (void)builtin;
  pthread_mutex_lock(&coordination);
  entered = 1; pthread_cond_signal(&changed);
  while (!released) pthread_cond_wait(&changed, &coordination);
  pthread_mutex_unlock(&coordination);
  return pending;
}
static void *hold_broker(void *unused) {
  (void)unused;
  initialized = lean_bridge_native_component_initialize("perl-installed-lock-probe", hold_initializer);
  return NULL;
}
XS(composition_start) {
  dXSARGS; (void)items;
  pending = lean_io_result_mk_ok(lean_box(0)); lean_mark_mt(pending);
  if (pthread_create(&locker, NULL, hold_broker, NULL)) { lean_dec(pending); croak("probe thread failed"); }
  pthread_mutex_lock(&coordination);
  while (!entered) pthread_cond_wait(&changed, &coordination);
  pthread_mutex_unlock(&coordination);
  XSRETURN_EMPTY;
}
XS(composition_stop) {
  dXSARGS; (void)items;
  pthread_mutex_lock(&coordination); released = 1; pthread_cond_signal(&changed); pthread_mutex_unlock(&coordination);
  if (pthread_join(locker, NULL) || !initialized) croak("probe initialization failed");
  XSRETURN_EMPTY;
}
XS(composition_retire) {
  dXSARGS; (void)items;
  lean_bridge_native_runtime_retire(); XSRETURN_EMPTY;
}
XS(composition_snapshot) {
  dXSARGS; (void)items;
  lean_bridge_native_snapshot value;
  lean_bridge_native_snapshot_read(&value);
  EXTEND(SP, 3);
  PUSHs(sv_2mortal(newSVuv(value.runtime_init_runs)));
  PUSHs(sv_2mortal(newSVuv(value.component_init_runs)));
  PUSHs(sv_2mortal(newSVuv(value.attached_components)));
  XSRETURN(3);
}
