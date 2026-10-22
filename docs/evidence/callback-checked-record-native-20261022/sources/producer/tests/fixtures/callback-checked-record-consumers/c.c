#include <callbackcheckedrecords.h>

#include <stdio.h>
#include <string.h>

#define CALL_(type) type##_call
#define CALL(type) CALL_(type)
#define DISPOSE_(type) type##_dispose
#define DISPOSE(type) DISPOSE_(type)

typedef callbackcheckedrecords_interval_t interval;
typedef callbackcheckedrecords_weighted_t weighted;

static unsigned checks;
#define CHECK(test) do { if (!(test)) { fprintf(stderr, "failed at line %d: %s\n", __LINE__, #test); return 1; } ++checks; } while (0)
#define OK(call) ((call) == CALLBACKCHECKEDRECORDS_STATUS_OK)
#define INVALID(call) ((call) == CALLBACKCHECKEDRECORDS_STATUS_INVALID_ARGUMENT)

static unsigned callback_calls;
static unsigned long reply_lo, reply_hi, reply_weight, reply_limit;

/* The host receives the proof-free interval and replies with the same shape. */
static callbackcheckedrecords_status widen(void *context, const interval *value,
		interval *out, callbackcheckedrecords_error *error) {
	(void)context; (void)error; ++callback_calls;
	if(mpz_cmp_ui(value->lo, 1) != 0 || mpz_cmp_ui(value->hi, 3) != 0) return CALLBACKCHECKEDRECORDS_STATUS_INVALID_ARGUMENT;
	mpz_set_ui(out->lo, reply_lo); mpz_set_ui(out->hi, reply_hi);
	return CALLBACKCHECKEDRECORDS_STATUS_OK;
}
static callbackcheckedrecords_status mixed(void *context, mpz_srcptr marker,
		const interval *value, interval *out, callbackcheckedrecords_error *error) {
	(void)context; (void)error; ++callback_calls;
	if(mpz_cmp_ui(marker, 7) != 0) return CALLBACKCHECKEDRECORDS_STATUS_INVALID_ARGUMENT;
	mpz_set(out->lo, value->lo); mpz_add_ui(out->hi, value->hi, 2);
	return CALLBACKCHECKEDRECORDS_STATUS_OK;
}
static callbackcheckedrecords_status reweigh(void *context, const weighted *value,
		weighted *out, callbackcheckedrecords_error *error) {
	(void)context; (void)error; ++callback_calls;
	if(mpz_cmp_ui(value->weight, 1) != 0 || mpz_cmp_ui(value->limit, 2) != 0) return CALLBACKCHECKEDRECORDS_STATUS_INVALID_ARGUMENT;
	mpz_set_ui(out->weight, reply_weight); mpz_set_ui(out->limit, reply_limit);
	return CALLBACKCHECKEDRECORDS_STATUS_OK;
}

static void set_interval(interval *value, unsigned long lo, unsigned long hi) {
	mpz_set_ui(value->lo, lo); mpz_set_ui(value->hi, hi);
}
static void set_weighted(weighted *value, unsigned long weight, unsigned long limit) {
	mpz_set_ui(value->weight, weight); mpz_set_ui(value->limit, limit);
}
static int interval_is(const interval *value, unsigned long lo, unsigned long hi) {
	return mpz_cmp_ui(value->lo, lo) == 0 && mpz_cmp_ui(value->hi, hi) == 0;
}

