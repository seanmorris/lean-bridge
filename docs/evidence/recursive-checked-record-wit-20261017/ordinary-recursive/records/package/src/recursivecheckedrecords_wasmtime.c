#ifndef _GNU_SOURCE
#define _GNU_SOURCE
#endif
#include <dlfcn.h>
#include <link.h>

#include <errno.h>
#include <fcntl.h>
#include <stdint.h>
#include <string.h>
#include <sys/stat.h>
#include <unistd.h>

typedef struct {
  uint32_t words[8];
  uint64_t bytes;
  size_t used;
  unsigned char block[64];
} lb_receipt_hash;

static uint32_t lb_receipt_rotr(uint32_t x, unsigned n) {
  return (x >> n) | (x << (32u - n));
}
static void lb_receipt_block(lb_receipt_hash *hash, const unsigned char *block) {
  static const uint32_t constants[64] = {
    0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
    0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
    0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
    0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
    0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
    0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
  };
  uint32_t w[64];
  for (size_t i = 0; i < 16; ++i)
    w[i] = ((uint32_t)block[4*i] << 24) | ((uint32_t)block[4*i+1] << 16)
      | ((uint32_t)block[4*i+2] << 8) | block[4*i+3];
  for (size_t i = 16; i < 64; ++i) {
    uint32_t x = w[i-15], y = w[i-2];
    w[i] = w[i-16] + (lb_receipt_rotr(x,7) ^ lb_receipt_rotr(x,18) ^ (x >> 3))
      + w[i-7] + (lb_receipt_rotr(y,17) ^ lb_receipt_rotr(y,19) ^ (y >> 10));
  }
  uint32_t a=hash->words[0], b=hash->words[1], c=hash->words[2], d=hash->words[3];
  uint32_t e=hash->words[4], f=hash->words[5], g=hash->words[6], h=hash->words[7];
  for (size_t i = 0; i < 64; ++i) {
    uint32_t t1 = h + (lb_receipt_rotr(e,6) ^ lb_receipt_rotr(e,11) ^ lb_receipt_rotr(e,25))
      + ((e & f) ^ (~e & g)) + constants[i] + w[i];
    uint32_t t2 = (lb_receipt_rotr(a,2) ^ lb_receipt_rotr(a,13) ^ lb_receipt_rotr(a,22))
      + ((a & b) ^ (a & c) ^ (b & c));
    h=g; g=f; f=e; e=d+t1; d=c; c=b; b=a; a=t1+t2;
  }
  hash->words[0]+=a; hash->words[1]+=b; hash->words[2]+=c; hash->words[3]+=d;
  hash->words[4]+=e; hash->words[5]+=f; hash->words[6]+=g; hash->words[7]+=h;
}
static void lb_receipt_update(lb_receipt_hash *hash, const unsigned char *bytes, size_t count) {
  hash->bytes += count;
  while (count) {
    size_t take = 64 - hash->used;
    if (take > count) take = count;
    memcpy(hash->block + hash->used, bytes, take);
    hash->used += take; bytes += take; count -= take;
    if (hash->used == 64) { lb_receipt_block(hash, hash->block); hash->used = 0; }
  }
}
static void lb_receipt_finish(lb_receipt_hash *hash, char out[65]) {
  static const char hex[] = "0123456789abcdef";
  uint64_t bits = hash->bytes * UINT64_C(8);
  unsigned char padding[128] = {0x80};
  size_t count = hash->used < 56 ? 56 - hash->used : 120 - hash->used;
  for (size_t i = 0; i < 8; ++i) padding[count+i] = (unsigned char)(bits >> (56-8*i));
  lb_receipt_update(hash, padding, count + 8);
  for (size_t i = 0; i < 32; ++i) {
    unsigned byte = (hash->words[i/4] >> (24-8*(i%4))) & 255u;
    out[2*i] = hex[byte >> 4]; out[2*i+1] = hex[byte & 15];
  }
  out[64] = 0;
}
static int lb_receipt_file_matches(const char *path, uint64_t bytes, const char *expected) {
  int fd = open(path, O_RDONLY | O_CLOEXEC | O_NOFOLLOW | O_NONBLOCK);
  if (fd < 0) return 0;
  struct stat before, after;
  int valid = !fstat(fd, &before) && S_ISREG(before.st_mode) && before.st_size >= 0
    && (uint64_t)before.st_size == bytes && bytes <= UINT64_MAX/8;
  lb_receipt_hash hash = {.words = {0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,
    0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19}};
  unsigned char buffer[16384];
  while (valid) {
    ssize_t count = read(fd, buffer, sizeof(buffer));
    if (count < 0 && errno == EINTR) continue;
    if (count < 0) { valid = 0; break; }
    if (!count) break;
    if ((uint64_t)count > bytes - hash.bytes) { valid = 0; break; }
    lb_receipt_update(&hash, buffer, (size_t)count);
  }
  valid = valid && hash.bytes == bytes && !fstat(fd, &after)
    && before.st_size == after.st_size
    && before.st_mtim.tv_sec == after.st_mtim.tv_sec && before.st_mtim.tv_nsec == after.st_mtim.tv_nsec
    && before.st_ctim.tv_sec == after.st_ctim.tv_sec && before.st_ctim.tv_nsec == after.st_ctim.tv_nsec;
  if (close(fd)) valid = 0;
  char actual[65]; lb_receipt_finish(&hash, actual);
  return valid && !strcmp(actual, expected);
}


static pid_t lb_package_pid;
/* Private loader handshake, not a consumer API. Keep each host's origin local
 * even when another host exports the same handshake symbol. */
__attribute__((visibility("default"))) pid_t __lean_bridge_wit_host_process_origin_v1(void) {
  return lb_package_pid;
}
static const char *lb_package_problem = "WIT package dependencies have not been verified";
static const struct { const char *name; uint64_t bytes; const char *sha256; } lb_package_libraries[] = {
  {"libcomponent_a1d30b9a0f384ed52541.so", UINT64_C(109496), "39fd2e912a23a62a9f98962f9c1735759fbd095b12d4b5bcfd2d79e00f23f575"},
  {"liblean_bridge_native.so", UINT64_C(21464), "25bb83c98a7f86c15c8f5a5181457943beae8e9052ce059cf11df47060cdb5f7"},
  {"libleanshared.so", UINT64_C(158401256), "d7768b88d8162736da4305777cd6f147676038fd885bd8a265c958b0ecea00b4"},
  {"librecursivecheckedrecords.so", UINT64_C(41472), "f40a13990c3da41f7963e04a7b229f763eab944b2d917e59ea141e2c7ce1d3d0"},
  {"libwasmtime.so", UINT64_C(22277728), "566e57cfeabafd6d44fab1b5e6660b4569a71aae4cff2e4d89563a424ee799f3"}
};
typedef struct { unsigned seen[5]; const char *failure; } lb_package_scan;
static int lb_package_process(struct dl_phdr_info *info, size_t size, void *data) {
  (void)size;
  lb_package_scan *scan = data;
  const char *path = info->dlpi_name;
  if (!path || !*path) return 0;
  const char *slash = strrchr(path, '/'), *name = slash ? slash+1 : path;
  const char suffix[] = "_wasmtime.so";
  size_t length = strlen(name);
  if (length <= 3 + sizeof(suffix)-1 || strncmp(name, "lib", 3)
      || strcmp(name+length-(sizeof(suffix)-1), suffix)) return 0;
  void *loaded = dlopen(path, RTLD_NOW | RTLD_NOLOAD);
  if (!loaded) { scan->failure = "Cannot inspect loaded WIT host"; return 1; }
  void *address = dlsym(loaded, "__lean_bridge_wit_host_process_origin_v1");
  Dl_info owner;
  /* dlsym also searches dependencies. Only use this library's own marker. */
  if (address && dladdr(address, &owner) && owner.dli_fbase == (void *)info->dlpi_addr) {
    pid_t (*origin)(void);
    _Static_assert(sizeof(origin) == sizeof(address), "POSIX function pointer");
    memcpy(&origin, &address, sizeof(origin));
    pid_t process = origin();
    /* A host whose constructor has not run yet has no Wasmtime state. */
    if (process && process != getpid())
      scan->failure = "WIT hosts cannot be used after fork; exec a fresh process";
  }
  dlclose(loaded);
  return scan->failure != NULL;
}
static int lb_package_library(struct dl_phdr_info *info, size_t size, void *data) {
  (void)size;
  lb_package_scan *scan = data;
  const char *path = info->dlpi_name;
  if (!path || !*path) return 0;
  const char *slash = strrchr(path, '/'), *name = slash ? slash+1 : path;
  for (size_t i = 0; i < sizeof(lb_package_libraries)/sizeof(lb_package_libraries[0]); ++i) {
    if (strcmp(name, lb_package_libraries[i].name)) continue;
    if (!lb_receipt_file_matches(path, lb_package_libraries[i].bytes, lb_package_libraries[i].sha256)) {
      scan->failure = "WIT package dependency conflict: loaded library differs from its receipt";
      return 1;
    }
    /* Resolve lazy dependency relocations before another host is loaded. */
    void *loaded = dlopen(path, RTLD_NOW | RTLD_NOLOAD);
    if (!loaded) { scan->failure = "Cannot bind verified WIT dependency"; return 1; }
    dlclose(loaded);
    scan->seen[i] = 1;
  }
  return 0;
}
__attribute__((constructor)) static void lb_package_verify(void) {
  lb_package_pid = getpid();
  lb_package_scan scan = {0};
  dl_iterate_phdr(lb_package_process, &scan);
  if (!scan.failure) dl_iterate_phdr(lb_package_library, &scan);
  for (size_t i = 0; i < sizeof(scan.seen)/sizeof(scan.seen[0]); ++i)
    if (!scan.seen[i] && !scan.failure) scan.failure = "WIT package dependency is missing from the loaded libraries";
  lb_package_problem = scan.failure;
}
static const char *lb_package_failure(void) {
  if (getpid() != lb_package_pid) return "WIT hosts cannot be used after fork; exec a fresh process";
  return lb_package_problem;
}
#include "recursivecheckedrecords_wasmtime.h"
#include "lean_bridge_native_runtime.h"
#include <stdint.h>
#include <stdlib.h>
#include <string.h>

_Static_assert(sizeof(bool) == 1, "WIT bool validation requires a one-byte representation");
typedef struct lb_allocation { struct lb_allocation *next; } lb_allocation;
typedef struct { size_t remaining; lb_allocation *allocations; unsigned failure; } lb_scope;
/* Native callers still own valid backing storage; this checks shape, alignment
 * and address arithmetic, not the allocation extent of an arbitrary pointer. */
