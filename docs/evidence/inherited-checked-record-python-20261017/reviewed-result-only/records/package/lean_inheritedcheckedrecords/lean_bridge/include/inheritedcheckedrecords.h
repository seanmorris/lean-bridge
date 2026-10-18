#ifndef INHERITEDCHECKEDRECORDS_H
#define INHERITEDCHECKEDRECORDS_H

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

#define INHERITEDCHECKEDRECORDS_BINDING_ABI_VERSION 1u
#define INHERITEDCHECKEDRECORDS_BINDING_IR_SHA256 "fff02bf45fca490daaad1e8d7a23aaeab90a50e8e254498eb028f7e3dff4bb68"

typedef enum inheritedcheckedrecords_status {
  INHERITEDCHECKEDRECORDS_STATUS_OK = 0,
  INHERITEDCHECKEDRECORDS_STATUS_INVALID_ARGUMENT = 1,
  INHERITEDCHECKEDRECORDS_STATUS_RUNTIME_UNAVAILABLE = 2,
  INHERITEDCHECKEDRECORDS_STATUS_RUNTIME_REJECTED = 3,
  INHERITEDCHECKEDRECORDS_STATUS_DECLARED_ERROR = 4,
  INHERITEDCHECKEDRECORDS_STATUS_UNEXPECTED_ERROR = 5
} inheritedcheckedrecords_status;

typedef enum inheritedcheckedrecords_error_code {
  INHERITEDCHECKEDRECORDS_ERROR_NONE = 0,
  INHERITEDCHECKEDRECORDS_ERROR_INVALID_ARGUMENT = 1,
  INHERITEDCHECKEDRECORDS_ERROR_RUNTIME_UNAVAILABLE = 2,
  INHERITEDCHECKEDRECORDS_ERROR_UNEXPECTED = 65535
} inheritedcheckedrecords_error_code;

typedef struct inheritedcheckedrecords_error {
  inheritedcheckedrecords_error_code code;
  const char *message;
  size_t message_length;
} inheritedcheckedrecords_error;

typedef struct inheritedcheckedrecords_nat {
  const uint32_t *data;
  size_t length;
  void *owner;
  void (*release)(void *owner);
} inheritedcheckedrecords_nat;

void inheritedcheckedrecords_nat_clear(inheritedcheckedrecords_nat *value);

typedef struct inheritedcheckedrecords_span {
  inheritedcheckedrecords_nat lo;
  inheritedcheckedrecords_nat hi;
} inheritedcheckedrecords_span;

void inheritedcheckedrecords_span_clear(inheritedcheckedrecords_span *value);

typedef struct inheritedcheckedrecords_ticket {
  inheritedcheckedrecords_span to_span;
  inheritedcheckedrecords_nat word;
} inheritedcheckedrecords_ticket;

void inheritedcheckedrecords_ticket_clear(inheritedcheckedrecords_ticket *value);

typedef struct inheritedcheckedrecords_stamped {
  inheritedcheckedrecords_ticket to_ticket;
  inheritedcheckedrecords_nat mark;
} inheritedcheckedrecords_stamped;

void inheritedcheckedrecords_stamped_clear(inheritedcheckedrecords_stamped *value);

inheritedcheckedrecords_status inheritedcheckedrecords_produce(const inheritedcheckedrecords_nat *value0, inheritedcheckedrecords_ticket *out, inheritedcheckedrecords_error *error);
inheritedcheckedrecords_status inheritedcheckedrecords_produce_stamped(const inheritedcheckedrecords_nat *value0, inheritedcheckedrecords_stamped *out, inheritedcheckedrecords_error *error);

#ifdef __cplusplus
}
#endif

#endif /* INHERITEDCHECKEDRECORDS_H */
