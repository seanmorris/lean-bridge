/**
 * Bounded typed-table traversal and independently owned Wasmtime output arenas.
 *
 * @file
 */

/**
 * Render helpers scoped to one finite schema. Native backing storage remains the
 * caller's responsibility; no untrusted index is interpreted as a pointer.
 *
 * @param model - Validated WIT graph projection.
 */
export const witGraphRuntime = model => `
#define LB_GRAPH_TABLES ${Math.max(model.tables.length, 1)}
#define LB_GRAPH_DEPTH 128
#define LB_GRAPH_NODES 262144
#define LB_GRAPH_BYTES 16777216
typedef struct { lb_scope memory; size_t nodes; } lb_graph_scope;
typedef struct { size_t type; uint32_t index; const void *address; } lb_graph_path;
typedef struct {
  lb_graph_scope *scope;
  const wasmtime_component_vallist_t *tables[LB_GRAPH_TABLES];
  size_t offsets[LB_GRAPH_TABLES], total, visited, active;
  uint8_t *seen;
  lb_graph_path path[LB_GRAPH_DEPTH + 1];
} lb_graph_input;
typedef struct lb_graph_row {
  struct lb_graph_row *next;
  wasmtime_component_val_t value;
} lb_graph_row;
typedef struct { lb_graph_row *head, *tail; uint32_t count; } lb_graph_table;
typedef struct {
  lb_graph_scope *scope;
  lb_graph_table tables[LB_GRAPH_TABLES];
  size_t active;
  lb_graph_path path[LB_GRAPH_DEPTH + 1];
} lb_graph_output;
static inline bool lb_graph_visit(lb_graph_scope *scope, unsigned depth, size_t bytes) {
  if (depth > LB_GRAPH_DEPTH || !scope->nodes) { scope->memory.failure = 2; return false; }
  if (!lb_charge(&scope->memory, 1, bytes)) return false;
  --scope->nodes; return true;
}
static inline bool lb_graph_count(lb_graph_scope *scope, size_t count) {
  if (count > scope->nodes) { scope->memory.failure = 2; return false; }
  return true;
}
static inline void lb_graph_release(void *owner) {
  lb_scope memory = {.allocations = owner}; lb_scope_close(&memory);
}
static inline bool lb_graph_record_in(const wasmtime_component_val_t *value, size_t count, lb_graph_scope *scope) {
  return lb_buffer(value, 1, sizeof(*value), _Alignof(wasmtime_component_val_t)) && value->kind == WASMTIME_COMPONENT_RECORD && value->of.record.size == count
    && lb_buffer(value->of.record.data, count, sizeof(*value->of.record.data), _Alignof(wasmtime_component_valrecord_entry_t))
    && lb_charge(&scope->memory, count, sizeof(*value->of.record.data));
}
static inline bool lb_graph_index(const wasmtime_component_val_t *value, lb_graph_scope *scope, uint32_t *out) {
  if (!lb_graph_record_in(value, 1, scope) || !lb_name(&value->of.record.data[0].name, "index") || value->of.record.data[0].val.kind != WASMTIME_COMPONENT_U32) return false;
  *out = value->of.record.data[0].val.of.u32; return true;
}
static inline lb_graph_input *lb_graph_open(const wasmtime_component_val_t *value, lb_graph_scope *scope) {
  if (!lb_graph_record_in(value, 2, scope) || !lb_name(&value->of.record.data[0].name, "root") || !lb_name(&value->of.record.data[1].name, "nodes")) return NULL;
  const wasmtime_component_val_t *arena = &value->of.record.data[1].val;
  if (!lb_graph_record_in(arena, ${model.tables.length}, scope) || !lb_charge(&scope->memory, 1, sizeof(lb_graph_input))) return NULL;
  lb_graph_input *context = lb_alloc(&scope->memory, 1, sizeof(*context));
  if (!context) return NULL;
  context->scope = scope;
${model.tables.map((node, index) => `  {
    const wasmtime_component_valrecord_entry_t *field = &arena->of.record.data[${index}];
    if (!lb_name(&field->name, "${node.tableField}") || field->val.kind != WASMTIME_COMPONENT_LIST) return NULL;
    const wasmtime_component_vallist_t *table = &field->val.of.list;
    if (table->size > LB_GRAPH_NODES - context->total || !lb_buffer(table->data, table->size, sizeof(*table->data), _Alignof(wasmtime_component_val_t)) || !lb_charge(&scope->memory, table->size, sizeof(*table->data) + 1)) return NULL;
    context->tables[${index}] = table; context->offsets[${index}] = context->total; context->total += table->size;
  }`).join("\n")}
  context->seen = lb_alloc(&scope->memory, context->total, 1);
  if (context->total && !context->seen) return NULL;
  return context;
}
static inline const wasmtime_component_val_t *lb_graph_dereference(lb_graph_input *context, size_t type, const wasmtime_component_val_t *reference) {
  uint32_t index;
  if (!lb_graph_index(reference, context->scope, &index) || index >= context->tables[type]->size || context->active > LB_GRAPH_DEPTH) return NULL;
  for (size_t i = 0; i < context->active; ++i) if (context->path[i].type == type && context->path[i].index == index) return NULL;
  context->path[context->active++] = (lb_graph_path){.type = type, .index = index};
  size_t position = context->offsets[type] + index;
  if (!context->seen[position]) { context->seen[position] = 1; ++context->visited; }
  return &context->tables[type]->data[index];
}
static inline bool lb_graph_record_out(wasmtime_component_val_t *out, size_t count, lb_graph_scope *scope) {
  if (!lb_charge(&scope->memory, count, sizeof(wasmtime_component_valrecord_entry_t))) return false;
  out->kind = WASMTIME_COMPONENT_RECORD;
  wasmtime_component_valrecord_new_uninit(&out->of.record, count);
  if (count) memset(out->of.record.data, 0, count * sizeof(*out->of.record.data));
  return true;
}
static inline bool lb_graph_field_out(wasmtime_component_valrecord_entry_t *field, const char *name, lb_graph_scope *scope) {
  size_t length = strlen(name);
  if (!lb_charge(&scope->memory, length, 1)) return false;
  wasm_name_new(&field->name, length, name); return true;
}
static inline wasmtime_component_val_t *lb_graph_append(lb_graph_output *context, size_t type, const void *address, wasmtime_component_val_t *reference) {
  if (context->active > LB_GRAPH_DEPTH) { context->scope->memory.failure = 2; return NULL; }
  for (size_t i = 0; i < context->active; ++i) if (context->path[i].type == type && context->path[i].address == address) return NULL;
  lb_graph_table *table = &context->tables[type];
  if (table->count >= LB_GRAPH_NODES) { context->scope->memory.failure = 2; return NULL; }
  if (!lb_charge(&context->scope->memory, 1, sizeof(lb_graph_row))) return NULL;
  lb_graph_row *row = lb_alloc(&context->scope->memory, 1, sizeof(*row));
  if (!row) return NULL;
  if (table->tail) table->tail->next = row; else table->head = row;
  table->tail = row;
  if (!lb_graph_record_out(reference, 1, context->scope) || !lb_graph_field_out(&reference->of.record.data[0], "index", context->scope)) return NULL;
  reference->of.record.data[0].val = (wasmtime_component_val_t){.kind = WASMTIME_COMPONENT_U32, .of.u32 = table->count++};
  context->path[context->active++] = (lb_graph_path){.type = type, .address = address};
  return &row->value;
}
static inline void lb_graph_output_close(lb_graph_output *context) {
${model.tables.length ? `  for (size_t i = 0; i < ${model.tables.length}; ++i) for (lb_graph_row *row = context->tables[i].head; row; row = row->next) wasmtime_component_val_delete(&row->value);` : "  (void)context;"}
}
static inline bool lb_graph_finish(lb_graph_output *context, wasmtime_component_val_t *arena) {
  if (!lb_graph_record_out(arena, ${model.tables.length}, context->scope)) return false;
${model.tables.map((node, index) => `  {
    wasmtime_component_valrecord_entry_t *field = &arena->of.record.data[${index}];
    lb_graph_table *table = &context->tables[${index}];
    if (!lb_graph_field_out(field, "${node.tableField}", context->scope) || !lb_charge(&context->scope->memory, table->count, sizeof(wasmtime_component_val_t))) return false;
    field->val.kind = WASMTIME_COMPONENT_LIST;
    wasmtime_component_vallist_new_uninit(&field->val.of.list, table->count);
    size_t offset = 0;
    for (lb_graph_row *row = table->head; row; row = row->next) { field->val.of.list.data[offset++] = row->value; row->value = (wasmtime_component_val_t){0}; }
  }`).join("\n")}
  return true;
}
`;