static inline bool lb_buffer(const void *data, size_t count, size_t width, size_t alignment) {
  if (!count) return true;
  if (!data || !width || !alignment || (uintptr_t)data % alignment || count > SIZE_MAX / width) return false;
  return count * width <= UINTPTR_MAX - (uintptr_t)data;
}
static inline bool lb_boolean(const void *data, bool *out) {
  uint8_t raw; memcpy(&raw, data, sizeof(raw));
  if (raw > 1) return false;
  *out = raw != 0; return true;
}
static inline bool lb_charge(lb_scope *scope, size_t count, size_t width) {
  if (count && width > scope->remaining / count) { scope->failure = 2; return false; }
  scope->remaining -= count * width; return true;
}
static inline void *lb_alloc(lb_scope *scope, size_t count, size_t width) {
  if (!count) return NULL;
  if (width > (SIZE_MAX - sizeof(lb_allocation)) / count) { scope->failure = 2; return NULL; }
  lb_allocation *allocation = calloc(1, sizeof(*allocation) + count * width);
  if (!allocation) { scope->failure = 3; return NULL; }
  allocation->next = scope->allocations; scope->allocations = allocation;
  return allocation + 1;
}
static inline void lb_scope_close(lb_scope *scope) {
  while (scope->allocations) { lb_allocation *next = scope->allocations->next; free(scope->allocations); scope->allocations = next; }
}
static inline bool lb_name(const wasm_name_t *name, const char *expected) {
  size_t length = strlen(expected);
  return name->size == length && lb_buffer(name->data, length, 1, 1) && (!length || memcmp(name->data, expected, length) == 0);
}
static inline bool lb_utf8(const char *text, size_t length) {
  const uint8_t *p = (const uint8_t *)text;
  if (!lb_buffer(p, length, 1, 1)) return false;
  for (size_t i = 0; i < length;) {
    uint32_t c = p[i++]; size_t extra = 0; uint32_t minimum = 0;
    if (c < 0x80) continue;
    if (c >= 0xc2 && c <= 0xdf) { extra = 1; minimum = 0x80; c &= 0x1f; }
    else if (c >= 0xe0 && c <= 0xef) { extra = 2; minimum = 0x800; c &= 0x0f; }
    else if (c >= 0xf0 && c <= 0xf4) { extra = 3; minimum = 0x10000; c &= 7; }
    else return false;
    if (extra > length - i) return false;
    while (extra--) { uint8_t b = p[i++]; if ((b & 0xc0) != 0x80) return false; c = (c << 6) | (b & 0x3f); }
    if (c < minimum || c > 0x10ffff || (c >= 0xd800 && c <= 0xdfff)) return false;
  }
  return true;
}
static inline bool lb_limbs_in(const wasmtime_component_val_t *value, lb_scope *scope, uint32_t **out, size_t *length) {
  if (value->kind != WASMTIME_COMPONENT_LIST) return false;
  size_t count = value->of.list.size;
  if (!lb_buffer(value->of.list.data, count, sizeof(wasmtime_component_val_t), _Alignof(wasmtime_component_val_t)) || !lb_charge(scope, count, sizeof(wasmtime_component_val_t) + sizeof(uint32_t))) return false;
  for (size_t i = 0; i < count; ++i) if (value->of.list.data[i].kind != WASMTIME_COMPONENT_U32) return false;
  if (count && value->of.list.data[count - 1].of.u32 == 0) return false;
  if (out) {
    *out = lb_alloc(scope, count, sizeof(uint32_t)); if (count && !*out) return false;
    for (size_t i = 0; i < count; ++i) (*out)[i] = value->of.list.data[i].of.u32;
    *length = count;
  }
  return true;
}
static inline bool lb_limbs_out(const uint32_t *data, size_t length, lb_scope *scope, wasmtime_component_val_t *out) {
  if (!lb_buffer(data, length, sizeof(uint32_t), _Alignof(uint32_t)) || !lb_charge(scope, length, sizeof(wasmtime_component_val_t))) return false;
  if (length && (!data || !data[length - 1])) return false;
  out->kind = WASMTIME_COMPONENT_LIST;
  wasmtime_component_vallist_new_uninit(&out->of.list, length);
  for (size_t i = 0; i < length; ++i) out->of.list.data[i] = (wasmtime_component_val_t){.kind = WASMTIME_COMPONENT_U32, .of.u32 = data[i]};
  return true;
}
static inline bool lb_in_3(const wasmtime_component_val_t *value, lb_scope *scope, recursivecheckedrecords_scalar_nat_t *out) {
  (void)out;
  if (!lb_buffer(value, 1, sizeof(*value), _Alignof(wasmtime_component_val_t)) || (out && !lb_buffer(out, 1, sizeof(*out), _Alignof(recursivecheckedrecords_scalar_nat_t))) || !lb_charge(scope, 1, sizeof(wasmtime_component_val_t))) return false;
  uint32_t *limbs = NULL; size_t length = 0;
  if (!lb_limbs_in(value, scope, out ? &limbs : NULL, &length)) return false;
  if (out) *out = (recursivecheckedrecords_scalar_nat_t){.data = limbs, .length = length};
  return true;
}
static inline bool lb_out_3(const recursivecheckedrecords_scalar_nat_t *value, lb_scope *scope, wasmtime_component_val_t *out) {
  (void)value;
  if (!lb_buffer(value, 1, sizeof(*value), _Alignof(recursivecheckedrecords_scalar_nat_t)) || !lb_buffer(out, 1, sizeof(*out), _Alignof(wasmtime_component_val_t)) || !lb_charge(scope, 1, sizeof(wasmtime_component_val_t))) return false;
  return lb_limbs_out(value->data, value->length, scope, out);
  return true;
}
#define LB_GRAPH_TABLES 3
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
  if (!lb_graph_record_in(arena, 3, scope) || !lb_charge(&scope->memory, 1, sizeof(lb_graph_input))) return NULL;
  lb_graph_input *context = lb_alloc(&scope->memory, 1, sizeof(*context));
  if (!context) return NULL;
  context->scope = scope;
  {
    const wasmtime_component_valrecord_entry_t *field = &arena->of.record.data[0];
    if (!lb_name(&field->name, "nodes0") || field->val.kind != WASMTIME_COMPONENT_LIST) return NULL;
    const wasmtime_component_vallist_t *table = &field->val.of.list;
    if (table->size > LB_GRAPH_NODES - context->total) { scope->memory.failure = 2; return NULL; }
    if (!lb_buffer(table->data, table->size, sizeof(*table->data), _Alignof(wasmtime_component_val_t)) || !lb_charge(&scope->memory, table->size, sizeof(*table->data) + 1)) return NULL;
    context->tables[0] = table; context->offsets[0] = context->total; context->total += table->size;
  }
  {
    const wasmtime_component_valrecord_entry_t *field = &arena->of.record.data[1];
    if (!lb_name(&field->name, "nodes1") || field->val.kind != WASMTIME_COMPONENT_LIST) return NULL;
    const wasmtime_component_vallist_t *table = &field->val.of.list;
    if (table->size > LB_GRAPH_NODES - context->total) { scope->memory.failure = 2; return NULL; }
    if (!lb_buffer(table->data, table->size, sizeof(*table->data), _Alignof(wasmtime_component_val_t)) || !lb_charge(&scope->memory, table->size, sizeof(*table->data) + 1)) return NULL;
    context->tables[1] = table; context->offsets[1] = context->total; context->total += table->size;
  }
  {
    const wasmtime_component_valrecord_entry_t *field = &arena->of.record.data[2];
    if (!lb_name(&field->name, "nodes2") || field->val.kind != WASMTIME_COMPONENT_LIST) return NULL;
    const wasmtime_component_vallist_t *table = &field->val.of.list;
    if (table->size > LB_GRAPH_NODES - context->total) { scope->memory.failure = 2; return NULL; }
    if (!lb_buffer(table->data, table->size, sizeof(*table->data), _Alignof(wasmtime_component_val_t)) || !lb_charge(&scope->memory, table->size, sizeof(*table->data) + 1)) return NULL;
    context->tables[2] = table; context->offsets[2] = context->total; context->total += table->size;
  }
  context->seen = lb_alloc(&scope->memory, context->total, 1);
  if (context->total && !context->seen) return NULL;
  return context;
}
static inline const wasmtime_component_val_t *lb_graph_dereference(lb_graph_input *context, size_t type, const wasmtime_component_val_t *reference) {
  uint32_t index;
  if (context->active > LB_GRAPH_DEPTH) { context->scope->memory.failure = 2; return NULL; }
  if (!lb_graph_index(reference, context->scope, &index) || index >= context->tables[type]->size) return NULL;
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
  for (size_t i = 0; i < 3; ++i) for (lb_graph_row *row = context->tables[i].head; row; row = row->next) wasmtime_component_val_delete(&row->value);
}
static inline bool lb_graph_finish(lb_graph_output *context, wasmtime_component_val_t *arena) {
  if (!lb_graph_record_out(arena, 3, context->scope)) return false;
  {
    wasmtime_component_valrecord_entry_t *field = &arena->of.record.data[0];
    lb_graph_table *table = &context->tables[0];
    if (!lb_graph_field_out(field, "nodes0", context->scope) || !lb_charge(&context->scope->memory, table->count, sizeof(wasmtime_component_val_t))) return false;
    field->val.kind = WASMTIME_COMPONENT_LIST;
    wasmtime_component_vallist_new_uninit(&field->val.of.list, table->count);
    size_t offset = 0;
    for (lb_graph_row *row = table->head; row; row = row->next) { field->val.of.list.data[offset++] = row->value; row->value = (wasmtime_component_val_t){0}; }
  }
  {
    wasmtime_component_valrecord_entry_t *field = &arena->of.record.data[1];
    lb_graph_table *table = &context->tables[1];
    if (!lb_graph_field_out(field, "nodes1", context->scope) || !lb_charge(&context->scope->memory, table->count, sizeof(wasmtime_component_val_t))) return false;
    field->val.kind = WASMTIME_COMPONENT_LIST;
    wasmtime_component_vallist_new_uninit(&field->val.of.list, table->count);
    size_t offset = 0;
    for (lb_graph_row *row = table->head; row; row = row->next) { field->val.of.list.data[offset++] = row->value; row->value = (wasmtime_component_val_t){0}; }
  }
  {
    wasmtime_component_valrecord_entry_t *field = &arena->of.record.data[2];
    lb_graph_table *table = &context->tables[2];
    if (!lb_graph_field_out(field, "nodes2", context->scope) || !lb_charge(&context->scope->memory, table->count, sizeof(wasmtime_component_val_t))) return false;
    field->val.kind = WASMTIME_COMPONENT_LIST;
    wasmtime_component_vallist_new_uninit(&field->val.of.list, table->count);
    size_t offset = 0;
    for (lb_graph_row *row = table->head; row; row = row->next) { field->val.of.list.data[offset++] = row->value; row->value = (wasmtime_component_val_t){0}; }
  }
  return true;
}
static inline bool lb_graph_read_0(const wasmtime_component_val_t *, lb_graph_input *, unsigned, recursivecheckedrecords_graph_bf065e9a21862d87767f_t *);
static inline bool lb_graph_write_0(const recursivecheckedrecords_graph_bf065e9a21862d87767f_t *, lb_graph_output *, unsigned, wasmtime_component_val_t *);
static inline bool lb_graph_read_1(const wasmtime_component_val_t *, lb_graph_input *, unsigned, recursivecheckedrecords_graph_2c3080f9e24fa7c11cff_t *);
static inline bool lb_graph_write_1(const recursivecheckedrecords_graph_2c3080f9e24fa7c11cff_t *, lb_graph_output *, unsigned, wasmtime_component_val_t *);
static inline bool lb_graph_read_2(const wasmtime_component_val_t *, lb_graph_input *, unsigned, recursivecheckedrecords_packet_t *);
static inline bool lb_graph_write_2(const recursivecheckedrecords_packet_t *, lb_graph_output *, unsigned, wasmtime_component_val_t *);
static inline bool lb_graph_read_3(const wasmtime_component_val_t *, lb_graph_input *, unsigned, recursivecheckedrecords_scalar_nat_t *);
static inline bool lb_graph_write_3(const recursivecheckedrecords_scalar_nat_t *, lb_graph_output *, unsigned, wasmtime_component_val_t *);
static inline bool lb_graph_read_0(const wasmtime_component_val_t *value, lb_graph_input *context, unsigned depth, recursivecheckedrecords_graph_bf065e9a21862d87767f_t *out) {
  (void)out;
  if (!lb_graph_visit(context->scope, depth, sizeof(recursivecheckedrecords_graph_bf065e9a21862d87767f_t) + sizeof(wasmtime_component_val_t)) || !lb_buffer(value, 1, sizeof(*value), _Alignof(wasmtime_component_val_t))) return false;
  value = lb_graph_dereference(context, 0, value);
  if (!value) return false;
  if (value->kind != WASMTIME_COMPONENT_LIST) return false;
  size_t count = value->of.list.size;
  if (!lb_graph_count(context->scope, count) || !lb_buffer(value->of.list.data, count, sizeof(wasmtime_component_val_t), _Alignof(wasmtime_component_val_t)) || !lb_charge(&context->scope->memory, count, sizeof(recursivecheckedrecords_graph_2c3080f9e24fa7c11cff_t) + sizeof(wasmtime_component_val_t))) return false;
  recursivecheckedrecords_graph_2c3080f9e24fa7c11cff_t *items = out ? lb_alloc(&context->scope->memory, count, sizeof(recursivecheckedrecords_graph_2c3080f9e24fa7c11cff_t)) : NULL;
  if (out && count && !items) return false;
  if (out) { out->data = items; out->length = count; }
  for (size_t i = 0; i < count; ++i) if (!lb_graph_read_1(&value->of.list.data[i], context, depth + 1, out ? &items[i] : NULL)) return false;
  --context->active;
  return true;
}
static inline bool lb_graph_write_0(const recursivecheckedrecords_graph_bf065e9a21862d87767f_t *value, lb_graph_output *context, unsigned depth, wasmtime_component_val_t *out) {
  if (!lb_graph_visit(context->scope, depth, sizeof(wasmtime_component_val_t)) || !lb_buffer(value, 1, sizeof(*value), _Alignof(recursivecheckedrecords_graph_bf065e9a21862d87767f_t))) return false;
  out = lb_graph_append(context, 0, value, out);
  if (!out) return false;
  if (!lb_graph_count(context->scope, value->length) || !lb_buffer(value->data, value->length, sizeof(recursivecheckedrecords_graph_2c3080f9e24fa7c11cff_t), _Alignof(recursivecheckedrecords_graph_2c3080f9e24fa7c11cff_t)) || !lb_charge(&context->scope->memory, value->length, sizeof(wasmtime_component_val_t))) return false;
  out->kind = WASMTIME_COMPONENT_LIST;
  wasmtime_component_vallist_new_uninit(&out->of.list, value->length);
  if (value->length) memset(out->of.list.data, 0, value->length * sizeof(*out->of.list.data));
  for (size_t i = 0; i < value->length; ++i) if (!lb_graph_write_1(&value->data[i], context, depth + 1, &out->of.list.data[i])) return false;
  --context->active;
  return true;
}

