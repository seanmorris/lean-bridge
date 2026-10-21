#ifndef ZEROPAYLOADCHECKEDRECORDS_H
#define ZEROPAYLOADCHECKEDRECORDS_H

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

#define ZEROPAYLOADCHECKEDRECORDS_BINDING_ABI_VERSION 1u
#define ZEROPAYLOADCHECKEDRECORDS_BINDING_IR_SHA256 "af83f066d0e65e2c44207f4ebfa65d31d858ef5105fe23630674a51bad0445cb"

typedef enum zeropayloadcheckedrecords_status {
  ZEROPAYLOADCHECKEDRECORDS_STATUS_OK = 0,
  ZEROPAYLOADCHECKEDRECORDS_STATUS_INVALID_ARGUMENT = 1,
  ZEROPAYLOADCHECKEDRECORDS_STATUS_RUNTIME_UNAVAILABLE = 2,
  ZEROPAYLOADCHECKEDRECORDS_STATUS_RUNTIME_REJECTED = 3,
  ZEROPAYLOADCHECKEDRECORDS_STATUS_DECLARED_ERROR = 4,
  ZEROPAYLOADCHECKEDRECORDS_STATUS_UNEXPECTED_ERROR = 5
} zeropayloadcheckedrecords_status;

typedef enum zeropayloadcheckedrecords_error_code {
  ZEROPAYLOADCHECKEDRECORDS_ERROR_NONE = 0,
  ZEROPAYLOADCHECKEDRECORDS_ERROR_INVALID_ARGUMENT = 1,
  ZEROPAYLOADCHECKEDRECORDS_ERROR_RUNTIME_UNAVAILABLE = 2,
  ZEROPAYLOADCHECKEDRECORDS_ERROR_UNEXPECTED = 65535
} zeropayloadcheckedrecords_error_code;

typedef struct zeropayloadcheckedrecords_error {
  zeropayloadcheckedrecords_error_code code;
  const char *message;
  size_t message_length;
} zeropayloadcheckedrecords_error;

typedef struct zeropayloadcheckedrecords_nat zeropayloadcheckedrecords_nat;
typedef struct zeropayloadcheckedrecords_array_lean_zero_payload_checked_records_witness_span zeropayloadcheckedrecords_array_lean_zero_payload_checked_records_witness_span;
typedef struct zeropayloadcheckedrecords_witness zeropayloadcheckedrecords_witness;
typedef struct zeropayloadcheckedrecords_mark zeropayloadcheckedrecords_mark;
typedef struct zeropayloadcheckedrecords_marker zeropayloadcheckedrecords_marker;
typedef struct zeropayloadcheckedrecords_token zeropayloadcheckedrecords_token;
typedef struct zeropayloadcheckedrecords_option_lean_zero_payload_checked_records_witness_value zeropayloadcheckedrecords_option_lean_zero_payload_checked_records_witness_value;

typedef struct zeropayloadcheckedrecords_nat {
  const uint32_t *data;
  size_t length;
  void *owner;
  void (*release)(void *owner);
} zeropayloadcheckedrecords_nat;

void zeropayloadcheckedrecords_nat_clear(zeropayloadcheckedrecords_nat *value);

typedef struct zeropayloadcheckedrecords_array_lean_zero_payload_checked_records_witness_span {
  const zeropayloadcheckedrecords_witness *data;
  size_t length;
  void *owner;
  void (*release)(void *owner);
} zeropayloadcheckedrecords_array_lean_zero_payload_checked_records_witness_span;

void zeropayloadcheckedrecords_array_lean_zero_payload_checked_records_witness_span_clear(zeropayloadcheckedrecords_array_lean_zero_payload_checked_records_witness_span *value);

typedef struct zeropayloadcheckedrecords_witness {
  uint8_t empty;
} zeropayloadcheckedrecords_witness;

void zeropayloadcheckedrecords_witness_clear(zeropayloadcheckedrecords_witness *value);