int main(void) {
	callbackcheckedrecords_error error = {0};
	CHECK(OK(callbackcheckedrecords_initialize(&error)));
	mpz_t seed, marker, out;
	mpz_inits(seed, marker, out, NULL);
	interval recovery, argument, returned;
	weighted weighted_recovery, weighted_argument;
	callbackcheckedrecords_interval_t_init(&recovery);
	callbackcheckedrecords_interval_t_init(&argument);
	callbackcheckedrecords_interval_t_init(&returned);
	callbackcheckedrecords_weighted_t_init(&weighted_recovery);
	callbackcheckedrecords_weighted_t_init(&weighted_argument);

	/* A host reply selects mkInterval: Lean computes hi - lo of the constructed reply. */
	set_interval(&recovery, 1, 3);
	HOST_SCALAR host = {.call = widen, .context = NULL, .recovery = &recovery};
	reply_lo = 1; reply_hi = 4;
	CHECK(OK(callbackcheckedrecords_call_host(&host, out, &error)) && mpz_cmp_ui(out, 3) == 0 && callback_calls == 1);
	unsigned before = callback_calls;
	set_interval(&recovery, 3, 1); mpz_set_ui(out, 99);
	CHECK(INVALID(callbackcheckedrecords_call_host(&host, out, &error)) && callback_calls == before && mpz_cmp_ui(out, 99) == 0);
	set_interval(&recovery, 1, 3); reply_lo = 5; reply_hi = 2; mpz_set_ui(out, 99);
	CHECK(INVALID(callbackcheckedrecords_call_host(&host, out, &error)) && callback_calls == before + 1 && mpz_cmp_ui(out, 99) == 0);
	reply_lo = 1; reply_hi = 4;
	CHECK(OK(callbackcheckedrecords_call_host(&host, out, &error)) && mpz_cmp_ui(out, 3) == 0);

	HOST_MIXED host_mixed = {.call = mixed, .context = NULL, .recovery = &recovery};
	CHECK(OK(callbackcheckedrecords_call_host_mixed(&host_mixed, out, &error)) && mpz_cmp_ui(out, 4) == 0);

	/* A leased closure constructs its interval argument before its body runs. */
	CLOSURE_SCALAR *closure = NULL; mpz_set_ui(seed, 9);
	CHECK(OK(callbackcheckedrecords_make_closure(seed, &closure, &error)) && closure);
	set_interval(&argument, 2, 5);
	CHECK(OK(CALL(CLOSURE_SCALAR)(closure, &argument, out, &error)) && mpz_cmp_ui(out, 3) == 0);
	set_interval(&argument, 5, 2); mpz_set_ui(out, 99);
	CHECK(INVALID(CALL(CLOSURE_SCALAR)(closure, &argument, out, &error)) && mpz_cmp_ui(out, 99) == 0);
	set_interval(&argument, 3, 3);
	CHECK(OK(CALL(CLOSURE_SCALAR)(closure, &argument, out, &error)) && mpz_cmp_ui(out, 0) == 0);
	DISPOSE(CLOSURE_SCALAR)(&closure); CHECK(closure == NULL);

	/* A Lean-produced closure result crosses as the proof-free interval. */
	CLOSURE_MIXED *owned_mixed = NULL; mpz_set_ui(seed, 0);
	CHECK(OK(callbackcheckedrecords_make_mixed_closure(seed, &owned_mixed, &error)) && owned_mixed);
	mpz_set_ui(marker, 9); set_interval(&argument, 2, 5);
	CHECK(OK(CALL(CLOSURE_MIXED)(owned_mixed, marker, &argument, &returned, &error)) && interval_is(&returned, 2, 5));
	set_interval(&argument, 5, 2);
	CHECK(INVALID(CALL(CLOSURE_MIXED)(owned_mixed, marker, &argument, &returned, &error)) && interval_is(&returned, 2, 5));
	set_interval(&argument, 3, 4);
	CHECK(OK(CALL(CLOSURE_MIXED)(owned_mixed, marker, &argument, &returned, &error)) && interval_is(&returned, 3, 4));
	DISPOSE(CLOSURE_MIXED)(&owned_mixed); CHECK(owned_mixed == NULL);

	/* A checked payload field runs its own constructor before the record constructor. */
	set_weighted(&weighted_recovery, 1, 2);
	HOST_NESTED host_nested = {.call = reweigh, .context = NULL, .recovery = &weighted_recovery};
	reply_weight = 2; reply_limit = 5;
	CHECK(OK(callbackcheckedrecords_call_host_nested(&host_nested, out, &error)) && mpz_cmp_ui(out, 3) == 0);
	before = callback_calls;
	reply_weight = 0; reply_limit = 5; mpz_set_ui(out, 99);
	CHECK(INVALID(callbackcheckedrecords_call_host_nested(&host_nested, out, &error)) && callback_calls == before + 1 && mpz_cmp_ui(out, 99) == 0);
	reply_weight = 6; reply_limit = 5;
	CHECK(INVALID(callbackcheckedrecords_call_host_nested(&host_nested, out, &error)) && callback_calls == before + 2 && mpz_cmp_ui(out, 99) == 0);
	set_weighted(&weighted_recovery, 0, 2);
	CHECK(INVALID(callbackcheckedrecords_call_host_nested(&host_nested, out, &error)) && callback_calls == before + 2 && mpz_cmp_ui(out, 99) == 0);
	set_weighted(&weighted_recovery, 1, 2); reply_weight = 2; reply_limit = 5;
	CHECK(OK(callbackcheckedrecords_call_host_nested(&host_nested, out, &error)) && mpz_cmp_ui(out, 3) == 0);

	CLOSURE_NESTED *nested = NULL; mpz_set_ui(seed, 0);
	CHECK(OK(callbackcheckedrecords_make_nested_closure(seed, &nested, &error)) && nested);
	set_weighted(&weighted_argument, 2, 5);
	CHECK(OK(CALL(CLOSURE_NESTED)(nested, &weighted_argument, out, &error)) && mpz_cmp_ui(out, 3) == 0);
	set_weighted(&weighted_argument, 0, 5); mpz_set_ui(out, 99);
	CHECK(INVALID(CALL(CLOSURE_NESTED)(nested, &weighted_argument, out, &error)) && mpz_cmp_ui(out, 99) == 0);
	set_weighted(&weighted_argument, 6, 5);
	CHECK(INVALID(CALL(CLOSURE_NESTED)(nested, &weighted_argument, out, &error)) && mpz_cmp_ui(out, 99) == 0);
	set_weighted(&weighted_argument, 5, 5);
	CHECK(OK(CALL(CLOSURE_NESTED)(nested, &weighted_argument, out, &error)) && mpz_cmp_ui(out, 0) == 0);
	DISPOSE(CLOSURE_NESTED)(&nested); CHECK(nested == NULL);

	callbackcheckedrecords_interval_t_clear(&recovery);
	callbackcheckedrecords_interval_t_clear(&argument);
	callbackcheckedrecords_interval_t_clear(&returned);
	callbackcheckedrecords_weighted_t_clear(&weighted_recovery);
	callbackcheckedrecords_weighted_t_clear(&weighted_argument);
	mpz_clears(seed, marker, out, NULL);
	printf("callback-checked-record-native-ok:%u\n", checks);
	return 0;
}
