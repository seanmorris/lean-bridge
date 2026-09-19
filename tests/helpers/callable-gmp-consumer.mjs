/**
 * Independent public mpz_t callback and closure consumer cases.
 *
 * @file
 */
/**
 * Generate ownership, boundary and failure checks through public GMP values.
 *
 * @param type - Nat or Int scalar name.
 * @param callback - Public callback type.
 * @param closure - Public owned closure type.
 */
export const callableGmpCases = (type, callback, closure) => ({ definitions: `static callables_status echo_${type}(void *raw, mpz_srcptr value, mpz_ptr out, callables_error *error) {
  struct context *ctx = raw; ++ctx->calls; mpz_set(out, value);
  if (ctx->mode == 5) mpz_set(out, (mpz_srcptr)ctx->replacement);
  if (ctx->mode == 1) { *error = (callables_error){CALLABLES_ERROR_INVALID_ARGUMENT, "host failure", 12}; return CALLABLES_STATUS_DECLARED_ERROR; }
  if (ctx->mode == 2) mpz_set_si(out, -1);
  if (ctx->mode == 6) mpz_setbit(out, 16u * 1024u * 1024u * 8u);
  return CALLABLES_STATUS_OK;
}`
, suite: `static void check_${type}(void) {
  mpz_t values[20]; for (unsigned i = 0; i < 20; ++i) mpz_init(values[i]);
  unsigned bits[] = {0, 31, 32, 53, 64, 255, 5120, 16384, 1, 63};
  for (unsigned i = 0; i < 10; ++i) { if (i) mpz_setbit(values[i], bits[i]); mpz_add_ui(values[i + 10], values[i], 1); }
  ${type === "int" ? "for (unsigned i = 11; i < 20; ++i) mpz_neg(values[i], values[i]);" : ""}
  struct context ctx = {0}; ${callback} callback = {echo_${type}, &ctx}; callables_error error = {0};
  mpz_t result, negative; mpz_init(result); mpz_init_set_si(negative, -1);
  for (unsigned i = 0; i < 256; ++i) {
    mpz_srcptr value = values[i % 20], alternative = values[(i + 1) % 20]; ctx.calls = 0;
    CHECK(callables_call_${type}(value, &callback, result, &error) == CALLABLES_STATUS_OK);
    CHECK(ctx.calls == 1 && !error.code && !mpz_cmp(result, value));
    CHECK(callables_twice_${type}(value, &callback, result, &error) == CALLABLES_STATUS_OK);
    CHECK(ctx.calls == 3 && !mpz_cmp(result, value));
    ${closure} *owned = NULL;
    CHECK(callables_make_${type}(value, &owned, &error) == CALLABLES_STATUS_OK && owned);
    CHECK(${closure}_call(owned, true, alternative, result, &error) == CALLABLES_STATUS_OK && !mpz_cmp(result, value));
    CHECK(${closure}_call(owned, false, alternative, result, &error) == CALLABLES_STATUS_OK && !mpz_cmp(result, alternative));
    ${type === "nat" ? `mpz_set_ui(result, 71); CHECK(${closure}_call(owned, false, negative, result, &error) == CALLABLES_STATUS_INVALID_ARGUMENT && mpz_cmp_ui(result, 71) == 0);` : ""}
    ${closure}_dispose(&owned); CHECK(!owned); ${closure}_dispose(&owned);
    CHECK(${closure}_call(owned, true, value, result, &error) == CALLABLES_STATUS_INVALID_ARGUMENT);
  }
  ctx.mode = 1; ctx.calls = 0; mpz_set_ui(result, 71);
  CHECK(callables_twice_${type}(values[7], &callback, result, &error) == CALLABLES_STATUS_DECLARED_ERROR);
  CHECK(ctx.calls == 1 && mpz_cmp_ui(result, 71) == 0 && error.message_length == 12 && !memcmp(error.message, "host failure", 12));
  const char *saved_error = error.message; ctx.mode = 0;
  CHECK(callables_call_${type}(values[1], &callback, result, &error) == CALLABLES_STATUS_OK && !error.code);
  CHECK(!memcmp(saved_error, "host failure", 12)); mpz_set_ui(result, 71);
  ${type === "nat" ? `ctx.mode = 0; ctx.calls = 0; CHECK(callables_call_nat(negative, &callback, result, &error) == CALLABLES_STATUS_INVALID_ARGUMENT && !ctx.calls && mpz_cmp_ui(result, 71) == 0);
  ctx.mode = 2; CHECK(callables_twice_nat(values[1], &callback, result, &error) == CALLABLES_STATUS_INVALID_ARGUMENT && ctx.calls == 1 && mpz_cmp_ui(result, 71) == 0);` : ""}
  ctx.mode = 6; ctx.calls = 0;
  CHECK(callables_twice_${type}(values[1], &callback, result, &error) == CALLABLES_STATUS_INVALID_ARGUMENT);
  CHECK(ctx.calls == 1 && mpz_cmp_ui(result, 71) == 0);
  ctx.mode = 0; CHECK(callables_call_${type}(values[1], NULL, result, &error) == CALLABLES_STATUS_INVALID_ARGUMENT);
  CHECK(callables_call_${type}(values[1], &callback, NULL, &error) == CALLABLES_STATUS_INVALID_ARGUMENT);
  CHECK(callables_call_${type}(NULL, &callback, result, &error) == CALLABLES_STATUS_INVALID_ARGUMENT);
  ctx.mode = 5; ctx.replacement = values[19]; ctx.calls = 0;
  CHECK(callables_twice_${type}(values[3], &callback, result, &error) == CALLABLES_STATUS_OK && ctx.calls == 2 && !mpz_cmp(result, values[19]));
  ctx.mode = 0; CHECK(callables_call_${type}(result, &callback, result, &error) == CALLABLES_STATUS_OK && !mpz_cmp(result, values[19]));
  callables_${type}_clear(result); callables_${type}_clear(result); CHECK(!mpz_sgn(result));
  for (unsigned i = 0; i < 20; ++i) { mpz_clear(values[i]); }
  mpz_clear(result); mpz_clear(negative);
}` });