static inline bool lb_graph_read_1(const wasmtime_component_val_t *value, lb_graph_input *context, unsigned depth, recursivecheckedrecords_graph_2c3080f9e24fa7c11cff_t *out) {
  (void)out;
  if (!lb_graph_visit(context->scope, depth, sizeof(recursivecheckedrecords_graph_2c3080f9e24fa7c11cff_t) + sizeof(wasmtime_component_val_t)) || !lb_buffer(value, 1, sizeof(*value), _Alignof(wasmtime_component_val_t))) return false;
  value = lb_graph_dereference(context, 1, value);
  if (!value) return false;
  if (value->kind != WASMTIME_COMPONENT_OPTION) return false;
  bool present = value->of.option != NULL;
  if (out) out->has_value = present;
  if (present) {
  if (!lb_charge(&context->scope->memory, 1, sizeof(recursivecheckedrecords_packet_t))) return false;
  recursivecheckedrecords_packet_t *child0 = out ? lb_alloc(&context->scope->memory, 1, sizeof(recursivecheckedrecords_packet_t)) : NULL;
  if (out && !child0) return false;
  if (out) out->value = child0;
  if (!lb_graph_read_2(value->of.option, context, depth + 1, child0)) return false;
  }
  --context->active;
  return true;
}
static inline bool lb_graph_write_1(const recursivecheckedrecords_graph_2c3080f9e24fa7c11cff_t *value, lb_graph_output *context, unsigned depth, wasmtime_component_val_t *out) {
  if (!lb_graph_visit(context->scope, depth, sizeof(wasmtime_component_val_t)) || !lb_buffer(value, 1, sizeof(*value), _Alignof(recursivecheckedrecords_graph_2c3080f9e24fa7c11cff_t))) return false;
  out = lb_graph_append(context, 1, value, out);
  if (!out) return false;
  if (value->has_value > 1) return false;
  out->kind = WASMTIME_COMPONENT_OPTION;
  out->of.option = NULL;
  if (value->has_value) {
  if (!lb_charge(&context->scope->memory, 1, sizeof(wasmtime_component_val_t))) return false;
  wasmtime_component_val_t empty = {0}; out->of.option = wasmtime_component_val_new(&empty);
  if (!lb_graph_write_2(value->value, context, depth + 1, out->of.option)) return false;
  }
  --context->active;
  return true;
}

static inline bool lb_graph_read_2(const wasmtime_component_val_t *value, lb_graph_input *context, unsigned depth, recursivecheckedrecords_packet_t *out) {
  (void)out;
  if (!lb_graph_visit(context->scope, depth, sizeof(recursivecheckedrecords_packet_t) + sizeof(wasmtime_component_val_t)) || !lb_buffer(value, 1, sizeof(*value), _Alignof(wasmtime_component_val_t))) return false;
  value = lb_graph_dereference(context, 2, value);
  if (!value) return false;
  if (!lb_graph_record_in(value, 3, context->scope)) return false;
  if (!lb_name(&value->of.record.data[0].name, "value")) return false;
  if (!lb_graph_read_3(&value->of.record.data[0].val, context, depth + 1, out ? &out->value : NULL)) return false;
  if (!lb_name(&value->of.record.data[1].name, "digit")) return false;
  if (!lb_graph_read_3(&value->of.record.data[1].val, context, depth + 1, out ? &out->digit : NULL)) return false;
  if (!lb_name(&value->of.record.data[2].name, "tail")) return false;
  if (!lb_charge(&context->scope->memory, 1, sizeof(recursivecheckedrecords_graph_2c3080f9e24fa7c11cff_t))) return false;
  recursivecheckedrecords_graph_2c3080f9e24fa7c11cff_t *child2 = out ? lb_alloc(&context->scope->memory, 1, sizeof(recursivecheckedrecords_graph_2c3080f9e24fa7c11cff_t)) : NULL;
  if (out && !child2) return false;
  if (out) out->tail = child2;
  if (!lb_graph_read_1(&value->of.record.data[2].val, context, depth + 1, child2)) return false;
  --context->active;
  return true;
}
static inline bool lb_graph_write_2(const recursivecheckedrecords_packet_t *value, lb_graph_output *context, unsigned depth, wasmtime_component_val_t *out) {
  if (!lb_graph_visit(context->scope, depth, sizeof(wasmtime_component_val_t)) || !lb_buffer(value, 1, sizeof(*value), _Alignof(recursivecheckedrecords_packet_t))) return false;
  out = lb_graph_append(context, 2, value, out);
  if (!out) return false;
  if (!lb_graph_record_out(out, 3, context->scope)) return false;
  if (!lb_graph_field_out(&out->of.record.data[0], "value", context->scope)) return false;
  if (!lb_graph_write_3(&value->value, context, depth + 1, &out->of.record.data[0].val)) return false;
  if (!lb_graph_field_out(&out->of.record.data[1], "digit", context->scope)) return false;
  if (!lb_graph_write_3(&value->digit, context, depth + 1, &out->of.record.data[1].val)) return false;
  if (!lb_graph_field_out(&out->of.record.data[2], "tail", context->scope)) return false;
  if (!lb_graph_write_1(value->tail, context, depth + 1, &out->of.record.data[2].val)) return false;
  --context->active;
  return true;
}

static inline bool lb_graph_read_3(const wasmtime_component_val_t *value, lb_graph_input *context, unsigned depth, recursivecheckedrecords_scalar_nat_t *out) {
  (void)out;
  if (!lb_graph_visit(context->scope, depth, sizeof(recursivecheckedrecords_scalar_nat_t) + sizeof(wasmtime_component_val_t)) || !lb_buffer(value, 1, sizeof(*value), _Alignof(wasmtime_component_val_t))) return false;
  return lb_in_3(value, &context->scope->memory, out);
}
static inline bool lb_graph_write_3(const recursivecheckedrecords_scalar_nat_t *value, lb_graph_output *context, unsigned depth, wasmtime_component_val_t *out) {
  if (!lb_graph_visit(context->scope, depth, sizeof(wasmtime_component_val_t)) || !lb_buffer(value, 1, sizeof(*value), _Alignof(recursivecheckedrecords_scalar_nat_t))) return false;
  return lb_out_3(value, &context->scope->memory, out);
}
static inline bool lb_graph_decode_0(const wasmtime_component_val_t *value, lb_graph_scope *scope, recursivecheckedrecords_graph_bf065e9a21862d87767f_t *out) {
  if (out && !lb_buffer(out, 1, sizeof(*out), _Alignof(recursivecheckedrecords_graph_bf065e9a21862d87767f_t))) return false;
  recursivecheckedrecords_graph_bf065e9a21862d87767f_t converted = {0};
  lb_graph_input *context = lb_graph_open(value, scope);
  if (!context || !lb_graph_read_0(&value->of.record.data[0].val, context, 0, out ? &converted : NULL) || context->visited != context->total) return false;
  if (out) *out = converted;
  return true;
}
static inline bool lb_graph_encode_0(const recursivecheckedrecords_graph_bf065e9a21862d87767f_t *value, lb_graph_scope *scope, wasmtime_component_val_t *out) {
  if (!lb_buffer(out, 1, sizeof(*out), _Alignof(wasmtime_component_val_t))) return false;
  wasmtime_component_val_t converted = {0};
  if (!lb_charge(&scope->memory, 1, sizeof(lb_graph_output))) return false;
  lb_graph_output *context = lb_alloc(&scope->memory, 1, sizeof(*context));
  if (!context) return false;
  context->scope = scope;
  bool valid = lb_graph_record_out(&converted, 2, scope)
    && lb_graph_field_out(&converted.of.record.data[0], "root", scope)
    && lb_graph_field_out(&converted.of.record.data[1], "nodes", scope)
    && lb_graph_write_0(value, context, 0, &converted.of.record.data[0].val)
    && lb_graph_finish(context, &converted.of.record.data[1].val);
  lb_graph_output_close(context);
  if (valid) *out = converted; else wasmtime_component_val_delete(&converted);
  return valid;
}


static inline bool lb_graph_decode_2(const wasmtime_component_val_t *value, lb_graph_scope *scope, recursivecheckedrecords_packet_t *out) {
  if (out && !lb_buffer(out, 1, sizeof(*out), _Alignof(recursivecheckedrecords_packet_t))) return false;
  recursivecheckedrecords_packet_t converted = {0};
  lb_graph_input *context = lb_graph_open(value, scope);
  if (!context || !lb_graph_read_2(&value->of.record.data[0].val, context, 0, out ? &converted : NULL) || context->visited != context->total) return false;
  if (out) *out = converted;
  return true;
}
static inline bool lb_graph_encode_2(const recursivecheckedrecords_packet_t *value, lb_graph_scope *scope, wasmtime_component_val_t *out) {
  if (!lb_buffer(out, 1, sizeof(*out), _Alignof(wasmtime_component_val_t))) return false;
  wasmtime_component_val_t converted = {0};
  if (!lb_charge(&scope->memory, 1, sizeof(lb_graph_output))) return false;
  lb_graph_output *context = lb_alloc(&scope->memory, 1, sizeof(*context));
  if (!context) return false;
  context->scope = scope;
  bool valid = lb_graph_record_out(&converted, 2, scope)
    && lb_graph_field_out(&converted.of.record.data[0], "root", scope)
    && lb_graph_field_out(&converted.of.record.data[1], "nodes", scope)
    && lb_graph_write_2(value, context, 0, &converted.of.record.data[0].val)
    && lb_graph_finish(context, &converted.of.record.data[1].val);
  lb_graph_output_close(context);
  if (valid) *out = converted; else wasmtime_component_val_delete(&converted);
  return valid;
}


