#ifndef NESTEDCHECKEDRECORDS_H
#define NESTEDCHECKEDRECORDS_H

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

#define NESTEDCHECKEDRECORDS_BINDING_ABI_VERSION 1u
#define NESTEDCHECKEDRECORDS_BINDING_IR_SHA256 "c59ddcc72f48add7c4ba256d14a96ef00806b50064996ed04ffdcf4d902aefcb"

typedef enum nestedcheckedrecords_status {
  NESTEDCHECKEDRECORDS_STATUS_OK = 0,
  NESTEDCHECKEDRECORDS_STATUS_INVALID_ARGUMENT = 1,
  NESTEDCHECKEDRECORDS_STATUS_RUNTIME_UNAVAILABLE = 2,
  NESTEDCHECKEDRECORDS_STATUS_RUNTIME_REJECTED = 3,
  NESTEDCHECKEDRECORDS_STATUS_DECLARED_ERROR = 4,
  NESTEDCHECKEDRECORDS_STATUS_UNEXPECTED_ERROR = 5
} nestedcheckedrecords_status;

typedef enum nestedcheckedrecords_error_code {
  NESTEDCHECKEDRECORDS_ERROR_NONE = 0,
  NESTEDCHECKEDRECORDS_ERROR_INVALID_ARGUMENT = 1,
  NESTEDCHECKEDRECORDS_ERROR_RUNTIME_UNAVAILABLE = 2,
  NESTEDCHECKEDRECORDS_ERROR_UNEXPECTED = 65535
} nestedcheckedrecords_error_code;

typedef struct nestedcheckedrecords_error {
  nestedcheckedrecords_error_code code;
  const char *message;
  size_t message_length;
} nestedcheckedrecords_error;

typedef struct nestedcheckedrecords_nat nestedcheckedrecords_nat;
typedef struct nestedcheckedrecords_array_lean_nested_checked_records_packet_span nestedcheckedrecords_array_lean_nested_checked_records_packet_span;
typedef struct nestedcheckedrecords_packet nestedcheckedrecords_packet;
typedef struct nestedcheckedrecords_option_lean_nested_checked_records_packet_value nestedcheckedrecords_option_lean_nested_checked_records_packet_value;

typedef struct nestedcheckedrecords_nat {
  const uint32_t *data;
  size_t length;
  void *owner;
  void (*release)(void *owner);
} nestedcheckedrecords_nat;

void nestedcheckedrecords_nat_clear(nestedcheckedrecords_nat *value);

typedef struct nestedcheckedrecords_array_lean_nested_checked_records_packet_span {
  const nestedcheckedrecords_packet *data;
  size_t length;
  void *owner;
  void (*release)(void *owner);
} nestedcheckedrecords_array_lean_nested_checked_records_packet_span;

void nestedcheckedrecords_array_lean_nested_checked_records_packet_span_clear(nestedcheckedrecords_array_lean_nested_checked_records_packet_span *value);

typedef struct nestedcheckedrecords_packet {
  nestedcheckedrecords_nat digit;
  nestedcheckedrecords_nat word;
} nestedcheckedrecords_packet;

void nestedcheckedrecords_packet_clear(nestedcheckedrecords_packet *value);

typedef struct nestedcheckedrecords_option_lean_nested_checked_records_packet_value {
  uint8_t has_value;
  nestedcheckedrecords_packet value;
} nestedcheckedrecords_option_lean_nested_checked_records_packet_value;

void nestedcheckedrecords_option_lean_nested_checked_records_packet_value_clear(nestedcheckedrecords_option_lean_nested_checked_records_packet_value *value);

nestedcheckedrecords_status nestedcheckedrecords_produce_array(const nestedcheckedrecords_nat *value0, nestedcheckedrecords_array_lean_nested_checked_records_packet_span *out, nestedcheckedrecords_error *error);
nestedcheckedrecords_status nestedcheckedrecords_produce_option(const nestedcheckedrecords_nat *value0, nestedcheckedrecords_option_lean_nested_checked_records_packet_value *out, nestedcheckedrecords_error *error);

#ifdef __cplusplus
}
#endif

#endif /* NESTEDCHECKEDRECORDS_H */
