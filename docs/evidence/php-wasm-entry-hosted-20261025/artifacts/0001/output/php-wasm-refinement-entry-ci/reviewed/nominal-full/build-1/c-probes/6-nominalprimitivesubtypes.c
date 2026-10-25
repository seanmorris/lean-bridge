#include "nominalprimitivesubtypes.h"
#include "nominalprimitivesubtypes_runtime.h"

#include <stdlib.h>
#include <string.h>


static const nominalprimitivesubtypes_runtime_v1 *nominalprimitivesubtypes_runtime = NULL;
static const nominalprimitivesubtypes_runtime_v1 *nominalprimitivesubtypes_attempted_runtime = NULL;
static nominalprimitivesubtypes_status nominalprimitivesubtypes_initialization_failure = NOMINALPRIMITIVESUBTYPES_STATUS_RUNTIME_UNAVAILABLE;

static nominalprimitivesubtypes_status nominalprimitivesubtypes_fail(nominalprimitivesubtypes_status status, nominalprimitivesubtypes_error_code code, const char *message, nominalprimitivesubtypes_error *error) {
  if (error != NULL) {
    error->code = code;
    error->message = message;
    error->message_length = strlen(message);
  }
  return status;
}

static nominalprimitivesubtypes_status nominalprimitivesubtypes_ready(nominalprimitivesubtypes_error *error) {
  if (nominalprimitivesubtypes_runtime != NULL) return NOMINALPRIMITIVESUBTYPES_STATUS_OK;
  if (nominalprimitivesubtypes_attempted_runtime != NULL) return nominalprimitivesubtypes_fail(nominalprimitivesubtypes_initialization_failure, NOMINALPRIMITIVESUBTYPES_ERROR_UNEXPECTED, "shared runtime initialization failed and will not be retried", error);
  return nominalprimitivesubtypes_fail(NOMINALPRIMITIVESUBTYPES_STATUS_RUNTIME_UNAVAILABLE, NOMINALPRIMITIVESUBTYPES_ERROR_RUNTIME_UNAVAILABLE, "the shared runtime is not installed", error);
}

nominalprimitivesubtypes_status nominalprimitivesubtypes_runtime_install_v1(const nominalprimitivesubtypes_runtime_v1 *runtime, nominalprimitivesubtypes_error *error) {
  if (runtime == NULL || runtime->abi_version != NOMINALPRIMITIVESUBTYPES_BINDING_ABI_VERSION) {
    return nominalprimitivesubtypes_fail(NOMINALPRIMITIVESUBTYPES_STATUS_RUNTIME_REJECTED, NOMINALPRIMITIVESUBTYPES_ERROR_INVALID_ARGUMENT, "the runtime ABI is incompatible", error);
  }
  if (nominalprimitivesubtypes_attempted_runtime != NULL) {
    if (nominalprimitivesubtypes_attempted_runtime != runtime) return nominalprimitivesubtypes_fail(NOMINALPRIMITIVESUBTYPES_STATUS_RUNTIME_REJECTED, NOMINALPRIMITIVESUBTYPES_ERROR_INVALID_ARGUMENT, "a different shared runtime is already installed", error);
    if (nominalprimitivesubtypes_runtime != NULL) return NOMINALPRIMITIVESUBTYPES_STATUS_OK;
    return nominalprimitivesubtypes_fail(nominalprimitivesubtypes_initialization_failure, NOMINALPRIMITIVESUBTYPES_ERROR_UNEXPECTED, "shared runtime initialization failed and will not be retried", error);
  }
  nominalprimitivesubtypes_attempted_runtime = runtime;
  nominalprimitivesubtypes_runtime = runtime;
  if (runtime->initialize == NULL) return NOMINALPRIMITIVESUBTYPES_STATUS_OK;
  nominalprimitivesubtypes_status status = runtime->initialize(runtime->context, error);
  if (status != NOMINALPRIMITIVESUBTYPES_STATUS_OK) {
    nominalprimitivesubtypes_initialization_failure = status;
    nominalprimitivesubtypes_runtime = NULL;
  }
  return status;
}