static inline bool lb_graph_decode_3(const wasmtime_component_val_t *value, lb_graph_scope *scope, recursivecheckedrecords_scalar_nat_t *out) {
  if (out && !lb_buffer(out, 1, sizeof(*out), _Alignof(recursivecheckedrecords_scalar_nat_t))) return false;
  recursivecheckedrecords_scalar_nat_t converted = {0};
  lb_graph_input context = {.scope = scope};
  if (!lb_graph_read_3(value, &context, 0, out ? &converted : NULL)) return false;
  if (out) *out = converted;
  return true;
}
static inline bool lb_graph_encode_3(const recursivecheckedrecords_scalar_nat_t *value, lb_graph_scope *scope, wasmtime_component_val_t *out) {
  if (!lb_buffer(out, 1, sizeof(*out), _Alignof(wasmtime_component_val_t))) return false;
  wasmtime_component_val_t converted = {0};
  lb_graph_output context = {.scope = scope};
  bool valid = lb_graph_write_3(value, &context, 0, &converted);
  if (valid) *out = converted; else wasmtime_component_val_delete(&converted);
  return valid;
}


static wasmtime_error_t *lb_call_0(void *data, wasmtime_context_t *context,
    const wasmtime_component_func_type_t *type, wasmtime_component_val_t *args, size_t count,
    wasmtime_component_val_t *results, size_t result_count) {
  const char *package_failure = lb_package_failure();
  if (package_failure) return wasmtime_error_new(package_failure);
  (void)data; (void)context; (void)type;
  if (count != 1 || result_count != 1 || !lb_buffer(args, count, sizeof(*args), _Alignof(wasmtime_component_val_t)) || !lb_buffer(results, 1, sizeof(*results), _Alignof(wasmtime_component_val_t))) return wasmtime_error_new("WIT graph import signature mismatch");
  lb_graph_scope input = {.memory = {.remaining = LB_GRAPH_BYTES}, .nodes = LB_GRAPH_NODES};
  lb_graph_scope output = {.memory = {.remaining = LB_GRAPH_BYTES}, .nodes = LB_GRAPH_NODES};
  wasmtime_error_t *failure = NULL;
  wasmtime_component_val_t converted = {0};
  recursivecheckedrecords_packet_t value = {0};
  recursivecheckedrecords_packet_t arg0 = {0};
  if (!lb_graph_decode_2(&args[0], &input, &arg0)) { failure = wasmtime_error_new("Invalid copied WIT graph, allocation failure or conversion limit"); goto done; }
  uint32_t status = recursivecheckedrecords_echo_graph(&arg0, &value);
  if (status) {
    /* The adapter resets this one-shot text at every call; missing text keeps the fixed failure. */
    const char *specific = status == 1 ? recursivecheckedrecords_graph_error() : NULL;
    if (specific && (!*specific || !lb_utf8(specific, strlen(specific)))) {
      lean_bridge_native_runtime_retire();
      failure = wasmtime_error_new("Malformed native refinement diagnostic; runtime retired"); goto done;
    }
    failure = wasmtime_error_new(specific ? specific : "Native Lean graph call failed"); goto done;
  }
  if (!lb_graph_encode_2(&value, &output, &converted)) {
    if (!output.memory.failure) lean_bridge_native_runtime_retire();
    failure = wasmtime_error_new(output.memory.failure ? "WIT graph result conversion limit or allocation failure" : "Malformed native graph result; runtime retired"); goto done;
  }
  if (!lean_bridge_native_component_ready("recursivecheckedrecords@1.0.0")) { failure = wasmtime_error_new("Lean runtime is unavailable"); goto done; }
  results[0] = converted; converted = (wasmtime_component_val_t){0};
done:
  wasmtime_component_val_delete(&converted);
  recursivecheckedrecords_packet_t_clear(&value);
  lb_scope_close(&output.memory); lb_scope_close(&input.memory);
  return failure;
}


static wasmtime_error_t *lb_call_1(void *data, wasmtime_context_t *context,
    const wasmtime_component_func_type_t *type, wasmtime_component_val_t *args, size_t count,
    wasmtime_component_val_t *results, size_t result_count) {
  const char *package_failure = lb_package_failure();
  if (package_failure) return wasmtime_error_new(package_failure);
  (void)data; (void)context; (void)type;
  if (count != 1 || result_count != 1 || !lb_buffer(args, count, sizeof(*args), _Alignof(wasmtime_component_val_t)) || !lb_buffer(results, 1, sizeof(*results), _Alignof(wasmtime_component_val_t))) return wasmtime_error_new("WIT graph import signature mismatch");
  lb_graph_scope input = {.memory = {.remaining = LB_GRAPH_BYTES}, .nodes = LB_GRAPH_NODES};
  lb_graph_scope output = {.memory = {.remaining = LB_GRAPH_BYTES}, .nodes = LB_GRAPH_NODES};
  wasmtime_error_t *failure = NULL;
  wasmtime_component_val_t converted = {0};
  recursivecheckedrecords_graph_bf065e9a21862d87767f_t value = {0};
  recursivecheckedrecords_graph_bf065e9a21862d87767f_t arg0 = {0};
  if (!lb_graph_decode_0(&args[0], &input, &arg0)) { failure = wasmtime_error_new("Invalid copied WIT graph, allocation failure or conversion limit"); goto done; }
  uint32_t status = recursivecheckedrecords_echo_groups_graph(&arg0, &value);
  if (status) {
    /* The adapter resets this one-shot text at every call; missing text keeps the fixed failure. */
    const char *specific = status == 1 ? recursivecheckedrecords_graph_error() : NULL;
    if (specific && (!*specific || !lb_utf8(specific, strlen(specific)))) {
      lean_bridge_native_runtime_retire();
      failure = wasmtime_error_new("Malformed native refinement diagnostic; runtime retired"); goto done;
    }
    failure = wasmtime_error_new(specific ? specific : "Native Lean graph call failed"); goto done;
  }
  if (!lb_graph_encode_0(&value, &output, &converted)) {
    if (!output.memory.failure) lean_bridge_native_runtime_retire();
    failure = wasmtime_error_new(output.memory.failure ? "WIT graph result conversion limit or allocation failure" : "Malformed native graph result; runtime retired"); goto done;
  }
  if (!lean_bridge_native_component_ready("recursivecheckedrecords@1.0.0")) { failure = wasmtime_error_new("Lean runtime is unavailable"); goto done; }
  results[0] = converted; converted = (wasmtime_component_val_t){0};
done:
  wasmtime_component_val_delete(&converted);
  recursivecheckedrecords_graph_bf065e9a21862d87767f_t_clear(&value);
  lb_scope_close(&output.memory); lb_scope_close(&input.memory);
  return failure;
}


static wasmtime_error_t *lb_call_2(void *data, wasmtime_context_t *context,
    const wasmtime_component_func_type_t *type, wasmtime_component_val_t *args, size_t count,
    wasmtime_component_val_t *results, size_t result_count) {
  const char *package_failure = lb_package_failure();
  if (package_failure) return wasmtime_error_new(package_failure);
  (void)data; (void)context; (void)type;
  if (count != 1 || result_count != 1 || !lb_buffer(args, count, sizeof(*args), _Alignof(wasmtime_component_val_t)) || !lb_buffer(results, 1, sizeof(*results), _Alignof(wasmtime_component_val_t))) return wasmtime_error_new("WIT graph import signature mismatch");
  lb_graph_scope input = {.memory = {.remaining = LB_GRAPH_BYTES}, .nodes = LB_GRAPH_NODES};
  lb_graph_scope output = {.memory = {.remaining = LB_GRAPH_BYTES}, .nodes = LB_GRAPH_NODES};
  wasmtime_error_t *failure = NULL;
  wasmtime_component_val_t converted = {0};
  recursivecheckedrecords_scalar_nat_t value = {0};
  recursivecheckedrecords_packet_t arg0 = {0};
  if (!lb_graph_decode_2(&args[0], &input, &arg0)) { failure = wasmtime_error_new("Invalid copied WIT graph, allocation failure or conversion limit"); goto done; }
  uint32_t status = recursivecheckedrecords_first_graph(&arg0, &value);
  if (status) {
    /* The adapter resets this one-shot text at every call; missing text keeps the fixed failure. */
    const char *specific = status == 1 ? recursivecheckedrecords_graph_error() : NULL;
    if (specific && (!*specific || !lb_utf8(specific, strlen(specific)))) {
      lean_bridge_native_runtime_retire();
      failure = wasmtime_error_new("Malformed native refinement diagnostic; runtime retired"); goto done;
    }
    failure = wasmtime_error_new(specific ? specific : "Native Lean graph call failed"); goto done;
  }
  if (!lb_graph_encode_3(&value, &output, &converted)) {
    if (!output.memory.failure) lean_bridge_native_runtime_retire();
    failure = wasmtime_error_new(output.memory.failure ? "WIT graph result conversion limit or allocation failure" : "Malformed native graph result; runtime retired"); goto done;
  }
  if (!lean_bridge_native_component_ready("recursivecheckedrecords@1.0.0")) { failure = wasmtime_error_new("Lean runtime is unavailable"); goto done; }
  results[0] = converted; converted = (wasmtime_component_val_t){0};
done:
  wasmtime_component_val_delete(&converted);
  recursivecheckedrecords_scalar_nat_t_clear(&value);
  lb_scope_close(&output.memory); lb_scope_close(&input.memory);
  return failure;
}


static wasmtime_error_t *lb_call_3(void *data, wasmtime_context_t *context,
    const wasmtime_component_func_type_t *type, wasmtime_component_val_t *args, size_t count,
    wasmtime_component_val_t *results, size_t result_count) {
  const char *package_failure = lb_package_failure();
  if (package_failure) return wasmtime_error_new(package_failure);
  (void)data; (void)context; (void)type;
  if (count != 1 || result_count != 1 || !lb_buffer(args, count, sizeof(*args), _Alignof(wasmtime_component_val_t)) || !lb_buffer(results, 1, sizeof(*results), _Alignof(wasmtime_component_val_t))) return wasmtime_error_new("WIT graph import signature mismatch");
  lb_graph_scope input = {.memory = {.remaining = LB_GRAPH_BYTES}, .nodes = LB_GRAPH_NODES};
  lb_graph_scope output = {.memory = {.remaining = LB_GRAPH_BYTES}, .nodes = LB_GRAPH_NODES};
  wasmtime_error_t *failure = NULL;
  wasmtime_component_val_t converted = {0};
  recursivecheckedrecords_scalar_nat_t value = {0};
  recursivecheckedrecords_graph_bf065e9a21862d87767f_t arg0 = {0};
  if (!lb_graph_decode_0(&args[0], &input, &arg0)) { failure = wasmtime_error_new("Invalid copied WIT graph, allocation failure or conversion limit"); goto done; }
  uint32_t status = recursivecheckedrecords_groups_graph(&arg0, &value);
  if (status) {
    /* The adapter resets this one-shot text at every call; missing text keeps the fixed failure. */
    const char *specific = status == 1 ? recursivecheckedrecords_graph_error() : NULL;
    if (specific && (!*specific || !lb_utf8(specific, strlen(specific)))) {
      lean_bridge_native_runtime_retire();
      failure = wasmtime_error_new("Malformed native refinement diagnostic; runtime retired"); goto done;
    }
    failure = wasmtime_error_new(specific ? specific : "Native Lean graph call failed"); goto done;
  }
  if (!lb_graph_encode_3(&value, &output, &converted)) {
    if (!output.memory.failure) lean_bridge_native_runtime_retire();
    failure = wasmtime_error_new(output.memory.failure ? "WIT graph result conversion limit or allocation failure" : "Malformed native graph result; runtime retired"); goto done;
  }
  if (!lean_bridge_native_component_ready("recursivecheckedrecords@1.0.0")) { failure = wasmtime_error_new("Lean runtime is unavailable"); goto done; }
  results[0] = converted; converted = (wasmtime_component_val_t){0};
done:
  wasmtime_component_val_delete(&converted);
  recursivecheckedrecords_scalar_nat_t_clear(&value);
  lb_scope_close(&output.memory); lb_scope_close(&input.memory);
  return failure;
}


