#include "zeropayloadcheckedrecords.h"
#include "zeropayloadcheckedrecords_runtime.h"

#include <stdlib.h>
#include <string.h>


static const zeropayloadcheckedrecords_runtime_v1 *zeropayloadcheckedrecords_runtime = NULL;
static const zeropayloadcheckedrecords_runtime_v1 *zeropayloadcheckedrecords_attempted_runtime = NULL;
static zeropayloadcheckedrecords_status zeropayloadcheckedrecords_initialization_failure = ZEROPAYLOADCHECKEDRECORDS_STATUS_RUNTIME_UNAVAILABLE;

static zeropayloadcheckedrecords_status zeropayloadcheckedrecords_fail(zeropayloadcheckedrecords_status status, zeropayloadcheckedrecords_error_code code, const char *message, zeropayloadcheckedrecords_error *error) {
  if (error != NULL) {
    error->code = code;
    error->message = message;
    error->message_length = strlen(message);
  }
  return status;
}

static zeropayloadcheckedrecords_status zeropayloadcheckedrecords_ready(zeropayloadcheckedrecords_error *error) {
  if (zeropayloadcheckedrecords_runtime != NULL) return ZEROPAYLOADCHECKEDRECORDS_STATUS_OK;
  if (zeropayloadcheckedrecords_attempted_runtime != NULL) return zeropayloadcheckedrecords_fail(zeropayloadcheckedrecords_initialization_failure, ZEROPAYLOADCHECKEDRECORDS_ERROR_UNEXPECTED, "shared runtime initialization failed and will not be retried", error);
  return zeropayloadcheckedrecords_fail(ZEROPAYLOADCHECKEDRECORDS_STATUS_RUNTIME_UNAVAILABLE, ZEROPAYLOADCHECKEDRECORDS_ERROR_RUNTIME_UNAVAILABLE, "the shared runtime is not installed", error);
}

zeropayloadcheckedrecords_status zeropayloadcheckedrecords_runtime_install_v1(const zeropayloadcheckedrecords_runtime_v1 *runtime, zeropayloadcheckedrecords_error *error) {
  if (runtime == NULL || runtime->abi_version != ZEROPAYLOADCHECKEDRECORDS_BINDING_ABI_VERSION) {
    return zeropayloadcheckedrecords_fail(ZEROPAYLOADCHECKEDRECORDS_STATUS_RUNTIME_REJECTED, ZEROPAYLOADCHECKEDRECORDS_ERROR_INVALID_ARGUMENT, "the runtime ABI is incompatible", error);
  }
  if (zeropayloadcheckedrecords_attempted_runtime != NULL) {
    if (zeropayloadcheckedrecords_attempted_runtime != runtime) return zeropayloadcheckedrecords_fail(ZEROPAYLOADCHECKEDRECORDS_STATUS_RUNTIME_REJECTED, ZEROPAYLOADCHECKEDRECORDS_ERROR_INVALID_ARGUMENT, "a different shared runtime is already installed", error);
    if (zeropayloadcheckedrecords_runtime != NULL) return ZEROPAYLOADCHECKEDRECORDS_STATUS_OK;
    return zeropayloadcheckedrecords_fail(zeropayloadcheckedrecords_initialization_failure, ZEROPAYLOADCHECKEDRECORDS_ERROR_UNEXPECTED, "shared runtime initialization failed and will not be retried", error);
  }
  zeropayloadcheckedrecords_attempted_runtime = runtime;
  zeropayloadcheckedrecords_runtime = runtime;
  if (runtime->initialize == NULL) return ZEROPAYLOADCHECKEDRECORDS_STATUS_OK;
  zeropayloadcheckedrecords_status status = runtime->initialize(runtime->context, error);
  if (status != ZEROPAYLOADCHECKEDRECORDS_STATUS_OK) {
    zeropayloadcheckedrecords_initialization_failure = status;
    zeropayloadcheckedrecords_runtime = NULL;
  }
  return status;
}

void zeropayloadcheckedrecords_nat_clear(zeropayloadcheckedrecords_nat *value) {
  if (value == NULL) return;
  if (value->release != NULL && value->owner != NULL) value->release(value->owner);
  memset(value, 0, sizeof(*value));
}

void zeropayloadcheckedrecords_array_lean_zero_payload_checked_records_witness_span_clear(zeropayloadcheckedrecords_array_lean_zero_payload_checked_records_witness_span *value) {
  if (value == NULL) return;
  if (value->release != NULL && value->owner != NULL) value->release(value->owner);
  memset(value, 0, sizeof(*value));
}

void zeropayloadcheckedrecords_mark_init(zeropayloadcheckedrecords_mark *value) { if (value) memset(value, 0, sizeof(*value)); }
void zeropayloadcheckedrecords_mark_clear(zeropayloadcheckedrecords_mark *value) {
  if (value == NULL) return;
  switch (value->kind) {
    case 0:
      break;
    case 1:
      zeropayloadcheckedrecords_witness_clear(&value->cases.marked.witness);
      break;
    default: break;
  }
  memset(value, 0, sizeof(*value));
}

