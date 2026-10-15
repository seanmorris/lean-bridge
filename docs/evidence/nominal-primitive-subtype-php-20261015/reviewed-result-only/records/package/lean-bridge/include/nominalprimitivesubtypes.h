#ifndef NOMINALPRIMITIVESUBTYPES_H
#define NOMINALPRIMITIVESUBTYPES_H

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>
#include <string.h>

#ifdef __cplusplus
extern "C" {
#endif

#define NOMINALPRIMITIVESUBTYPES_BINDING_ABI_VERSION 1u
#define NOMINALPRIMITIVESUBTYPES_BINDING_IR_SHA256 "caec14ad9b050d98201c7f9ac14423553b77aa34eaf7c7caa12ab0ae062cdf50"

typedef enum nominalprimitivesubtypes_status {
  NOMINALPRIMITIVESUBTYPES_STATUS_OK = 0,
  NOMINALPRIMITIVESUBTYPES_STATUS_INVALID_ARGUMENT = 1,
  NOMINALPRIMITIVESUBTYPES_STATUS_RUNTIME_UNAVAILABLE = 2,
  NOMINALPRIMITIVESUBTYPES_STATUS_RUNTIME_REJECTED = 3,
  NOMINALPRIMITIVESUBTYPES_STATUS_DECLARED_ERROR = 4,
  NOMINALPRIMITIVESUBTYPES_STATUS_UNEXPECTED_ERROR = 5
} nominalprimitivesubtypes_status;

typedef enum nominalprimitivesubtypes_error_code {
  NOMINALPRIMITIVESUBTYPES_ERROR_NONE = 0,
  NOMINALPRIMITIVESUBTYPES_ERROR_INVALID_ARGUMENT = 1,
  NOMINALPRIMITIVESUBTYPES_ERROR_RUNTIME_UNAVAILABLE = 2,
  NOMINALPRIMITIVESUBTYPES_ERROR_UNEXPECTED = 65535
} nominalprimitivesubtypes_error_code;

typedef struct nominalprimitivesubtypes_error {
  nominalprimitivesubtypes_error_code code;
  const char *message;
  size_t message_length;
} nominalprimitivesubtypes_error;

typedef struct nominalprimitivesubtypes_array_option_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_span nominalprimitivesubtypes_array_option_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_span;
typedef struct nominalprimitivesubtypes_nat nominalprimitivesubtypes_nat;
typedef struct nominalprimitivesubtypes_int nominalprimitivesubtypes_int;
typedef struct nominalprimitivesubtypes_string nominalprimitivesubtypes_string;
typedef struct nominalprimitivesubtypes_bytes nominalprimitivesubtypes_bytes;
typedef struct nominalprimitivesubtypes_array_option_lean_nominal_primitive_subtypes_packet_span nominalprimitivesubtypes_array_option_lean_nominal_primitive_subtypes_packet_span;
typedef struct nominalprimitivesubtypes_packet nominalprimitivesubtypes_packet;
typedef struct nominalprimitivesubtypes_event nominalprimitivesubtypes_event;
typedef struct nominalprimitivesubtypes_pair nominalprimitivesubtypes_pair;
typedef struct nominalprimitivesubtypes_raw_packet nominalprimitivesubtypes_raw_packet;
typedef struct nominalprimitivesubtypes_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_value nominalprimitivesubtypes_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_value;
typedef struct nominalprimitivesubtypes_option_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_value nominalprimitivesubtypes_option_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_value;
typedef struct nominalprimitivesubtypes_option_lean_nominal_primitive_subtypes_packet_value nominalprimitivesubtypes_option_lean_nominal_primitive_subtypes_packet_value;

typedef struct nominalprimitivesubtypes_array_option_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_span {
  const nominalprimitivesubtypes_option_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_value *data;
  size_t length;
  void *owner;
  void (*release)(void *owner);
} nominalprimitivesubtypes_array_option_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_span;

void nominalprimitivesubtypes_array_option_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_span_clear(nominalprimitivesubtypes_array_option_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_span *value);

typedef struct nominalprimitivesubtypes_nat {
  const uint32_t *data;
  size_t length;
  void *owner;
  void (*release)(void *owner);
} nominalprimitivesubtypes_nat;

void nominalprimitivesubtypes_nat_clear(nominalprimitivesubtypes_nat *value);

typedef struct nominalprimitivesubtypes_int {
  const uint32_t *data;
  size_t length;
  void *owner;
  void (*release)(void *owner);
  bool negative;
} nominalprimitivesubtypes_int;

void nominalprimitivesubtypes_int_clear(nominalprimitivesubtypes_int *value);

typedef struct nominalprimitivesubtypes_string {
  const char *data;
  size_t length;
  void *owner;
  void (*release)(void *owner);
} nominalprimitivesubtypes_string;

void nominalprimitivesubtypes_string_clear(nominalprimitivesubtypes_string *value);

typedef struct nominalprimitivesubtypes_bytes {
  const uint8_t *data;
  size_t length;
  void *owner;
  void (*release)(void *owner);
} nominalprimitivesubtypes_bytes;

void nominalprimitivesubtypes_bytes_clear(nominalprimitivesubtypes_bytes *value);

typedef struct nominalprimitivesubtypes_array_option_lean_nominal_primitive_subtypes_packet_span {
  const nominalprimitivesubtypes_option_lean_nominal_primitive_subtypes_packet_value *data;
  size_t length;
  void *owner;
  void (*release)(void *owner);
} nominalprimitivesubtypes_array_option_lean_nominal_primitive_subtypes_packet_span;

void nominalprimitivesubtypes_array_option_lean_nominal_primitive_subtypes_packet_span_clear(nominalprimitivesubtypes_array_option_lean_nominal_primitive_subtypes_packet_span *value);

typedef struct nominalprimitivesubtypes_packet {
  uint8_t unit_value;
  bool bool_value;
  uint8_t uint8_value;
  uint16_t uint16_value;
  uint32_t uint32_value;
  uint64_t uint64_value;
  int8_t int8_value;
  int16_t int16_value;
  int32_t int32_value;
  int64_t int64_value;
  nominalprimitivesubtypes_nat nat_value;
  nominalprimitivesubtypes_int int_value;
  float float32_value;
  double float64_value;
  nominalprimitivesubtypes_string text_value;
  nominalprimitivesubtypes_bytes bytes_value;
  uint32_t char_value;
  uint64_t usize_value;
  int64_t isize_value;
  nominalprimitivesubtypes_nat digit;
} nominalprimitivesubtypes_packet;

void nominalprimitivesubtypes_packet_clear(nominalprimitivesubtypes_packet *value);

typedef enum nominalprimitivesubtypes_event_tag { NOMINALPRIMITIVESUBTYPES_EVENT_KIND_EMPTY = 0, NOMINALPRIMITIVESUBTYPES_EVENT_KIND_BOX = 1, NOMINALPRIMITIVESUBTYPES_EVENT_KIND_CHOICES = 2 } nominalprimitivesubtypes_event_tag;
typedef struct nominalprimitivesubtypes_event {
  uint32_t kind;
  union {
    struct {
      uint8_t empty;
    } empty;
    struct {
      nominalprimitivesubtypes_packet value;
    } box;
    struct {
      nominalprimitivesubtypes_array_option_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_span values;
    } choices;
  } cases;
} nominalprimitivesubtypes_event;

void nominalprimitivesubtypes_event_init(nominalprimitivesubtypes_event *value);
void nominalprimitivesubtypes_event_clear(nominalprimitivesubtypes_event *value);
nominalprimitivesubtypes_status nominalprimitivesubtypes_event_select(nominalprimitivesubtypes_event *value, uint32_t kind);

typedef struct nominalprimitivesubtypes_pair {
  nominalprimitivesubtypes_array_option_lean_nominal_primitive_subtypes_packet_span left;
  nominalprimitivesubtypes_array_option_lean_nominal_primitive_subtypes_packet_span right;
} nominalprimitivesubtypes_pair;

void nominalprimitivesubtypes_pair_clear(nominalprimitivesubtypes_pair *value);

typedef struct nominalprimitivesubtypes_raw_packet {
  uint8_t unit_value;
  bool bool_value;
  uint8_t uint8_value;
  uint16_t uint16_value;
  uint32_t uint32_value;
  uint64_t uint64_value;
  int8_t int8_value;
  int16_t int16_value;
  int32_t int32_value;
  int64_t int64_value;
  nominalprimitivesubtypes_nat nat_value;
  nominalprimitivesubtypes_int int_value;
  float float32_value;
  double float64_value;
  nominalprimitivesubtypes_string text_value;
  nominalprimitivesubtypes_bytes bytes_value;
  uint32_t char_value;
  uint64_t usize_value;
  int64_t isize_value;
  nominalprimitivesubtypes_nat digit;
} nominalprimitivesubtypes_raw_packet;

void nominalprimitivesubtypes_raw_packet_clear(nominalprimitivesubtypes_raw_packet *value);

typedef struct nominalprimitivesubtypes_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_value {
  uint8_t is_ok;
  nominalprimitivesubtypes_packet ok;
  nominalprimitivesubtypes_packet error;
} nominalprimitivesubtypes_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_value;

void nominalprimitivesubtypes_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_value_clear(nominalprimitivesubtypes_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_value *value);

typedef struct nominalprimitivesubtypes_option_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_value {
  uint8_t has_value;
  nominalprimitivesubtypes_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_value value;
} nominalprimitivesubtypes_option_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_value;

void nominalprimitivesubtypes_option_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_value_clear(nominalprimitivesubtypes_option_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_value *value);

typedef struct nominalprimitivesubtypes_option_lean_nominal_primitive_subtypes_packet_value {
  uint8_t has_value;
  nominalprimitivesubtypes_packet value;
} nominalprimitivesubtypes_option_lean_nominal_primitive_subtypes_packet_value;

void nominalprimitivesubtypes_option_lean_nominal_primitive_subtypes_packet_value_clear(nominalprimitivesubtypes_option_lean_nominal_primitive_subtypes_packet_value *value);

typedef nominalprimitivesubtypes_packet nominalprimitivesubtypes_packet_alias_t;
static inline void nominalprimitivesubtypes_packet_alias_t_init(nominalprimitivesubtypes_packet_alias_t *value) { if (value) memset(value, 0, sizeof(*value)); }
static inline void nominalprimitivesubtypes_packet_alias_t_clear(nominalprimitivesubtypes_packet_alias_t *value) { nominalprimitivesubtypes_packet_clear(value); }

nominalprimitivesubtypes_status nominalprimitivesubtypes_produce(const nominalprimitivesubtypes_raw_packet *value0, nominalprimitivesubtypes_option_lean_nominal_primitive_subtypes_packet_value *out, nominalprimitivesubtypes_error *error);
nominalprimitivesubtypes_status nominalprimitivesubtypes_produce_choices(const nominalprimitivesubtypes_raw_packet *value0, nominalprimitivesubtypes_event *out, nominalprimitivesubtypes_error *error);
nominalprimitivesubtypes_status nominalprimitivesubtypes_produce_event(const nominalprimitivesubtypes_raw_packet *value0, nominalprimitivesubtypes_event *out, nominalprimitivesubtypes_error *error);
nominalprimitivesubtypes_status nominalprimitivesubtypes_produce_group(const nominalprimitivesubtypes_raw_packet *value0, nominalprimitivesubtypes_array_option_lean_nominal_primitive_subtypes_packet_span *out, nominalprimitivesubtypes_error *error);
nominalprimitivesubtypes_status nominalprimitivesubtypes_produce_pair(const nominalprimitivesubtypes_raw_packet *value0, nominalprimitivesubtypes_pair *out, nominalprimitivesubtypes_error *error);
nominalprimitivesubtypes_status nominalprimitivesubtypes_word_bits(uint32_t *out, nominalprimitivesubtypes_error *error);

#ifdef __cplusplus
}
#endif

#endif /* NOMINALPRIMITIVESUBTYPES_H */