static wasmtime_error_t *lb_call_4(void *data, wasmtime_context_t *context,
    const wasmtime_component_func_type_t *type, wasmtime_component_val_t *args, size_t count,
    wasmtime_component_val_t *results, size_t result_count) {
  const char *package_failure = lb_package_failure();
  if (package_failure) return wasmtime_error_new(package_failure);
  (void)data; (void)context; (void)type;
  if (count != 1 || result_count != 1 || !lb_buffer(args, count, sizeof(*args), _Alignof(wasmtime_component_val_t)) || !lb_buffer(results, 1, sizeof(*results), _Alignof(wasmtime_component_val_t))) return wasmtime_error_new("WIT graph import signature mismatch");
  lb_graph_scope input = {.memory = {.remaining = LB_GRAPH_BYTES}, .nodes = LB_GRAPH_NODES};
  lb_graph_scope output = {.memory = {.remaining = LB_GRAPH_BYTES}, .nodes = LB_GRAPH_NODES};
  wasmtime_error_t *failure = NULL;
  wasmtime_component_val_t converted = {0};
  recursivecheckedrecords_packet_t value = {0};
  recursivecheckedrecords_scalar_nat_t arg0 = {0};
  if (!lb_graph_decode_3(&args[0], &input, &arg0)) { failure = wasmtime_error_new("Invalid copied WIT graph, allocation failure or conversion limit"); goto done; }
  uint32_t status = recursivecheckedrecords_produce_graph(&arg0, &value);
  if (status) {
    /* The adapter resets this one-shot text at every call; missing text keeps the fixed failure. */
    const char *specific = status == 1 ? recursivecheckedrecords_graph_error() : NULL;
    if (specific && (!*specific || !lb_utf8(specific, strlen(specific)))) {
      lean_bridge_native_runtime_retire();
      failure = wasmtime_error_new("Malformed native refinement diagnostic; runtime retired"); goto done;
    }
    failure = wasmtime_error_new(specific ? specific : "Native Lean graph call failed"); goto done;
  }
  if (!lb_graph_encode_2(&value, &output, &converted)) {
    if (!output.memory.failure) lean_bridge_native_runtime_retire();
    failure = wasmtime_error_new(output.memory.failure ? "WIT graph result conversion limit or allocation failure" : "Malformed native graph result; runtime retired"); goto done;
  }
  if (!lean_bridge_native_component_ready("recursivecheckedrecords@1.0.0")) { failure = wasmtime_error_new("Lean runtime is unavailable"); goto done; }
  results[0] = converted; converted = (wasmtime_component_val_t){0};
done:
  wasmtime_component_val_delete(&converted);
  recursivecheckedrecords_packet_t_clear(&value);
  lb_scope_close(&output.memory); lb_scope_close(&input.memory);
  return failure;
}


static wasmtime_error_t *lb_call_5(void *data, wasmtime_context_t *context,
    const wasmtime_component_func_type_t *type, wasmtime_component_val_t *args, size_t count,
    wasmtime_component_val_t *results, size_t result_count) {
  const char *package_failure = lb_package_failure();
  if (package_failure) return wasmtime_error_new(package_failure);
  (void)data; (void)context; (void)type;
  if (count != 1 || result_count != 1 || !lb_buffer(args, count, sizeof(*args), _Alignof(wasmtime_component_val_t)) || !lb_buffer(results, 1, sizeof(*results), _Alignof(wasmtime_component_val_t))) return wasmtime_error_new("WIT graph import signature mismatch");
  lb_graph_scope input = {.memory = {.remaining = LB_GRAPH_BYTES}, .nodes = LB_GRAPH_NODES};
  lb_graph_scope output = {.memory = {.remaining = LB_GRAPH_BYTES}, .nodes = LB_GRAPH_NODES};
  wasmtime_error_t *failure = NULL;
  wasmtime_component_val_t converted = {0};
  recursivecheckedrecords_scalar_nat_t value = {0};
  recursivecheckedrecords_packet_t arg0 = {0};
  if (!lb_graph_decode_2(&args[0], &input, &arg0)) { failure = wasmtime_error_new("Invalid copied WIT graph, allocation failure or conversion limit"); goto done; }
  uint32_t status = recursivecheckedrecords_second_graph(&arg0, &value);
  if (status) {
    /* The adapter resets this one-shot text at every call; missing text keeps the fixed failure. */
    const char *specific = status == 1 ? recursivecheckedrecords_graph_error() : NULL;
    if (specific && (!*specific || !lb_utf8(specific, strlen(specific)))) {
      lean_bridge_native_runtime_retire();
      failure = wasmtime_error_new("Malformed native refinement diagnostic; runtime retired"); goto done;
    }
    failure = wasmtime_error_new(specific ? specific : "Native Lean graph call failed"); goto done;
  }
  if (!lb_graph_encode_3(&value, &output, &converted)) {
    if (!output.memory.failure) lean_bridge_native_runtime_retire();
    failure = wasmtime_error_new(output.memory.failure ? "WIT graph result conversion limit or allocation failure" : "Malformed native graph result; runtime retired"); goto done;
  }
  if (!lean_bridge_native_component_ready("recursivecheckedrecords@1.0.0")) { failure = wasmtime_error_new("Lean runtime is unavailable"); goto done; }
  results[0] = converted; converted = (wasmtime_component_val_t){0};
done:
  wasmtime_component_val_delete(&converted);
  recursivecheckedrecords_scalar_nat_t_clear(&value);
  lb_scope_close(&output.memory); lb_scope_close(&input.memory);
  return failure;
}

