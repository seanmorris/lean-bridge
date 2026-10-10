#include "subtypes.h"
#include "subtypes_runtime.h"

#include <stdlib.h>
#include <string.h>


static const subtypes_runtime_v1 *subtypes_runtime = NULL;
static const subtypes_runtime_v1 *subtypes_attempted_runtime = NULL;
static subtypes_status subtypes_initialization_failure = SUBTYPES_STATUS_RUNTIME_UNAVAILABLE;

static subtypes_status subtypes_fail(subtypes_status status, subtypes_error_code code, const char *message, subtypes_error *error) {
  if (error != NULL) {
    error->code = code;
    error->message = message;
    error->message_length = strlen(message);
  }
  return status;
}

static subtypes_status subtypes_ready(subtypes_error *error) {
  if (subtypes_runtime != NULL) return SUBTYPES_STATUS_OK;
  if (subtypes_attempted_runtime != NULL) return subtypes_fail(subtypes_initialization_failure, SUBTYPES_ERROR_UNEXPECTED, "shared runtime initialization failed and will not be retried", error);
  return subtypes_fail(SUBTYPES_STATUS_RUNTIME_UNAVAILABLE, SUBTYPES_ERROR_RUNTIME_UNAVAILABLE, "the shared runtime is not installed", error);
}

subtypes_status subtypes_runtime_install_v1(const subtypes_runtime_v1 *runtime, subtypes_error *error) {
  if (runtime == NULL || runtime->abi_version != SUBTYPES_BINDING_ABI_VERSION) {
    return subtypes_fail(SUBTYPES_STATUS_RUNTIME_REJECTED, SUBTYPES_ERROR_INVALID_ARGUMENT, "the runtime ABI is incompatible", error);
  }
  if (subtypes_attempted_runtime != NULL) {
    if (subtypes_attempted_runtime != runtime) return subtypes_fail(SUBTYPES_STATUS_RUNTIME_REJECTED, SUBTYPES_ERROR_INVALID_ARGUMENT, "a different shared runtime is already installed", error);
    if (subtypes_runtime != NULL) return SUBTYPES_STATUS_OK;
    return subtypes_fail(subtypes_initialization_failure, SUBTYPES_ERROR_UNEXPECTED, "shared runtime initialization failed and will not be retried", error);
  }
  subtypes_attempted_runtime = runtime;
  subtypes_runtime = runtime;
  if (runtime->initialize == NULL) return SUBTYPES_STATUS_OK;
  subtypes_status status = runtime->initialize(runtime->context, error);
  if (status != SUBTYPES_STATUS_OK) {
    subtypes_initialization_failure = status;
    subtypes_runtime = NULL;
  }
  return status;
}

void subtypes_nat_clear(subtypes_nat *value) {
  if (value == NULL) return;
  if (value->release != NULL && value->owner != NULL) value->release(value->owner);
  memset(value, 0, sizeof(*value));
}

void subtypes_bytes_clear(subtypes_bytes *value) {
  if (value == NULL) return;
  if (value->release != NULL && value->owner != NULL) value->release(value->owner);
  memset(value, 0, sizeof(*value));
}

void subtypes_string_clear(subtypes_string *value) {
  if (value == NULL) return;
  if (value->release != NULL && value->owner != NULL) value->release(value->owner);
  memset(value, 0, sizeof(*value));
}

void subtypes_int_clear(subtypes_int *value) {
  if (value == NULL) return;
  if (value->release != NULL && value->owner != NULL) value->release(value->owner);
  memset(value, 0, sizeof(*value));
}

subtypes_status subtypes_byte(uint8_t arg0, uint8_t *out, subtypes_error *error) {
  subtypes_status ready = subtypes_ready(error);
  if (ready != SUBTYPES_STATUS_OK) return ready;
  if (out == NULL) {
    return subtypes_fail(SUBTYPES_STATUS_INVALID_ARGUMENT, SUBTYPES_ERROR_INVALID_ARGUMENT, "a required C argument is null", error);
  }
  if (subtypes_runtime->byte == NULL) return subtypes_fail(SUBTYPES_STATUS_RUNTIME_REJECTED, SUBTYPES_ERROR_RUNTIME_UNAVAILABLE, "the runtime does not implement subtypes_byte", error);
  subtypes_status status = subtypes_runtime->byte(subtypes_runtime->context, arg0, out, error);
  return status;
}

subtypes_status subtypes_clamp(const subtypes_nat *arg0, subtypes_nat *out, subtypes_error *error) {
  subtypes_status ready = subtypes_ready(error);
  if (ready != SUBTYPES_STATUS_OK) return ready;
  if (arg0 == NULL || out == NULL) {
    return subtypes_fail(SUBTYPES_STATUS_INVALID_ARGUMENT, SUBTYPES_ERROR_INVALID_ARGUMENT, "a required C argument is null", error);
  }
  if (subtypes_runtime->clamp == NULL) return subtypes_fail(SUBTYPES_STATUS_RUNTIME_REJECTED, SUBTYPES_ERROR_RUNTIME_UNAVAILABLE, "the runtime does not implement subtypes_clamp", error);
  subtypes_status status = subtypes_runtime->clamp(subtypes_runtime->context, arg0, out, error);
  return status;
}