zeropayloadcheckedrecords_status zeropayloadcheckedrecords_mark_select(zeropayloadcheckedrecords_mark *value, uint32_t kind) {
  if (!value || kind >= 2 || value->kind >= 2) return ZEROPAYLOADCHECKEDRECORDS_STATUS_INVALID_ARGUMENT;
  zeropayloadcheckedrecords_mark_clear(value); value->kind = kind; return ZEROPAYLOADCHECKEDRECORDS_STATUS_OK;
}

void zeropayloadcheckedrecords_marker_clear(zeropayloadcheckedrecords_marker *value) {
  if (value == NULL) return;
  memset(value, 0, sizeof(*value));
}

void zeropayloadcheckedrecords_token_clear(zeropayloadcheckedrecords_token *value) {
  if (value == NULL) return;
  memset(value, 0, sizeof(*value));
}

void zeropayloadcheckedrecords_witness_clear(zeropayloadcheckedrecords_witness *value) {
  if (value == NULL) return;
  memset(value, 0, sizeof(*value));
}

void zeropayloadcheckedrecords_option_lean_zero_payload_checked_records_witness_value_clear(zeropayloadcheckedrecords_option_lean_zero_payload_checked_records_witness_value *value) {
  if (value == NULL) return;
  zeropayloadcheckedrecords_witness_clear(&value->value);
  memset(value, 0, sizeof(*value));
}

zeropayloadcheckedrecords_status zeropayloadcheckedrecords_maybe_witness(bool value0, zeropayloadcheckedrecords_option_lean_zero_payload_checked_records_witness_value *out, zeropayloadcheckedrecords_error *error) {
  zeropayloadcheckedrecords_status ready = zeropayloadcheckedrecords_ready(error);
  if (ready != ZEROPAYLOADCHECKEDRECORDS_STATUS_OK) return ready;
  if (out == NULL) {
    return zeropayloadcheckedrecords_fail(ZEROPAYLOADCHECKEDRECORDS_STATUS_INVALID_ARGUMENT, ZEROPAYLOADCHECKEDRECORDS_ERROR_INVALID_ARGUMENT, "a required C argument is null", error);
  }
  if (zeropayloadcheckedrecords_runtime->maybe_witness == NULL) return zeropayloadcheckedrecords_fail(ZEROPAYLOADCHECKEDRECORDS_STATUS_RUNTIME_REJECTED, ZEROPAYLOADCHECKEDRECORDS_ERROR_RUNTIME_UNAVAILABLE, "the runtime does not implement zeropayloadcheckedrecords_maybe_witness", error);
  zeropayloadcheckedrecords_status status = zeropayloadcheckedrecords_runtime->maybe_witness(zeropayloadcheckedrecords_runtime->context, value0, out, error);
  return status;
}

zeropayloadcheckedrecords_status zeropayloadcheckedrecords_produce_mark(bool value0, zeropayloadcheckedrecords_mark *out, zeropayloadcheckedrecords_error *error) {
  zeropayloadcheckedrecords_status ready = zeropayloadcheckedrecords_ready(error);
  if (ready != ZEROPAYLOADCHECKEDRECORDS_STATUS_OK) return ready;
  if (out == NULL) {
    return zeropayloadcheckedrecords_fail(ZEROPAYLOADCHECKEDRECORDS_STATUS_INVALID_ARGUMENT, ZEROPAYLOADCHECKEDRECORDS_ERROR_INVALID_ARGUMENT, "a required C argument is null", error);
  }
  if (zeropayloadcheckedrecords_runtime->produce_mark == NULL) return zeropayloadcheckedrecords_fail(ZEROPAYLOADCHECKEDRECORDS_STATUS_RUNTIME_REJECTED, ZEROPAYLOADCHECKEDRECORDS_ERROR_RUNTIME_UNAVAILABLE, "the runtime does not implement zeropayloadcheckedrecords_produce_mark", error);
  zeropayloadcheckedrecords_status status = zeropayloadcheckedrecords_runtime->produce_mark(zeropayloadcheckedrecords_runtime->context, value0, out, error);
  return status;
}

