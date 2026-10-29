/* Independent installed C consumer using only generated public types. */
#include "host_null_demo.h"
#include <assert.h>
#include <stdio.h>

static unsigned checks, callback_calls;
#define CHECK(value) do { ++checks; assert(value); } while (0)

static void ok(host_null_demo_status status) {
  CHECK(status == HOST_NULL_DEMO_STATUS_OK);
}
static host_null_demo_status callback(void *context,
    const host_null_demo_host_null_uint32_value *value,
    host_null_demo_host_null_option_uint32_value *out,
    host_null_demo_error *error) {
  (void)context; (void)error; ++callback_calls;
  if (!value->has_value) {
    *out = (host_null_demo_host_null_option_uint32_value){
      .has_value = 1, .value = {.has_value = 0}};
  } else {
    *out = (host_null_demo_host_null_option_uint32_value){
      .has_value = 1, .value = {.has_value = 1, .value = value->value + 1}};
  }
  return HOST_NULL_DEMO_STATUS_OK;
}
static host_null_demo_status invalid_callback(void *context,
    const host_null_demo_host_null_uint32_value *value,
    host_null_demo_host_null_option_uint32_value *out,
    host_null_demo_error *error) {
  (void)context; (void)value; (void)error;
  *out = (host_null_demo_host_null_option_uint32_value){.has_value = 2};
  return HOST_NULL_DEMO_STATUS_OK;
}

int main(void) {
  host_null_demo_error error = {0};
  host_null_demo_host_null_uint32_value direct = {0}, direct_out = {0};
  ok(host_null_demo_echo(&direct, &direct_out, &error));
  CHECK(!direct_out.has_value);
  direct = (host_null_demo_host_null_uint32_value){1, 42};
  ok(host_null_demo_echo(&direct, &direct_out, &error));
  CHECK(direct_out.has_value == 1 && direct_out.value == 42);
  host_null_demo_host_null_uint32_value_clear(&direct_out);

  host_null_demo_host_null_option_uint32_value nullable[] = {
    {0}, {1, {0}}, {1, {1, 42}}
  };
  for (size_t index = 0; index < 3; ++index) {
    host_null_demo_host_null_option_uint32_value out = {0};
    ok(host_null_demo_nullable_option(&nullable[index], &out, &error));
    CHECK(out.has_value == nullable[index].has_value);
    if (out.has_value) CHECK(out.value.has_value == nullable[index].value.has_value);
    if (out.has_value && out.value.has_value) CHECK(out.value.value == 42);
    host_null_demo_host_null_option_uint32_value_clear(&out);
  }
  host_null_demo_option_host_null_uint32_value optional[] = {
    {0}, {1, {0}}, {1, {1, 42}}
  };
  for (size_t index = 0; index < 3; ++index) {
    host_null_demo_option_host_null_uint32_value out = {0};
    ok(host_null_demo_optional_nullable(&optional[index], &out, &error));
    CHECK(out.has_value == optional[index].has_value);
    if (out.has_value) CHECK(out.value.has_value == optional[index].value.has_value);
    if (out.has_value && out.value.has_value) CHECK(out.value.value == 42);
    host_null_demo_option_host_null_uint32_value_clear(&out);
  }

  host_null_demo_packet packet = {
    .direct = {0}, .nullable_option = {1, {0}},
    .optional_nullable = {1, {0}}
  }, packet_out = {0};
  ok(host_null_demo_echo_packet(&packet, &packet_out, &error));
  CHECK(!packet_out.direct.has_value);
  CHECK(packet_out.nullable_option.has_value && !packet_out.nullable_option.value.has_value);
  CHECK(packet_out.optional_nullable.has_value && !packet_out.optional_nullable.value.has_value);
  host_null_demo_packet_clear(&packet_out);

  host_null_demo_callbackb89d42e1c745ab45c442 host = {callback, NULL};
  host_null_demo_host_null_option_uint32_value callback_out = {0};
  direct = (host_null_demo_host_null_uint32_value){0};
  ok(host_null_demo_call_host(&direct, &host, &callback_out, &error));
  CHECK(callback_out.has_value && !callback_out.value.has_value);
  host_null_demo_host_null_option_uint32_value_clear(&callback_out);
  direct = (host_null_demo_host_null_uint32_value){1, 42};
  ok(host_null_demo_call_host(&direct, &host, &callback_out, &error));
  CHECK(callback_out.has_value && callback_out.value.has_value
    && callback_out.value.value == 43 && callback_calls == 2);
  host_null_demo_host_null_option_uint32_value_clear(&callback_out);

  host_null_demo_host_null_option_uint32_value captured = {1, {1, 77}};
  host_null_demo_owned_callbackb89d42e1c745ab45c442 *closure = NULL;
  ok(host_null_demo_make_closure(&captured, &closure, &error));
  CHECK(closure != NULL);
  direct = (host_null_demo_host_null_uint32_value){0};
  ok(host_null_demo_owned_callbackb89d42e1c745ab45c442_call(
    closure, &direct, &callback_out, &error));
  CHECK(callback_out.has_value && callback_out.value.has_value
    && callback_out.value.value == 77);
  host_null_demo_host_null_option_uint32_value_clear(&callback_out);
  host_null_demo_owned_callbackb89d42e1c745ab45c442_dispose(&closure);
  CHECK(closure == NULL);

  direct = (host_null_demo_host_null_uint32_value){2, 9};
  CHECK(host_null_demo_echo(&direct, &direct_out, &error)
    == HOST_NULL_DEMO_STATUS_INVALID_ARGUMENT);
  host = (host_null_demo_callbackb89d42e1c745ab45c442){invalid_callback, NULL};
  direct = (host_null_demo_host_null_uint32_value){0};
  CHECK(host_null_demo_call_host(&direct, &host, &callback_out, &error)
    == HOST_NULL_DEMO_STATUS_INVALID_ARGUMENT);
  CHECK(!callback_out.has_value);

  printf("host-null-c:%u\n", checks);
  return 0;
}