void nominalprimitivesubtypes_array_option_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_span_clear(nominalprimitivesubtypes_array_option_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_span *value) {
  if (value == NULL) return;
  if (value->release != NULL && value->owner != NULL) value->release(value->owner);
  memset(value, 0, sizeof(*value));
}

void nominalprimitivesubtypes_nat_clear(nominalprimitivesubtypes_nat *value) {
  if (value == NULL) return;
  if (value->release != NULL && value->owner != NULL) value->release(value->owner);
  memset(value, 0, sizeof(*value));
}

void nominalprimitivesubtypes_int_clear(nominalprimitivesubtypes_int *value) {
  if (value == NULL) return;
  if (value->release != NULL && value->owner != NULL) value->release(value->owner);
  memset(value, 0, sizeof(*value));
}

void nominalprimitivesubtypes_string_clear(nominalprimitivesubtypes_string *value) {
  if (value == NULL) return;
  if (value->release != NULL && value->owner != NULL) value->release(value->owner);
  memset(value, 0, sizeof(*value));
}

void nominalprimitivesubtypes_bytes_clear(nominalprimitivesubtypes_bytes *value) {
  if (value == NULL) return;
  if (value->release != NULL && value->owner != NULL) value->release(value->owner);
  memset(value, 0, sizeof(*value));
}

void nominalprimitivesubtypes_array_option_lean_nominal_primitive_subtypes_packet_span_clear(nominalprimitivesubtypes_array_option_lean_nominal_primitive_subtypes_packet_span *value) {
  if (value == NULL) return;
  if (value->release != NULL && value->owner != NULL) value->release(value->owner);
  memset(value, 0, sizeof(*value));
}

void nominalprimitivesubtypes_event_init(nominalprimitivesubtypes_event *value) { if (value) memset(value, 0, sizeof(*value)); }
void nominalprimitivesubtypes_event_clear(nominalprimitivesubtypes_event *value) {
  if (value == NULL) return;
  switch (value->kind) {
    case 0:
      break;
    case 1:
      nominalprimitivesubtypes_packet_clear(&value->cases.box.value);
      break;
    case 2:
      nominalprimitivesubtypes_array_option_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_span_clear(&value->cases.choices.values);
      break;
    default: break;
  }
  memset(value, 0, sizeof(*value));
}

nominalprimitivesubtypes_status nominalprimitivesubtypes_event_select(nominalprimitivesubtypes_event *value, uint32_t kind) {
  if (!value || kind >= 3 || value->kind >= 3) return NOMINALPRIMITIVESUBTYPES_STATUS_INVALID_ARGUMENT;
  nominalprimitivesubtypes_event_clear(value); value->kind = kind; return NOMINALPRIMITIVESUBTYPES_STATUS_OK;
}

void nominalprimitivesubtypes_packet_clear(nominalprimitivesubtypes_packet *value) {
  if (value == NULL) return;
  nominalprimitivesubtypes_nat_clear(&value->nat_value);
  nominalprimitivesubtypes_int_clear(&value->int_value);
  nominalprimitivesubtypes_string_clear(&value->text_value);
  nominalprimitivesubtypes_bytes_clear(&value->bytes_value);
  nominalprimitivesubtypes_nat_clear(&value->digit);
  memset(value, 0, sizeof(*value));
}

void nominalprimitivesubtypes_pair_clear(nominalprimitivesubtypes_pair *value) {
  if (value == NULL) return;
  nominalprimitivesubtypes_array_option_lean_nominal_primitive_subtypes_packet_span_clear(&value->left);
  nominalprimitivesubtypes_array_option_lean_nominal_primitive_subtypes_packet_span_clear(&value->right);
  memset(value, 0, sizeof(*value));
}

void nominalprimitivesubtypes_raw_packet_clear(nominalprimitivesubtypes_raw_packet *value) {
  if (value == NULL) return;
  nominalprimitivesubtypes_nat_clear(&value->nat_value);
  nominalprimitivesubtypes_int_clear(&value->int_value);
  nominalprimitivesubtypes_string_clear(&value->text_value);
  nominalprimitivesubtypes_bytes_clear(&value->bytes_value);
  nominalprimitivesubtypes_nat_clear(&value->digit);
  memset(value, 0, sizeof(*value));
}

