/**
 * Negative control for the array-of-product consumers (VO #1441): a stand-in for the generated
 * GMP projection that bounds, sums and reverses rows exactly as Lean would. Built with
 * MUTATE_COMPONENT or MUTATE_ERROR, it also rewrites that rejected leaf in the caller's array
 * before returning the rejection, which the C consumer must detect.
 *
 * @file
 */

/** C source implementing the projection functions the C consumer links against. */
export const finProductArrayStubRuntime = () => `#include <finproductarrays.h>
#include <stdlib.h>
#include <stdio.h>
#include <string.h>
typedef finproductarrays_gmp_tuple_nat_result_nat_nat_value row;
typedef finproductarrays_gmp_array_tuple_nat_result_nat_nat_span rows;
void finproductarrays_gmp_nat_init(mpz_ptr value) { mpz_init(value); }
void finproductarrays_gmp_nat_clear(mpz_ptr value) { mpz_clear(value); }
void finproductarrays_gmp_result_nat_nat_value_init(finproductarrays_gmp_result_nat_nat_value *value) { value->is_ok = 0; mpz_init(value->ok); mpz_init(value->error); }
void finproductarrays_gmp_result_nat_nat_value_clear(finproductarrays_gmp_result_nat_nat_value *value) { mpz_clear(value->ok); mpz_clear(value->error); }
void finproductarrays_gmp_tuple_nat_result_nat_nat_value_init(row *value) { mpz_init(value->fst); finproductarrays_gmp_result_nat_nat_value_init(&value->snd); }
void finproductarrays_gmp_tuple_nat_result_nat_nat_value_clear(row *value) { mpz_clear(value->fst); finproductarrays_gmp_result_nat_nat_value_clear(&value->snd); }
void finproductarrays_gmp_array_tuple_nat_result_nat_nat_span_init(rows *value) { memset(value, 0, sizeof *value); }
void finproductarrays_gmp_array_tuple_nat_result_nat_nat_span_clear(rows *value) { if (value->release) value->release(value->owner); memset(value, 0, sizeof *value); }
static finproductarrays_gmp_status invalid(finproductarrays_gmp_error *error, const char *message) {
  error->code = FINPRODUCTARRAYS_GMP_ERROR_INVALID_ARGUMENT; error->message = message; error->message_length = strlen(message);
  return FINPRODUCTARRAYS_GMP_STATUS_INVALID_ARGUMENT;
}
/* Fin 4 on each component and Fin 6 on each active error branch, in element order. */
static finproductarrays_gmp_status check(const rows *input, finproductarrays_gmp_error *error) {
  static _Thread_local char diagnostic[128];
  for (size_t k = 0; k < input->length; ++k) {
    row *item = (row *)&input->data[k];
    if (mpz_cmp_ui(item->fst, 4) >= 0) {
#ifdef MUTATE_COMPONENT
      mpz_set_ui(item->fst, 0);
#endif
      snprintf(diagnostic, sizeof diagnostic, "arg0[%zu].0 is not below its Fin 4 bound", k);
      return invalid(error, diagnostic);
    }
    if (!item->snd.is_ok && mpz_cmp_ui(item->snd.error, 6) >= 0) {
#ifdef MUTATE_ERROR
      mpz_set_ui(item->snd.error, 0);
#endif
      snprintf(diagnostic, sizeof diagnostic, "arg0[%zu].1.error is not below its Fin 6 bound", k);
      return invalid(error, diagnostic);
    }
  }
  return FINPRODUCTARRAYS_GMP_STATUS_OK;
}
finproductarrays_gmp_status finproductarrays_gmp_rows(const rows *input, mpz_ptr out, finproductarrays_gmp_error *error) {
  finproductarrays_gmp_status status = check(input, error);
  if (status != FINPRODUCTARRAYS_GMP_STATUS_OK) return status;
  mpz_set_ui(out, 0);
  for (size_t k = 0; k < input->length; ++k) {
    const row *item = &input->data[k];
    mpz_add(out, out, item->fst);
    if (item->snd.is_ok) mpz_add(out, out, item->snd.ok);
    else { mpz_add(out, out, item->snd.error); mpz_add_ui(out, out, 1000); }
  }
  return FINPRODUCTARRAYS_GMP_STATUS_OK;
}
typedef struct { row *items; size_t length; } owned;
static void release(void *owner) {
  owned *rows_owned = owner;
  for (size_t k = 0; k < rows_owned->length; ++k) finproductarrays_gmp_tuple_nat_result_nat_nat_value_clear(&rows_owned->items[k]);
  free(rows_owned->items); free(rows_owned);
}
finproductarrays_gmp_status finproductarrays_gmp_reversed(const rows *input, rows *out, finproductarrays_gmp_error *error) {
  finproductarrays_gmp_status status = check(input, error);
  if (status != FINPRODUCTARRAYS_GMP_STATUS_OK) return status;
  owned *result = malloc(sizeof *result);
  result->length = input->length; result->items = calloc(input->length ? input->length : 1, sizeof(row));
  for (size_t k = 0; k < input->length; ++k) {
    const row *from = &input->data[input->length - 1 - k];
    row *to = &result->items[k];
    finproductarrays_gmp_tuple_nat_result_nat_nat_value_init(to);
    mpz_set(to->fst, from->fst); to->snd.is_ok = from->snd.is_ok;
    mpz_set(to->snd.is_ok ? to->snd.ok : to->snd.error, from->snd.is_ok ? from->snd.ok : from->snd.error);
  }
  out->data = result->items; out->length = result->length; out->owner = result; out->release = release;
  return FINPRODUCTARRAYS_GMP_STATUS_OK;
}
`;
