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
  {"libcomponent_7f8bfe55e5831a9133c5.so", UINT64_C(90800), "2e275d73caf7f0f531dac887cee6833e3bb953d5098bc94483c2e82a04171990"},
  {"liblean_bridge_native.so", UINT64_C(21464), "25bb83c98a7f86c15c8f5a5181457943beae8e9052ce059cf11df47060cdb5f7"},
  {"libleanshared.so", UINT64_C(158401256), "d7768b88d8162736da4305777cd6f147676038fd885bd8a265c958b0ecea00b4"},
  {"libnominalsubtypes.so", UINT64_C(53952), "ca835c86669d3cfcdb28cb28807d6e76d516c5671171729a85d17e25d0683570"},
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
#include "nominalsubtypes_wasmtime.h"
#include "nominalsubtypes.h"
#include <stdint.h>
#include <stdlib.h>
#include <string.h>

_Static_assert(sizeof(bool) == 1, "WIT bool validation requires a one-byte representation");
typedef struct lb_allocation { struct lb_allocation *next; } lb_allocation;
typedef struct { size_t remaining; lb_allocation *allocations; } lb_scope;
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
  if (count && width > scope->remaining / count) return false;
  scope->remaining -= count * width; return true;
}
static inline void *lb_alloc(lb_scope *scope, size_t count, size_t width) {
  if (!count) return NULL;
  if (width > (SIZE_MAX - sizeof(lb_allocation)) / count) return NULL;
  lb_allocation *allocation = calloc(1, sizeof(*allocation) + count * width);
  if (!allocation) return NULL;
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

static inline bool lb_in_0(const wasmtime_component_val_t *value, lb_scope *scope, nominalsubtypes_nat *out) {
  (void)out;
  if (!lb_buffer(value, 1, sizeof(*value), _Alignof(wasmtime_component_val_t)) || (out && !lb_buffer(out, 1, sizeof(*out), _Alignof(nominalsubtypes_nat))) || !lb_charge(scope, 1, sizeof(wasmtime_component_val_t))) return false;
  uint32_t *limbs = NULL; size_t length = 0;
  if (!lb_limbs_in(value, scope, out ? &limbs : NULL, &length)) return false;
  if (out) *out = (nominalsubtypes_nat){.data = limbs, .length = length};
  return true;
}
static inline bool lb_out_0(const nominalsubtypes_nat *value, lb_scope *scope, wasmtime_component_val_t *out) {
  (void)value;
  if (!lb_buffer(value, 1, sizeof(*value), _Alignof(nominalsubtypes_nat)) || !lb_buffer(out, 1, sizeof(*out), _Alignof(wasmtime_component_val_t)) || !lb_charge(scope, 1, sizeof(wasmtime_component_val_t))) return false;
  return lb_limbs_out(value->data, value->length, scope, out);
  return true;
}

static inline bool lb_in_1(const wasmtime_component_val_t *value, lb_scope *scope, nominalsubtypes_array_nat_span *out) {
  (void)out;
  if (!lb_buffer(value, 1, sizeof(*value), _Alignof(wasmtime_component_val_t)) || (out && !lb_buffer(out, 1, sizeof(*out), _Alignof(nominalsubtypes_array_nat_span))) || !lb_charge(scope, 1, sizeof(wasmtime_component_val_t))) return false;
  if (value->kind != WASMTIME_COMPONENT_LIST || !lb_buffer(value->of.list.data, value->of.list.size, sizeof(wasmtime_component_val_t), _Alignof(wasmtime_component_val_t)) || !lb_charge(scope, value->of.list.size, sizeof(wasmtime_component_val_t) + sizeof(nominalsubtypes_nat))) return false;
  nominalsubtypes_nat *items = out ? lb_alloc(scope, value->of.list.size, sizeof(nominalsubtypes_nat)) : NULL;
  if (out && value->of.list.size && !items) return false;
  for (size_t i = 0; i < value->of.list.size; ++i) {
    if (!lb_in_0(&value->of.list.data[i], scope, out ? &items[i] : NULL)) return false;
  }
  if (out) *out = (nominalsubtypes_array_nat_span){.data = items, .length = value->of.list.size};
  return true;
}
static inline bool lb_out_1(const nominalsubtypes_array_nat_span *value, lb_scope *scope, wasmtime_component_val_t *out) {
  (void)value;
  if (!lb_buffer(value, 1, sizeof(*value), _Alignof(nominalsubtypes_array_nat_span)) || !lb_buffer(out, 1, sizeof(*out), _Alignof(wasmtime_component_val_t)) || !lb_charge(scope, 1, sizeof(wasmtime_component_val_t))) return false;
  if (!lb_buffer(value->data, value->length, sizeof(nominalsubtypes_nat), _Alignof(nominalsubtypes_nat)) || !lb_charge(scope, value->length, sizeof(wasmtime_component_val_t))) return false;
  out->kind = WASMTIME_COMPONENT_LIST; wasmtime_component_vallist_new_uninit(&out->of.list, value->length);
  if (value->length) memset(out->of.list.data, 0, value->length * sizeof(*out->of.list.data));
  for (size_t i = 0; i < value->length; ++i) {
    if (!lb_out_0(&value->data[i], scope, &out->of.list.data[i])) return false;
  }
  return true;
}

static inline bool lb_in_2(const wasmtime_component_val_t *value, lb_scope *scope, nominalsubtypes_result_nat_nat_value *out) {
  (void)out;
  if (!lb_buffer(value, 1, sizeof(*value), _Alignof(wasmtime_component_val_t)) || (out && !lb_buffer(out, 1, sizeof(*out), _Alignof(nominalsubtypes_result_nat_nat_value))) || !lb_charge(scope, 1, sizeof(wasmtime_component_val_t))) return false;
  if (value->kind != WASMTIME_COMPONENT_RESULT || !value->of.result.val) return false;
  bool is_ok; if (!lb_boolean(&value->of.result.is_ok, &is_ok)) return false;
  if (out) out->is_ok = is_ok;
  if (is_ok) { if (!lb_in_0(value->of.result.val, scope, out ? &out->ok : NULL)) return false; }
  else if (!lb_in_0(value->of.result.val, scope, out ? &out->error : NULL)) return false;
  return true;
}
static inline bool lb_out_2(const nominalsubtypes_result_nat_nat_value *value, lb_scope *scope, wasmtime_component_val_t *out) {
  (void)value;
  if (!lb_buffer(value, 1, sizeof(*value), _Alignof(nominalsubtypes_result_nat_nat_value)) || !lb_buffer(out, 1, sizeof(*out), _Alignof(wasmtime_component_val_t)) || !lb_charge(scope, 1, sizeof(wasmtime_component_val_t))) return false;
  if (value->is_ok > 1) return false;
  out->kind = WASMTIME_COMPONENT_RESULT; out->of.result.is_ok = value->is_ok;
  wasmtime_component_val_t empty = {0}; out->of.result.val = wasmtime_component_val_new(&empty);
  if (value->is_ok) { if (!lb_out_0(&value->ok, scope, out->of.result.val)) return false; }
  else if (!lb_out_0(&value->error, scope, out->of.result.val)) return false;
  return true;
}

static inline bool lb_in_3(const wasmtime_component_val_t *value, lb_scope *scope, nominalsubtypes_envelope *out) {
  (void)out;
  if (!lb_buffer(value, 1, sizeof(*value), _Alignof(wasmtime_component_val_t)) || (out && !lb_buffer(out, 1, sizeof(*out), _Alignof(nominalsubtypes_envelope))) || !lb_charge(scope, 1, sizeof(wasmtime_component_val_t))) return false;
  if (value->kind != WASMTIME_COMPONENT_RECORD || value->of.record.size != 2 || !lb_buffer(value->of.record.data, 2, sizeof(wasmtime_component_valrecord_entry_t), _Alignof(wasmtime_component_valrecord_entry_t))) return false;
  if (!lb_name(&value->of.record.data[0].name, "payload") || !lb_in_0(&value->of.record.data[0].val, scope, out ? &out->payload : NULL)) return false;
  if (!lb_name(&value->of.record.data[1].name, "digit") || !lb_in_0(&value->of.record.data[1].val, scope, out ? &out->digit : NULL)) return false;
  return true;
}
static inline bool lb_out_3(const nominalsubtypes_envelope *value, lb_scope *scope, wasmtime_component_val_t *out) {
  (void)value;
  if (!lb_buffer(value, 1, sizeof(*value), _Alignof(nominalsubtypes_envelope)) || !lb_buffer(out, 1, sizeof(*out), _Alignof(wasmtime_component_val_t)) || !lb_charge(scope, 1, sizeof(wasmtime_component_val_t))) return false;
  if (!lb_charge(scope, 2, sizeof(wasmtime_component_valrecord_entry_t))) return false;
  out->kind = WASMTIME_COMPONENT_RECORD; wasmtime_component_valrecord_new_uninit(&out->of.record, 2);
  memset(out->of.record.data, 0, 2 * sizeof(*out->of.record.data));
  wasm_name_new(&out->of.record.data[0].name, 7, "payload");
  if (!lb_out_0(&value->payload, scope, &out->of.record.data[0].val)) return false;
  wasm_name_new(&out->of.record.data[1].name, 5, "digit");
  if (!lb_out_0(&value->digit, scope, &out->of.record.data[1].val)) return false;
  return true;
}

static inline bool lb_in_4(const wasmtime_component_val_t *value, lb_scope *scope, nominalsubtypes_option_result_nat_nat_value *out) {
  (void)out;
  if (!lb_buffer(value, 1, sizeof(*value), _Alignof(wasmtime_component_val_t)) || (out && !lb_buffer(out, 1, sizeof(*out), _Alignof(nominalsubtypes_option_result_nat_nat_value))) || !lb_charge(scope, 1, sizeof(wasmtime_component_val_t))) return false;
  if (value->kind != WASMTIME_COMPONENT_OPTION) return false;
  if (out) out->has_value = value->of.option != NULL;
  if (value->of.option && !lb_in_2(value->of.option, scope, out ? &out->value : NULL)) return false;
  return true;
}
static inline bool lb_out_4(const nominalsubtypes_option_result_nat_nat_value *value, lb_scope *scope, wasmtime_component_val_t *out) {
  (void)value;
  if (!lb_buffer(value, 1, sizeof(*value), _Alignof(nominalsubtypes_option_result_nat_nat_value)) || !lb_buffer(out, 1, sizeof(*out), _Alignof(wasmtime_component_val_t)) || !lb_charge(scope, 1, sizeof(wasmtime_component_val_t))) return false;
  if (value->has_value > 1) return false;
  out->kind = WASMTIME_COMPONENT_OPTION; out->of.option = NULL;
  if (value->has_value) {
    wasmtime_component_val_t empty = {0}; out->of.option = wasmtime_component_val_new(&empty);
    if (!lb_out_2(&value->value, scope, out->of.option)) return false;
  }
  return true;
}

static inline bool lb_in_5(const wasmtime_component_val_t *value, lb_scope *scope, nominalsubtypes_array_option_result_nat_nat_span *out) {
  (void)out;
  if (!lb_buffer(value, 1, sizeof(*value), _Alignof(wasmtime_component_val_t)) || (out && !lb_buffer(out, 1, sizeof(*out), _Alignof(nominalsubtypes_array_option_result_nat_nat_span))) || !lb_charge(scope, 1, sizeof(wasmtime_component_val_t))) return false;
  if (value->kind != WASMTIME_COMPONENT_LIST || !lb_buffer(value->of.list.data, value->of.list.size, sizeof(wasmtime_component_val_t), _Alignof(wasmtime_component_val_t)) || !lb_charge(scope, value->of.list.size, sizeof(wasmtime_component_val_t) + sizeof(nominalsubtypes_option_result_nat_nat_value))) return false;
  nominalsubtypes_option_result_nat_nat_value *items = out ? lb_alloc(scope, value->of.list.size, sizeof(nominalsubtypes_option_result_nat_nat_value)) : NULL;
  if (out && value->of.list.size && !items) return false;
  for (size_t i = 0; i < value->of.list.size; ++i) {
    if (!lb_in_4(&value->of.list.data[i], scope, out ? &items[i] : NULL)) return false;
  }
  if (out) *out = (nominalsubtypes_array_option_result_nat_nat_span){.data = items, .length = value->of.list.size};
  return true;
}
static inline bool lb_out_5(const nominalsubtypes_array_option_result_nat_nat_span *value, lb_scope *scope, wasmtime_component_val_t *out) {
  (void)value;
  if (!lb_buffer(value, 1, sizeof(*value), _Alignof(nominalsubtypes_array_option_result_nat_nat_span)) || !lb_buffer(out, 1, sizeof(*out), _Alignof(wasmtime_component_val_t)) || !lb_charge(scope, 1, sizeof(wasmtime_component_val_t))) return false;
  if (!lb_buffer(value->data, value->length, sizeof(nominalsubtypes_option_result_nat_nat_value), _Alignof(nominalsubtypes_option_result_nat_nat_value)) || !lb_charge(scope, value->length, sizeof(wasmtime_component_val_t))) return false;
  out->kind = WASMTIME_COMPONENT_LIST; wasmtime_component_vallist_new_uninit(&out->of.list, value->length);
  if (value->length) memset(out->of.list.data, 0, value->length * sizeof(*out->of.list.data));
  for (size_t i = 0; i < value->length; ++i) {
    if (!lb_out_4(&value->data[i], scope, &out->of.list.data[i])) return false;
  }
  return true;
}

static inline bool lb_in_6(const wasmtime_component_val_t *value, lb_scope *scope, nominalsubtypes_event *out) {
  (void)out;
  if (!lb_buffer(value, 1, sizeof(*value), _Alignof(wasmtime_component_val_t)) || (out && !lb_buffer(out, 1, sizeof(*out), _Alignof(nominalsubtypes_event))) || !lb_charge(scope, 1, sizeof(wasmtime_component_val_t))) return false;
  if (value->kind != WASMTIME_COMPONENT_VARIANT) return false;
  if (lb_name(&value->of.variant.discriminant, "empty")) {
    if (value->of.variant.val) return false;
    if (out) out->kind = 0;
  }
  else if (lb_name(&value->of.variant.discriminant, "box")) {
    const wasmtime_component_val_t *payload = value->of.variant.val;
    if (!lb_buffer(payload, 1, sizeof(*payload), _Alignof(wasmtime_component_val_t)) || payload->kind != WASMTIME_COMPONENT_RECORD || payload->of.record.size != 1 || !lb_buffer(payload->of.record.data, 1, sizeof(wasmtime_component_valrecord_entry_t), _Alignof(wasmtime_component_valrecord_entry_t))) return false;
    if (!lb_charge(scope, 1, sizeof(wasmtime_component_valrecord_entry_t))) return false;
    if (out) out->kind = 1;
    if (!lb_name(&payload->of.record.data[0].name, "value") || !lb_in_3(&payload->of.record.data[0].val, scope, out ? &out->cases.box.value : NULL)) return false;
  }
  else if (lb_name(&value->of.variant.discriminant, "choices")) {
    const wasmtime_component_val_t *payload = value->of.variant.val;
    if (!lb_buffer(payload, 1, sizeof(*payload), _Alignof(wasmtime_component_val_t)) || payload->kind != WASMTIME_COMPONENT_RECORD || payload->of.record.size != 1 || !lb_buffer(payload->of.record.data, 1, sizeof(wasmtime_component_valrecord_entry_t), _Alignof(wasmtime_component_valrecord_entry_t))) return false;
    if (!lb_charge(scope, 1, sizeof(wasmtime_component_valrecord_entry_t))) return false;
    if (out) out->kind = 2;
    if (!lb_name(&payload->of.record.data[0].name, "values") || !lb_in_5(&payload->of.record.data[0].val, scope, out ? &out->cases.choices.values : NULL)) return false;
  }
  else return false;
  return true;
}
static inline bool lb_out_6(const nominalsubtypes_event *value, lb_scope *scope, wasmtime_component_val_t *out) {
  (void)value;
  if (!lb_buffer(value, 1, sizeof(*value), _Alignof(nominalsubtypes_event)) || !lb_buffer(out, 1, sizeof(*out), _Alignof(wasmtime_component_val_t)) || !lb_charge(scope, 1, sizeof(wasmtime_component_val_t))) return false;
  if (value->kind >= 3) return false;
  out->kind = WASMTIME_COMPONENT_VARIANT; out->of.variant = (wasmtime_component_valvariant_t){0};
  switch (value->kind) {
  case 0: {
    wasm_name_new(&out->of.variant.discriminant, 5, "empty");
    break;
  }
  case 1: {
    wasm_name_new(&out->of.variant.discriminant, 3, "box");
    if (!lb_charge(scope, 1, sizeof(wasmtime_component_valrecord_entry_t))) return false;
    wasmtime_component_val_t empty = {0}; out->of.variant.val = wasmtime_component_val_new(&empty);
    wasmtime_component_val_t *payload = out->of.variant.val; payload->kind = WASMTIME_COMPONENT_RECORD;
    wasmtime_component_valrecord_new_uninit(&payload->of.record, 1);
    memset(payload->of.record.data, 0, 1 * sizeof(*payload->of.record.data));
    wasm_name_new(&payload->of.record.data[0].name, 5, "value");
    if (!lb_out_3(&value->cases.box.value, scope, &payload->of.record.data[0].val)) return false;
    break;
  }
  case 2: {
    wasm_name_new(&out->of.variant.discriminant, 7, "choices");
    if (!lb_charge(scope, 1, sizeof(wasmtime_component_valrecord_entry_t))) return false;
    wasmtime_component_val_t empty = {0}; out->of.variant.val = wasmtime_component_val_new(&empty);
    wasmtime_component_val_t *payload = out->of.variant.val; payload->kind = WASMTIME_COMPONENT_RECORD;
    wasmtime_component_valrecord_new_uninit(&payload->of.record, 1);
    memset(payload->of.record.data, 0, 1 * sizeof(*payload->of.record.data));
    wasm_name_new(&payload->of.record.data[0].name, 6, "values");
    if (!lb_out_5(&value->cases.choices.values, scope, &payload->of.record.data[0].val)) return false;
    break;
  }
  }
  return true;
}

static inline bool lb_in_7(const wasmtime_component_val_t *value, lb_scope *scope, nominalsubtypes_option_lean_nominal_subtypes_envelope_value *out) {
  (void)out;
  if (!lb_buffer(value, 1, sizeof(*value), _Alignof(wasmtime_component_val_t)) || (out && !lb_buffer(out, 1, sizeof(*out), _Alignof(nominalsubtypes_option_lean_nominal_subtypes_envelope_value))) || !lb_charge(scope, 1, sizeof(wasmtime_component_val_t))) return false;
  if (value->kind != WASMTIME_COMPONENT_OPTION) return false;
  if (out) out->has_value = value->of.option != NULL;
  if (value->of.option && !lb_in_3(value->of.option, scope, out ? &out->value : NULL)) return false;
  return true;
}
static inline bool lb_out_7(const nominalsubtypes_option_lean_nominal_subtypes_envelope_value *value, lb_scope *scope, wasmtime_component_val_t *out) {
  (void)value;
  if (!lb_buffer(value, 1, sizeof(*value), _Alignof(nominalsubtypes_option_lean_nominal_subtypes_envelope_value)) || !lb_buffer(out, 1, sizeof(*out), _Alignof(wasmtime_component_val_t)) || !lb_charge(scope, 1, sizeof(wasmtime_component_val_t))) return false;
  if (value->has_value > 1) return false;
  out->kind = WASMTIME_COMPONENT_OPTION; out->of.option = NULL;
  if (value->has_value) {
    wasmtime_component_val_t empty = {0}; out->of.option = wasmtime_component_val_new(&empty);
    if (!lb_out_3(&value->value, scope, out->of.option)) return false;
  }
  return true;
}

static inline bool lb_in_8(const wasmtime_component_val_t *value, lb_scope *scope, nominalsubtypes_array_option_lean_nominal_subtypes_envelope_span *out) {
  (void)out;
  if (!lb_buffer(value, 1, sizeof(*value), _Alignof(wasmtime_component_val_t)) || (out && !lb_buffer(out, 1, sizeof(*out), _Alignof(nominalsubtypes_array_option_lean_nominal_subtypes_envelope_span))) || !lb_charge(scope, 1, sizeof(wasmtime_component_val_t))) return false;
  if (value->kind != WASMTIME_COMPONENT_LIST || !lb_buffer(value->of.list.data, value->of.list.size, sizeof(wasmtime_component_val_t), _Alignof(wasmtime_component_val_t)) || !lb_charge(scope, value->of.list.size, sizeof(wasmtime_component_val_t) + sizeof(nominalsubtypes_option_lean_nominal_subtypes_envelope_value))) return false;
  nominalsubtypes_option_lean_nominal_subtypes_envelope_value *items = out ? lb_alloc(scope, value->of.list.size, sizeof(nominalsubtypes_option_lean_nominal_subtypes_envelope_value)) : NULL;
  if (out && value->of.list.size && !items) return false;
  for (size_t i = 0; i < value->of.list.size; ++i) {
    if (!lb_in_7(&value->of.list.data[i], scope, out ? &items[i] : NULL)) return false;
  }
  if (out) *out = (nominalsubtypes_array_option_lean_nominal_subtypes_envelope_span){.data = items, .length = value->of.list.size};
  return true;
}
static inline bool lb_out_8(const nominalsubtypes_array_option_lean_nominal_subtypes_envelope_span *value, lb_scope *scope, wasmtime_component_val_t *out) {
  (void)value;
  if (!lb_buffer(value, 1, sizeof(*value), _Alignof(nominalsubtypes_array_option_lean_nominal_subtypes_envelope_span)) || !lb_buffer(out, 1, sizeof(*out), _Alignof(wasmtime_component_val_t)) || !lb_charge(scope, 1, sizeof(wasmtime_component_val_t))) return false;
  if (!lb_buffer(value->data, value->length, sizeof(nominalsubtypes_option_lean_nominal_subtypes_envelope_value), _Alignof(nominalsubtypes_option_lean_nominal_subtypes_envelope_value)) || !lb_charge(scope, value->length, sizeof(wasmtime_component_val_t))) return false;
  out->kind = WASMTIME_COMPONENT_LIST; wasmtime_component_vallist_new_uninit(&out->of.list, value->length);
  if (value->length) memset(out->of.list.data, 0, value->length * sizeof(*out->of.list.data));
  for (size_t i = 0; i < value->length; ++i) {
    if (!lb_out_7(&value->data[i], scope, &out->of.list.data[i])) return false;
  }
  return true;
}

static inline bool lb_in_9(const wasmtime_component_val_t *value, lb_scope *scope, nominalsubtypes_list_nat_span *out) {
  (void)out;
  if (!lb_buffer(value, 1, sizeof(*value), _Alignof(wasmtime_component_val_t)) || (out && !lb_buffer(out, 1, sizeof(*out), _Alignof(nominalsubtypes_list_nat_span))) || !lb_charge(scope, 1, sizeof(wasmtime_component_val_t))) return false;
  if (value->kind != WASMTIME_COMPONENT_LIST || !lb_buffer(value->of.list.data, value->of.list.size, sizeof(wasmtime_component_val_t), _Alignof(wasmtime_component_val_t)) || !lb_charge(scope, value->of.list.size, sizeof(wasmtime_component_val_t) + sizeof(nominalsubtypes_nat))) return false;
  nominalsubtypes_nat *items = out ? lb_alloc(scope, value->of.list.size, sizeof(nominalsubtypes_nat)) : NULL;
  if (out && value->of.list.size && !items) return false;
  for (size_t i = 0; i < value->of.list.size; ++i) {
    if (!lb_in_0(&value->of.list.data[i], scope, out ? &items[i] : NULL)) return false;
  }
  if (out) *out = (nominalsubtypes_list_nat_span){.data = items, .length = value->of.list.size};
  return true;
}
static inline bool lb_out_9(const nominalsubtypes_list_nat_span *value, lb_scope *scope, wasmtime_component_val_t *out) {
  (void)value;
  if (!lb_buffer(value, 1, sizeof(*value), _Alignof(nominalsubtypes_list_nat_span)) || !lb_buffer(out, 1, sizeof(*out), _Alignof(wasmtime_component_val_t)) || !lb_charge(scope, 1, sizeof(wasmtime_component_val_t))) return false;
  if (!lb_buffer(value->data, value->length, sizeof(nominalsubtypes_nat), _Alignof(nominalsubtypes_nat)) || !lb_charge(scope, value->length, sizeof(wasmtime_component_val_t))) return false;
  out->kind = WASMTIME_COMPONENT_LIST; wasmtime_component_vallist_new_uninit(&out->of.list, value->length);
  if (value->length) memset(out->of.list.data, 0, value->length * sizeof(*out->of.list.data));
  for (size_t i = 0; i < value->length; ++i) {
    if (!lb_out_0(&value->data[i], scope, &out->of.list.data[i])) return false;
  }
  return true;
}

static inline bool lb_in_10(const wasmtime_component_val_t *value, lb_scope *scope, nominalsubtypes_option_nat_value *out) {
  (void)out;
  if (!lb_buffer(value, 1, sizeof(*value), _Alignof(wasmtime_component_val_t)) || (out && !lb_buffer(out, 1, sizeof(*out), _Alignof(nominalsubtypes_option_nat_value))) || !lb_charge(scope, 1, sizeof(wasmtime_component_val_t))) return false;
  if (value->kind != WASMTIME_COMPONENT_OPTION) return false;
  if (out) out->has_value = value->of.option != NULL;
  if (value->of.option && !lb_in_0(value->of.option, scope, out ? &out->value : NULL)) return false;
  return true;
}
static inline bool lb_out_10(const nominalsubtypes_option_nat_value *value, lb_scope *scope, wasmtime_component_val_t *out) {
  (void)value;
  if (!lb_buffer(value, 1, sizeof(*value), _Alignof(nominalsubtypes_option_nat_value)) || !lb_buffer(out, 1, sizeof(*out), _Alignof(wasmtime_component_val_t)) || !lb_charge(scope, 1, sizeof(wasmtime_component_val_t))) return false;
  if (value->has_value > 1) return false;
  out->kind = WASMTIME_COMPONENT_OPTION; out->of.option = NULL;
  if (value->has_value) {
    wasmtime_component_val_t empty = {0}; out->of.option = wasmtime_component_val_new(&empty);
    if (!lb_out_0(&value->value, scope, out->of.option)) return false;
  }
  return true;
}

static inline bool lb_in_11(const wasmtime_component_val_t *value, lb_scope *scope, nominalsubtypes_alias_pair *out) {
  (void)out;
  if (!lb_buffer(value, 1, sizeof(*value), _Alignof(wasmtime_component_val_t)) || (out && !lb_buffer(out, 1, sizeof(*out), _Alignof(nominalsubtypes_alias_pair))) || !lb_charge(scope, 1, sizeof(wasmtime_component_val_t))) return false;
  if (value->kind != WASMTIME_COMPONENT_RECORD || value->of.record.size != 2 || !lb_buffer(value->of.record.data, 2, sizeof(wasmtime_component_valrecord_entry_t), _Alignof(wasmtime_component_valrecord_entry_t))) return false;
  if (!lb_name(&value->of.record.data[0].name, "left") || !lb_in_8(&value->of.record.data[0].val, scope, out ? &out->left : NULL)) return false;
  if (!lb_name(&value->of.record.data[1].name, "right") || !lb_in_8(&value->of.record.data[1].val, scope, out ? &out->right : NULL)) return false;
  return true;
}
static inline bool lb_out_11(const nominalsubtypes_alias_pair *value, lb_scope *scope, wasmtime_component_val_t *out) {
  (void)value;
  if (!lb_buffer(value, 1, sizeof(*value), _Alignof(nominalsubtypes_alias_pair)) || !lb_buffer(out, 1, sizeof(*out), _Alignof(wasmtime_component_val_t)) || !lb_charge(scope, 1, sizeof(wasmtime_component_val_t))) return false;
  if (!lb_charge(scope, 2, sizeof(wasmtime_component_valrecord_entry_t))) return false;
  out->kind = WASMTIME_COMPONENT_RECORD; wasmtime_component_valrecord_new_uninit(&out->of.record, 2);
  memset(out->of.record.data, 0, 2 * sizeof(*out->of.record.data));
  wasm_name_new(&out->of.record.data[0].name, 4, "left");
  if (!lb_out_8(&value->left, scope, &out->of.record.data[0].val)) return false;
  wasm_name_new(&out->of.record.data[1].name, 5, "right");
  if (!lb_out_8(&value->right, scope, &out->of.record.data[1].val)) return false;
  return true;
}

static inline bool lb_in_12(const wasmtime_component_val_t *value, lb_scope *scope, nominalsubtypes_tuple_nat_nat_value *out) {
  (void)out;
  if (!lb_buffer(value, 1, sizeof(*value), _Alignof(wasmtime_component_val_t)) || (out && !lb_buffer(out, 1, sizeof(*out), _Alignof(nominalsubtypes_tuple_nat_nat_value))) || !lb_charge(scope, 1, sizeof(wasmtime_component_val_t))) return false;
  if (value->kind != WASMTIME_COMPONENT_TUPLE || value->of.tuple.size != 2 || !lb_buffer(value->of.tuple.data, 2, sizeof(wasmtime_component_val_t), _Alignof(wasmtime_component_val_t))) return false;
  if (!lb_in_0(&value->of.tuple.data[0], scope, out ? &out->fst : NULL)) return false;
  if (!lb_in_0(&value->of.tuple.data[1], scope, out ? &out->snd : NULL)) return false;
  return true;
}
static inline bool lb_out_12(const nominalsubtypes_tuple_nat_nat_value *value, lb_scope *scope, wasmtime_component_val_t *out) {
  (void)value;
  if (!lb_buffer(value, 1, sizeof(*value), _Alignof(nominalsubtypes_tuple_nat_nat_value)) || !lb_buffer(out, 1, sizeof(*out), _Alignof(wasmtime_component_val_t)) || !lb_charge(scope, 1, sizeof(wasmtime_component_val_t))) return false;
  out->kind = WASMTIME_COMPONENT_TUPLE; wasmtime_component_valtuple_new_uninit(&out->of.tuple, 2);
  memset(out->of.tuple.data, 0, 2 * sizeof(*out->of.tuple.data));
  if (!lb_out_0(&value->fst, scope, &out->of.tuple.data[0])) return false;
  if (!lb_out_0(&value->snd, scope, &out->of.tuple.data[1])) return false;
  return true;
}
static wasmtime_error_t *lb_call_0(void *data, wasmtime_context_t *context,
    const wasmtime_component_func_type_t *type, wasmtime_component_val_t *args, size_t count,
    wasmtime_component_val_t *results, size_t result_count) {
  const char *package_failure = lb_package_failure();
  if (package_failure) return wasmtime_error_new(package_failure);
  (void)data; (void)context; (void)type;
  if (count != 1 || result_count != 1 || (1 && !args) || !results)
    return wasmtime_error_new("WIT import signature mismatch");
  lb_scope scope = {.remaining = 16u * 1024u * 1024u};
  wasmtime_error_t *failure = NULL;
  nominalsubtypes_error native_error = {0};
  nominalsubtypes_array_nat_span value = {0};
  wasmtime_component_val_t converted = {0};
  nominalsubtypes_nat value0 = {0};
  if (!lb_in_0(&args[0], &scope, &value0)) { failure = wasmtime_error_new("Invalid copied WIT input, allocation failure or 16 MiB conversion limit"); goto done; }
  if (nominalsubtypes_array_values(&value0, &value, &native_error) != NOMINALSUBTYPES_STATUS_OK) {
    failure = wasmtime_error_new(native_error.message ? native_error.message : "Native Lean call failed"); goto done;
  }
  if (!lb_out_1(&value, &scope, &converted)) { failure = wasmtime_error_new("16 MiB WIT result conversion limit"); goto done; }
  results[0] = converted; converted = (wasmtime_component_val_t){0};
done:
  wasmtime_component_val_delete(&converted);
  nominalsubtypes_array_nat_span_clear(&value);
  lb_scope_close(&scope);
  return failure;
}

static wasmtime_error_t *lb_call_1(void *data, wasmtime_context_t *context,
    const wasmtime_component_func_type_t *type, wasmtime_component_val_t *args, size_t count,
    wasmtime_component_val_t *results, size_t result_count) {
  const char *package_failure = lb_package_failure();
  if (package_failure) return wasmtime_error_new(package_failure);
  (void)data; (void)context; (void)type;
  if (count != 1 || result_count != 1 || (1 && !args) || !results)
    return wasmtime_error_new("WIT import signature mismatch");
  lb_scope scope = {.remaining = 16u * 1024u * 1024u};
  wasmtime_error_t *failure = NULL;
  nominalsubtypes_error native_error = {0};
  nominalsubtypes_result_nat_nat_value value = {0};
  wasmtime_component_val_t converted = {0};
  nominalsubtypes_nat value0 = {0};
  if (!lb_in_0(&args[0], &scope, &value0)) { failure = wasmtime_error_new("Invalid copied WIT input, allocation failure or 16 MiB conversion limit"); goto done; }
  if (nominalsubtypes_branch(&value0, &value, &native_error) != NOMINALSUBTYPES_STATUS_OK) {
    failure = wasmtime_error_new(native_error.message ? native_error.message : "Native Lean call failed"); goto done;
  }
  if (!lb_out_2(&value, &scope, &converted)) { failure = wasmtime_error_new("16 MiB WIT result conversion limit"); goto done; }
  results[0] = converted; converted = (wasmtime_component_val_t){0};
done:
  wasmtime_component_val_delete(&converted);
  nominalsubtypes_result_nat_nat_value_clear(&value);
  lb_scope_close(&scope);
  return failure;
}

static wasmtime_error_t *lb_call_2(void *data, wasmtime_context_t *context,
    const wasmtime_component_func_type_t *type, wasmtime_component_val_t *args, size_t count,
    wasmtime_component_val_t *results, size_t result_count) {
  const char *package_failure = lb_package_failure();
  if (package_failure) return wasmtime_error_new(package_failure);
  (void)data; (void)context; (void)type;
  if (count != 1 || result_count != 1 || (1 && !args) || !results)
    return wasmtime_error_new("WIT import signature mismatch");
  lb_scope scope = {.remaining = 16u * 1024u * 1024u};
  wasmtime_error_t *failure = NULL;
  nominalsubtypes_error native_error = {0};
  nominalsubtypes_event value = {0};
  wasmtime_component_val_t converted = {0};
  nominalsubtypes_nat value0 = {0};
  if (!lb_in_0(&args[0], &scope, &value0)) { failure = wasmtime_error_new("Invalid copied WIT input, allocation failure or 16 MiB conversion limit"); goto done; }
  if (nominalsubtypes_event_choices(&value0, &value, &native_error) != NOMINALSUBTYPES_STATUS_OK) {
    failure = wasmtime_error_new(native_error.message ? native_error.message : "Native Lean call failed"); goto done;
  }
  if (!lb_out_6(&value, &scope, &converted)) { failure = wasmtime_error_new("16 MiB WIT result conversion limit"); goto done; }
  results[0] = converted; converted = (wasmtime_component_val_t){0};
done:
  wasmtime_component_val_delete(&converted);
  nominalsubtypes_event_clear(&value);
  lb_scope_close(&scope);
  return failure;
}

static wasmtime_error_t *lb_call_3(void *data, wasmtime_context_t *context,
    const wasmtime_component_func_type_t *type, wasmtime_component_val_t *args, size_t count,
    wasmtime_component_val_t *results, size_t result_count) {
  const char *package_failure = lb_package_failure();
  if (package_failure) return wasmtime_error_new(package_failure);
  (void)data; (void)context; (void)type;
  if (count != 1 || result_count != 1 || (1 && !args) || !results)
    return wasmtime_error_new("WIT import signature mismatch");
  lb_scope scope = {.remaining = 16u * 1024u * 1024u};
  wasmtime_error_t *failure = NULL;
  nominalsubtypes_error native_error = {0};
  nominalsubtypes_event value = {0};
  wasmtime_component_val_t converted = {0};
  nominalsubtypes_nat value0 = {0};
  if (!lb_in_0(&args[0], &scope, &value0)) { failure = wasmtime_error_new("Invalid copied WIT input, allocation failure or 16 MiB conversion limit"); goto done; }
  if (nominalsubtypes_event_empty(&value0, &value, &native_error) != NOMINALSUBTYPES_STATUS_OK) {
    failure = wasmtime_error_new(native_error.message ? native_error.message : "Native Lean call failed"); goto done;
  }
  if (!lb_out_6(&value, &scope, &converted)) { failure = wasmtime_error_new("16 MiB WIT result conversion limit"); goto done; }
  results[0] = converted; converted = (wasmtime_component_val_t){0};
done:
  wasmtime_component_val_delete(&converted);
  nominalsubtypes_event_clear(&value);
  lb_scope_close(&scope);
  return failure;
}

static wasmtime_error_t *lb_call_4(void *data, wasmtime_context_t *context,
    const wasmtime_component_func_type_t *type, wasmtime_component_val_t *args, size_t count,
    wasmtime_component_val_t *results, size_t result_count) {
  const char *package_failure = lb_package_failure();
  if (package_failure) return wasmtime_error_new(package_failure);
  (void)data; (void)context; (void)type;
  if (count != 1 || result_count != 1 || (1 && !args) || !results)
    return wasmtime_error_new("WIT import signature mismatch");
  lb_scope scope = {.remaining = 16u * 1024u * 1024u};
  wasmtime_error_t *failure = NULL;
  nominalsubtypes_error native_error = {0};
  nominalsubtypes_event value = {0};
  wasmtime_component_val_t converted = {0};
  nominalsubtypes_nat value0 = {0};
  if (!lb_in_0(&args[0], &scope, &value0)) { failure = wasmtime_error_new("Invalid copied WIT input, allocation failure or 16 MiB conversion limit"); goto done; }
  if (nominalsubtypes_event_value(&value0, &value, &native_error) != NOMINALSUBTYPES_STATUS_OK) {
    failure = wasmtime_error_new(native_error.message ? native_error.message : "Native Lean call failed"); goto done;
  }
  if (!lb_out_6(&value, &scope, &converted)) { failure = wasmtime_error_new("16 MiB WIT result conversion limit"); goto done; }
  results[0] = converted; converted = (wasmtime_component_val_t){0};
done:
  wasmtime_component_val_delete(&converted);
  nominalsubtypes_event_clear(&value);
  lb_scope_close(&scope);
  return failure;
}

static wasmtime_error_t *lb_call_5(void *data, wasmtime_context_t *context,
    const wasmtime_component_func_type_t *type, wasmtime_component_val_t *args, size_t count,
    wasmtime_component_val_t *results, size_t result_count) {
  const char *package_failure = lb_package_failure();
  if (package_failure) return wasmtime_error_new(package_failure);
  (void)data; (void)context; (void)type;
  if (count != 1 || result_count != 1 || (1 && !args) || !results)
    return wasmtime_error_new("WIT import signature mismatch");
  lb_scope scope = {.remaining = 16u * 1024u * 1024u};
  wasmtime_error_t *failure = NULL;
  nominalsubtypes_error native_error = {0};
  nominalsubtypes_array_option_lean_nominal_subtypes_envelope_span value = {0};
  wasmtime_component_val_t converted = {0};
  nominalsubtypes_nat value0 = {0};
  if (!lb_in_0(&args[0], &scope, &value0)) { failure = wasmtime_error_new("Invalid copied WIT input, allocation failure or 16 MiB conversion limit"); goto done; }
  if (nominalsubtypes_group_values(&value0, &value, &native_error) != NOMINALSUBTYPES_STATUS_OK) {
    failure = wasmtime_error_new(native_error.message ? native_error.message : "Native Lean call failed"); goto done;
  }
  if (!lb_out_8(&value, &scope, &converted)) { failure = wasmtime_error_new("16 MiB WIT result conversion limit"); goto done; }
  results[0] = converted; converted = (wasmtime_component_val_t){0};
done:
  wasmtime_component_val_delete(&converted);
  nominalsubtypes_array_option_lean_nominal_subtypes_envelope_span_clear(&value);
  lb_scope_close(&scope);
  return failure;
}

static wasmtime_error_t *lb_call_6(void *data, wasmtime_context_t *context,
    const wasmtime_component_func_type_t *type, wasmtime_component_val_t *args, size_t count,
    wasmtime_component_val_t *results, size_t result_count) {
  const char *package_failure = lb_package_failure();
  if (package_failure) return wasmtime_error_new(package_failure);
  (void)data; (void)context; (void)type;
  if (count != 1 || result_count != 1 || (1 && !args) || !results)
    return wasmtime_error_new("WIT import signature mismatch");
  lb_scope scope = {.remaining = 16u * 1024u * 1024u};
  wasmtime_error_t *failure = NULL;
  nominalsubtypes_error native_error = {0};
  nominalsubtypes_list_nat_span value = {0};
  wasmtime_component_val_t converted = {0};
  nominalsubtypes_nat value0 = {0};
  if (!lb_in_0(&args[0], &scope, &value0)) { failure = wasmtime_error_new("Invalid copied WIT input, allocation failure or 16 MiB conversion limit"); goto done; }
  if (nominalsubtypes_list_values(&value0, &value, &native_error) != NOMINALSUBTYPES_STATUS_OK) {
    failure = wasmtime_error_new(native_error.message ? native_error.message : "Native Lean call failed"); goto done;
  }
  if (!lb_out_9(&value, &scope, &converted)) { failure = wasmtime_error_new("16 MiB WIT result conversion limit"); goto done; }
  results[0] = converted; converted = (wasmtime_component_val_t){0};
done:
  wasmtime_component_val_delete(&converted);
  nominalsubtypes_list_nat_span_clear(&value);
  lb_scope_close(&scope);
  return failure;
}

static wasmtime_error_t *lb_call_7(void *data, wasmtime_context_t *context,
    const wasmtime_component_func_type_t *type, wasmtime_component_val_t *args, size_t count,
    wasmtime_component_val_t *results, size_t result_count) {
  const char *package_failure = lb_package_failure();
  if (package_failure) return wasmtime_error_new(package_failure);
  (void)data; (void)context; (void)type;
  if (count != 1 || result_count != 1 || (1 && !args) || !results)
    return wasmtime_error_new("WIT import signature mismatch");
  lb_scope scope = {.remaining = 16u * 1024u * 1024u};
  wasmtime_error_t *failure = NULL;
  nominalsubtypes_error native_error = {0};
  nominalsubtypes_array_nat_span value = {0};
  wasmtime_component_val_t converted = {0};
  nominalsubtypes_nat value0 = {0};
  if (!lb_in_0(&args[0], &scope, &value0)) { failure = wasmtime_error_new("Invalid copied WIT input, allocation failure or 16 MiB conversion limit"); goto done; }
  if (nominalsubtypes_no_items(&value0, &value, &native_error) != NOMINALSUBTYPES_STATUS_OK) {
    failure = wasmtime_error_new(native_error.message ? native_error.message : "Native Lean call failed"); goto done;
  }
  if (!lb_out_1(&value, &scope, &converted)) { failure = wasmtime_error_new("16 MiB WIT result conversion limit"); goto done; }
  results[0] = converted; converted = (wasmtime_component_val_t){0};
done:
  wasmtime_component_val_delete(&converted);
  nominalsubtypes_array_nat_span_clear(&value);
  lb_scope_close(&scope);
  return failure;
}

static wasmtime_error_t *lb_call_8(void *data, wasmtime_context_t *context,
    const wasmtime_component_func_type_t *type, wasmtime_component_val_t *args, size_t count,
    wasmtime_component_val_t *results, size_t result_count) {
  const char *package_failure = lb_package_failure();
  if (package_failure) return wasmtime_error_new(package_failure);
  (void)data; (void)context; (void)type;
  if (count != 1 || result_count != 1 || (1 && !args) || !results)
    return wasmtime_error_new("WIT import signature mismatch");
  lb_scope scope = {.remaining = 16u * 1024u * 1024u};
  wasmtime_error_t *failure = NULL;
  nominalsubtypes_error native_error = {0};
  nominalsubtypes_option_nat_value value = {0};
  wasmtime_component_val_t converted = {0};
  nominalsubtypes_nat value0 = {0};
  if (!lb_in_0(&args[0], &scope, &value0)) { failure = wasmtime_error_new("Invalid copied WIT input, allocation failure or 16 MiB conversion limit"); goto done; }
  if (nominalsubtypes_optional(&value0, &value, &native_error) != NOMINALSUBTYPES_STATUS_OK) {
    failure = wasmtime_error_new(native_error.message ? native_error.message : "Native Lean call failed"); goto done;
  }
  if (!lb_out_10(&value, &scope, &converted)) { failure = wasmtime_error_new("16 MiB WIT result conversion limit"); goto done; }
  results[0] = converted; converted = (wasmtime_component_val_t){0};
done:
  wasmtime_component_val_delete(&converted);
  nominalsubtypes_option_nat_value_clear(&value);
  lb_scope_close(&scope);
  return failure;
}

static wasmtime_error_t *lb_call_9(void *data, wasmtime_context_t *context,
    const wasmtime_component_func_type_t *type, wasmtime_component_val_t *args, size_t count,
    wasmtime_component_val_t *results, size_t result_count) {
  const char *package_failure = lb_package_failure();
  if (package_failure) return wasmtime_error_new(package_failure);
  (void)data; (void)context; (void)type;
  if (count != 1 || result_count != 1 || (1 && !args) || !results)
    return wasmtime_error_new("WIT import signature mismatch");
  lb_scope scope = {.remaining = 16u * 1024u * 1024u};
  wasmtime_error_t *failure = NULL;
  nominalsubtypes_error native_error = {0};
  nominalsubtypes_alias_pair value = {0};
  wasmtime_component_val_t converted = {0};
  nominalsubtypes_nat value0 = {0};
  if (!lb_in_0(&args[0], &scope, &value0)) { failure = wasmtime_error_new("Invalid copied WIT input, allocation failure or 16 MiB conversion limit"); goto done; }
  if (nominalsubtypes_pair_values(&value0, &value, &native_error) != NOMINALSUBTYPES_STATUS_OK) {
    failure = wasmtime_error_new(native_error.message ? native_error.message : "Native Lean call failed"); goto done;
  }
  if (!lb_out_11(&value, &scope, &converted)) { failure = wasmtime_error_new("16 MiB WIT result conversion limit"); goto done; }
  results[0] = converted; converted = (wasmtime_component_val_t){0};
done:
  wasmtime_component_val_delete(&converted);
  nominalsubtypes_alias_pair_clear(&value);
  lb_scope_close(&scope);
  return failure;
}

static wasmtime_error_t *lb_call_10(void *data, wasmtime_context_t *context,
    const wasmtime_component_func_type_t *type, wasmtime_component_val_t *args, size_t count,
    wasmtime_component_val_t *results, size_t result_count) {
  const char *package_failure = lb_package_failure();
  if (package_failure) return wasmtime_error_new(package_failure);
  (void)data; (void)context; (void)type;
  if (count != 1 || result_count != 1 || (1 && !args) || !results)
    return wasmtime_error_new("WIT import signature mismatch");
  lb_scope scope = {.remaining = 16u * 1024u * 1024u};
  wasmtime_error_t *failure = NULL;
  nominalsubtypes_error native_error = {0};
  nominalsubtypes_envelope value = {0};
  wasmtime_component_val_t converted = {0};
  nominalsubtypes_nat value0 = {0};
  if (!lb_in_0(&args[0], &scope, &value0)) { failure = wasmtime_error_new("Invalid copied WIT input, allocation failure or 16 MiB conversion limit"); goto done; }
  if (nominalsubtypes_produce_envelope(&value0, &value, &native_error) != NOMINALSUBTYPES_STATUS_OK) {
    failure = wasmtime_error_new(native_error.message ? native_error.message : "Native Lean call failed"); goto done;
  }
  if (!lb_out_3(&value, &scope, &converted)) { failure = wasmtime_error_new("16 MiB WIT result conversion limit"); goto done; }
  results[0] = converted; converted = (wasmtime_component_val_t){0};
done:
  wasmtime_component_val_delete(&converted);
  nominalsubtypes_envelope_clear(&value);
  lb_scope_close(&scope);
  return failure;
}

static wasmtime_error_t *lb_call_11(void *data, wasmtime_context_t *context,
    const wasmtime_component_func_type_t *type, wasmtime_component_val_t *args, size_t count,
    wasmtime_component_val_t *results, size_t result_count) {
  const char *package_failure = lb_package_failure();
  if (package_failure) return wasmtime_error_new(package_failure);
  (void)data; (void)context; (void)type;
  if (count != 1 || result_count != 1 || (1 && !args) || !results)
    return wasmtime_error_new("WIT import signature mismatch");
  lb_scope scope = {.remaining = 16u * 1024u * 1024u};
  wasmtime_error_t *failure = NULL;
  nominalsubtypes_error native_error = {0};
  nominalsubtypes_tuple_nat_nat_value value = {0};
  wasmtime_component_val_t converted = {0};
  nominalsubtypes_nat value0 = {0};
  if (!lb_in_0(&args[0], &scope, &value0)) { failure = wasmtime_error_new("Invalid copied WIT input, allocation failure or 16 MiB conversion limit"); goto done; }
  if (nominalsubtypes_product(&value0, &value, &native_error) != NOMINALSUBTYPES_STATUS_OK) {
    failure = wasmtime_error_new(native_error.message ? native_error.message : "Native Lean call failed"); goto done;
  }
  if (!lb_out_12(&value, &scope, &converted)) { failure = wasmtime_error_new("16 MiB WIT result conversion limit"); goto done; }
  results[0] = converted; converted = (wasmtime_component_val_t){0};
done:
  wasmtime_component_val_delete(&converted);
  nominalsubtypes_tuple_nat_nat_value_clear(&value);
  lb_scope_close(&scope);
  return failure;
}

static wasmtime_error_t *lb_call_12(void *data, wasmtime_context_t *context,
    const wasmtime_component_func_type_t *type, wasmtime_component_val_t *args, size_t count,
    wasmtime_component_val_t *results, size_t result_count) {
  const char *package_failure = lb_package_failure();
  if (package_failure) return wasmtime_error_new(package_failure);
  (void)data; (void)context; (void)type;
  if (count != 1 || result_count != 1 || (1 && !args) || !results)
    return wasmtime_error_new("WIT import signature mismatch");
  lb_scope scope = {.remaining = 16u * 1024u * 1024u};
  wasmtime_error_t *failure = NULL;
  nominalsubtypes_error native_error = {0};
  nominalsubtypes_nat value = {0};
  wasmtime_component_val_t converted = {0};
  nominalsubtypes_nat value0 = {0};
  if (!lb_in_0(&args[0], &scope, &value0)) { failure = wasmtime_error_new("Invalid copied WIT input, allocation failure or 16 MiB conversion limit"); goto done; }
  if (nominalsubtypes_scalar(&value0, &value, &native_error) != NOMINALSUBTYPES_STATUS_OK) {
    failure = wasmtime_error_new(native_error.message ? native_error.message : "Native Lean call failed"); goto done;
  }
  if (!lb_out_0(&value, &scope, &converted)) { failure = wasmtime_error_new("16 MiB WIT result conversion limit"); goto done; }
  results[0] = converted; converted = (wasmtime_component_val_t){0};
done:
  wasmtime_component_val_delete(&converted);
  nominalsubtypes_nat_clear(&value);
  lb_scope_close(&scope);
  return failure;
}

static const uint8_t lb_component[] = {0,97,115,109,13,0,1,0,7,223,6,1,66,62,1,112,121,1,112,121,4,0,14,98,114,105,100,103,101,45,118,97,108,117,101,45,48,3,0,1,1,112,2,4,0,14,98,114,105,100,103,101,45,118,97,108,117,101,45,49,3,0,3,1,106,1,2,1,2,4,0,14,98,114,105,100,103,101,45,118,97,108,117,101,45,50,3,0,5,1,114,2,7,112,97,121,108,111,97,100,2,5,100,105,103,105,116,2,4,0,8,101,110,118,101,108,111,112,101,3,0,7,1,107,6,4,0,14,98,114,105,100,103,101,45,118,97,108,117,101,45,52,3,0,9,1,112,10,4,0,14,98,114,105,100,103,101,45,118,97,108,117,101,45,53,3,0,11,1,114,1,5,118,97,108,117,101,8,4,0,16,101,118,101,110,116,45,98,111,120,45,102,105,101,108,100,115,3,0,13,1,114,1,6,118,97,108,117,101,115,12,4,0,20,101,118,101,110,116,45,99,104,111,105,99,101,115,45,102,105,101,108,100,115,3,0,15,1,113,3,5,101,109,112,116,121,0,0,3,98,111,120,1,14,0,7,99,104,111,105,99,101,115,1,16,0,4,0,5,101,118,101,110,116,3,0,17,1,107,8,4,0,14,98,114,105,100,103,101,45,118,97,108,117,101,45,55,3,0,19,1,112,20,4,0,14,98,114,105,100,103,101,45,118,97,108,117,101,45,56,3,0,21,1,112,2,4,0,14,98,114,105,100,103,101,45,118,97,108,117,101,45,57,3,0,23,1,107,2,4,0,15,98,114,105,100,103,101,45,118,97,108,117,101,45,49,48,3,0,25,4,0,14,101,110,118,101,108,111,112,101,45,97,108,105,97,115,3,0,8,1,107,27,4,0,21,98,114,105,100,103,101,45,97,108,105,97,115,45,118,97,108,117,101,45,49,52,3,0,28,1,112,29,4,0,21,98,114,105,100,103,101,45,97,108,105,97,115,45,118,97,108,117,101,45,49,53,3,0,30,1,114,2,4,108,101,102,116,31,5,114,105,103,104,116,31,4,0,10,97,108,105,97,115,45,112,97,105,114,3,0,32,1,111,2,2,2,4,0,15,98,114,105,100,103,101,45,118,97,108,117,101,45,49,50,3,0,34,1,64,1,6,118,97,108,117,101,48,2,0,4,4,0,12,97,114,114,97,121,45,118,97,108,117,101,115,1,36,1,64,1,6,118,97,108,117,101,48,2,0,6,4,0,6,98,114,97,110,99,104,1,37,1,64,1,6,118,97,108,117,101,48,2,0,18,4,0,13,101,118,101,110,116,45,99,104,111,105,99,101,115,1,38,1,64,1,6,118,97,108,117,101,48,2,0,18,4,0,11,101,118,101,110,116,45,101,109,112,116,121,1,39,1,64,1,6,118,97,108,117,101,48,2,0,18,4,0,11,101,118,101,110,116,45,118,97,108,117,101,1,40,1,64,1,6,118,97,108,117,101,48,2,0,31,4,0,12,103,114,111,117,112,45,118,97,108,117,101,115,1,41,1,64,1,6,118,97,108,117,101,48,2,0,24,4,0,11,108,105,115,116,45,118,97,108,117,101,115,1,42,1,64,1,6,118,97,108,117,101,48,2,0,4,4,0,8,110,111,45,105,116,101,109,115,1,43,1,64,1,6,118,97,108,117,101,48,2,0,26,4,0,8,111,112,116,105,111,110,97,108,1,44,1,64,1,6,118,97,108,117,101,48,2,0,33,4,0,11,112,97,105,114,45,118,97,108,117,101,115,1,45,1,64,1,6,118,97,108,117,101,48,2,0,8,4,0,16,112,114,111,100,117,99,101,45,101,110,118,101,108,111,112,101,1,46,1,64,1,6,118,97,108,117,101,48,2,0,35,4,0,7,112,114,111,100,117,99,116,1,47,1,64,1,6,118,97,108,117,101,48,2,0,2,4,0,6,115,99,97,108,97,114,1,48,10,45,1,0,40,108,101,97,110,45,98,114,105,100,103,101,58,110,111,109,105,110,97,108,115,117,98,116,121,112,101,115,47,110,97,116,105,118,101,64,49,46,48,46,48,5,0,6,130,4,31,3,0,0,14,98,114,105,100,103,101,45,118,97,108,117,101,45,48,3,0,0,14,98,114,105,100,103,101,45,118,97,108,117,101,45,49,3,0,0,14,98,114,105,100,103,101,45,118,97,108,117,101,45,50,3,0,0,8,101,110,118,101,108,111,112,101,3,0,0,14,98,114,105,100,103,101,45,118,97,108,117,101,45,52,3,0,0,14,98,114,105,100,103,101,45,118,97,108,117,101,45,53,3,0,0,16,101,118,101,110,116,45,98,111,120,45,102,105,101,108,100,115,3,0,0,20,101,118,101,110,116,45,99,104,111,105,99,101,115,45,102,105,101,108,100,115,3,0,0,5,101,118,101,110,116,3,0,0,14,98,114,105,100,103,101,45,118,97,108,117,101,45,55,3,0,0,14,98,114,105,100,103,101,45,118,97,108,117,101,45,56,3,0,0,14,98,114,105,100,103,101,45,118,97,108,117,101,45,57,3,0,0,15,98,114,105,100,103,101,45,118,97,108,117,101,45,49,48,3,0,0,14,101,110,118,101,108,111,112,101,45,97,108,105,97,115,3,0,0,21,98,114,105,100,103,101,45,97,108,105,97,115,45,118,97,108,117,101,45,49,52,3,0,0,21,98,114,105,100,103,101,45,97,108,105,97,115,45,118,97,108,117,101,45,49,53,3,0,0,10,97,108,105,97,115,45,112,97,105,114,3,0,0,15,98,114,105,100,103,101,45,118,97,108,117,101,45,49,50,1,0,0,12,97,114,114,97,121,45,118,97,108,117,101,115,1,0,0,6,98,114,97,110,99,104,1,0,0,13,101,118,101,110,116,45,99,104,111,105,99,101,115,1,0,0,11,101,118,101,110,116,45,101,109,112,116,121,1,0,0,11,101,118,101,110,116,45,118,97,108,117,101,1,0,0,12,103,114,111,117,112,45,118,97,108,117,101,115,1,0,0,11,108,105,115,116,45,118,97,108,117,101,115,1,0,0,8,110,111,45,105,116,101,109,115,1,0,0,8,111,112,116,105,111,110,97,108,1,0,0,11,112,97,105,114,45,118,97,108,117,101,115,1,0,0,16,112,114,111,100,117,99,101,45,101,110,118,101,108,111,112,101,1,0,0,7,112,114,111,100,117,99,116,1,0,0,6,115,99,97,108,97,114,1,230,2,0,97,115,109,1,0,0,0,1,25,5,96,4,127,127,127,127,1,127,96,1,127,0,96,1,126,0,96,1,125,0,96,1,124,0,3,6,5,0,1,2,3,4,5,5,1,1,1,128,8,6,6,1,127,1,65,16,11,7,64,6,6,109,101,109,111,114,121,2,0,7,114,101,97,108,108,111,99,0,0,8,112,111,115,116,45,105,51,50,0,1,8,112,111,115,116,45,105,54,52,0,2,8,112,111,115,116,45,102,51,50,0,3,8,112,111,115,116,45,102,54,52,0,4,10,147,1,5,117,1,3,127,32,3,69,4,64,65,0,15,11,35,0,32,2,65,1,107,106,65,0,32,2,107,113,33,4,32,4,32,3,106,33,5,32,5,32,4,73,32,5,65,128,128,128,32,75,114,4,64,0,11,32,5,65,255,255,3,106,65,16,118,33,6,32,6,63,0,75,4,64,32,6,63,0,107,64,0,65,127,70,4,64,0,11,11,32,0,4,64,32,4,32,0,32,1,32,3,32,1,32,3,73,27,252,10,0,0,11,32,5,36,0,32,4,11,6,0,65,16,36,0,11,6,0,65,16,36,0,11,6,0,65,16,36,0,11,6,0,65,16,36,0,11,0,82,4,110,97,109,101,0,10,9,97,108,108,111,99,97,116,111,114,2,54,1,0,7,0,3,111,108,100,1,8,111,108,100,45,115,105,122,101,2,9,97,108,105,103,110,109,101,110,116,3,4,115,105,122,101,4,5,115,116,97,114,116,5,3,101,110,100,6,5,112,97,103,101,115,7,7,1,0,4,104,101,97,112,2,4,1,0,0,0,6,76,6,0,2,1,0,6,109,101,109,111,114,121,0,0,1,0,7,114,101,97,108,108,111,99,0,0,1,0,8,112,111,115,116,45,105,51,50,0,0,1,0,8,112,111,115,116,45,105,54,52,0,0,1,0,8,112,111,115,116,45,102,51,50,0,0,1,0,8,112,111,115,116,45,102,54,52,8,105,13,1,0,0,2,3,0,4,0,1,0,1,2,3,0,4,0,1,0,2,2,3,0,4,0,1,0,3,2,3,0,4,0,1,0,4,2,3,0,4,0,1,0,5,2,3,0,4,0,1,0,6,2,3,0,4,0,1,0,7,2,3,0,4,0,1,0,8,2,3,0,4,0,1,0,9,2,3,0,4,0,1,0,10,2,3,0,4,0,1,0,11,2,3,0,4,0,1,0,12,2,3,0,4,0,1,211,6,0,97,115,109,1,0,0,0,1,21,3,96,4,127,127,127,127,1,127,96,3,127,127,127,0,96,2,127,127,1,127,2,155,1,14,10,97,108,108,111,99,97,116,105,111,110,7,114,101,97,108,108,111,99,0,0,4,104,111,115,116,2,102,48,0,1,4,104,111,115,116,2,102,49,0,1,4,104,111,115,116,2,102,50,0,1,4,104,111,115,116,2,102,51,0,1,4,104,111,115,116,2,102,52,0,1,4,104,111,115,116,2,102,53,0,1,4,104,111,115,116,2,102,54,0,1,4,104,111,115,116,2,102,55,0,1,4,104,111,115,116,2,102,56,0,1,4,104,111,115,116,2,102,57,0,1,4,104,111,115,116,3,102,49,48,0,1,4,104,111,115,116,3,102,49,49,0,1,4,104,111,115,116,3,102,49,50,0,1,3,14,13,2,2,2,2,2,2,2,2,2,2,2,2,2,7,69,13,2,102,48,0,14,2,102,49,0,15,2,102,50,0,16,2,102,51,0,17,2,102,52,0,18,2,102,53,0,19,2,102,54,0,20,2,102,55,0,21,2,102,56,0,22,2,102,57,0,23,3,102,49,48,0,24,3,102,49,49,0,25,3,102,49,50,0,26,10,224,2,13,26,1,1,127,65,0,65,0,65,4,65,8,16,0,33,2,32,0,32,1,32,2,16,1,32,2,11,26,1,1,127,65,0,65,0,65,4,65,12,16,0,33,2,32,0,32,1,32,2,16,2,32,2,11,26,1,1,127,65,0,65,0,65,4,65,20,16,0,33,2,32,0,32,1,32,2,16,3,32,2,11,26,1,1,127,65,0,65,0,65,4,65,20,16,0,33,2,32,0,32,1,32,2,16,4,32,2,11,26,1,1,127,65,0,65,0,65,4,65,20,16,0,33,2,32,0,32,1,32,2,16,5,32,2,11,26,1,1,127,65,0,65,0,65,4,65,8,16,0,33,2,32,0,32,1,32,2,16,6,32,2,11,26,1,1,127,65,0,65,0,65,4,65,8,16,0,33,2,32,0,32,1,32,2,16,7,32,2,11,26,1,1,127,65,0,65,0,65,4,65,8,16,0,33,2,32,0,32,1,32,2,16,8,32,2,11,26,1,1,127,65,0,65,0,65,4,65,12,16,0,33,2,32,0,32,1,32,2,16,9,32,2,11,26,1,1,127,65,0,65,0,65,4,65,16,16,0,33,2,32,0,32,1,32,2,16,10,32,2,11,26,1,1,127,65,0,65,0,65,4,65,16,16,0,33,2,32,0,32,1,32,2,16,11,32,2,11,26,1,1,127,65,0,65,0,65,4,65,16,16,0,33,2,32,0,32,1,32,2,16,12,32,2,11,26,1,1,127,65,0,65,0,65,4,65,8,16,0,33,2,32,0,32,1,32,2,16,13,32,2,11,0,217,1,4,110,97,109,101,0,8,7,102,111,114,119,97,114,100,1,66,14,0,8,97,108,108,111,99,97,116,101,1,2,102,48,2,2,102,49,3,2,102,50,4,2,102,51,5,2,102,52,6,2,102,53,7,2,102,54,8,2,102,55,9,2,102,56,10,2,102,57,11,3,102,49,48,12,3,102,49,49,13,3,102,49,50,2,131,1,13,14,1,2,6,114,101,115,117,108,116,15,1,2,6,114,101,115,117,108,116,16,1,2,6,114,101,115,117,108,116,17,1,2,6,114,101,115,117,108,116,18,1,2,6,114,101,115,117,108,116,19,1,2,6,114,101,115,117,108,116,20,1,2,6,114,101,115,117,108,116,21,1,2,6,114,101,115,117,108,116,22,1,2,6,114,101,115,117,108,116,23,1,2,6,114,101,115,117,108,116,24,1,2,6,114,101,115,117,108,116,25,1,2,6,114,101,115,117,108,116,26,1,2,6,114,101,115,117,108,116,2,94,2,1,13,2,102,48,0,5,2,102,49,0,6,2,102,50,0,7,2,102,51,0,8,2,102,52,0,9,2,102,53,0,10,2,102,54,0,11,2,102,55,0,12,2,102,56,0,13,2,102,57,0,14,3,102,49,48,0,15,3,102,49,49,0,16,3,102,49,50,0,17,0,1,2,10,97,108,108,111,99,97,116,105,111,110,18,0,4,104,111,115,116,18,1,6,95,13,0,0,1,2,2,102,48,0,0,1,2,2,102,49,0,0,1,2,2,102,50,0,0,1,2,2,102,51,0,0,1,2,2,102,52,0,0,1,2,2,102,53,0,0,1,2,2,102,54,0,0,1,2,2,102,55,0,0,1,2,2,102,56,0,0,1,2,2,102,57,0,0,1,2,3,102,49,48,0,0,1,2,3,102,49,49,0,0,1,2,3,102,49,50,7,13,1,64,1,6,118,97,108,117,101,48,1,0,2,8,12,1,0,0,18,3,3,0,4,0,5,1,19,7,13,1,64,1,6,118,97,108,117,101,48,1,0,3,8,12,1,0,0,19,3,3,0,4,0,5,1,20,7,13,1,64,1,6,118,97,108,117,101,48,1,0,9,8,12,1,0,0,20,3,3,0,4,0,5,1,21,7,13,1,64,1,6,118,97,108,117,101,48,1,0,9,8,12,1,0,0,21,3,3,0,4,0,5,1,22,7,13,1,64,1,6,118,97,108,117,101,48,1,0,9,8,12,1,0,0,22,3,3,0,4,0,5,1,23,7,13,1,64,1,6,118,97,108,117,101,48,1,0,16,8,12,1,0,0,23,3,3,0,4,0,5,1,24,7,13,1,64,1,6,118,97,108,117,101,48,1,0,12,8,12,1,0,0,24,3,3,0,4,0,5,1,25,7,13,1,64,1,6,118,97,108,117,101,48,1,0,2,8,12,1,0,0,25,3,3,0,4,0,5,1,26,7,13,1,64,1,6,118,97,108,117,101,48,1,0,13,8,12,1,0,0,26,3,3,0,4,0,5,1,27,7,13,1,64,1,6,118,97,108,117,101,48,1,0,17,8,12,1,0,0,27,3,3,0,4,0,5,1,28,7,13,1,64,1,6,118,97,108,117,101,48,1,0,4,8,12,1,0,0,28,3,3,0,4,0,5,1,29,7,13,1,64,1,6,118,97,108,117,101,48,1,0,18,8,12,1,0,0,29,3,3,0,4,0,5,1,30,7,13,1,64,1,6,118,97,108,117,101,48,1,0,1,8,12,1,0,0,30,3,3,0,4,0,5,1,31,7,184,6,1,66,62,2,3,2,1,1,4,0,14,98,114,105,100,103,101,45,118,97,108,117,101,45,48,3,0,0,2,3,2,1,2,4,0,14,98,114,105,100,103,101,45,118,97,108,117,101,45,49,3,0,2,2,3,2,1,3,4,0,14,98,114,105,100,103,101,45,118,97,108,117,101,45,50,3,0,4,2,3,2,1,4,4,0,8,101,110,118,101,108,111,112,101,3,0,6,2,3,2,1,5,4,0,14,98,114,105,100,103,101,45,118,97,108,117,101,45,52,3,0,8,2,3,2,1,6,4,0,14,98,114,105,100,103,101,45,118,97,108,117,101,45,53,3,0,10,2,3,2,1,7,4,0,16,101,118,101,110,116,45,98,111,120,45,102,105,101,108,100,115,3,0,12,2,3,2,1,8,4,0,20,101,118,101,110,116,45,99,104,111,105,99,101,115,45,102,105,101,108,100,115,3,0,14,2,3,2,1,9,4,0,5,101,118,101,110,116,3,0,16,2,3,2,1,10,4,0,14,98,114,105,100,103,101,45,118,97,108,117,101,45,55,3,0,18,2,3,2,1,11,4,0,14,98,114,105,100,103,101,45,118,97,108,117,101,45,56,3,0,20,2,3,2,1,12,4,0,14,98,114,105,100,103,101,45,118,97,108,117,101,45,57,3,0,22,2,3,2,1,13,4,0,15,98,114,105,100,103,101,45,118,97,108,117,101,45,49,48,3,0,24,2,3,2,1,14,4,0,14,101,110,118,101,108,111,112,101,45,97,108,105,97,115,3,0,26,2,3,2,1,15,4,0,21,98,114,105,100,103,101,45,97,108,105,97,115,45,118,97,108,117,101,45,49,52,3,0,28,2,3,2,1,16,4,0,21,98,114,105,100,103,101,45,97,108,105,97,115,45,118,97,108,117,101,45,49,53,3,0,30,2,3,2,1,17,4,0,10,97,108,105,97,115,45,112,97,105,114,3,0,32,2,3,2,1,18,4,0,15,98,114,105,100,103,101,45,118,97,108,117,101,45,49,50,3,0,34,1,64,1,6,118,97,108,117,101,48,1,0,3,4,0,12,97,114,114,97,121,45,118,97,108,117,101,115,1,36,1,64,1,6,118,97,108,117,101,48,1,0,5,4,0,6,98,114,97,110,99,104,1,37,1,64,1,6,118,97,108,117,101,48,1,0,17,4,0,13,101,118,101,110,116,45,99,104,111,105,99,101,115,1,38,1,64,1,6,118,97,108,117,101,48,1,0,17,4,0,11,101,118,101,110,116,45,101,109,112,116,121,1,39,1,64,1,6,118,97,108,117,101,48,1,0,17,4,0,11,101,118,101,110,116,45,118,97,108,117,101,1,40,1,64,1,6,118,97,108,117,101,48,1,0,31,4,0,12,103,114,111,117,112,45,118,97,108,117,101,115,1,41,1,64,1,6,118,97,108,117,101,48,1,0,23,4,0,11,108,105,115,116,45,118,97,108,117,101,115,1,42,1,64,1,6,118,97,108,117,101,48,1,0,3,4,0,8,110,111,45,105,116,101,109,115,1,43,1,64,1,6,118,97,108,117,101,48,1,0,25,4,0,8,111,112,116,105,111,110,97,108,1,44,1,64,1,6,118,97,108,117,101,48,1,0,33,4,0,11,112,97,105,114,45,118,97,108,117,101,115,1,45,1,64,1,6,118,97,108,117,101,48,1,0,7,4,0,16,112,114,111,100,117,99,101,45,101,110,118,101,108,111,112,101,1,46,1,64,1,6,118,97,108,117,101,48,1,0,35,4,0,7,112,114,111,100,117,99,116,1,47,1,64,1,6,118,97,108,117,101,48,1,0,1,4,0,6,115,99,97,108,97,114,1,48,5,132,4,1,1,31,0,14,98,114,105,100,103,101,45,118,97,108,117,101,45,48,3,1,0,14,98,114,105,100,103,101,45,118,97,108,117,101,45,49,3,2,0,14,98,114,105,100,103,101,45,118,97,108,117,101,45,50,3,3,0,8,101,110,118,101,108,111,112,101,3,4,0,14,98,114,105,100,103,101,45,118,97,108,117,101,45,52,3,5,0,14,98,114,105,100,103,101,45,118,97,108,117,101,45,53,3,6,0,16,101,118,101,110,116,45,98,111,120,45,102,105,101,108,100,115,3,7,0,20,101,118,101,110,116,45,99,104,111,105,99,101,115,45,102,105,101,108,100,115,3,8,0,5,101,118,101,110,116,3,9,0,14,98,114,105,100,103,101,45,118,97,108,117,101,45,55,3,10,0,14,98,114,105,100,103,101,45,118,97,108,117,101,45,56,3,11,0,14,98,114,105,100,103,101,45,118,97,108,117,101,45,57,3,12,0,15,98,114,105,100,103,101,45,118,97,108,117,101,45,49,48,3,13,0,14,101,110,118,101,108,111,112,101,45,97,108,105,97,115,3,14,0,21,98,114,105,100,103,101,45,97,108,105,97,115,45,118,97,108,117,101,45,49,52,3,15,0,21,98,114,105,100,103,101,45,97,108,105,97,115,45,118,97,108,117,101,45,49,53,3,16,0,10,97,108,105,97,115,45,112,97,105,114,3,17,0,15,98,114,105,100,103,101,45,118,97,108,117,101,45,49,50,3,18,0,12,97,114,114,97,121,45,118,97,108,117,101,115,1,13,0,6,98,114,97,110,99,104,1,14,0,13,101,118,101,110,116,45,99,104,111,105,99,101,115,1,15,0,11,101,118,101,110,116,45,101,109,112,116,121,1,16,0,11,101,118,101,110,116,45,118,97,108,117,101,1,17,0,12,103,114,111,117,112,45,118,97,108,117,101,115,1,18,0,11,108,105,115,116,45,118,97,108,117,101,115,1,19,0,8,110,111,45,105,116,101,109,115,1,20,0,8,111,112,116,105,111,110,97,108,1,21,0,11,112,97,105,114,45,118,97,108,117,101,115,1,22,0,16,112,114,111,100,117,99,101,45,101,110,118,101,108,111,112,101,1,23,0,7,112,114,111,100,117,99,116,1,24,0,6,115,99,97,108,97,114,1,25,11,45,1,0,37,108,101,97,110,45,98,114,105,100,103,101,58,110,111,109,105,110,97,108,115,117,98,116,121,112,101,115,47,97,112,105,64,49,46,48,46,48,5,1,1,5,32,0,237,5,14,99,111,109,112,111,110,101,110,116,45,110,97,109,101,1,164,2,0,0,31,0,7,114,101,97,108,108,111,99,1,8,112,111,115,116,45,105,51,50,2,8,112,111,115,116,45,105,54,52,3,8,112,111,115,116,45,102,51,50,4,8,112,111,115,116,45,102,54,52,5,6,108,111,119,101,114,48,6,6,108,111,119,101,114,49,7,6,108,111,119,101,114,50,8,6,108,111,119,101,114,51,9,6,108,111,119,101,114,52,10,6,108,111,119,101,114,53,11,6,108,111,119,101,114,54,12,6,108,111,119,101,114,55,13,6,108,111,119,101,114,56,14,6,108,111,119,101,114,57,15,7,108,111,119,101,114,49,48,16,7,108,111,119,101,114,49,49,17,7,108,111,119,101,114,49,50,18,8,102,111,114,119,97,114,100,48,19,8,102,111,114,119,97,114,100,49,20,8,102,111,114,119,97,114,100,50,21,8,102,111,114,119,97,114,100,51,22,8,102,111,114,119,97,114,100,52,23,8,102,111,114,119,97,114,100,53,24,8,102,111,114,119,97,114,100,54,25,8,102,111,114,119,97,114,100,55,26,8,102,111,114,119,97,114,100,56,27,8,102,111,114,119,97,114,100,57,28,9,102,111,114,119,97,114,100,49,48,29,9,102,111,114,119,97,114,100,49,49,30,9,102,111,114,119,97,114,100,49,50,1,11,0,2,1,0,6,109,101,109,111,114,121,1,23,0,17,2,0,9,97,108,108,111,99,97,116,111,114,1,7,102,111,114,119,97,114,100,1,35,0,18,3,0,10,97,108,108,111,99,97,116,105,111,110,1,7,105,109,112,111,114,116,115,2,9,102,111,114,119,97,114,100,101,100,1,151,1,1,26,0,5,104,111,115,116,48,1,5,104,111,115,116,49,2,5,104,111,115,116,50,3,5,104,111,115,116,51,4,5,104,111,115,116,52,5,5,104,111,115,116,53,6,5,104,111,115,116,54,7,5,104,111,115,116,55,8,5,104,111,115,116,56,9,5,104,111,115,116,57,10,6,104,111,115,116,49,48,11,6,104,111,115,116,49,49,12,6,104,111,115,116,49,50,13,2,102,48,14,2,102,49,15,2,102,50,16,2,102,51,17,2,102,52,18,2,102,53,19,2,102,54,20,2,102,55,21,2,102,56,22,2,102,57,23,3,102,49,48,24,3,102,49,49,25,3,102,49,50,1,189,1,3,20,0,3,97,112,105,1,7,112,117,98,108,105,99,48,2,7,112,117,98,108,105,99,49,3,7,112,117,98,108,105,99,50,4,7,112,117,98,108,105,99,51,5,7,112,117,98,108,105,99,52,6,7,112,117,98,108,105,99,53,7,8,112,117,98,108,105,99,49,54,8,8,112,117,98,108,105,99,49,55,9,7,112,117,98,108,105,99,54,10,7,112,117,98,108,105,99,55,11,7,112,117,98,108,105,99,56,12,7,112,117,98,108,105,99,57,13,8,112,117,98,108,105,99,49,48,14,8,112,117,98,108,105,99,49,51,15,8,112,117,98,108,105,99,49,52,16,8,112,117,98,108,105,99,49,53,17,8,112,117,98,108,105,99,49,49,18,8,112,117,98,108,105,99,49,50,32,10,112,117,98,108,105,99,45,97,112,105,1,16,5,2,0,4,104,111,115,116,1,6,112,117,98,108,105,99};
struct nominalsubtypes_wasmtime {
  wasm_engine_t *engine;
  wasmtime_component_t *component;
  wasmtime_store_t *store;
  wasmtime_component_linker_t *linker;
  wasmtime_component_instance_t instance;
};
wasmtime_error_t *nominalsubtypes_wasmtime_link(wasmtime_component_linker_t *linker) {
  const char *package_failure = lb_package_failure();
  if (package_failure) return wasmtime_error_new(package_failure);
  if (!linker) return wasmtime_error_new("Missing Wasmtime linker");
  wasmtime_component_linker_instance_t *root = wasmtime_component_linker_root(linker), *host = NULL;
  wasmtime_error_t *error = wasmtime_component_linker_instance_add_instance(root, "lean-bridge:nominalsubtypes/native@1.0.0", 40, &host);
  if (!error) {
    if (!error) error = wasmtime_component_linker_instance_add_func(host, "array-values", 12, lb_call_0, NULL, NULL);
    if (!error) error = wasmtime_component_linker_instance_add_func(host, "branch", 6, lb_call_1, NULL, NULL);
    if (!error) error = wasmtime_component_linker_instance_add_func(host, "event-choices", 13, lb_call_2, NULL, NULL);
    if (!error) error = wasmtime_component_linker_instance_add_func(host, "event-empty", 11, lb_call_3, NULL, NULL);
    if (!error) error = wasmtime_component_linker_instance_add_func(host, "event-value", 11, lb_call_4, NULL, NULL);
    if (!error) error = wasmtime_component_linker_instance_add_func(host, "group-values", 12, lb_call_5, NULL, NULL);
    if (!error) error = wasmtime_component_linker_instance_add_func(host, "list-values", 11, lb_call_6, NULL, NULL);
    if (!error) error = wasmtime_component_linker_instance_add_func(host, "no-items", 8, lb_call_7, NULL, NULL);
    if (!error) error = wasmtime_component_linker_instance_add_func(host, "optional", 8, lb_call_8, NULL, NULL);
    if (!error) error = wasmtime_component_linker_instance_add_func(host, "pair-values", 11, lb_call_9, NULL, NULL);
    if (!error) error = wasmtime_component_linker_instance_add_func(host, "produce-envelope", 16, lb_call_10, NULL, NULL);
    if (!error) error = wasmtime_component_linker_instance_add_func(host, "product", 7, lb_call_11, NULL, NULL);
    if (!error) error = wasmtime_component_linker_instance_add_func(host, "scalar", 6, lb_call_12, NULL, NULL);
    wasmtime_component_linker_instance_delete(host);
  }
  wasmtime_component_linker_instance_delete(root);
  return error;
}
static wasmtime_error_t *lb_refresh(nominalsubtypes_wasmtime *session) {
  if (session->store) wasmtime_store_delete(session->store);
  session->store = wasmtime_store_new(session->engine, NULL, NULL);
  wasmtime_error_t *error = wasmtime_component_linker_instantiate(session->linker, wasmtime_store_context(session->store), session->component, &session->instance);
  if (error) { wasmtime_store_delete(session->store); session->store = NULL; }
  return error;
}
void nominalsubtypes_wasmtime_close(nominalsubtypes_wasmtime *session) {
  if (getpid() != lb_package_pid) return;
  if (!session) return;
  if (session->linker) wasmtime_component_linker_delete(session->linker);
  if (session->store) wasmtime_store_delete(session->store);
  if (session->component) wasmtime_component_delete(session->component);
  if (session->engine) wasm_engine_delete(session->engine);
  free(session);
}
wasmtime_error_t *nominalsubtypes_wasmtime_open(nominalsubtypes_wasmtime **out) {
  const char *package_failure = lb_package_failure();
  if (package_failure) return wasmtime_error_new(package_failure);
  if (!out) return wasmtime_error_new("Missing session output");
  nominalsubtypes_wasmtime *session = calloc(1, sizeof(*session));
  if (!session) return wasmtime_error_new("Cannot allocate Wasmtime session");
  wasm_config_t *config = wasm_config_new();
  if (!config) { free(session); return wasmtime_error_new("Cannot allocate Wasmtime configuration"); }
  wasmtime_config_wasm_component_model_set(config, true);
  session->engine = wasm_engine_new_with_config(config);
  wasmtime_error_t *error = wasmtime_component_new(session->engine, lb_component, sizeof(lb_component), &session->component);
  if (!error) {
    session->linker = wasmtime_component_linker_new(session->engine);
    error = nominalsubtypes_wasmtime_link(session->linker);
    if (!error) error = lb_refresh(session);
  }
  if (error) { nominalsubtypes_wasmtime_close(session); return error; }
  *out = session; return NULL;
}
wasmtime_error_t *nominalsubtypes_wasmtime_call(nominalsubtypes_wasmtime *session, const char *name,
    const wasmtime_component_val_t *args, size_t count, wasmtime_component_val_t *out) {
  const char *package_failure = lb_package_failure();
  if (package_failure) return wasmtime_error_new(package_failure);
  if (!session || !session->store || !name || !out || (count && !args)) return wasmtime_error_new("Invalid WIT call arguments or unavailable session");
  /* Validate before Wasmtime copies caller buffers, including allocation bounds. */
  lb_scope scope = {.remaining = 16u * 1024u * 1024u};
  (void)scope; /* A package may contain only zero-argument exports. */
  bool valid = false;
  if (strcmp(name, "array-values") == 0) valid = count == 1 && lb_in_0(&args[0], &scope, NULL);
  if (strcmp(name, "branch") == 0) valid = count == 1 && lb_in_0(&args[0], &scope, NULL);
  if (strcmp(name, "event-choices") == 0) valid = count == 1 && lb_in_0(&args[0], &scope, NULL);
  if (strcmp(name, "event-empty") == 0) valid = count == 1 && lb_in_0(&args[0], &scope, NULL);
  if (strcmp(name, "event-value") == 0) valid = count == 1 && lb_in_0(&args[0], &scope, NULL);
  if (strcmp(name, "group-values") == 0) valid = count == 1 && lb_in_0(&args[0], &scope, NULL);
  if (strcmp(name, "list-values") == 0) valid = count == 1 && lb_in_0(&args[0], &scope, NULL);
  if (strcmp(name, "no-items") == 0) valid = count == 1 && lb_in_0(&args[0], &scope, NULL);
  if (strcmp(name, "optional") == 0) valid = count == 1 && lb_in_0(&args[0], &scope, NULL);
  if (strcmp(name, "pair-values") == 0) valid = count == 1 && lb_in_0(&args[0], &scope, NULL);
  if (strcmp(name, "produce-envelope") == 0) valid = count == 1 && lb_in_0(&args[0], &scope, NULL);
  if (strcmp(name, "product") == 0) valid = count == 1 && lb_in_0(&args[0], &scope, NULL);
  if (strcmp(name, "scalar") == 0) valid = count == 1 && lb_in_0(&args[0], &scope, NULL);
  if (!valid) return wasmtime_error_new("Unknown export, invalid WIT input or 16 MiB conversion limit");
  wasmtime_context_t *context = wasmtime_store_context(session->store);
  wasmtime_component_export_index_t *api = wasmtime_component_instance_get_export_index(&session->instance, context, NULL, "lean-bridge:nominalsubtypes/api@1.0.0", 37);
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

