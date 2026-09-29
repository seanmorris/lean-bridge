/**
 * Bounded owned-graph traversal with root-specific tables and identity hooks.
 *
 * @file
 */
import { witConversionPrelude } from "./copied-conversions.mjs";

const prelude = () => {
	let text = witConversionPrelude;
	for(const [before, after] of [
		["typedef struct { size_t remaining; lb_allocation *allocations; } lb_scope;", "typedef struct { size_t remaining; lb_allocation *allocations; unsigned failure; } lb_scope;"]
		, ["if (count && width > scope->remaining / count) return false;", "if (count && width > scope->remaining / count) { scope->failure = 2; return false; }"]
		, ["if (width > (SIZE_MAX - sizeof(lb_allocation)) / count) return NULL;", "if (width > (SIZE_MAX - sizeof(lb_allocation)) / count) { scope->failure = 2; return NULL; }"]
		, ["if (!allocation) return NULL;", "if (!allocation) { scope->failure = 3; return NULL; }"]
	]) {
		if(text.split(before).length !== 2) throw new Error("Review the shared WIT allocation prelude before changing owned conversions");
		text = text.replace(before, after);
	}
	return text;
};

/**
 * Identity hooks validate nominal types and lifetimes in the owning session.
 * A writer must register every produced resource in its rollback ledger. The
 * discard hook drops unpublished canonical resources; published handles remain
 * owned by the Component Model host, not by the native scratch allocator.
 *
 * @param model - Validated owned WIT graph model.
 */