void nominalprimitivesubtypes_option_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_value_clear(nominalprimitivesubtypes_option_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_value *value) {
  if (value == NULL) return;
  nominalprimitivesubtypes_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_value_clear(&value->value);
  memset(value, 0, sizeof(*value));
}

void nominalprimitivesubtypes_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_value_clear(nominalprimitivesubtypes_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_value *value) {
  if (value == NULL) return;
  nominalprimitivesubtypes_packet_clear(&value->ok);
  nominalprimitivesubtypes_packet_clear(&value->error);
  memset(value, 0, sizeof(*value));
}

void nominalprimitivesubtypes_option_lean_nominal_primitive_subtypes_packet_value_clear(nominalprimitivesubtypes_option_lean_nominal_primitive_subtypes_packet_value *value) {
  if (value == NULL) return;
  nominalprimitivesubtypes_packet_clear(&value->value);
  memset(value, 0, sizeof(*value));
}

void nominalprimitivesubtypes_tuple_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_value_clear(nominalprimitivesubtypes_tuple_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_value *value) {
  if (value == NULL) return;
  nominalprimitivesubtypes_packet_clear(&value->fst);
  nominalprimitivesubtypes_packet_clear(&value->snd);
  memset(value, 0, sizeof(*value));
}

nominalprimitivesubtypes_status nominalprimitivesubtypes_aliases(const nominalprimitivesubtypes_array_option_lean_nominal_primitive_subtypes_packet_span *value0, const nominalprimitivesubtypes_array_option_lean_nominal_primitive_subtypes_packet_span *value1, nominalprimitivesubtypes_array_option_lean_nominal_primitive_subtypes_packet_span *out, nominalprimitivesubtypes_error *error) {
  nominalprimitivesubtypes_status ready = nominalprimitivesubtypes_ready(error);
  if (ready != NOMINALPRIMITIVESUBTYPES_STATUS_OK) return ready;
  if (value0 == NULL || value1 == NULL || out == NULL) {
    return nominalprimitivesubtypes_fail(NOMINALPRIMITIVESUBTYPES_STATUS_INVALID_ARGUMENT, NOMINALPRIMITIVESUBTYPES_ERROR_INVALID_ARGUMENT, "a required C argument is null", error);
  }
  if (nominalprimitivesubtypes_runtime->aliases == NULL) return nominalprimitivesubtypes_fail(NOMINALPRIMITIVESUBTYPES_STATUS_RUNTIME_REJECTED, NOMINALPRIMITIVESUBTYPES_ERROR_RUNTIME_UNAVAILABLE, "the runtime does not implement nominalprimitivesubtypes_aliases", error);
  nominalprimitivesubtypes_status status = nominalprimitivesubtypes_runtime->aliases(nominalprimitivesubtypes_runtime->context, value0, value1, out, error);
  return status;
}

nominalprimitivesubtypes_status nominalprimitivesubtypes_combine(const nominalprimitivesubtypes_packet *value0, const nominalprimitivesubtypes_packet *value1, nominalprimitivesubtypes_tuple_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_value *out, nominalprimitivesubtypes_error *error) {
  nominalprimitivesubtypes_status ready = nominalprimitivesubtypes_ready(error);
  if (ready != NOMINALPRIMITIVESUBTYPES_STATUS_OK) return ready;
  if (value0 == NULL || value1 == NULL || out == NULL) {
    return nominalprimitivesubtypes_fail(NOMINALPRIMITIVESUBTYPES_STATUS_INVALID_ARGUMENT, NOMINALPRIMITIVESUBTYPES_ERROR_INVALID_ARGUMENT, "a required C argument is null", error);
  }
  if (nominalprimitivesubtypes_runtime->combine == NULL) return nominalprimitivesubtypes_fail(NOMINALPRIMITIVESUBTYPES_STATUS_RUNTIME_REJECTED, NOMINALPRIMITIVESUBTYPES_ERROR_RUNTIME_UNAVAILABLE, "the runtime does not implement nominalprimitivesubtypes_combine", error);
  nominalprimitivesubtypes_status status = nominalprimitivesubtypes_runtime->combine(nominalprimitivesubtypes_runtime->context, value0, value1, out, error);
  return status;
}

