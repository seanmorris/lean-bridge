#include "checkedrecordvalueindices.h"
#include "checkedrecordvalueindices_runtime.h"

#include <stdlib.h>
#include <string.h>


static const checkedrecordvalueindices_runtime_v1 *checkedrecordvalueindices_runtime = NULL;
static const checkedrecordvalueindices_runtime_v1 *checkedrecordvalueindices_attempted_runtime = NULL;
static checkedrecordvalueindices_status checkedrecordvalueindices_initialization_failure = CHECKEDRECORDVALUEINDICES_STATUS_RUNTIME_UNAVAILABLE;

static checkedrecordvalueindices_status checkedrecordvalueindices_fail(checkedrecordvalueindices_status status, checkedrecordvalueindices_error_code code, const char *message, checkedrecordvalueindices_error *error) {
  if (error != NULL) {
    error->code = code;
    error->message = message;
    error->message_length = strlen(message);
  }
  return status;
}

static checkedrecordvalueindices_status checkedrecordvalueindices_ready(checkedrecordvalueindices_error *error) {
  if (checkedrecordvalueindices_runtime != NULL) return CHECKEDRECORDVALUEINDICES_STATUS_OK;
  if (checkedrecordvalueindices_attempted_runtime != NULL) return checkedrecordvalueindices_fail(checkedrecordvalueindices_initialization_failure, CHECKEDRECORDVALUEINDICES_ERROR_UNEXPECTED, "shared runtime initialization failed and will not be retried", error);
  return checkedrecordvalueindices_fail(CHECKEDRECORDVALUEINDICES_STATUS_RUNTIME_UNAVAILABLE, CHECKEDRECORDVALUEINDICES_ERROR_RUNTIME_UNAVAILABLE, "the shared runtime is not installed", error);
}

checkedrecordvalueindices_status checkedrecordvalueindices_runtime_install_v1(const checkedrecordvalueindices_runtime_v1 *runtime, checkedrecordvalueindices_error *error) {
  if (runtime == NULL || runtime->abi_version != CHECKEDRECORDVALUEINDICES_BINDING_ABI_VERSION) {
    return checkedrecordvalueindices_fail(CHECKEDRECORDVALUEINDICES_STATUS_RUNTIME_REJECTED, CHECKEDRECORDVALUEINDICES_ERROR_INVALID_ARGUMENT, "the runtime ABI is incompatible", error);
  }
  if (checkedrecordvalueindices_attempted_runtime != NULL) {
    if (checkedrecordvalueindices_attempted_runtime != runtime) return checkedrecordvalueindices_fail(CHECKEDRECORDVALUEINDICES_STATUS_RUNTIME_REJECTED, CHECKEDRECORDVALUEINDICES_ERROR_INVALID_ARGUMENT, "a different shared runtime is already installed", error);
    if (checkedrecordvalueindices_runtime != NULL) return CHECKEDRECORDVALUEINDICES_STATUS_OK;
    return checkedrecordvalueindices_fail(checkedrecordvalueindices_initialization_failure, CHECKEDRECORDVALUEINDICES_ERROR_UNEXPECTED, "shared runtime initialization failed and will not be retried", error);
  }
  checkedrecordvalueindices_attempted_runtime = runtime;
  checkedrecordvalueindices_runtime = runtime;
  if (runtime->initialize == NULL) return CHECKEDRECORDVALUEINDICES_STATUS_OK;
  checkedrecordvalueindices_status status = runtime->initialize(runtime->context, error);
  if (status != CHECKEDRECORDVALUEINDICES_STATUS_OK) {
    checkedrecordvalueindices_initialization_failure = status;
    checkedrecordvalueindices_runtime = NULL;
  }
  return status;
}

void checkedrecordvalueindices_nat_clear(checkedrecordvalueindices_nat *value) {
  if (value == NULL) return;
  if (value->release != NULL && value->owner != NULL) value->release(value->owner);
  memset(value, 0, sizeof(*value));
}