export const ownedWitGraphRuntime = model => prelude() + `
#define OW_TYPES ${Math.max(1, model.layout.nodes.length)}
#define OW_DEPTH ${model.model.limits.depth}
#define OW_NODES ${model.model.limits.visits}
#define OW_BYTES ${model.model.limits.bytes}
typedef struct {
  void *data;
  bool (*read)(void *, size_t, bool, const wasmtime_component_val_t *, uint64_t *);
  bool (*write)(void *, size_t, bool, uint64_t, wasmtime_component_val_t *);
  void (*discard)(void *, wasmtime_component_resource_any_t *);
} ow_identities;
typedef struct { lb_scope memory; size_t visits; ow_identities identities; } ow_scope;
typedef struct { size_t type; const char *name; } ow_table_schema;
typedef struct { size_t count; const ow_table_schema *tables; } ow_schema;
typedef struct { size_t type; uint32_t index; const void *address; } ow_path;
typedef struct {
  ow_scope *scope; bool borrowed;
  const wasmtime_component_vallist_t *tables[OW_TYPES];
  size_t offsets[OW_TYPES], total, visited, active;
  uint8_t *seen;
  ow_path path[OW_DEPTH + 1];
} ow_input;
typedef struct ow_row { struct ow_row *next; wasmtime_component_val_t value; } ow_row;
typedef struct { ow_row *head, *tail; uint32_t count; } ow_table;
typedef struct {
  ow_scope *scope; bool borrowed; const ow_schema *schema;
  ow_table tables[OW_TYPES]; size_t active;
  ow_path path[OW_DEPTH + 1];
} ow_output;
static inline bool ow_visit(ow_scope *scope, unsigned depth, size_t bytes) {
  if (depth > OW_DEPTH || !scope->visits) { scope->memory.failure = 2; return false; }
  --scope->visits; return lb_charge(&scope->memory, 1, bytes);
}
static inline bool ow_count(ow_scope *scope, size_t count) {
  if (count > scope->visits) { scope->memory.failure = 2; return false; }
  return true;
}
/* Traverse only values constructed by these encoders, never unchecked inputs. */
static inline void ow_discard_resources(ow_scope *scope, wasmtime_component_val_t *value) {
  switch (value->kind) {
  case WASMTIME_COMPONENT_RESOURCE:
    if (value->of.resource && scope->identities.discard) scope->identities.discard(scope->identities.data, value->of.resource);
    break;
  case WASMTIME_COMPONENT_RECORD:
    for (size_t i = 0; i < value->of.record.size; ++i) ow_discard_resources(scope, &value->of.record.data[i].val);
    break;
  case WASMTIME_COMPONENT_LIST:
    for (size_t i = 0; i < value->of.list.size; ++i) ow_discard_resources(scope, &value->of.list.data[i]);
    break;
  case WASMTIME_COMPONENT_TUPLE:
    for (size_t i = 0; i < value->of.tuple.size; ++i) ow_discard_resources(scope, &value->of.tuple.data[i]);
    break;
  case WASMTIME_COMPONENT_VARIANT:
    if (value->of.variant.val) ow_discard_resources(scope, value->of.variant.val);
    break;
  case WASMTIME_COMPONENT_OPTION:
    if (value->of.option) ow_discard_resources(scope, value->of.option);
    break;
  case WASMTIME_COMPONENT_RESULT:
    if (value->of.result.val) ow_discard_resources(scope, value->of.result.val);
    break;
  default: break;
  }
}
static inline void ow_value_delete(ow_scope *scope, wasmtime_component_val_t *value) {
  ow_discard_resources(scope, value); wasmtime_component_val_delete(value);
  *value = (wasmtime_component_val_t){0};
}
static inline bool ow_record_in(const wasmtime_component_val_t *value, size_t count, ow_scope *scope) {
  return lb_buffer(value, 1, sizeof(*value), _Alignof(wasmtime_component_val_t))
    && value->kind == WASMTIME_COMPONENT_RECORD && value->of.record.size == count
    && lb_buffer(value->of.record.data, count, sizeof(*value->of.record.data), _Alignof(wasmtime_component_valrecord_entry_t))
    && lb_charge(&scope->memory, count, sizeof(*value->of.record.data));
}
static inline bool ow_record_out(wasmtime_component_val_t *value, size_t count, ow_scope *scope) {
  if (!lb_charge(&scope->memory, count, sizeof(wasmtime_component_valrecord_entry_t))) return false;
  value->kind = WASMTIME_COMPONENT_RECORD; wasmtime_component_valrecord_new_uninit(&value->of.record, count);
  if (count) memset(value->of.record.data, 0, count * sizeof(*value->of.record.data));
  return true;
}
static inline bool ow_field_out(wasmtime_component_valrecord_entry_t *field, const char *name, ow_scope *scope) {
  size_t length = strlen(name);
  if (!lb_charge(&scope->memory, length, 1)) return false;
  wasm_name_new(&field->name, length, name); return true;
}
static inline ow_input *ow_open(const wasmtime_component_val_t *value, ow_scope *scope, const ow_schema *schema, bool borrowed) {
  if (!ow_record_in(value, 2, scope) || !lb_name(&value->of.record.data[0].name, "root") || !lb_name(&value->of.record.data[1].name, "nodes")) return NULL;
  const wasmtime_component_val_t *arena = &value->of.record.data[1].val;
  if (!ow_record_in(arena, schema->count, scope) || !lb_charge(&scope->memory, 1, sizeof(ow_input))) return NULL;
  ow_input *context = lb_alloc(&scope->memory, 1, sizeof(*context));
  if (!context) return NULL;
  context->scope = scope; context->borrowed = borrowed;
  for (size_t i = 0; i < schema->count; ++i) {
    const wasmtime_component_valrecord_entry_t *field = &arena->of.record.data[i];
    size_t type = schema->tables[i].type;
    if (!lb_name(&field->name, schema->tables[i].name) || field->val.kind != WASMTIME_COMPONENT_LIST) return NULL;
    const wasmtime_component_vallist_t *table = &field->val.of.list;
    if (table->size > OW_NODES - context->total) { scope->memory.failure = 2; return NULL; }
    if (!lb_buffer(table->data, table->size, sizeof(*table->data), _Alignof(wasmtime_component_val_t)) || !lb_charge(&scope->memory, table->size, sizeof(*table->data) + 1)) return NULL;
    context->tables[type] = table; context->offsets[type] = context->total; context->total += table->size;
  }
  context->seen = lb_alloc(&scope->memory, context->total, 1);
  if (context->total && !context->seen) return NULL;
  return context;
}
static inline const wasmtime_component_val_t *ow_dereference(ow_input *context, size_t type, const wasmtime_component_val_t *value) {
  if (context->active > OW_DEPTH) { context->scope->memory.failure = 2; return NULL; }
  if (!ow_record_in(value, 1, context->scope) || !lb_name(&value->of.record.data[0].name, "index") || value->of.record.data[0].val.kind != WASMTIME_COMPONENT_U32) return NULL;
  uint32_t index = value->of.record.data[0].val.of.u32;
  if (!context->tables[type] || index >= context->tables[type]->size) return NULL;
  for (size_t i = 0; i < context->active; ++i) if (context->path[i].type == type && context->path[i].index == index) return NULL;
  context->path[context->active++] = (ow_path){.type = type, .index = index};
  size_t position = context->offsets[type] + index;
  if (!context->seen[position]) { context->seen[position] = 1; ++context->visited; }
  return &context->tables[type]->data[index];
}
static inline wasmtime_component_val_t *ow_append(ow_output *context, size_t type, const void *address, wasmtime_component_val_t *reference) {
  if (context->active > OW_DEPTH) { context->scope->memory.failure = 2; return NULL; }
  for (size_t i = 0; i < context->active; ++i) if (context->path[i].type == type && context->path[i].address == address) return NULL;
  ow_table *table = &context->tables[type];
  if (table->count >= OW_NODES) { context->scope->memory.failure = 2; return NULL; }
  if (!lb_charge(&context->scope->memory, 1, sizeof(ow_row))) return NULL;
  ow_row *row = lb_alloc(&context->scope->memory, 1, sizeof(*row));
  if (!row) return NULL;
  if (table->tail) table->tail->next = row; else table->head = row;
  table->tail = row;
  if (!ow_record_out(reference, 1, context->scope) || !ow_field_out(&reference->of.record.data[0], "index", context->scope)) return NULL;
  reference->of.record.data[0].val = (wasmtime_component_val_t){.kind = WASMTIME_COMPONENT_U32, .of.u32 = table->count++};
  context->path[context->active++] = (ow_path){.type = type, .address = address}; return &row->value;
}
static inline void ow_output_close(ow_output *context) {
  for (size_t i = 0; i < OW_TYPES; ++i)
    for (ow_row *row = context->tables[i].head; row; row = row->next) ow_value_delete(context->scope, &row->value);
}
static inline bool ow_finish(ow_output *context, wasmtime_component_val_t *arena) {
  if (!ow_record_out(arena, context->schema->count, context->scope)) return false;
  for (size_t i = 0; i < context->schema->count; ++i) {
    const ow_table_schema *schema = &context->schema->tables[i];
    wasmtime_component_valrecord_entry_t *field = &arena->of.record.data[i];
    ow_table *table = &context->tables[schema->type];
    if (!ow_field_out(field, schema->name, context->scope) || !lb_charge(&context->scope->memory, table->count, sizeof(wasmtime_component_val_t))) return false;
    field->val.kind = WASMTIME_COMPONENT_LIST;
    wasmtime_component_vallist_new_uninit(&field->val.of.list, table->count);
    size_t offset = 0;
    for (ow_row *row = table->head; row; row = row->next) { field->val.of.list.data[offset++] = row->value; row->value = (wasmtime_component_val_t){0}; }
  }
  return true;
}
`;