static const uint8_t lb_component[] = {0,97,115,109,13,0,1,0,7,148,5,1,66,47,1,112,121,1,114,1,5,105,110,100,101,120,121,4,0,13,108,98,45,103,114,97,112,104,45,114,101,102,50,3,0,1,1,114,1,5,105,110,100,101,120,121,4,0,13,108,98,45,103,114,97,112,104,45,114,101,102,49,3,0,3,1,112,4,4,0,14,98,114,105,100,103,101,45,118,97,108,117,101,45,51,3,0,5,1,112,6,4,0,14,98,114,105,100,103,101,45,118,97,108,117,101,45,52,3,0,7,1,107,2,4,0,14,98,114,105,100,103,101,45,118,97,108,117,101,45,53,3,0,9,1,112,10,4,0,14,98,114,105,100,103,101,45,118,97,108,117,101,45,54,3,0,11,1,112,121,4,0,14,98,114,105,100,103,101,45,118,97,108,117,101,45,55,3,0,13,1,114,3,5,118,97,108,117,101,14,5,100,105,103,105,116,14,4,116,97,105,108,4,4,0,14,108,98,45,103,114,97,112,104,45,110,111,100,101,50,3,0,15,1,112,16,4,0,14,98,114,105,100,103,101,45,118,97,108,117,101,45,57,3,0,17,4,0,14,108,98,45,103,114,97,112,104,45,110,111,100,101,48,3,0,6,1,112,19,4,0,21,98,114,105,100,103,101,45,97,108,105,97,115,45,118,97,108,117,101,45,49,53,3,0,20,4,0,14,108,98,45,103,114,97,112,104,45,110,111,100,101,49,3,0,10,1,112,22,4,0,21,98,114,105,100,103,101,45,97,108,105,97,115,45,118,97,108,117,101,45,49,55,3,0,23,1,114,3,6,110,111,100,101,115,48,21,6,110,111,100,101,115,49,24,6,110,111,100,101,115,50,18,4,0,14,108,98,45,103,114,97,112,104,45,97,114,101,110,97,3,0,25,1,114,2,4,114,111,111,116,2,5,110,111,100,101,115,26,4,0,15,108,98,45,103,114,97,112,104,45,118,97,108,117,101,50,3,0,27,1,114,1,5,105,110,100,101,120,121,4,0,13,108,98,45,103,114,97,112,104,45,114,101,102,48,3,0,29,1,114,2,4,114,111,111,116,30,5,110,111,100,101,115,26,4,0,15,108,98,45,103,114,97,112,104,45,118,97,108,117,101,48,3,0,31,4,0,6,112,97,99,107,101,116,3,0,28,4,0,12,112,97,99,107,101,116,45,97,108,105,97,115,3,0,28,1,64,1,4,97,114,103,48,33,0,33,4,0,4,101,99,104,111,1,35,1,64,1,4,97,114,103,48,32,0,32,4,0,11,101,99,104,111,45,103,114,111,117,112,115,1,36,1,64,1,4,97,114,103,48,33,0,14,4,0,5,102,105,114,115,116,1,37,1,64,1,4,97,114,103,48,32,0,14,4,0,6,103,114,111,117,112,115,1,38,1,64,1,4,97,114,103,48,14,0,33,4,0,7,112,114,111,100,117,99,101,1,39,1,64,1,4,97,114,103,48,33,0,14,4,0,6,115,101,99,111,110,100,1,40,10,53,1,0,48,108,101,97,110,45,98,114,105,100,103,101,58,114,101,99,117,114,115,105,118,101,99,104,101,99,107,101,100,114,101,99,111,114,100,115,47,110,97,116,105,118,101,64,49,46,48,46,48,5,0,6,153,3,25,3,0,0,13,108,98,45,103,114,97,112,104,45,114,101,102,50,3,0,0,13,108,98,45,103,114,97,112,104,45,114,101,102,49,3,0,0,14,98,114,105,100,103,101,45,118,97,108,117,101,45,51,3,0,0,14,98,114,105,100,103,101,45,118,97,108,117,101,45,52,3,0,0,14,98,114,105,100,103,101,45,118,97,108,117,101,45,53,3,0,0,14,98,114,105,100,103,101,45,118,97,108,117,101,45,54,3,0,0,14,98,114,105,100,103,101,45,118,97,108,117,101,45,55,3,0,0,14,108,98,45,103,114,97,112,104,45,110,111,100,101,50,3,0,0,14,98,114,105,100,103,101,45,118,97,108,117,101,45,57,3,0,0,14,108,98,45,103,114,97,112,104,45,110,111,100,101,48,3,0,0,21,98,114,105,100,103,101,45,97,108,105,97,115,45,118,97,108,117,101,45,49,53,3,0,0,14,108,98,45,103,114,97,112,104,45,110,111,100,101,49,3,0,0,21,98,114,105,100,103,101,45,97,108,105,97,115,45,118,97,108,117,101,45,49,55,3,0,0,14,108,98,45,103,114,97,112,104,45,97,114,101,110,97,3,0,0,15,108,98,45,103,114,97,112,104,45,118,97,108,117,101,50,3,0,0,13,108,98,45,103,114,97,112,104,45,114,101,102,48,3,0,0,15,108,98,45,103,114,97,112,104,45,118,97,108,117,101,48,3,0,0,6,112,97,99,107,101,116,3,0,0,12,112,97,99,107,101,116,45,97,108,105,97,115,1,0,0,4,101,99,104,111,1,0,0,11,101,99,104,111,45,103,114,111,117,112,115,1,0,0,5,102,105,114,115,116,1,0,0,6,103,114,111,117,112,115,1,0,0,7,112,114,111,100,117,99,101,1,0,0,6,115,101,99,111,110,100,1,230,2,0,97,115,109,1,0,0,0,1,25,5,96,4,127,127,127,127,1,127,96,1,127,0,96,1,126,0,96,1,125,0,96,1,124,0,3,6,5,0,1,2,3,4,5,5,1,1,1,128,8,6,6,1,127,1,65,16,11,7,64,6,6,109,101,109,111,114,121,2,0,7,114,101,97,108,108,111,99,0,0,8,112,111,115,116,45,105,51,50,0,1,8,112,111,115,116,45,105,54,52,0,2,8,112,111,115,116,45,102,51,50,0,3,8,112,111,115,116,45,102,54,52,0,4,10,147,1,5,117,1,3,127,32,3,69,4,64,65,0,15,11,35,0,32,2,65,1,107,106,65,0,32,2,107,113,33,4,32,4,32,3,106,33,5,32,5,32,4,73,32,5,65,128,128,128,32,75,114,4,64,0,11,32,5,65,255,255,3,106,65,16,118,33,6,32,6,63,0,75,4,64,32,6,63,0,107,64,0,65,127,70,4,64,0,11,11,32,0,4,64,32,4,32,0,32,1,32,3,32,1,32,3,73,27,252,10,0,0,11,32,5,36,0,32,4,11,6,0,65,16,36,0,11,6,0,65,16,36,0,11,6,0,65,16,36,0,11,6,0,65,16,36,0,11,0,82,4,110,97,109,101,0,10,9,97,108,108,111,99,97,116,111,114,2,54,1,0,7,0,3,111,108,100,1,8,111,108,100,45,115,105,122,101,2,9,97,108,105,103,110,109,101,110,116,3,4,115,105,122,101,4,5,115,116,97,114,116,5,3,101,110,100,6,5,112,97,103,101,115,7,7,1,0,4,104,101,97,112,2,4,1,0,0,0,6,76,6,0,2,1,0,6,109,101,109,111,114,121,0,0,1,0,7,114,101,97,108,108,111,99,0,0,1,0,8,112,111,115,116,45,105,51,50,0,0,1,0,8,112,111,115,116,45,105,54,52,0,0,1,0,8,112,111,115,116,45,102,51,50,0,0,1,0,8,112,111,115,116,45,102,54,52,8,49,6,1,0,0,2,3,0,4,0,1,0,1,2,3,0,4,0,1,0,2,2,3,0,4,0,1,0,3,2,3,0,4,0,1,0,4,2,3,0,4,0,1,0,5,2,3,0,4,0,1,128,4,0,97,115,109,1,0,0,0,1,43,5,96,4,127,127,127,127,1,127,96,8,127,127,127,127,127,127,127,127,0,96,3,127,127,127,0,96,7,127,127,127,127,127,127,127,1,127,96,2,127,127,1,127,2,82,7,10,97,108,108,111,99,97,116,105,111,110,7,114,101,97,108,108,111,99,0,0,4,104,111,115,116,2,102,48,0,1,4,104,111,115,116,2,102,49,0,1,4,104,111,115,116,2,102,50,0,1,4,104,111,115,116,2,102,51,0,1,4,104,111,115,116,2,102,52,0,2,4,104,111,115,116,2,102,53,0,1,3,7,6,3,3,3,3,4,3,7,31,6,2,102,48,0,7,2,102,49,0,8,2,102,50,0,9,2,102,51,0,10,2,102,52,0,11,2,102,53,0,12,10,213,1,6,36,1,1,127,65,0,65,0,65,4,65,28,16,0,33,7,32,0,32,1,32,2,32,3,32,4,32,5,32,6,32,7,16,1,32,7,11,36,1,1,127,65,0,65,0,65,4,65,28,16,0,33,7,32,0,32,1,32,2,32,3,32,4,32,5,32,6,32,7,16,2,32,7,11,36,1,1,127,65,0,65,0,65,4,65,8,16,0,33,7,32,0,32,1,32,2,32,3,32,4,32,5,32,6,32,7,16,3,32,7,11,36,1,1,127,65,0,65,0,65,4,65,8,16,0,33,7,32,0,32,1,32,2,32,3,32,4,32,5,32,6,32,7,16,4,32,7,11,26,1,1,127,65,0,65,0,65,4,65,28,16,0,33,2,32,0,32,1,32,2,16,5,32,2,11,36,1,1,127,65,0,65,0,65,4,65,8,16,0,33,7,32,0,32,1,32,2,32,3,32,4,32,5,32,6,32,7,16,6,32,7,11,0,115,4,110,97,109,101,0,8,7,102,111,114,119,97,114,100,1,35,7,0,8,97,108,108,111,99,97,116,101,1,2,102,48,2,2,102,49,3,2,102,50,4,2,102,51,5,2,102,52,6,2,102,53,2,61,6,7,1,7,6,114,101,115,117,108,116,8,1,7,6,114,101,115,117,108,116,9,1,7,6,114,101,115,117,108,116,10,1,7,6,114,101,115,117,108,116,11,1,2,6,114,101,115,117,108,116,12,1,7,6,114,101,115,117,108,116,2,56,2,1,6,2,102,48,0,5,2,102,49,0,6,2,102,50,0,7,2,102,51,0,8,2,102,52,0,9,2,102,53,0,10,0,1,2,10,97,108,108,111,99,97,116,105,111,110,18,0,4,104,111,115,116,18,1,6,43,6,0,0,1,2,2,102,48,0,0,1,2,2,102,49,0,0,1,2,2,102,50,0,0,1,2,2,102,51,0,0,1,2,2,102,52,0,0,1,2,2,102,53,7,11,1,64,1,4,97,114,103,48,18,0,18,8,12,1,0,0,11,3,3,0,4,0,5,1,20,7,11,1,64,1,4,97,114,103,48,17,0,17,8,12,1,0,0,12,3,3,0,4,0,5,1,21,7,11,1,64,1,4,97,114,103,48,18,0,7,8,12,1,0,0,13,3,3,0,4,0,5,1,22,7,11,1,64,1,4,97,114,103,48,17,0,7,8,12,1,0,0,14,3,3,0,4,0,5,1,23,7,11,1,64,1,4,97,114,103,48,7,0,18,8,12,1,0,0,15,3,3,0,4,0,5,1,24,7,11,1,64,1,4,97,114,103,48,18,0,7,8,12,1,0,0,16,3,3,0,4,0,5,1,25,7,232,4,1,66,50,2,3,2,1,1,4,0,13,108,98,45,103,114,97,112,104,45,114,101,102,50,3,0,0,2,3,2,1,2,4,0,13,108,98,45,103,114,97,112,104,45,114,101,102,49,3,0,2,2,3,2,1,3,4,0,14,98,114,105,100,103,101,45,118,97,108,117,101,45,51,3,0,4,2,3,2,1,4,4,0,14,98,114,105,100,103,101,45,118,97,108,117,101,45,52,3,0,6,2,3,2,1,5,4,0,14,98,114,105,100,103,101,45,118,97,108,117,101,45,53,3,0,8,2,3,2,1,6,4,0,14,98,114,105,100,103,101,45,118,97,108,117,101,45,54,3,0,10,2,3,2,1,7,4,0,14,98,114,105,100,103,101,45,118,97,108,117,101,45,55,3,0,12,2,3,2,1,8,4,0,14,108,98,45,103,114,97,112,104,45,110,111,100,101,50,3,0,14,2,3,2,1,9,4,0,14,98,114,105,100,103,101,45,118,97,108,117,101,45,57,3,0,16,2,3,2,1,10,4,0,14,108,98,45,103,114,97,112,104,45,110,111,100,101,48,3,0,18,2,3,2,1,11,4,0,21,98,114,105,100,103,101,45,97,108,105,97,115,45,118,97,108,117,101,45,49,53,3,0,20,2,3,2,1,12,4,0,14,108,98,45,103,114,97,112,104,45,110,111,100,101,49,3,0,22,2,3,2,1,13,4,0,21,98,114,105,100,103,101,45,97,108,105,97,115,45,118,97,108,117,101,45,49,55,3,0,24,2,3,2,1,14,4,0,14,108,98,45,103,114,97,112,104,45,97,114,101,110,97,3,0,26,2,3,2,1,15,4,0,15,108,98,45,103,114,97,112,104,45,118,97,108,117,101,50,3,0,28,2,3,2,1,16,4,0,13,108,98,45,103,114,97,112,104,45,114,101,102,48,3,0,30,2,3,2,1,17,4,0,15,108,98,45,103,114,97,112,104,45,118,97,108,117,101,48,3,0,32,2,3,2,1,18,4,0,6,112,97,99,107,101,116,3,0,34,2,3,2,1,19,4,0,12,112,97,99,107,101,116,45,97,108,105,97,115,3,0,36,1,64,1,4,97,114,103,48,35,0,35,4,0,4,101,99,104,111,1,38,1,64,1,4,97,114,103,48,33,0,33,4,0,11,101,99,104,111,45,103,114,111,117,112,115,1,39,1,64,1,4,97,114,103,48,35,0,13,4,0,5,102,105,114,115,116,1,40,1,64,1,4,97,114,103,48,33,0,13,4,0,6,103,114,111,117,112,115,1,41,1,64,1,4,97,114,103,48,13,0,35,4,0,7,112,114,111,100,117,99,101,1,42,1,64,1,4,97,114,103,48,35,0,13,4,0,6,115,101,99,111,110,100,1,43,5,155,3,1,1,25,0,13,108,98,45,103,114,97,112,104,45,114,101,102,50,3,1,0,13,108,98,45,103,114,97,112,104,45,114,101,102,49,3,2,0,14,98,114,105,100,103,101,45,118,97,108,117,101,45,51,3,3,0,14,98,114,105,100,103,101,45,118,97,108,117,101,45,52,3,4,0,14,98,114,105,100,103,101,45,118,97,108,117,101,45,53,3,5,0,14,98,114,105,100,103,101,45,118,97,108,117,101,45,54,3,6,0,14,98,114,105,100,103,101,45,118,97,108,117,101,45,55,3,7,0,14,108,98,45,103,114,97,112,104,45,110,111,100,101,50,3,8,0,14,98,114,105,100,103,101,45,118,97,108,117,101,45,57,3,9,0,14,108,98,45,103,114,97,112,104,45,110,111,100,101,48,3,10,0,21,98,114,105,100,103,101,45,97,108,105,97,115,45,118,97,108,117,101,45,49,53,3,11,0,14,108,98,45,103,114,97,112,104,45,110,111,100,101,49,3,12,0,21,98,114,105,100,103,101,45,97,108,105,97,115,45,118,97,108,117,101,45,49,55,3,13,0,14,108,98,45,103,114,97,112,104,45,97,114,101,110,97,3,14,0,15,108,98,45,103,114,97,112,104,45,118,97,108,117,101,50,3,15,0,13,108,98,45,103,114,97,112,104,45,114,101,102,48,3,16,0,15,108,98,45,103,114,97,112,104,45,118,97,108,117,101,48,3,17,0,6,112,97,99,107,101,116,3,18,0,12,112,97,99,107,101,116,45,97,108,105,97,115,3,19,0,4,101,99,104,111,1,6,0,11,101,99,104,111,45,103,114,111,117,112,115,1,7,0,5,102,105,114,115,116,1,8,0,6,103,114,111,117,112,115,1,9,0,7,112,114,111,100,117,99,101,1,10,0,6,115,101,99,111,110,100,1,11,11,53,1,0,45,108,101,97,110,45,98,114,105,100,103,101,58,114,101,99,117,114,115,105,118,101,99,104,101,99,107,101,100,114,101,99,111,114,100,115,47,97,112,105,64,49,46,48,46,48,5,1,1,5,26,0,160,4,14,99,111,109,112,111,110,101,110,116,45,110,97,109,101,1,160,1,0,0,17,0,7,114,101,97,108,108,111,99,1,8,112,111,115,116,45,105,51,50,2,8,112,111,115,116,45,105,54,52,3,8,112,111,115,116,45,102,51,50,4,8,112,111,115,116,45,102,54,52,5,6,108,111,119,101,114,48,6,6,108,111,119,101,114,49,7,6,108,111,119,101,114,50,8,6,108,111,119,101,114,51,9,6,108,111,119,101,114,52,10,6,108,111,119,101,114,53,11,8,102,111,114,119,97,114,100,48,12,8,102,111,114,119,97,114,100,49,13,8,102,111,114,119,97,114,100,50,14,8,102,111,114,119,97,114,100,51,15,8,102,111,114,119,97,114,100,52,16,8,102,111,114,119,97,114,100,53,1,11,0,2,1,0,6,109,101,109,111,114,121,1,23,0,17,2,0,9,97,108,108,111,99,97,116,111,114,1,7,102,111,114,119,97,114,100,1,35,0,18,3,0,10,97,108,108,111,99,97,116,105,111,110,1,7,105,109,112,111,114,116,115,2,9,102,111,114,119,97,114,100,101,100,1,68,1,12,0,5,104,111,115,116,48,1,5,104,111,115,116,49,2,5,104,111,115,116,50,3,5,104,111,115,116,51,4,5,104,111,115,116,52,5,5,104,111,115,116,53,6,2,102,48,7,2,102,49,8,2,102,50,9,2,102,51,10,2,102,52,11,2,102,53,1,200,1,3,21,0,3,97,112,105,1,7,112,117,98,108,105,99,49,2,7,112,117,98,108,105,99,50,3,7,112,117,98,108,105,99,51,4,7,112,117,98,108,105,99,52,5,7,112,117,98,108,105,99,53,6,7,112,117,98,108,105,99,54,7,7,112,117,98,108,105,99,55,8,7,112,117,98,108,105,99,56,9,7,112,117,98,108,105,99,57,10,8,112,117,98,108,105,99,49,52,11,8,112,117,98,108,105,99,49,53,12,8,112,117,98,108,105,99,49,54,13,8,112,117,98,108,105,99,49,55,14,8,112,117,98,108,105,99,49,48,15,8,112,117,98,108,105,99,49,49,16,8,112,117,98,108,105,99,49,50,17,8,112,117,98,108,105,99,49,51,18,8,112,117,98,108,105,99,49,56,19,8,112,117,98,108,105,99,49,57,26,10,112,117,98,108,105,99,45,97,112,105,1,16,5,2,0,4,104,111,115,116,1,6,112,117,98,108,105,99};
struct recursivecheckedrecords_wasmtime {
  wasm_engine_t *engine;
  wasmtime_component_t *component;
  wasmtime_store_t *store;
  wasmtime_component_linker_t *linker;
  wasmtime_component_instance_t instance;
};
wasmtime_error_t *recursivecheckedrecords_wasmtime_link(wasmtime_component_linker_t *linker) {
  const char *package_failure = lb_package_failure();
  if (package_failure) return wasmtime_error_new(package_failure);
  if (!linker) return wasmtime_error_new("Missing Wasmtime linker");
  wasmtime_component_linker_instance_t *root = wasmtime_component_linker_root(linker), *host = NULL;
  wasmtime_error_t *error = wasmtime_component_linker_instance_add_instance(root, "lean-bridge:recursivecheckedrecords/native@1.0.0", 48, &host);
  if (!error) {
    if (!error) error = wasmtime_component_linker_instance_add_func(host, "echo", 4, lb_call_0, NULL, NULL);
    if (!error) error = wasmtime_component_linker_instance_add_func(host, "echo-groups", 11, lb_call_1, NULL, NULL);
    if (!error) error = wasmtime_component_linker_instance_add_func(host, "first", 5, lb_call_2, NULL, NULL);
    if (!error) error = wasmtime_component_linker_instance_add_func(host, "groups", 6, lb_call_3, NULL, NULL);
    if (!error) error = wasmtime_component_linker_instance_add_func(host, "produce", 7, lb_call_4, NULL, NULL);
    if (!error) error = wasmtime_component_linker_instance_add_func(host, "second", 6, lb_call_5, NULL, NULL);
    wasmtime_component_linker_instance_delete(host);
  }
  wasmtime_component_linker_instance_delete(root);
  return error;
}
static wasmtime_error_t *lb_refresh(recursivecheckedrecords_wasmtime *session) {
  if (session->store) wasmtime_store_delete(session->store);
  session->store = wasmtime_store_new(session->engine, NULL, NULL);
  wasmtime_error_t *error = wasmtime_component_linker_instantiate(session->linker, wasmtime_store_context(session->store), session->component, &session->instance);
  if (error) { wasmtime_store_delete(session->store); session->store = NULL; }
  return error;
}
void recursivecheckedrecords_wasmtime_close(recursivecheckedrecords_wasmtime *session) {
  if (getpid() != lb_package_pid) return;
  if (!session) return;
  if (session->linker) wasmtime_component_linker_delete(session->linker);
  if (session->store) wasmtime_store_delete(session->store);
  if (session->component) wasmtime_component_delete(session->component);
  if (session->engine) wasm_engine_delete(session->engine);
  free(session);
}
wasmtime_error_t *recursivecheckedrecords_wasmtime_open(recursivecheckedrecords_wasmtime **out) {
  const char *package_failure = lb_package_failure();
  if (package_failure) return wasmtime_error_new(package_failure);
  if (!out) return wasmtime_error_new("Missing session output");
  recursivecheckedrecords_wasmtime *session = calloc(1, sizeof(*session));
  if (!session) return wasmtime_error_new("Cannot allocate Wasmtime session");
  wasm_config_t *config = wasm_config_new();
  if (!config) { free(session); return wasmtime_error_new("Cannot allocate Wasmtime configuration"); }
  wasmtime_config_wasm_component_model_set(config, true);
  session->engine = wasm_engine_new_with_config(config);
  wasmtime_error_t *error = wasmtime_component_new(session->engine, lb_component, sizeof(lb_component), &session->component);
  if (!error) {
    session->linker = wasmtime_component_linker_new(session->engine);
    error = recursivecheckedrecords_wasmtime_link(session->linker);
    if (!error) error = lb_refresh(session);
  }
  if (error) { recursivecheckedrecords_wasmtime_close(session); return error; }
  *out = session; return NULL;
}
wasmtime_error_t *recursivecheckedrecords_wasmtime_call(recursivecheckedrecords_wasmtime *session, const char *name,
    const wasmtime_component_val_t *args, size_t count, wasmtime_component_val_t *out) {
  const char *package_failure = lb_package_failure();
  if (package_failure) return wasmtime_error_new(package_failure);
  if (!session || !session->store || !name || !out || (count && !args)) return wasmtime_error_new("Invalid WIT call arguments or unavailable session");
  /* Check every referenced row before Wasmtime copies any caller value. */
  if (!lb_buffer(args, count, sizeof(*args), _Alignof(wasmtime_component_val_t)) || !lb_buffer(out, 1, sizeof(*out), _Alignof(wasmtime_component_val_t))) return wasmtime_error_new("Invalid WIT argument storage");
  lb_graph_scope validation = {.memory = {.remaining = LB_GRAPH_BYTES}, .nodes = LB_GRAPH_NODES};
  bool valid = false;
  if (strcmp(name, "echo") == 0) valid = count == 1 && lb_graph_decode_2(&args[0], &validation, NULL);
  if (strcmp(name, "echo-groups") == 0) valid = count == 1 && lb_graph_decode_0(&args[0], &validation, NULL);
  if (strcmp(name, "first") == 0) valid = count == 1 && lb_graph_decode_2(&args[0], &validation, NULL);
  if (strcmp(name, "groups") == 0) valid = count == 1 && lb_graph_decode_0(&args[0], &validation, NULL);
  if (strcmp(name, "produce") == 0) valid = count == 1 && lb_graph_decode_3(&args[0], &validation, NULL);
  if (strcmp(name, "second") == 0) valid = count == 1 && lb_graph_decode_2(&args[0], &validation, NULL);
  lb_scope_close(&validation.memory);
  if (!valid) return wasmtime_error_new("Unknown export, invalid copied graph or conversion limit");
  wasmtime_context_t *context = wasmtime_store_context(session->store);
  wasmtime_component_export_index_t *api = wasmtime_component_instance_get_export_index(&session->instance, context, NULL, "lean-bridge:recursivecheckedrecords/api@1.0.0", 45);
  if (!api) return wasmtime_error_new("Component API export is missing");
  wasmtime_component_export_index_t *index = wasmtime_component_instance_get_export_index(&session->instance, context, api, name, strlen(name));
  wasmtime_component_export_index_delete(api);
  if (!index) return wasmtime_error_new("Component function export is missing");
  wasmtime_component_func_t function;
  bool found = wasmtime_component_instance_get_func(&session->instance, context, index, &function);
  wasmtime_component_export_index_delete(index);
  if (!found) return wasmtime_error_new("Component export is not a function");
  wasmtime_component_val_t result = {0};
  wasmtime_error_t *error = wasmtime_component_func_call(&function, context, args, count, &result, 1);
  if (error) {
    wasmtime_component_val_delete(&result);
    /* A trap bypasses canonical post-return. Dispose its store and scratch memory. */
    wasmtime_error_t *reset_error = lb_refresh(session);
    if (reset_error) wasmtime_error_delete(reset_error);
    return error;
  }
  *out = result; return NULL;
}


