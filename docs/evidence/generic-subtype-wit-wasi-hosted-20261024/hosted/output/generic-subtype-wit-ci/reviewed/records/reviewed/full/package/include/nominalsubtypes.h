#ifndef NOMINALSUBTYPES_H
#define NOMINALSUBTYPES_H

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>
#include <string.h>

#ifdef __cplusplus
extern "C" {
#endif

#define NOMINALSUBTYPES_BINDING_ABI_VERSION 1u
#define NOMINALSUBTYPES_BINDING_IR_SHA256 "3dd9eb9d8c56fd9a0857c8d93570fbecc4f576420b83e3c105c79e29b68d0143"

typedef enum nominalsubtypes_status {
  NOMINALSUBTYPES_STATUS_OK = 0,
  NOMINALSUBTYPES_STATUS_INVALID_ARGUMENT = 1,
  NOMINALSUBTYPES_STATUS_RUNTIME_UNAVAILABLE = 2,
  NOMINALSUBTYPES_STATUS_RUNTIME_REJECTED = 3,
  NOMINALSUBTYPES_STATUS_DECLARED_ERROR = 4,
  NOMINALSUBTYPES_STATUS_UNEXPECTED_ERROR = 5
} nominalsubtypes_status;

typedef enum nominalsubtypes_error_code {
  NOMINALSUBTYPES_ERROR_NONE = 0,
  NOMINALSUBTYPES_ERROR_INVALID_ARGUMENT = 1,
  NOMINALSUBTYPES_ERROR_RUNTIME_UNAVAILABLE = 2,
  NOMINALSUBTYPES_ERROR_UNEXPECTED = 65535
} nominalsubtypes_error_code;

typedef struct nominalsubtypes_error {
  nominalsubtypes_error_code code;
  const char *message;
  size_t message_length;
} nominalsubtypes_error;

typedef struct nominalsubtypes_array_option_lean_nominal_subtypes_envelope_span nominalsubtypes_array_option_lean_nominal_subtypes_envelope_span;
typedef struct nominalsubtypes_nat nominalsubtypes_nat;
typedef struct nominalsubtypes_array_option_result_nat_nat_span nominalsubtypes_array_option_result_nat_nat_span;
typedef struct nominalsubtypes_array_nat_span nominalsubtypes_array_nat_span;
typedef struct nominalsubtypes_list_nat_span nominalsubtypes_list_nat_span;
typedef struct nominalsubtypes_alias_pair nominalsubtypes_alias_pair;
typedef struct nominalsubtypes_envelope nominalsubtypes_envelope;
typedef struct nominalsubtypes_event nominalsubtypes_event;
typedef struct nominalsubtypes_generic_nat nominalsubtypes_generic_nat;
typedef struct nominalsubtypes_pair nominalsubtypes_pair;
typedef struct nominalsubtypes_option_lean_nominal_subtypes_envelope_value nominalsubtypes_option_lean_nominal_subtypes_envelope_value;
typedef struct nominalsubtypes_result_nat_nat_value nominalsubtypes_result_nat_nat_value;
typedef struct nominalsubtypes_option_result_nat_nat_value nominalsubtypes_option_result_nat_nat_value;
typedef struct nominalsubtypes_option_nat_value nominalsubtypes_option_nat_value;
typedef struct nominalsubtypes_tuple_nat_nat_value nominalsubtypes_tuple_nat_nat_value;

typedef struct nominalsubtypes_array_option_lean_nominal_subtypes_envelope_span {
  const nominalsubtypes_option_lean_nominal_subtypes_envelope_value *data;
  size_t length;
  void *owner;
  void (*release)(void *owner);
} nominalsubtypes_array_option_lean_nominal_subtypes_envelope_span;

void nominalsubtypes_array_option_lean_nominal_subtypes_envelope_span_clear(nominalsubtypes_array_option_lean_nominal_subtypes_envelope_span *value);

typedef struct nominalsubtypes_nat {
  const uint32_t *data;
  size_t length;
  void *owner;
  void (*release)(void *owner);
} nominalsubtypes_nat;

void nominalsubtypes_nat_clear(nominalsubtypes_nat *value);

typedef struct nominalsubtypes_array_option_result_nat_nat_span {
  const nominalsubtypes_option_result_nat_nat_value *data;
  size_t length;
  void *owner;
  void (*release)(void *owner);
} nominalsubtypes_array_option_result_nat_nat_span;

void nominalsubtypes_array_option_result_nat_nat_span_clear(nominalsubtypes_array_option_result_nat_nat_span *value);

typedef struct nominalsubtypes_array_nat_span {
  const nominalsubtypes_nat *data;
  size_t length;
  void *owner;
  void (*release)(void *owner);
} nominalsubtypes_array_nat_span;

void nominalsubtypes_array_nat_span_clear(nominalsubtypes_array_nat_span *value);

typedef struct nominalsubtypes_list_nat_span {
  const nominalsubtypes_nat *data;
  size_t length;
  void *owner;
  void (*release)(void *owner);
} nominalsubtypes_list_nat_span;

void nominalsubtypes_list_nat_span_clear(nominalsubtypes_list_nat_span *value);

typedef struct nominalsubtypes_alias_pair {
  nominalsubtypes_array_option_lean_nominal_subtypes_envelope_span left;
  nominalsubtypes_array_option_lean_nominal_subtypes_envelope_span right;
} nominalsubtypes_alias_pair;

void nominalsubtypes_alias_pair_clear(nominalsubtypes_alias_pair *value);

typedef struct nominalsubtypes_envelope {
  nominalsubtypes_nat payload;
  nominalsubtypes_nat digit;
} nominalsubtypes_envelope;

void nominalsubtypes_envelope_clear(nominalsubtypes_envelope *value);

typedef enum nominalsubtypes_event_tag { NOMINALSUBTYPES_EVENT_KIND_EMPTY = 0, NOMINALSUBTYPES_EVENT_KIND_BOX = 1, NOMINALSUBTYPES_EVENT_KIND_CHOICES = 2 } nominalsubtypes_event_tag;
typedef struct nominalsubtypes_event {
  uint32_t kind;
  union {
    struct {
      uint8_t empty;
    } empty;
    struct {
      nominalsubtypes_envelope value;
    } box;
    struct {
      nominalsubtypes_array_option_result_nat_nat_span values;
    } choices;
  } cases;
} nominalsubtypes_event;

void nominalsubtypes_event_init(nominalsubtypes_event *value);
void nominalsubtypes_event_clear(nominalsubtypes_event *value);
nominalsubtypes_status nominalsubtypes_event_select(nominalsubtypes_event *value, uint32_t kind);

typedef struct nominalsubtypes_generic_nat {
  nominalsubtypes_nat value;
  nominalsubtypes_nat marker;
} nominalsubtypes_generic_nat;

void nominalsubtypes_generic_nat_clear(nominalsubtypes_generic_nat *value);

typedef struct nominalsubtypes_pair {
  nominalsubtypes_envelope left;
  nominalsubtypes_envelope right;
} nominalsubtypes_pair;

void nominalsubtypes_pair_clear(nominalsubtypes_pair *value);

typedef struct nominalsubtypes_option_lean_nominal_subtypes_envelope_value {
  uint8_t has_value;
  nominalsubtypes_envelope value;
} nominalsubtypes_option_lean_nominal_subtypes_envelope_value;

void nominalsubtypes_option_lean_nominal_subtypes_envelope_value_clear(nominalsubtypes_option_lean_nominal_subtypes_envelope_value *value);

typedef struct nominalsubtypes_result_nat_nat_value {
  uint8_t is_ok;
  nominalsubtypes_nat ok;
  nominalsubtypes_nat error;
} nominalsubtypes_result_nat_nat_value;

void nominalsubtypes_result_nat_nat_value_clear(nominalsubtypes_result_nat_nat_value *value);

typedef struct nominalsubtypes_option_result_nat_nat_value {
  uint8_t has_value;
  nominalsubtypes_result_nat_nat_value value;
} nominalsubtypes_option_result_nat_nat_value;

void nominalsubtypes_option_result_nat_nat_value_clear(nominalsubtypes_option_result_nat_nat_value *value);

typedef struct nominalsubtypes_option_nat_value {
  uint8_t has_value;
  nominalsubtypes_nat value;
} nominalsubtypes_option_nat_value;

void nominalsubtypes_option_nat_value_clear(nominalsubtypes_option_nat_value *value);

typedef struct nominalsubtypes_tuple_nat_nat_value {
  nominalsubtypes_nat fst;
  nominalsubtypes_nat snd;
} nominalsubtypes_tuple_nat_nat_value;

void nominalsubtypes_tuple_nat_nat_value_clear(nominalsubtypes_tuple_nat_nat_value *value);

typedef nominalsubtypes_envelope nominalsubtypes_envelope_alias_t;
static inline void nominalsubtypes_envelope_alias_t_init(nominalsubtypes_envelope_alias_t *value) { if (value) memset(value, 0, sizeof(*value)); }
static inline void nominalsubtypes_envelope_alias_t_clear(nominalsubtypes_envelope_alias_t *value) { nominalsubtypes_envelope_clear(value); }

nominalsubtypes_status nominalsubtypes_echo_generic_first(const nominalsubtypes_generic_nat *value0, nominalsubtypes_generic_nat *out, nominalsubtypes_error *error);
nominalsubtypes_status nominalsubtypes_echo_generic_second(const nominalsubtypes_generic_nat *value0, nominalsubtypes_generic_nat *out, nominalsubtypes_error *error);
nominalsubtypes_status nominalsubtypes_generic_use(const nominalsubtypes_generic_nat *value0, nominalsubtypes_nat *out, nominalsubtypes_error *error);
nominalsubtypes_status nominalsubtypes_aliases(const nominalsubtypes_array_option_lean_nominal_subtypes_envelope_span *value0, const nominalsubtypes_array_option_lean_nominal_subtypes_envelope_span *value1, nominalsubtypes_nat *out, nominalsubtypes_error *error);
nominalsubtypes_status nominalsubtypes_array_values(const nominalsubtypes_nat *value0, nominalsubtypes_array_nat_span *out, nominalsubtypes_error *error);
nominalsubtypes_status nominalsubtypes_branch(const nominalsubtypes_nat *value0, nominalsubtypes_result_nat_nat_value *out, nominalsubtypes_error *error);
nominalsubtypes_status nominalsubtypes_combine(const nominalsubtypes_envelope *value0, const nominalsubtypes_envelope *value1, nominalsubtypes_nat *out, nominalsubtypes_error *error);
nominalsubtypes_status nominalsubtypes_echo(const nominalsubtypes_envelope *value0, nominalsubtypes_envelope *out, nominalsubtypes_error *error);
nominalsubtypes_status nominalsubtypes_echo_event(const nominalsubtypes_event *value0, nominalsubtypes_event *out, nominalsubtypes_error *error);
nominalsubtypes_status nominalsubtypes_echo_groups(const nominalsubtypes_array_option_lean_nominal_subtypes_envelope_span *value0, nominalsubtypes_array_option_lean_nominal_subtypes_envelope_span *out, nominalsubtypes_error *error);
nominalsubtypes_status nominalsubtypes_echo_pair(const nominalsubtypes_alias_pair *value0, nominalsubtypes_alias_pair *out, nominalsubtypes_error *error);
nominalsubtypes_status nominalsubtypes_event_choices(const nominalsubtypes_nat *value0, nominalsubtypes_event *out, nominalsubtypes_error *error);
nominalsubtypes_status nominalsubtypes_event_empty(const nominalsubtypes_nat *value0, nominalsubtypes_event *out, nominalsubtypes_error *error);
nominalsubtypes_status nominalsubtypes_event_first(const nominalsubtypes_event *value0, nominalsubtypes_nat *out, nominalsubtypes_error *error);
nominalsubtypes_status nominalsubtypes_event_second(const nominalsubtypes_event *value0, nominalsubtypes_nat *out, nominalsubtypes_error *error);
nominalsubtypes_status nominalsubtypes_event_value(const nominalsubtypes_nat *value0, nominalsubtypes_event *out, nominalsubtypes_error *error);
nominalsubtypes_status nominalsubtypes_first(const nominalsubtypes_envelope *value0, nominalsubtypes_nat *out, nominalsubtypes_error *error);
nominalsubtypes_status nominalsubtypes_group_values(const nominalsubtypes_nat *value0, nominalsubtypes_array_option_lean_nominal_subtypes_envelope_span *out, nominalsubtypes_error *error);
nominalsubtypes_status nominalsubtypes_inspect_alias_pair(const nominalsubtypes_alias_pair *value0, nominalsubtypes_nat *out, nominalsubtypes_error *error);
nominalsubtypes_status nominalsubtypes_list_values(const nominalsubtypes_nat *value0, nominalsubtypes_list_nat_span *out, nominalsubtypes_error *error);
nominalsubtypes_status nominalsubtypes_nested(const nominalsubtypes_pair *value0, nominalsubtypes_nat *out, nominalsubtypes_error *error);
nominalsubtypes_status nominalsubtypes_no_items(const nominalsubtypes_nat *value0, nominalsubtypes_array_nat_span *out, nominalsubtypes_error *error);
nominalsubtypes_status nominalsubtypes_optional(const nominalsubtypes_nat *value0, nominalsubtypes_option_nat_value *out, nominalsubtypes_error *error);
nominalsubtypes_status nominalsubtypes_pair_values(const nominalsubtypes_nat *value0, nominalsubtypes_alias_pair *out, nominalsubtypes_error *error);
nominalsubtypes_status nominalsubtypes_plain_fin(const nominalsubtypes_nat *value0, nominalsubtypes_nat *out, nominalsubtypes_error *error);
nominalsubtypes_status nominalsubtypes_produce_envelope(const nominalsubtypes_nat *value0, nominalsubtypes_envelope *out, nominalsubtypes_error *error);
nominalsubtypes_status nominalsubtypes_product(const nominalsubtypes_nat *value0, nominalsubtypes_tuple_nat_nat_value *out, nominalsubtypes_error *error);
nominalsubtypes_status nominalsubtypes_scalar(const nominalsubtypes_nat *value0, nominalsubtypes_nat *out, nominalsubtypes_error *error);
nominalsubtypes_status nominalsubtypes_second(const nominalsubtypes_envelope *value0, nominalsubtypes_nat *out, nominalsubtypes_error *error);

#ifdef __cplusplus
}
#endif

#endif /* NOMINALSUBTYPES_H */
