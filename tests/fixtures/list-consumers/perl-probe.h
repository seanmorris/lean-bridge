/* Test-only checkpoints in a separately compiled copy of Component.xs.
 * Fail after ownership registration, never strand an unregistered C pointer.
 * Neither this header nor the probe XS is shipped in a CPAN package.
 */
static UV lb_test_count, lb_test_target;
static void lb_test_tick(pTHX) {
  if (++lb_test_count == lb_test_target) croak("injected List conversion failure");
}
static lean_object *lb_test_keep(pTHX_ lbp_scope *scope, lean_object *value) {
  lean_object *out = lbp_keep(scope, value); lb_test_tick(aTHX); return out;
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
