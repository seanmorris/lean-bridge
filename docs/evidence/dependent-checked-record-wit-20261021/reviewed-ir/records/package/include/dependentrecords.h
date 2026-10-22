#ifndef DEPENDENTRECORDS_H
#define DEPENDENTRECORDS_H

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

#define DEPENDENTRECORDS_BINDING_ABI_VERSION 1u
#define DEPENDENTRECORDS_BINDING_IR_SHA256 "e390eae6b192f15a33963bbc6ebd1452fbc56a70be769537f3484b79e6609ed3"

typedef enum dependentrecords_status {
  DEPENDENTRECORDS_STATUS_OK = 0,
  DEPENDENTRECORDS_STATUS_INVALID_ARGUMENT = 1,
  DEPENDENTRECORDS_STATUS_RUNTIME_UNAVAILABLE = 2,
  DEPENDENTRECORDS_STATUS_RUNTIME_REJECTED = 3,
  DEPENDENTRECORDS_STATUS_DECLARED_ERROR = 4,
  DEPENDENTRECORDS_STATUS_UNEXPECTED_ERROR = 5
} dependentrecords_status;

typedef enum dependentrecords_error_code {
  DEPENDENTRECORDS_ERROR_NONE = 0,
  DEPENDENTRECORDS_ERROR_INVALID_ARGUMENT = 1,
  DEPENDENTRECORDS_ERROR_RUNTIME_UNAVAILABLE = 2,
  DEPENDENTRECORDS_ERROR_UNEXPECTED = 65535
} dependentrecords_error_code;

typedef struct dependentrecords_error {
  dependentrecords_error_code code;
  const char *message;
  size_t message_length;
} dependentrecords_error;

typedef struct dependentrecords_nat {
  const uint32_t *data;
  size_t length;
  void *owner;
  void (*release)(void *owner);
} dependentrecords_nat;

void dependentrecords_nat_clear(dependentrecords_nat *value);

typedef struct dependentrecords_dependent {
  dependentrecords_nat bound;
  dependentrecords_nat below;
} dependentrecords_dependent;

void dependentrecords_dependent_clear(dependentrecords_dependent *value);

dependentrecords_status dependentrecords_dependent_result(const dependentrecords_nat *value0, dependentrecords_dependent *out, dependentrecords_error *error);
dependentrecords_status dependentrecords_dependent_roundtrip(const dependentrecords_dependent *value0, dependentrecords_dependent *out, dependentrecords_error *error);
dependentrecords_status dependentrecords_dependent_total(const dependentrecords_dependent *value0, dependentrecords_nat *out, dependentrecords_error *error);

#ifdef __cplusplus
}
#endif

#endif /* DEPENDENTRECORDS_H */