subtypes_status subtypes_first_even(const subtypes_nat *arg0, subtypes_nat *out, subtypes_error *error) {
  subtypes_status ready = subtypes_ready(error);
  if (ready != SUBTYPES_STATUS_OK) return ready;
  if (arg0 == NULL || out == NULL) {
    return subtypes_fail(SUBTYPES_STATUS_INVALID_ARGUMENT, SUBTYPES_ERROR_INVALID_ARGUMENT, "a required C argument is null", error);
  }
  if (subtypes_runtime->first_even == NULL) return subtypes_fail(SUBTYPES_STATUS_RUNTIME_REJECTED, SUBTYPES_ERROR_RUNTIME_UNAVAILABLE, "the runtime does not implement subtypes_first_even", error);
  subtypes_status status = subtypes_runtime->first_even(subtypes_runtime->context, arg0, out, error);
  return status;
}

subtypes_status subtypes_half(const subtypes_nat *arg0, subtypes_nat *out, subtypes_error *error) {
  subtypes_status ready = subtypes_ready(error);
  if (ready != SUBTYPES_STATUS_OK) return ready;
  if (arg0 == NULL || out == NULL) {
    return subtypes_fail(SUBTYPES_STATUS_INVALID_ARGUMENT, SUBTYPES_ERROR_INVALID_ARGUMENT, "a required C argument is null", error);
  }
  if (subtypes_runtime->half == NULL) return subtypes_fail(SUBTYPES_STATUS_RUNTIME_REJECTED, SUBTYPES_ERROR_RUNTIME_UNAVAILABLE, "the runtime does not implement subtypes_half", error);
  subtypes_status status = subtypes_runtime->half(subtypes_runtime->context, arg0, out, error);
  return status;
}

subtypes_status subtypes_head(const subtypes_bytes *arg0, uint8_t *out, subtypes_error *error) {
  subtypes_status ready = subtypes_ready(error);
  if (ready != SUBTYPES_STATUS_OK) return ready;
  if (arg0 == NULL || out == NULL) {
    return subtypes_fail(SUBTYPES_STATUS_INVALID_ARGUMENT, SUBTYPES_ERROR_INVALID_ARGUMENT, "a required C argument is null", error);
  }
  if (subtypes_runtime->head == NULL) return subtypes_fail(SUBTYPES_STATUS_RUNTIME_REJECTED, SUBTYPES_ERROR_RUNTIME_UNAVAILABLE, "the runtime does not implement subtypes_head", error);
  subtypes_status status = subtypes_runtime->head(subtypes_runtime->context, arg0, out, error);
  return status;
}

subtypes_status subtypes_join(const subtypes_string *arg0, const subtypes_string *arg1, subtypes_string *out, subtypes_error *error) {
  subtypes_status ready = subtypes_ready(error);
  if (ready != SUBTYPES_STATUS_OK) return ready;
  if (arg0 == NULL || arg1 == NULL || out == NULL) {
    return subtypes_fail(SUBTYPES_STATUS_INVALID_ARGUMENT, SUBTYPES_ERROR_INVALID_ARGUMENT, "a required C argument is null", error);
  }
  if (subtypes_runtime->join == NULL) return subtypes_fail(SUBTYPES_STATUS_RUNTIME_REJECTED, SUBTYPES_ERROR_RUNTIME_UNAVAILABLE, "the runtime does not implement subtypes_join", error);
  subtypes_status status = subtypes_runtime->join(subtypes_runtime->context, arg0, arg1, out, error);
  return status;
}

subtypes_status subtypes_mix(const subtypes_nat *arg0, const subtypes_nat *arg1, subtypes_nat *out, subtypes_error *error) {
  subtypes_status ready = subtypes_ready(error);
  if (ready != SUBTYPES_STATUS_OK) return ready;
  if (arg0 == NULL || arg1 == NULL || out == NULL) {
    return subtypes_fail(SUBTYPES_STATUS_INVALID_ARGUMENT, SUBTYPES_ERROR_INVALID_ARGUMENT, "a required C argument is null", error);
  }
  if (subtypes_runtime->mix == NULL) return subtypes_fail(SUBTYPES_STATUS_RUNTIME_REJECTED, SUBTYPES_ERROR_RUNTIME_UNAVAILABLE, "the runtime does not implement subtypes_mix", error);
  subtypes_status status = subtypes_runtime->mix(subtypes_runtime->context, arg0, arg1, out, error);
  return status;
}