void checkedrecordvalueindices_array_nat_span_clear(checkedrecordvalueindices_array_nat_span *value) {
  if (value == NULL) return;
  if (value->release != NULL && value->owner != NULL) value->release(value->owner);
  memset(value, 0, sizeof(*value));
}

void checkedrecordvalueindices_ab_clear(checkedrecordvalueindices_ab *value) {
  if (value == NULL) return;
  checkedrecordvalueindices_nat_clear(&value->size);
  memset(value, 0, sizeof(*value));
}

void checkedrecordvalueindices_empty_sized_clear(checkedrecordvalueindices_empty_sized *value) {
  if (value == NULL) return;
  checkedrecordvalueindices_array_nat_span_clear(&value->data);
  memset(value, 0, sizeof(*value));
}

void checkedrecordvalueindices_empty_token_clear(checkedrecordvalueindices_empty_token *value) {
  if (value == NULL) return;
  checkedrecordvalueindices_nat_clear(&value->count);
  memset(value, 0, sizeof(*value));
}

void checkedrecordvalueindices_off_clear(checkedrecordvalueindices_off *value) {
  if (value == NULL) return;
  checkedrecordvalueindices_nat_clear(&value->count);
  memset(value, 0, sizeof(*value));
}

void checkedrecordvalueindices_on_clear(checkedrecordvalueindices_on *value) {
  if (value == NULL) return;
  checkedrecordvalueindices_nat_clear(&value->count);
  memset(value, 0, sizeof(*value));
}

void checkedrecordvalueindices_unicode_token_clear(checkedrecordvalueindices_unicode_token *value) {
  if (value == NULL) return;
  checkedrecordvalueindices_nat_clear(&value->count);
  memset(value, 0, sizeof(*value));
}

void checkedrecordvalueindices_wide_token_clear(checkedrecordvalueindices_wide_token *value) {
  if (value == NULL) return;
  checkedrecordvalueindices_nat_clear(&value->count);
  memset(value, 0, sizeof(*value));
}

void checkedrecordvalueindices_zero_token_clear(checkedrecordvalueindices_zero_token *value) {
  if (value == NULL) return;
  checkedrecordvalueindices_nat_clear(&value->count);
  memset(value, 0, sizeof(*value));
}

checkedrecordvalueindices_status checkedrecordvalueindices_produce_ab(checkedrecordvalueindices_ab *out, checkedrecordvalueindices_error *error) {
  checkedrecordvalueindices_status ready = checkedrecordvalueindices_ready(error);
  if (ready != CHECKEDRECORDVALUEINDICES_STATUS_OK) return ready;
  if (out == NULL) {
    return checkedrecordvalueindices_fail(CHECKEDRECORDVALUEINDICES_STATUS_INVALID_ARGUMENT, CHECKEDRECORDVALUEINDICES_ERROR_INVALID_ARGUMENT, "a required C argument is null", error);
  }
  if (checkedrecordvalueindices_runtime->produce_ab == NULL) return checkedrecordvalueindices_fail(CHECKEDRECORDVALUEINDICES_STATUS_RUNTIME_REJECTED, CHECKEDRECORDVALUEINDICES_ERROR_RUNTIME_UNAVAILABLE, "the runtime does not implement checkedrecordvalueindices_produce_ab", error);
  checkedrecordvalueindices_status status = checkedrecordvalueindices_runtime->produce_ab(checkedrecordvalueindices_runtime->context, out, error);
  return status;
}

checkedrecordvalueindices_status checkedrecordvalueindices_produce_empty_sized(checkedrecordvalueindices_empty_sized *out, checkedrecordvalueindices_error *error) {
  checkedrecordvalueindices_status ready = checkedrecordvalueindices_ready(error);
  if (ready != CHECKEDRECORDVALUEINDICES_STATUS_OK) return ready;
  if (out == NULL) {
    return checkedrecordvalueindices_fail(CHECKEDRECORDVALUEINDICES_STATUS_INVALID_ARGUMENT, CHECKEDRECORDVALUEINDICES_ERROR_INVALID_ARGUMENT, "a required C argument is null", error);
  }
  if (checkedrecordvalueindices_runtime->produce_empty_sized == NULL) return checkedrecordvalueindices_fail(CHECKEDRECORDVALUEINDICES_STATUS_RUNTIME_REJECTED, CHECKEDRECORDVALUEINDICES_ERROR_RUNTIME_UNAVAILABLE, "the runtime does not implement checkedrecordvalueindices_produce_empty_sized", error);
  checkedrecordvalueindices_status status = checkedrecordvalueindices_runtime->produce_empty_sized(checkedrecordvalueindices_runtime->context, out, error);
  return status;
}