nominalprimitivesubtypes_status nominalprimitivesubtypes_echo_a(const nominalprimitivesubtypes_packet *value0, nominalprimitivesubtypes_packet *out, nominalprimitivesubtypes_error *error) {
  nominalprimitivesubtypes_status ready = nominalprimitivesubtypes_ready(error);
  if (ready != NOMINALPRIMITIVESUBTYPES_STATUS_OK) return ready;
  if (value0 == NULL || out == NULL) {
    return nominalprimitivesubtypes_fail(NOMINALPRIMITIVESUBTYPES_STATUS_INVALID_ARGUMENT, NOMINALPRIMITIVESUBTYPES_ERROR_INVALID_ARGUMENT, "a required C argument is null", error);
  }
  if (nominalprimitivesubtypes_runtime->echo_a == NULL) return nominalprimitivesubtypes_fail(NOMINALPRIMITIVESUBTYPES_STATUS_RUNTIME_REJECTED, NOMINALPRIMITIVESUBTYPES_ERROR_RUNTIME_UNAVAILABLE, "the runtime does not implement nominalprimitivesubtypes_echo_a", error);
  nominalprimitivesubtypes_status status = nominalprimitivesubtypes_runtime->echo_a(nominalprimitivesubtypes_runtime->context, value0, out, error);
  return status;
}

nominalprimitivesubtypes_status nominalprimitivesubtypes_echo_b(const nominalprimitivesubtypes_packet *value0, nominalprimitivesubtypes_packet *out, nominalprimitivesubtypes_error *error) {
  nominalprimitivesubtypes_status ready = nominalprimitivesubtypes_ready(error);
  if (ready != NOMINALPRIMITIVESUBTYPES_STATUS_OK) return ready;
  if (value0 == NULL || out == NULL) {
    return nominalprimitivesubtypes_fail(NOMINALPRIMITIVESUBTYPES_STATUS_INVALID_ARGUMENT, NOMINALPRIMITIVESUBTYPES_ERROR_INVALID_ARGUMENT, "a required C argument is null", error);
  }
  if (nominalprimitivesubtypes_runtime->echo_b == NULL) return nominalprimitivesubtypes_fail(NOMINALPRIMITIVESUBTYPES_STATUS_RUNTIME_REJECTED, NOMINALPRIMITIVESUBTYPES_ERROR_RUNTIME_UNAVAILABLE, "the runtime does not implement nominalprimitivesubtypes_echo_b", error);
  nominalprimitivesubtypes_status status = nominalprimitivesubtypes_runtime->echo_b(nominalprimitivesubtypes_runtime->context, value0, out, error);
  return status;
}

nominalprimitivesubtypes_status nominalprimitivesubtypes_echo_event_a(const nominalprimitivesubtypes_event *value0, nominalprimitivesubtypes_event *out, nominalprimitivesubtypes_error *error) {
  nominalprimitivesubtypes_status ready = nominalprimitivesubtypes_ready(error);
  if (ready != NOMINALPRIMITIVESUBTYPES_STATUS_OK) return ready;
  if (value0 == NULL || out == NULL) {
    return nominalprimitivesubtypes_fail(NOMINALPRIMITIVESUBTYPES_STATUS_INVALID_ARGUMENT, NOMINALPRIMITIVESUBTYPES_ERROR_INVALID_ARGUMENT, "a required C argument is null", error);
  }
  if (nominalprimitivesubtypes_runtime->echo_event_a == NULL) return nominalprimitivesubtypes_fail(NOMINALPRIMITIVESUBTYPES_STATUS_RUNTIME_REJECTED, NOMINALPRIMITIVESUBTYPES_ERROR_RUNTIME_UNAVAILABLE, "the runtime does not implement nominalprimitivesubtypes_echo_event_a", error);
  nominalprimitivesubtypes_status status = nominalprimitivesubtypes_runtime->echo_event_a(nominalprimitivesubtypes_runtime->context, value0, out, error);
  return status;
}

