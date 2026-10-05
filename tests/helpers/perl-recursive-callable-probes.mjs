/**
 * Private allocation ledgers and owned-output corruption for isolated Perl XS tests.
 *
 * @file
 */
export const hooks = `
#include <assert.h>
#include <signal.h>
static size_t probe_host_live, probe_native_live, probe_host_attempts, probe_native_attempts;
static size_t probe_points, probe_target, probe_mode;
static size_t probe_clears, probe_retired, probe_poisoned;
static SV *probe_error;
static void *prototype_host_malloc(size_t bytes) {
  if (++probe_host_attempts == probe_target && probe_mode == 1) return NULL;
  void *value = malloc(bytes); if (value) ++probe_host_live; return value;
}
static void prototype_host_free(void *value) { assert(value && probe_host_live); --probe_host_live; free(value); }
static void *prototype_native_malloc(size_t bytes) {
  if (++probe_native_attempts == probe_target && probe_mode == 4) return NULL;
  void *value = malloc(bytes); if (value) ++probe_native_live; return value;
}
static void prototype_native_free(void *value) { assert(value && probe_native_live); --probe_native_live; free(value); }
static void prototype_checkpoint(pTHX) {
  if (++probe_points != probe_target) return;
  if (probe_mode == 3) { kill(getpid(), SIGUSR1); PERL_ASYNC_CHECK(); croak("signal did not interrupt conversion"); }
  if (probe_mode == 2) {
    if (probe_error) croak_sv(probe_error);
    croak("injected recursive Perl conversion failure");
  }
}
#define LB_PERL_GRAPH_MALLOC prototype_host_malloc
#define LB_PERL_GRAPH_FREE prototype_host_free
#define LB_PERL_GRAPH_CHECKPOINT() prototype_checkpoint(aTHX)
#define LB_GRAPH_MALLOC prototype_native_malloc
#define LB_GRAPH_FREE prototype_native_free
`;
export const probeXs = `
MODULE = LeanBridge::Recursive PACKAGE = LeanBridge::Recursive

void
fault_reset(target=0, mode=0, error=&PL_sv_undef)
    unsigned int target
    unsigned int mode
    SV *error
  PPCODE:
    SV *previous = probe_error;
    probe_error = SvOK(error) ? SvREFCNT_inc(error) : NULL;
    SvREFCNT_dec(previous);
    probe_host_attempts = probe_native_attempts = probe_points = 0;
    probe_clears = probe_retired = probe_poisoned = 0;
    probe_target = target; probe_mode = mode;
    XSRETURN_EMPTY;

void
fault_snapshot()
  PPCODE:
    lean_bridge_native_snapshot snapshot;
    lean_bridge_native_snapshot_read(&snapshot);
    EXTEND(SP, 6);
    PUSHs(sv_2mortal(newSVuv(probe_host_live)));
    PUSHs(sv_2mortal(newSVuv(probe_native_live)));
    PUSHs(sv_2mortal(newSVuv(probe_host_attempts)));
    PUSHs(sv_2mortal(newSVuv(probe_native_attempts)));
    PUSHs(sv_2mortal(newSVuv(probe_points)));
    PUSHs(sv_2mortal(newSVuv(snapshot.live_identities)));

void
poison_snapshot()
  PPCODE:
    EXTEND(SP, 3);
    PUSHs(sv_2mortal(newSVuv(probe_clears)));
    PUSHs(sv_2mortal(newSVuv(probe_retired)));
    PUSHs(sv_2mortal(newSVuv(probe_poisoned)));
`;

/**
 * Corrupt a genuine owned result only after the authentic native call succeeds.
 *
 * @param model - Checked callable graph types and exported functions.
 */
export const poisonDeclarations = model => {
	const fn = model.functions.find(fn => fn.publicName === "call_recursive");
	return `static uint32_t prototype_poisoned_result(const ${fn.parameters[0].node.name} *input,
    const ${model.layout.prefix}_callback_${fn.parameters[1].callback.key} *callback, ${fn.result.node.name} *output) {
  uint32_t status = ${fn.native}(input, callback, output);
  if (!status && probe_mode == 5) {
    assert(output->_bridge_owner && output->_bridge_release && probe_native_live);
    output->kind = UINT32_MAX; ++probe_poisoned;
  }
  return status;
}
#define ${fn.native} prototype_poisoned_result
`;
};