wasmtime_error_t *recursivecheckedrecords_wasmtime_value_echo(recursivecheckedrecords_wasmtime *session, const recursivecheckedrecords_packet_t *arg0, recursivecheckedrecords_packet_t *out) {
  const char *package_failure = lb_package_failure();
  if (package_failure) return wasmtime_error_new(package_failure);
  if (!lb_buffer(out, 1, sizeof(*out), _Alignof(recursivecheckedrecords_packet_t)) || out->_bridge_owner || out->_bridge_release) return wasmtime_error_new("Graph output requires a fresh initialized slot");
  lb_graph_scope input = {.memory = {.remaining = LB_GRAPH_BYTES}, .nodes = LB_GRAPH_NODES};
  lb_graph_scope output = {.memory = {.remaining = LB_GRAPH_BYTES}, .nodes = LB_GRAPH_NODES};
  wasmtime_error_t *failure = NULL;
  wasmtime_component_val_t arguments[1] = {{0}};
  wasmtime_component_val_t result = {0};
  recursivecheckedrecords_packet_t converted = {0};
  if (!lb_graph_encode_2(arg0, &input, &arguments[0])) { failure = wasmtime_error_new("Invalid native graph input, allocation failure or conversion limit"); goto done; }
  failure = recursivecheckedrecords_wasmtime_call(session, "echo", arguments, 1, &result);
  if (failure) goto done;
  if (!lb_graph_decode_2(&result, &output, &converted)) {
    if (!output.memory.failure) lean_bridge_native_runtime_retire();
    failure = wasmtime_error_new(output.memory.failure ? "Graph result conversion limit or allocation failure" : "Malformed WIT graph result; runtime retired"); goto done;
  }
  converted._bridge_owner = output.memory.allocations; converted._bridge_release = output.memory.allocations ? lb_graph_release : NULL; output.memory.allocations = NULL;
  *out = converted;
done:
  wasmtime_component_val_delete(&arguments[0]);
  wasmtime_component_val_delete(&result);
  lb_scope_close(&input.memory); lb_scope_close(&output.memory);
  return failure;
}


