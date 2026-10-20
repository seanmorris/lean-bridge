#include <callbacksubtypes.h>

#include <stdio.h>
#include <string.h>

#define CALL_(type) type##_call
#define CALL(type) CALL_(type)
#define DISPOSE_(type) type##_dispose
#define DISPOSE(type) DISPOSE_(type)

static unsigned checks;
#define CHECK(test) do { if (!(test)) { fprintf(stderr, "failed at line %d: %s\n", __LINE__, #test); return 1; } ++checks; } while (0)
#define OK(call) ((call) == CALLBACKSUBTYPES_STATUS_OK)

static unsigned callback_calls;
static callbacksubtypes_status increment(void *context, mpz_srcptr value,
		mpz_ptr out, callbacksubtypes_error *error) {
	(void)context; (void)error; ++callback_calls;
	mpz_add_ui(out, value, 1);
	return CALLBACKSUBTYPES_STATUS_OK;
}
static callbacksubtypes_status invalid(void *context, mpz_srcptr value,
		mpz_ptr out, callbacksubtypes_error *error) {
	(void)context; (void)value; (void)error; ++callback_calls;
	mpz_set_ui(out, 0);
	return CALLBACKSUBTYPES_STATUS_OK;
}
static callbacksubtypes_status mixed(void *context, mpz_srcptr marker,
		mpz_srcptr value, mpz_ptr out, callbacksubtypes_error *error) {
	(void)context; (void)error; ++callback_calls;
	if(mpz_cmp_ui(marker, 7) != 0) return CALLBACKSUBTYPES_STATUS_INVALID_ARGUMENT;
	mpz_add_ui(out, value, 2);
	return CALLBACKSUBTYPES_STATUS_OK;
}

int main(void) {
	callbacksubtypes_error error = {0};
	CHECK(OK(callbacksubtypes_initialize(&error)));
	mpz_t recovery, argument, marker, out;
	mpz_inits(recovery, argument, marker, out, NULL);
	mpz_set_ui(recovery, 1);

	HOST_SCALAR host = {.call = increment, .context = NULL, .recovery = recovery};
	CHECK(OK(callbacksubtypes_call_host(&host, out, &error)) && mpz_cmp_ui(out, 2) == 0);
	unsigned before = callback_calls;
	mpz_set_ui(recovery, 0); mpz_set_ui(out, 99);
	CHECK(callbacksubtypes_call_host(&host, out, &error) == CALLBACKSUBTYPES_STATUS_INVALID_ARGUMENT
		&& callback_calls == before && mpz_cmp_ui(out, 99) == 0);
	mpz_set_ui(recovery, 1); host.call = invalid; mpz_set_ui(out, 99);
	CHECK(callbacksubtypes_call_host(&host, out, &error) == CALLBACKSUBTYPES_STATUS_INVALID_ARGUMENT
		&& callback_calls == before + 1 && mpz_cmp_ui(out, 99) == 0);
	host.call = increment;
	CHECK(OK(callbacksubtypes_call_host(&host, out, &error)) && mpz_cmp_ui(out, 2) == 0);

	HOST_MIXED host_mixed = {.call = mixed, .context = NULL, .recovery = recovery};
	CHECK(OK(callbacksubtypes_call_host_mixed(&host_mixed, out, &error)) && mpz_cmp_ui(out, 3) == 0);

	CLOSURE_SCALAR *closure = NULL; mpz_set_ui(argument, 9);
	CHECK(OK(callbacksubtypes_make_closure(argument, &closure, &error)) && closure);
	mpz_set_ui(argument, 2);
	CHECK(OK(CALL(CLOSURE_SCALAR)(closure, argument, out, &error)) && mpz_cmp_ui(out, 2) == 0);
	mpz_set_ui(argument, 0); mpz_set_ui(out, 99);
	CHECK(CALL(CLOSURE_SCALAR)(closure, argument, out, &error) == CALLBACKSUBTYPES_STATUS_INVALID_ARGUMENT
		&& mpz_cmp_ui(out, 99) == 0);
	mpz_set_ui(argument, 3);
	CHECK(OK(CALL(CLOSURE_SCALAR)(closure, argument, out, &error)) && mpz_cmp_ui(out, 3) == 0);
	DISPOSE(CLOSURE_SCALAR)(&closure); CHECK(closure == NULL);

	CLOSURE_MIXED *owned_mixed = NULL; mpz_set_ui(argument, 0);
	CHECK(OK(callbacksubtypes_make_mixed_closure(argument, &owned_mixed, &error)) && owned_mixed);
	mpz_set_ui(marker, 9); mpz_set_ui(argument, 2);
	CHECK(OK(CALL(CLOSURE_MIXED)(owned_mixed, marker, argument, out, &error)) && mpz_cmp_ui(out, 2) == 0);
	mpz_set_ui(argument, 0); mpz_set_ui(out, 99);
	CHECK(CALL(CLOSURE_MIXED)(owned_mixed, marker, argument, out, &error) == CALLBACKSUBTYPES_STATUS_INVALID_ARGUMENT
		&& mpz_cmp_ui(out, 99) == 0);
	mpz_set_ui(argument, 3);
	CHECK(OK(CALL(CLOSURE_MIXED)(owned_mixed, marker, argument, out, &error)) && mpz_cmp_ui(out, 3) == 0);
	DISPOSE(CLOSURE_MIXED)(&owned_mixed); CHECK(owned_mixed == NULL);

	mpz_clears(recovery, argument, marker, out, NULL);
	printf("callback-subtype-native-ok:%u\n", checks);
	return 0;
}