checkedrecordvalueindices_status checkedrecordvalueindices_produce_empty_string(const checkedrecordvalueindices_nat *arg0, checkedrecordvalueindices_empty_token *out, checkedrecordvalueindices_error *error) {
  checkedrecordvalueindices_status ready = checkedrecordvalueindices_ready(error);
  if (ready != CHECKEDRECORDVALUEINDICES_STATUS_OK) return ready;
  if (arg0 == NULL || out == NULL) {
    return checkedrecordvalueindices_fail(CHECKEDRECORDVALUEINDICES_STATUS_INVALID_ARGUMENT, CHECKEDRECORDVALUEINDICES_ERROR_INVALID_ARGUMENT, "a required C argument is null", error);
  }
  if (checkedrecordvalueindices_runtime->produce_empty_string == NULL) return checkedrecordvalueindices_fail(CHECKEDRECORDVALUEINDICES_STATUS_RUNTIME_REJECTED, CHECKEDRECORDVALUEINDICES_ERROR_RUNTIME_UNAVAILABLE, "the runtime does not implement checkedrecordvalueindices_produce_empty_string", error);
  checkedrecordvalueindices_status status = checkedrecordvalueindices_runtime->produce_empty_string(checkedrecordvalueindices_runtime->context, arg0, out, error);
  return status;
}

checkedrecordvalueindices_status checkedrecordvalueindices_produce_false_bool(checkedrecordvalueindices_off *out, checkedrecordvalueindices_error *error) {
  checkedrecordvalueindices_status ready = checkedrecordvalueindices_ready(error);
  if (ready != CHECKEDRECORDVALUEINDICES_STATUS_OK) return ready;
  if (out == NULL) {
    return checkedrecordvalueindices_fail(CHECKEDRECORDVALUEINDICES_STATUS_INVALID_ARGUMENT, CHECKEDRECORDVALUEINDICES_ERROR_INVALID_ARGUMENT, "a required C argument is null", error);
  }
  if (checkedrecordvalueindices_runtime->produce_false_bool == NULL) return checkedrecordvalueindices_fail(CHECKEDRECORDVALUEINDICES_STATUS_RUNTIME_REJECTED, CHECKEDRECORDVALUEINDICES_ERROR_RUNTIME_UNAVAILABLE, "the runtime does not implement checkedrecordvalueindices_produce_false_bool", error);
  checkedrecordvalueindices_status status = checkedrecordvalueindices_runtime->produce_false_bool(checkedrecordvalueindices_runtime->context, out, error);
  return status;
}

checkedrecordvalueindices_status checkedrecordvalueindices_produce_true_bool(checkedrecordvalueindices_on *out, checkedrecordvalueindices_error *error) {
  checkedrecordvalueindices_status ready = checkedrecordvalueindices_ready(error);
  if (ready != CHECKEDRECORDVALUEINDICES_STATUS_OK) return ready;
  if (out == NULL) {
    return checkedrecordvalueindices_fail(CHECKEDRECORDVALUEINDICES_STATUS_INVALID_ARGUMENT, CHECKEDRECORDVALUEINDICES_ERROR_INVALID_ARGUMENT, "a required C argument is null", error);
  }
  if (checkedrecordvalueindices_runtime->produce_true_bool == NULL) return checkedrecordvalueindices_fail(CHECKEDRECORDVALUEINDICES_STATUS_RUNTIME_REJECTED, CHECKEDRECORDVALUEINDICES_ERROR_RUNTIME_UNAVAILABLE, "the runtime does not implement checkedrecordvalueindices_produce_true_bool", error);
  checkedrecordvalueindices_status status = checkedrecordvalueindices_runtime->produce_true_bool(checkedrecordvalueindices_runtime->context, out, error);
  return status;
}