zeropayloadcheckedrecords_status zeropayloadcheckedrecords_produce_marker(zeropayloadcheckedrecords_marker *out, zeropayloadcheckedrecords_error *error) {
  zeropayloadcheckedrecords_status ready = zeropayloadcheckedrecords_ready(error);
  if (ready != ZEROPAYLOADCHECKEDRECORDS_STATUS_OK) return ready;
  if (out == NULL) {
    return zeropayloadcheckedrecords_fail(ZEROPAYLOADCHECKEDRECORDS_STATUS_INVALID_ARGUMENT, ZEROPAYLOADCHECKEDRECORDS_ERROR_INVALID_ARGUMENT, "a required C argument is null", error);
  }
  if (zeropayloadcheckedrecords_runtime->produce_marker == NULL) return zeropayloadcheckedrecords_fail(ZEROPAYLOADCHECKEDRECORDS_STATUS_RUNTIME_REJECTED, ZEROPAYLOADCHECKEDRECORDS_ERROR_RUNTIME_UNAVAILABLE, "the runtime does not implement zeropayloadcheckedrecords_produce_marker", error);
  zeropayloadcheckedrecords_status status = zeropayloadcheckedrecords_runtime->produce_marker(zeropayloadcheckedrecords_runtime->context, out, error);
  return status;
}

zeropayloadcheckedrecords_status zeropayloadcheckedrecords_produce_token(zeropayloadcheckedrecords_token *out, zeropayloadcheckedrecords_error *error) {
  zeropayloadcheckedrecords_status ready = zeropayloadcheckedrecords_ready(error);
  if (ready != ZEROPAYLOADCHECKEDRECORDS_STATUS_OK) return ready;
  if (out == NULL) {
    return zeropayloadcheckedrecords_fail(ZEROPAYLOADCHECKEDRECORDS_STATUS_INVALID_ARGUMENT, ZEROPAYLOADCHECKEDRECORDS_ERROR_INVALID_ARGUMENT, "a required C argument is null", error);
  }
  if (zeropayloadcheckedrecords_runtime->produce_token == NULL) return zeropayloadcheckedrecords_fail(ZEROPAYLOADCHECKEDRECORDS_STATUS_RUNTIME_REJECTED, ZEROPAYLOADCHECKEDRECORDS_ERROR_RUNTIME_UNAVAILABLE, "the runtime does not implement zeropayloadcheckedrecords_produce_token", error);
  zeropayloadcheckedrecords_status status = zeropayloadcheckedrecords_runtime->produce_token(zeropayloadcheckedrecords_runtime->context, out, error);
  return status;
}

zeropayloadcheckedrecords_status zeropayloadcheckedrecords_produce_witness(zeropayloadcheckedrecords_witness *out, zeropayloadcheckedrecords_error *error) {
  zeropayloadcheckedrecords_status ready = zeropayloadcheckedrecords_ready(error);
  if (ready != ZEROPAYLOADCHECKEDRECORDS_STATUS_OK) return ready;
  if (out == NULL) {
    return zeropayloadcheckedrecords_fail(ZEROPAYLOADCHECKEDRECORDS_STATUS_INVALID_ARGUMENT, ZEROPAYLOADCHECKEDRECORDS_ERROR_INVALID_ARGUMENT, "a required C argument is null", error);
  }
  if (zeropayloadcheckedrecords_runtime->produce_witness == NULL) return zeropayloadcheckedrecords_fail(ZEROPAYLOADCHECKEDRECORDS_STATUS_RUNTIME_REJECTED, ZEROPAYLOADCHECKEDRECORDS_ERROR_RUNTIME_UNAVAILABLE, "the runtime does not implement zeropayloadcheckedrecords_produce_witness", error);
  zeropayloadcheckedrecords_status status = zeropayloadcheckedrecords_runtime->produce_witness(zeropayloadcheckedrecords_runtime->context, out, error);
  return status;
}

zeropayloadcheckedrecords_status zeropayloadcheckedrecords_witnesses(const zeropayloadcheckedrecords_nat *value0, zeropayloadcheckedrecords_array_lean_zero_payload_checked_records_witness_span *out, zeropayloadcheckedrecords_error *error) {
  zeropayloadcheckedrecords_status ready = zeropayloadcheckedrecords_ready(error);
  if (ready != ZEROPAYLOADCHECKEDRECORDS_STATUS_OK) return ready;
  if (value0 == NULL || out == NULL) {
    return zeropayloadcheckedrecords_fail(ZEROPAYLOADCHECKEDRECORDS_STATUS_INVALID_ARGUMENT, ZEROPAYLOADCHECKEDRECORDS_ERROR_INVALID_ARGUMENT, "a required C argument is null", error);
  }
  if (zeropayloadcheckedrecords_runtime->witnesses == NULL) return zeropayloadcheckedrecords_fail(ZEROPAYLOADCHECKEDRECORDS_STATUS_RUNTIME_REJECTED, ZEROPAYLOADCHECKEDRECORDS_ERROR_RUNTIME_UNAVAILABLE, "the runtime does not implement zeropayloadcheckedrecords_witnesses", error);
  zeropayloadcheckedrecords_status status = zeropayloadcheckedrecords_runtime->witnesses(zeropayloadcheckedrecords_runtime->context, value0, out, error);
  return status;
}
