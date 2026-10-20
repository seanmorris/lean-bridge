/**
 * Unwrap authentic callback values while their original native owners are pinned.
 *
 * @file
 */
export const ownedPerlCallbackArguments = `
static SV *lpo_callback_value(pTHX_ lpg_scope *scope, SV *value, size_t type, int fetched) {
  SV *snapshot = lpg_sv(aTHX_ scope);
  LB_PERL_GRAPH_CHECKPOINT();
  if (!fetched) SvGETMAGIC(value);
  sv_setsv_flags(snapshot, value, SV_NOSTEAL);
  value = snapshot; lpo_context(aTHX);
  if (!SvROK(value) || SvTYPE(SvRV(value)) != SVt_PVHV || !SvOBJECT(SvRV(value)))
    return value;
  MAGIC *magic = mg_findext(SvRV(value), PERL_MAGIC_ext, &lpo_wrapper_magic);
  if (!magic) return value;
  lpo_wrapper *wrapper = lpo_get_fetched(aTHX_ value, type);
  if (!wrapper->is_value) return value;
  if (lpo_closed(wrapper) || !wrapper->payload) lpo_status(aTHX_ 4);
  /* Empty payloads carry no identity leaf that could check this lifetime. */
  lpo_pin_owner(aTHX_ wrapper->owner);
  return lpg_pin(aTHX_ wrapper->payload);
}
`;