checkedrecordvalueindices_status checkedrecordvalueindices_produce_unicode_string(const checkedrecordvalueindices_nat *arg0, checkedrecordvalueindices_unicode_token *out, checkedrecordvalueindices_error *error) {
  checkedrecordvalueindices_status ready = checkedrecordvalueindices_ready(error);
  if (ready != CHECKEDRECORDVALUEINDICES_STATUS_OK) return ready;
  if (arg0 == NULL || out == NULL) {
    return checkedrecordvalueindices_fail(CHECKEDRECORDVALUEINDICES_STATUS_INVALID_ARGUMENT, CHECKEDRECORDVALUEINDICES_ERROR_INVALID_ARGUMENT, "a required C argument is null", error);
  }
  if (checkedrecordvalueindices_runtime->produce_unicode_string == NULL) return checkedrecordvalueindices_fail(CHECKEDRECORDVALUEINDICES_STATUS_RUNTIME_REJECTED, CHECKEDRECORDVALUEINDICES_ERROR_RUNTIME_UNAVAILABLE, "the runtime does not implement checkedrecordvalueindices_produce_unicode_string", error);
  checkedrecordvalueindices_status status = checkedrecordvalueindices_runtime->produce_unicode_string(checkedrecordvalueindices_runtime->context, arg0, out, error);
  return status;
}

checkedrecordvalueindices_status checkedrecordvalueindices_produce_wide_nat(const checkedrecordvalueindices_nat *arg0, checkedrecordvalueindices_wide_token *out, checkedrecordvalueindices_error *error) {
  checkedrecordvalueindices_status ready = checkedrecordvalueindices_ready(error);
  if (ready != CHECKEDRECORDVALUEINDICES_STATUS_OK) return ready;
  if (arg0 == NULL || out == NULL) {
    return checkedrecordvalueindices_fail(CHECKEDRECORDVALUEINDICES_STATUS_INVALID_ARGUMENT, CHECKEDRECORDVALUEINDICES_ERROR_INVALID_ARGUMENT, "a required C argument is null", error);
  }
  if (checkedrecordvalueindices_runtime->produce_wide_nat == NULL) return checkedrecordvalueindices_fail(CHECKEDRECORDVALUEINDICES_STATUS_RUNTIME_REJECTED, CHECKEDRECORDVALUEINDICES_ERROR_RUNTIME_UNAVAILABLE, "the runtime does not implement checkedrecordvalueindices_produce_wide_nat", error);
  checkedrecordvalueindices_status status = checkedrecordvalueindices_runtime->produce_wide_nat(checkedrecordvalueindices_runtime->context, arg0, out, error);
  return status;
}

checkedrecordvalueindices_status checkedrecordvalueindices_produce_zero_nat(const checkedrecordvalueindices_nat *arg0, checkedrecordvalueindices_zero_token *out, checkedrecordvalueindices_error *error) {
  checkedrecordvalueindices_status ready = checkedrecordvalueindices_ready(error);
  if (ready != CHECKEDRECORDVALUEINDICES_STATUS_OK) return ready;
  if (arg0 == NULL || out == NULL) {
    return checkedrecordvalueindices_fail(CHECKEDRECORDVALUEINDICES_STATUS_INVALID_ARGUMENT, CHECKEDRECORDVALUEINDICES_ERROR_INVALID_ARGUMENT, "a required C argument is null", error);
  }
  if (checkedrecordvalueindices_runtime->produce_zero_nat == NULL) return checkedrecordvalueindices_fail(CHECKEDRECORDVALUEINDICES_STATUS_RUNTIME_REJECTED, CHECKEDRECORDVALUEINDICES_ERROR_RUNTIME_UNAVAILABLE, "the runtime does not implement checkedrecordvalueindices_produce_zero_nat", error);
  checkedrecordvalueindices_status status = checkedrecordvalueindices_runtime->produce_zero_nat(checkedrecordvalueindices_runtime->context, arg0, out, error);
  return status;
}