wasmtime_error_t *recursivecheckedrecords_wasmtime_value_echo_groups(recursivecheckedrecords_wasmtime *session, const recursivecheckedrecords_graph_bf065e9a21862d87767f_t *arg0, recursivecheckedrecords_graph_bf065e9a21862d87767f_t *out) {
  const char *package_failure = lb_package_failure();
  if (package_failure) return wasmtime_error_new(package_failure);
  if (!lb_buffer(out, 1, sizeof(*out), _Alignof(recursivecheckedrecords_graph_bf065e9a21862d87767f_t)) || out->_bridge_owner || out->_bridge_release) return wasmtime_error_new("Graph output requires a fresh initialized slot");
  lb_graph_scope input = {.memory = {.remaining = LB_GRAPH_BYTES}, .nodes = LB_GRAPH_NODES};
  lb_graph_scope output = {.memory = {.remaining = LB_GRAPH_BYTES}, .nodes = LB_GRAPH_NODES};
  wasmtime_error_t *failure = NULL;
  wasmtime_component_val_t arguments[1] = {{0}};
  wasmtime_component_val_t result = {0};
  recursivecheckedrecords_graph_bf065e9a21862d87767f_t converted = {0};
  if (!lb_graph_encode_0(arg0, &input, &arguments[0])) { failure = wasmtime_error_new("Invalid native graph input, allocation failure or conversion limit"); goto done; }
  failure = recursivecheckedrecords_wasmtime_call(session, "echo-groups", arguments, 1, &result);
  if (failure) goto done;
  if (!lb_graph_decode_0(&result, &output, &converted)) {
    if (!output.memory.failure) lean_bridge_native_runtime_retire();
    failure = wasmtime_error_new(output.memory.failure ? "Graph result conversion limit or allocation failure" : "Malformed WIT graph result; runtime retired"); goto done;
  }
  converted._bridge_owner = output.memory.allocations; converted._bridge_release = output.memory.allocations ? lb_graph_release : NULL; output.memory.allocations = NULL;
  *out = converted;
done:
  wasmtime_component_val_delete(&arguments[0]);
  wasmtime_component_val_delete(&result);
  lb_scope_close(&input.memory); lb_scope_close(&output.memory);
  return failure;
}


wasmtime_error_t *recursivecheckedrecords_wasmtime_value_first(recursivecheckedrecords_wasmtime *session, const recursivecheckedrecords_packet_t *arg0, recursivecheckedrecords_scalar_nat_t *out) {
  const char *package_failure = lb_package_failure();
  if (package_failure) return wasmtime_error_new(package_failure);
  if (!lb_buffer(out, 1, sizeof(*out), _Alignof(recursivecheckedrecords_scalar_nat_t)) || out->_bridge_owner || out->_bridge_release) return wasmtime_error_new("Graph output requires a fresh initialized slot");
  lb_graph_scope input = {.memory = {.remaining = LB_GRAPH_BYTES}, .nodes = LB_GRAPH_NODES};
  lb_graph_scope output = {.memory = {.remaining = LB_GRAPH_BYTES}, .nodes = LB_GRAPH_NODES};
  wasmtime_error_t *failure = NULL;
  wasmtime_component_val_t arguments[1] = {{0}};
  wasmtime_component_val_t result = {0};
  recursivecheckedrecords_scalar_nat_t converted = {0};
  if (!lb_graph_encode_2(arg0, &input, &arguments[0])) { failure = wasmtime_error_new("Invalid native graph input, allocation failure or conversion limit"); goto done; }
  failure = recursivecheckedrecords_wasmtime_call(session, "first", arguments, 1, &result);
  if (failure) goto done;
  if (!lb_graph_decode_3(&result, &output, &converted)) {
    if (!output.memory.failure) lean_bridge_native_runtime_retire();
    failure = wasmtime_error_new(output.memory.failure ? "Graph result conversion limit or allocation failure" : "Malformed WIT graph result; runtime retired"); goto done;
  }
  converted._bridge_owner = output.memory.allocations; converted._bridge_release = output.memory.allocations ? lb_graph_release : NULL; output.memory.allocations = NULL;
  *out = converted;
done:
  wasmtime_component_val_delete(&arguments[0]);
  wasmtime_component_val_delete(&result);
  lb_scope_close(&input.memory); lb_scope_close(&output.memory);
  return failure;
}


wasmtime_error_t *recursivecheckedrecords_wasmtime_value_groups(recursivecheckedrecords_wasmtime *session, const recursivecheckedrecords_graph_bf065e9a21862d87767f_t *arg0, recursivecheckedrecords_scalar_nat_t *out) {
  const char *package_failure = lb_package_failure();
  if (package_failure) return wasmtime_error_new(package_failure);
  if (!lb_buffer(out, 1, sizeof(*out), _Alignof(recursivecheckedrecords_scalar_nat_t)) || out->_bridge_owner || out->_bridge_release) return wasmtime_error_new("Graph output requires a fresh initialized slot");
  lb_graph_scope input = {.memory = {.remaining = LB_GRAPH_BYTES}, .nodes = LB_GRAPH_NODES};
  lb_graph_scope output = {.memory = {.remaining = LB_GRAPH_BYTES}, .nodes = LB_GRAPH_NODES};
  wasmtime_error_t *failure = NULL;
  wasmtime_component_val_t arguments[1] = {{0}};
  wasmtime_component_val_t result = {0};
  recursivecheckedrecords_scalar_nat_t converted = {0};
  if (!lb_graph_encode_0(arg0, &input, &arguments[0])) { failure = wasmtime_error_new("Invalid native graph input, allocation failure or conversion limit"); goto done; }
  failure = recursivecheckedrecords_wasmtime_call(session, "groups", arguments, 1, &result);
  if (failure) goto done;
  if (!lb_graph_decode_3(&result, &output, &converted)) {
    if (!output.memory.failure) lean_bridge_native_runtime_retire();
    failure = wasmtime_error_new(output.memory.failure ? "Graph result conversion limit or allocation failure" : "Malformed WIT graph result; runtime retired"); goto done;
  }
  converted._bridge_owner = output.memory.allocations; converted._bridge_release = output.memory.allocations ? lb_graph_release : NULL; output.memory.allocations = NULL;
  *out = converted;
done:
  wasmtime_component_val_delete(&arguments[0]);
  wasmtime_component_val_delete(&result);
  lb_scope_close(&input.memory); lb_scope_close(&output.memory);
  return failure;
}


wasmtime_error_t *recursivecheckedrecords_wasmtime_value_produce(recursivecheckedrecords_wasmtime *session, const recursivecheckedrecords_scalar_nat_t *arg0, recursivecheckedrecords_packet_t *out) {
  const char *package_failure = lb_package_failure();
  if (package_failure) return wasmtime_error_new(package_failure);
  if (!lb_buffer(out, 1, sizeof(*out), _Alignof(recursivecheckedrecords_packet_t)) || out->_bridge_owner || out->_bridge_release) return wasmtime_error_new("Graph output requires a fresh initialized slot");
  lb_graph_scope input = {.memory = {.remaining = LB_GRAPH_BYTES}, .nodes = LB_GRAPH_NODES};
  lb_graph_scope output = {.memory = {.remaining = LB_GRAPH_BYTES}, .nodes = LB_GRAPH_NODES};
  wasmtime_error_t *failure = NULL;
  wasmtime_component_val_t arguments[1] = {{0}};
  wasmtime_component_val_t result = {0};
  recursivecheckedrecords_packet_t converted = {0};
  if (!lb_graph_encode_3(arg0, &input, &arguments[0])) { failure = wasmtime_error_new("Invalid native graph input, allocation failure or conversion limit"); goto done; }
  failure = recursivecheckedrecords_wasmtime_call(session, "produce", arguments, 1, &result);
  if (failure) goto done;
  if (!lb_graph_decode_2(&result, &output, &converted)) {
    if (!output.memory.failure) lean_bridge_native_runtime_retire();
    failure = wasmtime_error_new(output.memory.failure ? "Graph result conversion limit or allocation failure" : "Malformed WIT graph result; runtime retired"); goto done;
  }
  converted._bridge_owner = output.memory.allocations; converted._bridge_release = output.memory.allocations ? lb_graph_release : NULL; output.memory.allocations = NULL;
  *out = converted;
done:
  wasmtime_component_val_delete(&arguments[0]);
  wasmtime_component_val_delete(&result);
  lb_scope_close(&input.memory); lb_scope_close(&output.memory);
  return failure;
}


wasmtime_error_t *recursivecheckedrecords_wasmtime_value_second(recursivecheckedrecords_wasmtime *session, const recursivecheckedrecords_packet_t *arg0, recursivecheckedrecords_scalar_nat_t *out) {
  const char *package_failure = lb_package_failure();
  if (package_failure) return wasmtime_error_new(package_failure);
  if (!lb_buffer(out, 1, sizeof(*out), _Alignof(recursivecheckedrecords_scalar_nat_t)) || out->_bridge_owner || out->_bridge_release) return wasmtime_error_new("Graph output requires a fresh initialized slot");
  lb_graph_scope input = {.memory = {.remaining = LB_GRAPH_BYTES}, .nodes = LB_GRAPH_NODES};
  lb_graph_scope output = {.memory = {.remaining = LB_GRAPH_BYTES}, .nodes = LB_GRAPH_NODES};
  wasmtime_error_t *failure = NULL;
  wasmtime_component_val_t arguments[1] = {{0}};
  wasmtime_component_val_t result = {0};
  recursivecheckedrecords_scalar_nat_t converted = {0};
  if (!lb_graph_encode_2(arg0, &input, &arguments[0])) { failure = wasmtime_error_new("Invalid native graph input, allocation failure or conversion limit"); goto done; }
  failure = recursivecheckedrecords_wasmtime_call(session, "second", arguments, 1, &result);
  if (failure) goto done;
  if (!lb_graph_decode_3(&result, &output, &converted)) {
    if (!output.memory.failure) lean_bridge_native_runtime_retire();
    failure = wasmtime_error_new(output.memory.failure ? "Graph result conversion limit or allocation failure" : "Malformed WIT graph result; runtime retired"); goto done;
  }
  converted._bridge_owner = output.memory.allocations; converted._bridge_release = output.memory.allocations ? lb_graph_release : NULL; output.memory.allocations = NULL;
  *out = converted;
done:
  wasmtime_component_val_delete(&arguments[0]);
  wasmtime_component_val_delete(&result);
  lb_scope_close(&input.memory); lb_scope_close(&output.memory);
  return failure;
}

