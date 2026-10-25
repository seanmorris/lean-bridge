#include "dependentrecords.h"
#include "dependentrecords_runtime.h"

#include <stdlib.h>
#include <string.h>


static const dependentrecords_runtime_v1 *dependentrecords_runtime = NULL;
static const dependentrecords_runtime_v1 *dependentrecords_attempted_runtime = NULL;
static dependentrecords_status dependentrecords_initialization_failure = DEPENDENTRECORDS_STATUS_RUNTIME_UNAVAILABLE;

static dependentrecords_status dependentrecords_fail(dependentrecords_status status, dependentrecords_error_code code, const char *message, dependentrecords_error *error) {
  if (error != NULL) {
    error->code = code;
    error->message = message;
    error->message_length = strlen(message);
  }
  return status;
}

static dependentrecords_status dependentrecords_ready(dependentrecords_error *error) {
  if (dependentrecords_runtime != NULL) return DEPENDENTRECORDS_STATUS_OK;
  if (dependentrecords_attempted_runtime != NULL) return dependentrecords_fail(dependentrecords_initialization_failure, DEPENDENTRECORDS_ERROR_UNEXPECTED, "shared runtime initialization failed and will not be retried", error);
  return dependentrecords_fail(DEPENDENTRECORDS_STATUS_RUNTIME_UNAVAILABLE, DEPENDENTRECORDS_ERROR_RUNTIME_UNAVAILABLE, "the shared runtime is not installed", error);
}

dependentrecords_status dependentrecords_runtime_install_v1(const dependentrecords_runtime_v1 *runtime, dependentrecords_error *error) {
  if (runtime == NULL || runtime->abi_version != DEPENDENTRECORDS_BINDING_ABI_VERSION) {
    return dependentrecords_fail(DEPENDENTRECORDS_STATUS_RUNTIME_REJECTED, DEPENDENTRECORDS_ERROR_INVALID_ARGUMENT, "the runtime ABI is incompatible", error);
  }
  if (dependentrecords_attempted_runtime != NULL) {
    if (dependentrecords_attempted_runtime != runtime) return dependentrecords_fail(DEPENDENTRECORDS_STATUS_RUNTIME_REJECTED, DEPENDENTRECORDS_ERROR_INVALID_ARGUMENT, "a different shared runtime is already installed", error);
    if (dependentrecords_runtime != NULL) return DEPENDENTRECORDS_STATUS_OK;
    return dependentrecords_fail(dependentrecords_initialization_failure, DEPENDENTRECORDS_ERROR_UNEXPECTED, "shared runtime initialization failed and will not be retried", error);
  }
  dependentrecords_attempted_runtime = runtime;
  dependentrecords_runtime = runtime;
  if (runtime->initialize == NULL) return DEPENDENTRECORDS_STATUS_OK;
  dependentrecords_status status = runtime->initialize(runtime->context, error);
  if (status != DEPENDENTRECORDS_STATUS_OK) {
    dependentrecords_initialization_failure = status;
    dependentrecords_runtime = NULL;
  }
  return status;
}

void dependentrecords_nat_clear(dependentrecords_nat *value) {
  if (value == NULL) return;
  if (value->release != NULL && value->owner != NULL) value->release(value->owner);
  memset(value, 0, sizeof(*value));
}

void dependentrecords_dependent_clear(dependentrecords_dependent *value) {
  if (value == NULL) return;
  dependentrecords_nat_clear(&value->bound);
  dependentrecords_nat_clear(&value->below);
  memset(value, 0, sizeof(*value));
}

dependentrecords_status dependentrecords_dependent_result(const dependentrecords_nat *arg0, dependentrecords_dependent *out, dependentrecords_error *error) {
  dependentrecords_status ready = dependentrecords_ready(error);
  if (ready != DEPENDENTRECORDS_STATUS_OK) return ready;
  if (arg0 == NULL || out == NULL) {
    return dependentrecords_fail(DEPENDENTRECORDS_STATUS_INVALID_ARGUMENT, DEPENDENTRECORDS_ERROR_INVALID_ARGUMENT, "a required C argument is null", error);
  }
  if (dependentrecords_runtime->dependent_result == NULL) return dependentrecords_fail(DEPENDENTRECORDS_STATUS_RUNTIME_REJECTED, DEPENDENTRECORDS_ERROR_RUNTIME_UNAVAILABLE, "the runtime does not implement dependentrecords_dependent_result", error);
  dependentrecords_status status = dependentrecords_runtime->dependent_result(dependentrecords_runtime->context, arg0, out, error);
  return status;
}