subtypes_status subtypes_pad(const subtypes_nat *arg0, subtypes_nat *out, subtypes_error *error) {
  subtypes_status ready = subtypes_ready(error);
  if (ready != SUBTYPES_STATUS_OK) return ready;
  if (arg0 == NULL || out == NULL) {
    return subtypes_fail(SUBTYPES_STATUS_INVALID_ARGUMENT, SUBTYPES_ERROR_INVALID_ARGUMENT, "a required C argument is null", error);
  }
  if (subtypes_runtime->pad == NULL) return subtypes_fail(SUBTYPES_STATUS_RUNTIME_REJECTED, SUBTYPES_ERROR_RUNTIME_UNAVAILABLE, "the runtime does not implement subtypes_pad", error);
  subtypes_status status = subtypes_runtime->pad(subtypes_runtime->context, arg0, out, error);
  return status;
}

subtypes_status subtypes_scale(const subtypes_int *arg0, const subtypes_int *arg1, subtypes_int *out, subtypes_error *error) {
  subtypes_status ready = subtypes_ready(error);
  if (ready != SUBTYPES_STATUS_OK) return ready;
  if (arg0 == NULL || arg1 == NULL || out == NULL) {
    return subtypes_fail(SUBTYPES_STATUS_INVALID_ARGUMENT, SUBTYPES_ERROR_INVALID_ARGUMENT, "a required C argument is null", error);
  }
  if (subtypes_runtime->scale == NULL) return subtypes_fail(SUBTYPES_STATUS_RUNTIME_REJECTED, SUBTYPES_ERROR_RUNTIME_UNAVAILABLE, "the runtime does not implement subtypes_scale", error);
  subtypes_status status = subtypes_runtime->scale(subtypes_runtime->context, arg0, arg1, out, error);
  return status;
}

subtypes_status subtypes_second_even(const subtypes_nat *arg0, subtypes_nat *out, subtypes_error *error) {
  subtypes_status ready = subtypes_ready(error);
  if (ready != SUBTYPES_STATUS_OK) return ready;
  if (arg0 == NULL || out == NULL) {
    return subtypes_fail(SUBTYPES_STATUS_INVALID_ARGUMENT, SUBTYPES_ERROR_INVALID_ARGUMENT, "a required C argument is null", error);
  }
  if (subtypes_runtime->second_even == NULL) return subtypes_fail(SUBTYPES_STATUS_RUNTIME_REJECTED, SUBTYPES_ERROR_RUNTIME_UNAVAILABLE, "the runtime does not implement subtypes_second_even", error);
  subtypes_status status = subtypes_runtime->second_even(subtypes_runtime->context, arg0, out, error);
  return status;
}

subtypes_status subtypes_shout(const subtypes_string *arg0, subtypes_string *out, subtypes_error *error) {
  subtypes_status ready = subtypes_ready(error);
  if (ready != SUBTYPES_STATUS_OK) return ready;
  if (arg0 == NULL || out == NULL) {
    return subtypes_fail(SUBTYPES_STATUS_INVALID_ARGUMENT, SUBTYPES_ERROR_INVALID_ARGUMENT, "a required C argument is null", error);
  }
  if (subtypes_runtime->shout == NULL) return subtypes_fail(SUBTYPES_STATUS_RUNTIME_REJECTED, SUBTYPES_ERROR_RUNTIME_UNAVAILABLE, "the runtime does not implement subtypes_shout", error);
  subtypes_status status = subtypes_runtime->shout(subtypes_runtime->context, arg0, out, error);
  return status;
}

subtypes_status subtypes_unrestricted(const subtypes_nat *arg0, subtypes_nat *out, subtypes_error *error) {
  subtypes_status ready = subtypes_ready(error);
  if (ready != SUBTYPES_STATUS_OK) return ready;
  if (arg0 == NULL || out == NULL) {
    return subtypes_fail(SUBTYPES_STATUS_INVALID_ARGUMENT, SUBTYPES_ERROR_INVALID_ARGUMENT, "a required C argument is null", error);
  }
  if (subtypes_runtime->unrestricted == NULL) return subtypes_fail(SUBTYPES_STATUS_RUNTIME_REJECTED, SUBTYPES_ERROR_RUNTIME_UNAVAILABLE, "the runtime does not implement subtypes_unrestricted", error);
  subtypes_status status = subtypes_runtime->unrestricted(subtypes_runtime->context, arg0, out, error);
  return status;
}

subtypes_status subtypes_zero_even(subtypes_nat *out, subtypes_error *error) {
  subtypes_status ready = subtypes_ready(error);
  if (ready != SUBTYPES_STATUS_OK) return ready;
  if (out == NULL) {
    return subtypes_fail(SUBTYPES_STATUS_INVALID_ARGUMENT, SUBTYPES_ERROR_INVALID_ARGUMENT, "a required C argument is null", error);
  }
  if (subtypes_runtime->zero_even == NULL) return subtypes_fail(SUBTYPES_STATUS_RUNTIME_REJECTED, SUBTYPES_ERROR_RUNTIME_UNAVAILABLE, "the runtime does not implement subtypes_zero_even", error);
  subtypes_status status = subtypes_runtime->zero_even(subtypes_runtime->context, out, error);
  return status;
}
