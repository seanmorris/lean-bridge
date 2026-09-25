/* Checkpoints run only after registering ownership in the installed runtime.
 * This header belongs to a separate XS probe, never to a distributed archive.
 */
#include <assert.h>
static UV lb_test_count, lb_test_target, lb_test_scopes, lb_test_owners;
static UV lb_test_keeps, lb_test_callbacks, lb_test_resources, lb_test_borrows;
static SV *lb_test_error;
static struct { lbp_scope *scope; UV owners; } lb_test_slots[64];

static void lb_test_tick(pTHX) {
  if (++lb_test_count != lb_test_target) return;
  if (lb_test_error) croak_sv(lb_test_error);
  croak("injected structured conversion failure");
}
static unsigned lb_test_slot(lbp_scope *scope) {
  for (unsigned i = 0; i < 64; ++i) if (lb_test_slots[i].scope == scope) return i;
  abort();
}
static lbp_scope *lb_test_begin(pTHX) {
  unsigned slot = lb_test_slot(NULL);
  lbp_scope *scope = lbp_begin(aTHX);
  lb_test_slots[slot].scope = scope; ++lb_test_scopes;
  return scope;
}
static void lb_test_end(pTHX_ void *data) {
  unsigned slot = lb_test_slot(data);
  lbp_end(aTHX_ data);
  assert(lb_test_scopes && lb_test_owners >= lb_test_slots[slot].owners);
  --lb_test_scopes; lb_test_owners -= lb_test_slots[slot].owners;
  lb_test_slots[slot].scope = NULL; lb_test_slots[slot].owners = 0;
}
static lean_object *lb_test_keep(pTHX_ lbp_scope *scope, lean_object *value) {
  lean_object *out = lbp_keep(scope, value);
  if (!lean_is_scalar(value)) {
    ++lb_test_keeps; ++lb_test_owners; ++lb_test_slots[lb_test_slot(scope)].owners;
  }
  lb_test_tick(aTHX); return out;
}
static void lb_test_budget(pTHX_ lbp_scope *scope, size_t bytes) {
  lbp_budget(scope, bytes); lb_test_tick(aTHX);
}
static SV *lb_test_mortal(pTHX_ SV *value) {
  SV *out = sv_2mortal(value); lb_test_tick(aTHX); return out;
}
static void lb_test_push(pTHX_ AV *array, SV *value) {
  av_push(array, value); lb_test_tick(aTHX);
}
static SV **lb_test_store(pTHX_ HV *hash, const char *key, I32 length, SV *value, U32 flag) {
  SV **out = hv_store(hash, key, length, value, flag); lb_test_tick(aTHX); return out;
}
static SV *lb_test_branch(pTHX_ const char *package, SV *value) {
  SV *out = lbp_branch(aTHX_ package, value); lb_test_tick(aTHX); return out;
}
static uint64_t lb_test_callback_new(pTHX_ lbp_scope *scope, SV *code,
    CV *invoker, void (*invoke)(void)) {
  uint64_t token = lbp_callback_new(aTHX_ scope, code, invoker, invoke);
  ++lb_test_callbacks; lb_test_tick(aTHX); return token;
}
static SV *lb_test_resource(pTHX_ lean_object *object, const char *kind, const char *package) {
  SV *out = lbp_resource(aTHX_ object, kind, package);
  ++lb_test_resources; lb_test_tick(aTHX); return out;
}
static lean_object *lb_test_borrow(pTHX_ lbp_scope *scope, SV *value, const char *kind) {
  lean_object *out = lbp_borrow(aTHX_ scope, value, kind);
  /* The installed borrow registers this reference through its internal keep. */
  if (!lean_is_scalar(out)) {
    ++lb_test_keeps; ++lb_test_owners; ++lb_test_slots[lb_test_slot(scope)].owners;
  }
  ++lb_test_borrows; lb_test_tick(aTHX); return out;
}
static SV *lb_test_reset(pTHX_ UV fail, SV *error) {
  HV *out = newHV();
  hv_stores(out, "count", newSVuv(lb_test_count));
  hv_stores(out, "live_scopes", newSVuv(lb_test_scopes));
  hv_stores(out, "live_owners", newSVuv(lb_test_owners));
  hv_stores(out, "keeps", newSVuv(lb_test_keeps));
  hv_stores(out, "callbacks", newSVuv(lb_test_callbacks));
  hv_stores(out, "resources", newSVuv(lb_test_resources));
  hv_stores(out, "borrows", newSVuv(lb_test_borrows));
  SV *value = sv_2mortal(newRV_noinc((SV *)out));
  SvREFCNT_dec(lb_test_error);
  lb_test_error = error && SvROK(error) ? SvREFCNT_inc(error) : NULL;
  lb_test_count = lb_test_keeps = lb_test_callbacks = lb_test_resources = lb_test_borrows = 0;
  lb_test_target = fail;
  return value;
}
#define lbp_begin(...) lb_test_begin(__VA_ARGS__)
#define lbp_end lb_test_end
#define lbp_keep(scope, value) lb_test_keep(aTHX_ scope, value)
#define lbp_budget(scope, bytes) lb_test_budget(aTHX_ scope, bytes)
#define lbp_mortal(value) lb_test_mortal(aTHX_ value)
#undef sv_2mortal
#define sv_2mortal(value) lb_test_mortal(aTHX_ value)
#undef av_push
#define av_push(array, value) lb_test_push(aTHX_ array, value)
#undef hv_store
#define hv_store(hash, key, length, value, flag) lb_test_store(aTHX_ hash, key, length, value, flag)
#define lbp_branch(...) lb_test_branch(__VA_ARGS__)
#define lbp_callback_new(...) lb_test_callback_new(__VA_ARGS__)
#define lbp_resource(...) lb_test_resource(__VA_ARGS__)
#define lbp_borrow(...) lb_test_borrow(__VA_ARGS__)
