#ifndef CHECKEDRECORDVALUEINDICES_H
#define CHECKEDRECORDVALUEINDICES_H

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

#define CHECKEDRECORDVALUEINDICES_BINDING_ABI_VERSION 1u
#define CHECKEDRECORDVALUEINDICES_BINDING_IR_SHA256 "95f899d862f0f2dcd11b72435322d705cc9188d2e4347d5eb093bb1a28671da9"

typedef enum checkedrecordvalueindices_status {
  CHECKEDRECORDVALUEINDICES_STATUS_OK = 0,
  CHECKEDRECORDVALUEINDICES_STATUS_INVALID_ARGUMENT = 1,
  CHECKEDRECORDVALUEINDICES_STATUS_RUNTIME_UNAVAILABLE = 2,
  CHECKEDRECORDVALUEINDICES_STATUS_RUNTIME_REJECTED = 3,
  CHECKEDRECORDVALUEINDICES_STATUS_DECLARED_ERROR = 4,
  CHECKEDRECORDVALUEINDICES_STATUS_UNEXPECTED_ERROR = 5
} checkedrecordvalueindices_status;

typedef enum checkedrecordvalueindices_error_code {
  CHECKEDRECORDVALUEINDICES_ERROR_NONE = 0,
  CHECKEDRECORDVALUEINDICES_ERROR_INVALID_ARGUMENT = 1,
  CHECKEDRECORDVALUEINDICES_ERROR_RUNTIME_UNAVAILABLE = 2,
  CHECKEDRECORDVALUEINDICES_ERROR_UNEXPECTED = 65535
} checkedrecordvalueindices_error_code;

typedef struct checkedrecordvalueindices_error {
  checkedrecordvalueindices_error_code code;
  const char *message;
  size_t message_length;
} checkedrecordvalueindices_error;

typedef struct checkedrecordvalueindices_nat checkedrecordvalueindices_nat;
typedef struct checkedrecordvalueindices_array_nat_span checkedrecordvalueindices_array_nat_span;
typedef struct checkedrecordvalueindices_ab checkedrecordvalueindices_ab;
typedef struct checkedrecordvalueindices_empty_sized checkedrecordvalueindices_empty_sized;
typedef struct checkedrecordvalueindices_empty_token checkedrecordvalueindices_empty_token;
typedef struct checkedrecordvalueindices_off checkedrecordvalueindices_off;
typedef struct checkedrecordvalueindices_on checkedrecordvalueindices_on;
typedef struct checkedrecordvalueindices_unicode_token checkedrecordvalueindices_unicode_token;
typedef struct checkedrecordvalueindices_wide_token checkedrecordvalueindices_wide_token;
typedef struct checkedrecordvalueindices_zero_token checkedrecordvalueindices_zero_token;

typedef struct checkedrecordvalueindices_nat {
  const uint32_t *data;
  size_t length;
  void *owner;
  void (*release)(void *owner);
} checkedrecordvalueindices_nat;

void checkedrecordvalueindices_nat_clear(checkedrecordvalueindices_nat *value);

typedef struct checkedrecordvalueindices_array_nat_span {
  const checkedrecordvalueindices_nat *data;
  size_t length;
  void *owner;
  void (*release)(void *owner);
} checkedrecordvalueindices_array_nat_span;

void checkedrecordvalueindices_array_nat_span_clear(checkedrecordvalueindices_array_nat_span *value);

typedef struct checkedrecordvalueindices_ab {
  checkedrecordvalueindices_nat size;
} checkedrecordvalueindices_ab;

void checkedrecordvalueindices_ab_clear(checkedrecordvalueindices_ab *value);

typedef struct checkedrecordvalueindices_empty_sized {
  checkedrecordvalueindices_array_nat_span data;
} checkedrecordvalueindices_empty_sized;

void checkedrecordvalueindices_empty_sized_clear(checkedrecordvalueindices_empty_sized *value);

typedef struct checkedrecordvalueindices_empty_token {
  checkedrecordvalueindices_nat count;
} checkedrecordvalueindices_empty_token;

void checkedrecordvalueindices_empty_token_clear(checkedrecordvalueindices_empty_token *value);

typedef struct checkedrecordvalueindices_off {
  checkedrecordvalueindices_nat count;
} checkedrecordvalueindices_off;

void checkedrecordvalueindices_off_clear(checkedrecordvalueindices_off *value);

typedef struct checkedrecordvalueindices_on {
  checkedrecordvalueindices_nat count;
} checkedrecordvalueindices_on;

void checkedrecordvalueindices_on_clear(checkedrecordvalueindices_on *value);

typedef struct checkedrecordvalueindices_unicode_token {
  checkedrecordvalueindices_nat count;
} checkedrecordvalueindices_unicode_token;

void checkedrecordvalueindices_unicode_token_clear(checkedrecordvalueindices_unicode_token *value);

typedef struct checkedrecordvalueindices_wide_token {
  checkedrecordvalueindices_nat count;
} checkedrecordvalueindices_wide_token;

void checkedrecordvalueindices_wide_token_clear(checkedrecordvalueindices_wide_token *value);

typedef struct checkedrecordvalueindices_zero_token {
  checkedrecordvalueindices_nat count;
} checkedrecordvalueindices_zero_token;

void checkedrecordvalueindices_zero_token_clear(checkedrecordvalueindices_zero_token *value);

checkedrecordvalueindices_status checkedrecordvalueindices_produce_ab(checkedrecordvalueindices_ab *out, checkedrecordvalueindices_error *error);
checkedrecordvalueindices_status checkedrecordvalueindices_produce_empty_sized(checkedrecordvalueindices_empty_sized *out, checkedrecordvalueindices_error *error);
checkedrecordvalueindices_status checkedrecordvalueindices_produce_empty_string(const checkedrecordvalueindices_nat *arg0, checkedrecordvalueindices_empty_token *out, checkedrecordvalueindices_error *error);
checkedrecordvalueindices_status checkedrecordvalueindices_produce_false_bool(checkedrecordvalueindices_off *out, checkedrecordvalueindices_error *error);
checkedrecordvalueindices_status checkedrecordvalueindices_produce_true_bool(checkedrecordvalueindices_on *out, checkedrecordvalueindices_error *error);
checkedrecordvalueindices_status checkedrecordvalueindices_produce_unicode_string(const checkedrecordvalueindices_nat *arg0, checkedrecordvalueindices_unicode_token *out, checkedrecordvalueindices_error *error);
checkedrecordvalueindices_status checkedrecordvalueindices_produce_wide_nat(const checkedrecordvalueindices_nat *arg0, checkedrecordvalueindices_wide_token *out, checkedrecordvalueindices_error *error);
checkedrecordvalueindices_status checkedrecordvalueindices_produce_zero_nat(const checkedrecordvalueindices_nat *arg0, checkedrecordvalueindices_zero_token *out, checkedrecordvalueindices_error *error);

#ifdef __cplusplus
}
#endif

#endif /* CHECKEDRECORDVALUEINDICES_H */