nominalprimitivesubtypes_status nominalprimitivesubtypes_echo_event_b(const nominalprimitivesubtypes_event *value0, nominalprimitivesubtypes_event *out, nominalprimitivesubtypes_error *error) {
  nominalprimitivesubtypes_status ready = nominalprimitivesubtypes_ready(error);
  if (ready != NOMINALPRIMITIVESUBTYPES_STATUS_OK) return ready;
  if (value0 == NULL || out == NULL) {
    return nominalprimitivesubtypes_fail(NOMINALPRIMITIVESUBTYPES_STATUS_INVALID_ARGUMENT, NOMINALPRIMITIVESUBTYPES_ERROR_INVALID_ARGUMENT, "a required C argument is null", error);
  }
  if (nominalprimitivesubtypes_runtime->echo_event_b == NULL) return nominalprimitivesubtypes_fail(NOMINALPRIMITIVESUBTYPES_STATUS_RUNTIME_REJECTED, NOMINALPRIMITIVESUBTYPES_ERROR_RUNTIME_UNAVAILABLE, "the runtime does not implement nominalprimitivesubtypes_echo_event_b", error);
  nominalprimitivesubtypes_status status = nominalprimitivesubtypes_runtime->echo_event_b(nominalprimitivesubtypes_runtime->context, value0, out, error);
  return status;
}

nominalprimitivesubtypes_status nominalprimitivesubtypes_echo_pair(const nominalprimitivesubtypes_pair *value0, nominalprimitivesubtypes_pair *out, nominalprimitivesubtypes_error *error) {
  nominalprimitivesubtypes_status ready = nominalprimitivesubtypes_ready(error);
  if (ready != NOMINALPRIMITIVESUBTYPES_STATUS_OK) return ready;
  if (value0 == NULL || out == NULL) {
    return nominalprimitivesubtypes_fail(NOMINALPRIMITIVESUBTYPES_STATUS_INVALID_ARGUMENT, NOMINALPRIMITIVESUBTYPES_ERROR_INVALID_ARGUMENT, "a required C argument is null", error);
  }
  if (nominalprimitivesubtypes_runtime->echo_pair == NULL) return nominalprimitivesubtypes_fail(NOMINALPRIMITIVESUBTYPES_STATUS_RUNTIME_REJECTED, NOMINALPRIMITIVESUBTYPES_ERROR_RUNTIME_UNAVAILABLE, "the runtime does not implement nominalprimitivesubtypes_echo_pair", error);
  nominalprimitivesubtypes_status status = nominalprimitivesubtypes_runtime->echo_pair(nominalprimitivesubtypes_runtime->context, value0, out, error);
  return status;
}

nominalprimitivesubtypes_status nominalprimitivesubtypes_produce(const nominalprimitivesubtypes_raw_packet *value0, nominalprimitivesubtypes_option_lean_nominal_primitive_subtypes_packet_value *out, nominalprimitivesubtypes_error *error) {
  nominalprimitivesubtypes_status ready = nominalprimitivesubtypes_ready(error);
  if (ready != NOMINALPRIMITIVESUBTYPES_STATUS_OK) return ready;
  if (value0 == NULL || out == NULL) {
    return nominalprimitivesubtypes_fail(NOMINALPRIMITIVESUBTYPES_STATUS_INVALID_ARGUMENT, NOMINALPRIMITIVESUBTYPES_ERROR_INVALID_ARGUMENT, "a required C argument is null", error);
  }
  if (nominalprimitivesubtypes_runtime->produce == NULL) return nominalprimitivesubtypes_fail(NOMINALPRIMITIVESUBTYPES_STATUS_RUNTIME_REJECTED, NOMINALPRIMITIVESUBTYPES_ERROR_RUNTIME_UNAVAILABLE, "the runtime does not implement nominalprimitivesubtypes_produce", error);
  nominalprimitivesubtypes_status status = nominalprimitivesubtypes_runtime->produce(nominalprimitivesubtypes_runtime->context, value0, out, error);
  return status;
}