typedef enum zeropayloadcheckedrecords_mark_tag { ZEROPAYLOADCHECKEDRECORDS_MARK_KIND_BLANK = 0, ZEROPAYLOADCHECKEDRECORDS_MARK_KIND_MARKED = 1 } zeropayloadcheckedrecords_mark_tag;
typedef struct zeropayloadcheckedrecords_mark {
  uint32_t kind;
  union {
    struct {
      uint8_t empty;
    } blank;
    struct {
      zeropayloadcheckedrecords_witness witness;
    } marked;
  } cases;
} zeropayloadcheckedrecords_mark;

void zeropayloadcheckedrecords_mark_init(zeropayloadcheckedrecords_mark *value);
void zeropayloadcheckedrecords_mark_clear(zeropayloadcheckedrecords_mark *value);
zeropayloadcheckedrecords_status zeropayloadcheckedrecords_mark_select(zeropayloadcheckedrecords_mark *value, uint32_t kind);

typedef struct zeropayloadcheckedrecords_marker {
  uint8_t empty;
} zeropayloadcheckedrecords_marker;

void zeropayloadcheckedrecords_marker_clear(zeropayloadcheckedrecords_marker *value);

typedef struct zeropayloadcheckedrecords_token {
  uint8_t tag;
} zeropayloadcheckedrecords_token;

void zeropayloadcheckedrecords_token_clear(zeropayloadcheckedrecords_token *value);

typedef struct zeropayloadcheckedrecords_option_lean_zero_payload_checked_records_witness_value {
  uint8_t has_value;
  zeropayloadcheckedrecords_witness value;
} zeropayloadcheckedrecords_option_lean_zero_payload_checked_records_witness_value;

void zeropayloadcheckedrecords_option_lean_zero_payload_checked_records_witness_value_clear(zeropayloadcheckedrecords_option_lean_zero_payload_checked_records_witness_value *value);

zeropayloadcheckedrecords_status zeropayloadcheckedrecords_absent_count(const zeropayloadcheckedrecords_witness *value0, zeropayloadcheckedrecords_nat *out, zeropayloadcheckedrecords_error *error);
zeropayloadcheckedrecords_status zeropayloadcheckedrecords_mark_count(const zeropayloadcheckedrecords_mark *value0, zeropayloadcheckedrecords_nat *out, zeropayloadcheckedrecords_error *error);
zeropayloadcheckedrecords_status zeropayloadcheckedrecords_marker_count(const zeropayloadcheckedrecords_marker *value0, zeropayloadcheckedrecords_nat *out, zeropayloadcheckedrecords_error *error);
zeropayloadcheckedrecords_status zeropayloadcheckedrecords_maybe_witness(bool value0, zeropayloadcheckedrecords_option_lean_zero_payload_checked_records_witness_value *out, zeropayloadcheckedrecords_error *error);
zeropayloadcheckedrecords_status zeropayloadcheckedrecords_produce_mark(bool value0, zeropayloadcheckedrecords_mark *out, zeropayloadcheckedrecords_error *error);
zeropayloadcheckedrecords_status zeropayloadcheckedrecords_produce_marker(zeropayloadcheckedrecords_marker *out, zeropayloadcheckedrecords_error *error);
zeropayloadcheckedrecords_status zeropayloadcheckedrecords_produce_token(zeropayloadcheckedrecords_token *out, zeropayloadcheckedrecords_error *error);
zeropayloadcheckedrecords_status zeropayloadcheckedrecords_produce_witness(zeropayloadcheckedrecords_witness *out, zeropayloadcheckedrecords_error *error);
zeropayloadcheckedrecords_status zeropayloadcheckedrecords_token_tag(const zeropayloadcheckedrecords_token *value0, zeropayloadcheckedrecords_error *error);
zeropayloadcheckedrecords_status zeropayloadcheckedrecords_witness_count(const zeropayloadcheckedrecords_witness *value0, zeropayloadcheckedrecords_nat *out, zeropayloadcheckedrecords_error *error);
zeropayloadcheckedrecords_status zeropayloadcheckedrecords_witnesses(const zeropayloadcheckedrecords_nat *value0, zeropayloadcheckedrecords_array_lean_zero_payload_checked_records_witness_span *out, zeropayloadcheckedrecords_error *error);

#ifdef __cplusplus
}
#endif

#endif /* ZEROPAYLOADCHECKEDRECORDS_H */
