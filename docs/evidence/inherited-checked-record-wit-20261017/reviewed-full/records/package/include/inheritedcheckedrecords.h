#ifndef INHERITEDCHECKEDRECORDS_H
#define INHERITEDCHECKEDRECORDS_H

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>
#include <string.h>

#ifdef __cplusplus
extern "C" {
#endif

#define INHERITEDCHECKEDRECORDS_BINDING_ABI_VERSION 1u
#define INHERITEDCHECKEDRECORDS_BINDING_IR_SHA256 "b9d1c903e52cf6d6b094b6a553b47555782ccee9a940e28ac861d5948175f2de"

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

typedef inheritedcheckedrecords_ticket inheritedcheckedrecords_ticket_alias_t;
static inline void inheritedcheckedrecords_ticket_alias_t_init(inheritedcheckedrecords_ticket_alias_t *value) { if (value) memset(value, 0, sizeof(*value)); }
static inline void inheritedcheckedrecords_ticket_alias_t_clear(inheritedcheckedrecords_ticket_alias_t *value) { inheritedcheckedrecords_ticket_clear(value); }

inheritedcheckedrecords_status inheritedcheckedrecords_aliased(const inheritedcheckedrecords_ticket *value0, inheritedcheckedrecords_nat *out, inheritedcheckedrecords_error *error);
inheritedcheckedrecords_status inheritedcheckedrecords_echo(const inheritedcheckedrecords_ticket *value0, inheritedcheckedrecords_ticket *out, inheritedcheckedrecords_error *error);
inheritedcheckedrecords_status inheritedcheckedrecords_first(const inheritedcheckedrecords_ticket *value0, inheritedcheckedrecords_nat *out, inheritedcheckedrecords_error *error);
inheritedcheckedrecords_status inheritedcheckedrecords_nested(const inheritedcheckedrecords_stamped *value0, inheritedcheckedrecords_nat *out, inheritedcheckedrecords_error *error);
inheritedcheckedrecords_status inheritedcheckedrecords_normalized(const inheritedcheckedrecords_ticket *value0, inheritedcheckedrecords_nat *out, inheritedcheckedrecords_error *error);
inheritedcheckedrecords_status inheritedcheckedrecords_pair(const inheritedcheckedrecords_ticket *value0, const inheritedcheckedrecords_ticket *value1, inheritedcheckedrecords_nat *out, inheritedcheckedrecords_error *error);
inheritedcheckedrecords_status inheritedcheckedrecords_produce(const inheritedcheckedrecords_nat *value0, inheritedcheckedrecords_ticket *out, inheritedcheckedrecords_error *error);
inheritedcheckedrecords_status inheritedcheckedrecords_produce_stamped(const inheritedcheckedrecords_nat *value0, inheritedcheckedrecords_stamped *out, inheritedcheckedrecords_error *error);

#ifdef __cplusplus
}
#endif

#endif /* INHERITEDCHECKEDRECORDS_H */