nominalprimitivesubtypes_status nominalprimitivesubtypes_produce_choices(const nominalprimitivesubtypes_raw_packet *value0, nominalprimitivesubtypes_event *out, nominalprimitivesubtypes_error *error) {
  nominalprimitivesubtypes_status ready = nominalprimitivesubtypes_ready(error);
  if (ready != NOMINALPRIMITIVESUBTYPES_STATUS_OK) return ready;
  if (value0 == NULL || out == NULL) {
    return nominalprimitivesubtypes_fail(NOMINALPRIMITIVESUBTYPES_STATUS_INVALID_ARGUMENT, NOMINALPRIMITIVESUBTYPES_ERROR_INVALID_ARGUMENT, "a required C argument is null", error);
  }
  if (nominalprimitivesubtypes_runtime->produce_choices == NULL) return nominalprimitivesubtypes_fail(NOMINALPRIMITIVESUBTYPES_STATUS_RUNTIME_REJECTED, NOMINALPRIMITIVESUBTYPES_ERROR_RUNTIME_UNAVAILABLE, "the runtime does not implement nominalprimitivesubtypes_produce_choices", error);
  nominalprimitivesubtypes_status status = nominalprimitivesubtypes_runtime->produce_choices(nominalprimitivesubtypes_runtime->context, value0, out, error);
  return status;
}

nominalprimitivesubtypes_status nominalprimitivesubtypes_produce_event(const nominalprimitivesubtypes_raw_packet *value0, nominalprimitivesubtypes_event *out, nominalprimitivesubtypes_error *error) {
  nominalprimitivesubtypes_status ready = nominalprimitivesubtypes_ready(error);
  if (ready != NOMINALPRIMITIVESUBTYPES_STATUS_OK) return ready;
  if (value0 == NULL || out == NULL) {
    return nominalprimitivesubtypes_fail(NOMINALPRIMITIVESUBTYPES_STATUS_INVALID_ARGUMENT, NOMINALPRIMITIVESUBTYPES_ERROR_INVALID_ARGUMENT, "a required C argument is null", error);
  }
  if (nominalprimitivesubtypes_runtime->produce_event == NULL) return nominalprimitivesubtypes_fail(NOMINALPRIMITIVESUBTYPES_STATUS_RUNTIME_REJECTED, NOMINALPRIMITIVESUBTYPES_ERROR_RUNTIME_UNAVAILABLE, "the runtime does not implement nominalprimitivesubtypes_produce_event", error);
  nominalprimitivesubtypes_status status = nominalprimitivesubtypes_runtime->produce_event(nominalprimitivesubtypes_runtime->context, value0, out, error);
  return status;
}

nominalprimitivesubtypes_status nominalprimitivesubtypes_produce_group(const nominalprimitivesubtypes_raw_packet *value0, nominalprimitivesubtypes_array_option_lean_nominal_primitive_subtypes_packet_span *out, nominalprimitivesubtypes_error *error) {
  nominalprimitivesubtypes_status ready = nominalprimitivesubtypes_ready(error);
  if (ready != NOMINALPRIMITIVESUBTYPES_STATUS_OK) return ready;
  if (value0 == NULL || out == NULL) {
    return nominalprimitivesubtypes_fail(NOMINALPRIMITIVESUBTYPES_STATUS_INVALID_ARGUMENT, NOMINALPRIMITIVESUBTYPES_ERROR_INVALID_ARGUMENT, "a required C argument is null", error);
  }
  if (nominalprimitivesubtypes_runtime->produce_group == NULL) return nominalprimitivesubtypes_fail(NOMINALPRIMITIVESUBTYPES_STATUS_RUNTIME_REJECTED, NOMINALPRIMITIVESUBTYPES_ERROR_RUNTIME_UNAVAILABLE, "the runtime does not implement nominalprimitivesubtypes_produce_group", error);
  nominalprimitivesubtypes_status status = nominalprimitivesubtypes_runtime->produce_group(nominalprimitivesubtypes_runtime->context, value0, out, error);
  return status;
}

nominalprimitivesubtypes_status nominalprimitivesubtypes_produce_pair(const nominalprimitivesubtypes_raw_packet *value0, nominalprimitivesubtypes_pair *out, nominalprimitivesubtypes_error *error) {
  nominalprimitivesubtypes_status ready = nominalprimitivesubtypes_ready(error);
  if (ready != NOMINALPRIMITIVESUBTYPES_STATUS_OK) return ready;
  if (value0 == NULL || out == NULL) {
    return nominalprimitivesubtypes_fail(NOMINALPRIMITIVESUBTYPES_STATUS_INVALID_ARGUMENT, NOMINALPRIMITIVESUBTYPES_ERROR_INVALID_ARGUMENT, "a required C argument is null", error);
  }
  if (nominalprimitivesubtypes_runtime->produce_pair == NULL) return nominalprimitivesubtypes_fail(NOMINALPRIMITIVESUBTYPES_STATUS_RUNTIME_REJECTED, NOMINALPRIMITIVESUBTYPES_ERROR_RUNTIME_UNAVAILABLE, "the runtime does not implement nominalprimitivesubtypes_produce_pair", error);
  nominalprimitivesubtypes_status status = nominalprimitivesubtypes_runtime->produce_pair(nominalprimitivesubtypes_runtime->context, value0, out, error);
  return status;
}

nominalprimitivesubtypes_status nominalprimitivesubtypes_refuse_unit(const nominalprimitivesubtypes_packet *value0, nominalprimitivesubtypes_packet *out, nominalprimitivesubtypes_error *error) {
  nominalprimitivesubtypes_status ready = nominalprimitivesubtypes_ready(error);
  if (ready != NOMINALPRIMITIVESUBTYPES_STATUS_OK) return ready;
  if (value0 == NULL || out == NULL) {
    return nominalprimitivesubtypes_fail(NOMINALPRIMITIVESUBTYPES_STATUS_INVALID_ARGUMENT, NOMINALPRIMITIVESUBTYPES_ERROR_INVALID_ARGUMENT, "a required C argument is null", error);
  }
  if (nominalprimitivesubtypes_runtime->refuse_unit == NULL) return nominalprimitivesubtypes_fail(NOMINALPRIMITIVESUBTYPES_STATUS_RUNTIME_REJECTED, NOMINALPRIMITIVESUBTYPES_ERROR_RUNTIME_UNAVAILABLE, "the runtime does not implement nominalprimitivesubtypes_refuse_unit", error);
  nominalprimitivesubtypes_status status = nominalprimitivesubtypes_runtime->refuse_unit(nominalprimitivesubtypes_runtime->context, value0, out, error);
  return status;
}

nominalprimitivesubtypes_status nominalprimitivesubtypes_word_bits(uint32_t *out, nominalprimitivesubtypes_error *error) {
  nominalprimitivesubtypes_status ready = nominalprimitivesubtypes_ready(error);
  if (ready != NOMINALPRIMITIVESUBTYPES_STATUS_OK) return ready;
  if (out == NULL) {
    return nominalprimitivesubtypes_fail(NOMINALPRIMITIVESUBTYPES_STATUS_INVALID_ARGUMENT, NOMINALPRIMITIVESUBTYPES_ERROR_INVALID_ARGUMENT, "a required C argument is null", error);
  }
  if (nominalprimitivesubtypes_runtime->word_bits == NULL) return nominalprimitivesubtypes_fail(NOMINALPRIMITIVESUBTYPES_STATUS_RUNTIME_REJECTED, NOMINALPRIMITIVESUBTYPES_ERROR_RUNTIME_UNAVAILABLE, "the runtime does not implement nominalprimitivesubtypes_word_bits", error);
  nominalprimitivesubtypes_status status = nominalprimitivesubtypes_runtime->word_bits(nominalprimitivesubtypes_runtime->context, out, error);
  return status;
}
