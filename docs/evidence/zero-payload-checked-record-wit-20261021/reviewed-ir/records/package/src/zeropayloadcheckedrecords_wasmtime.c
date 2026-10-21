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
  {"libcomponent_d43d7c5a9f170f3ce127.so", UINT64_C(44776), "99757ffd528089839276986cecbacc46ff50f89c9c9d51ddfaa77e680091384a"},
  {"liblean_bridge_native.so", UINT64_C(21632), "459fcd2098d4b646ab6ae0f4cdccd1f222908cb162562bfc3940a533cd4e4e21"},
  {"libleanshared.so", UINT64_C(158401256), "d7768b88d8162736da4305777cd6f147676038fd885bd8a265c958b0ecea00b4"},
  {"libwasmtime.so", UINT64_C(22277728), "566e57cfeabafd6d44fab1b5e6660b4569a71aae4cff2e4d89563a424ee799f3"},
  {"libzeropayloadcheckedrecords.so", UINT64_C(41008), "0e5597b960e36703438c54db29b3c2a99aeadfbfeefc0b5ca86b386c5e465e07"}
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
#include "zeropayloadcheckedrecords_wasmtime.h"
#include "zeropayloadcheckedrecords.h"
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

static inline bool lb_in_0(const wasmtime_component_val_t *value, lb_scope *scope, zeropayloadcheckedrecords_witness *out) {
  (void)out;
  if (!lb_buffer(value, 1, sizeof(*value), _Alignof(wasmtime_component_val_t)) || (out && !lb_buffer(out, 1, sizeof(*out), _Alignof(zeropayloadcheckedrecords_witness))) || !lb_charge(scope, 1, sizeof(wasmtime_component_val_t))) return false;
  if (value->kind != WASMTIME_COMPONENT_ENUM || !lb_name(&value->of.enumeration, "empty")) return false;
  return true;
}
static inline bool lb_out_0(const zeropayloadcheckedrecords_witness *value, lb_scope *scope, wasmtime_component_val_t *out) {
  (void)value;
  if (!lb_buffer(value, 1, sizeof(*value), _Alignof(zeropayloadcheckedrecords_witness)) || !lb_buffer(out, 1, sizeof(*out), _Alignof(wasmtime_component_val_t)) || !lb_charge(scope, 1, sizeof(wasmtime_component_val_t))) return false;
  out->kind = WASMTIME_COMPONENT_ENUM; wasm_name_new(&out->of.enumeration, 5, "empty");
  return true;
}

static inline bool lb_in_1(const wasmtime_component_val_t *value, lb_scope *scope, zeropayloadcheckedrecords_nat *out) {
  (void)out;
  if (!lb_buffer(value, 1, sizeof(*value), _Alignof(wasmtime_component_val_t)) || (out && !lb_buffer(out, 1, sizeof(*out), _Alignof(zeropayloadcheckedrecords_nat))) || !lb_charge(scope, 1, sizeof(wasmtime_component_val_t))) return false;
  uint32_t *limbs = NULL; size_t length = 0;
  if (!lb_limbs_in(value, scope, out ? &limbs : NULL, &length)) return false;
  if (out) *out = (zeropayloadcheckedrecords_nat){.data = limbs, .length = length};
  return true;
}
static inline bool lb_out_1(const zeropayloadcheckedrecords_nat *value, lb_scope *scope, wasmtime_component_val_t *out) {
  (void)value;
  if (!lb_buffer(value, 1, sizeof(*value), _Alignof(zeropayloadcheckedrecords_nat)) || !lb_buffer(out, 1, sizeof(*out), _Alignof(wasmtime_component_val_t)) || !lb_charge(scope, 1, sizeof(wasmtime_component_val_t))) return false;
  return lb_limbs_out(value->data, value->length, scope, out);
  return true;
}

static inline bool lb_in_2(const wasmtime_component_val_t *value, lb_scope *scope, zeropayloadcheckedrecords_mark *out) {
  (void)out;
  if (!lb_buffer(value, 1, sizeof(*value), _Alignof(wasmtime_component_val_t)) || (out && !lb_buffer(out, 1, sizeof(*out), _Alignof(zeropayloadcheckedrecords_mark))) || !lb_charge(scope, 1, sizeof(wasmtime_component_val_t))) return false;
  if (value->kind != WASMTIME_COMPONENT_VARIANT) return false;
  if (lb_name(&value->of.variant.discriminant, "blank")) {
    if (value->of.variant.val) return false;
    if (out) out->kind = 0;
  }
  else if (lb_name(&value->of.variant.discriminant, "marked")) {
    const wasmtime_component_val_t *payload = value->of.variant.val;
    if (!lb_buffer(payload, 1, sizeof(*payload), _Alignof(wasmtime_component_val_t)) || payload->kind != WASMTIME_COMPONENT_RECORD || payload->of.record.size != 1 || !lb_buffer(payload->of.record.data, 1, sizeof(wasmtime_component_valrecord_entry_t), _Alignof(wasmtime_component_valrecord_entry_t))) return false;
    if (!lb_charge(scope, 1, sizeof(wasmtime_component_valrecord_entry_t))) return false;
    if (out) out->kind = 1;
    if (!lb_name(&payload->of.record.data[0].name, "witness") || !lb_in_0(&payload->of.record.data[0].val, scope, out ? &out->cases.marked.witness : NULL)) return false;
  }
  else return false;
  return true;
}
static inline bool lb_out_2(const zeropayloadcheckedrecords_mark *value, lb_scope *scope, wasmtime_component_val_t *out) {
  (void)value;
  if (!lb_buffer(value, 1, sizeof(*value), _Alignof(zeropayloadcheckedrecords_mark)) || !lb_buffer(out, 1, sizeof(*out), _Alignof(wasmtime_component_val_t)) || !lb_charge(scope, 1, sizeof(wasmtime_component_val_t))) return false;
  if (value->kind >= 2) return false;
  out->kind = WASMTIME_COMPONENT_VARIANT; out->of.variant = (wasmtime_component_valvariant_t){0};
  switch (value->kind) {
  case 0: {
    wasm_name_new(&out->of.variant.discriminant, 5, "blank");
    break;
  }
  case 1: {
    wasm_name_new(&out->of.variant.discriminant, 6, "marked");
    if (!lb_charge(scope, 1, sizeof(wasmtime_component_valrecord_entry_t))) return false;
    wasmtime_component_val_t empty = {0}; out->of.variant.val = wasmtime_component_val_new(&empty);
    wasmtime_component_val_t *payload = out->of.variant.val; payload->kind = WASMTIME_COMPONENT_RECORD;
    wasmtime_component_valrecord_new_uninit(&payload->of.record, 1);
    memset(payload->of.record.data, 0, 1 * sizeof(*payload->of.record.data));
    wasm_name_new(&payload->of.record.data[0].name, 7, "witness");
    if (!lb_out_0(&value->cases.marked.witness, scope, &payload->of.record.data[0].val)) return false;
    break;
  }
  }
  return true;
}

static inline bool lb_in_3(const wasmtime_component_val_t *value, lb_scope *scope, zeropayloadcheckedrecords_marker *out) {
  (void)out;
  if (!lb_buffer(value, 1, sizeof(*value), _Alignof(wasmtime_component_val_t)) || (out && !lb_buffer(out, 1, sizeof(*out), _Alignof(zeropayloadcheckedrecords_marker))) || !lb_charge(scope, 1, sizeof(wasmtime_component_val_t))) return false;
  if (value->kind != WASMTIME_COMPONENT_ENUM || !lb_name(&value->of.enumeration, "empty")) return false;
  return true;
}
static inline bool lb_out_3(const zeropayloadcheckedrecords_marker *value, lb_scope *scope, wasmtime_component_val_t *out) {
  (void)value;
  if (!lb_buffer(value, 1, sizeof(*value), _Alignof(zeropayloadcheckedrecords_marker)) || !lb_buffer(out, 1, sizeof(*out), _Alignof(wasmtime_component_val_t)) || !lb_charge(scope, 1, sizeof(wasmtime_component_val_t))) return false;
  out->kind = WASMTIME_COMPONENT_ENUM; wasm_name_new(&out->of.enumeration, 5, "empty");
  return true;
}

static inline bool lb_in_4(const wasmtime_component_val_t *value, lb_scope *scope, bool *out) {
  (void)out;
  if (!lb_buffer(value, 1, sizeof(*value), _Alignof(wasmtime_component_val_t)) || (out && !lb_buffer(out, 1, sizeof(*out), _Alignof(bool))) || !lb_charge(scope, 1, sizeof(wasmtime_component_val_t))) return false;
  if (value->kind != WASMTIME_COMPONENT_BOOL) return false;
  bool boolean; if (!lb_boolean(&value->of.boolean, &boolean)) return false;
  if (out) *out = boolean;
  return true;
}
static inline bool lb_out_4(const bool *value, lb_scope *scope, wasmtime_component_val_t *out) {
  (void)value;
  if (!lb_buffer(value, 1, sizeof(*value), _Alignof(bool)) || !lb_buffer(out, 1, sizeof(*out), _Alignof(wasmtime_component_val_t)) || !lb_charge(scope, 1, sizeof(wasmtime_component_val_t))) return false;
  bool boolean; if (!lb_boolean(value, &boolean)) return false;
  out->kind = WASMTIME_COMPONENT_BOOL; out->of.boolean = boolean;
  return true;
}

static inline bool lb_in_5(const wasmtime_component_val_t *value, lb_scope *scope, zeropayloadcheckedrecords_option_lean_zero_payload_checked_records_witness_value *out) {
  (void)out;
  if (!lb_buffer(value, 1, sizeof(*value), _Alignof(wasmtime_component_val_t)) || (out && !lb_buffer(out, 1, sizeof(*out), _Alignof(zeropayloadcheckedrecords_option_lean_zero_payload_checked_records_witness_value))) || !lb_charge(scope, 1, sizeof(wasmtime_component_val_t))) return false;
  if (value->kind != WASMTIME_COMPONENT_OPTION) return false;
  if (out) out->has_value = value->of.option != NULL;
  if (value->of.option && !lb_in_0(value->of.option, scope, out ? &out->value : NULL)) return false;
  return true;
}
static inline bool lb_out_5(const zeropayloadcheckedrecords_option_lean_zero_payload_checked_records_witness_value *value, lb_scope *scope, wasmtime_component_val_t *out) {
  (void)value;
  if (!lb_buffer(value, 1, sizeof(*value), _Alignof(zeropayloadcheckedrecords_option_lean_zero_payload_checked_records_witness_value)) || !lb_buffer(out, 1, sizeof(*out), _Alignof(wasmtime_component_val_t)) || !lb_charge(scope, 1, sizeof(wasmtime_component_val_t))) return false;
  if (value->has_value > 1) return false;
  out->kind = WASMTIME_COMPONENT_OPTION; out->of.option = NULL;
  if (value->has_value) {
    wasmtime_component_val_t empty = {0}; out->of.option = wasmtime_component_val_new(&empty);
    if (!lb_out_0(&value->value, scope, out->of.option)) return false;
  }
  return true;
}

static inline bool lb_in_6(const wasmtime_component_val_t *value, lb_scope *scope, uint8_t *out) {
  (void)out;
  if (!lb_buffer(value, 1, sizeof(*value), _Alignof(wasmtime_component_val_t)) || (out && !lb_buffer(out, 1, sizeof(*out), _Alignof(uint8_t))) || !lb_charge(scope, 1, sizeof(wasmtime_component_val_t))) return false;
  if (value->kind != WASMTIME_COMPONENT_ENUM || !lb_name(&value->of.enumeration, "unit")) return false;
  if (out) *out = 0;
  return true;
}
static inline bool lb_out_6(const uint8_t *value, lb_scope *scope, wasmtime_component_val_t *out) {
  (void)value;
  if (!lb_buffer(value, 1, sizeof(*value), _Alignof(uint8_t)) || !lb_buffer(out, 1, sizeof(*out), _Alignof(wasmtime_component_val_t)) || !lb_charge(scope, 1, sizeof(wasmtime_component_val_t))) return false;
  if (*value) return false;
  out->kind = WASMTIME_COMPONENT_ENUM; wasm_name_new(&out->of.enumeration, 4, "unit");
  return true;
}

static inline bool lb_in_7(const wasmtime_component_val_t *value, lb_scope *scope, zeropayloadcheckedrecords_token *out) {
  (void)out;
  if (!lb_buffer(value, 1, sizeof(*value), _Alignof(wasmtime_component_val_t)) || (out && !lb_buffer(out, 1, sizeof(*out), _Alignof(zeropayloadcheckedrecords_token))) || !lb_charge(scope, 1, sizeof(wasmtime_component_val_t))) return false;
  if (value->kind != WASMTIME_COMPONENT_RECORD || value->of.record.size != 1 || !lb_buffer(value->of.record.data, 1, sizeof(wasmtime_component_valrecord_entry_t), _Alignof(wasmtime_component_valrecord_entry_t))) return false;
  if (!lb_name(&value->of.record.data[0].name, "tag") || !lb_in_6(&value->of.record.data[0].val, scope, out ? &out->tag : NULL)) return false;
  return true;
}
static inline bool lb_out_7(const zeropayloadcheckedrecords_token *value, lb_scope *scope, wasmtime_component_val_t *out) {
  (void)value;
  if (!lb_buffer(value, 1, sizeof(*value), _Alignof(zeropayloadcheckedrecords_token)) || !lb_buffer(out, 1, sizeof(*out), _Alignof(wasmtime_component_val_t)) || !lb_charge(scope, 1, sizeof(wasmtime_component_val_t))) return false;
  if (!lb_charge(scope, 1, sizeof(wasmtime_component_valrecord_entry_t))) return false;
  out->kind = WASMTIME_COMPONENT_RECORD; wasmtime_component_valrecord_new_uninit(&out->of.record, 1);
  memset(out->of.record.data, 0, 1 * sizeof(*out->of.record.data));
  wasm_name_new(&out->of.record.data[0].name, 3, "tag");
  if (!lb_out_6(&value->tag, scope, &out->of.record.data[0].val)) return false;
  return true;
}

static inline bool lb_in_8(const wasmtime_component_val_t *value, lb_scope *scope, zeropayloadcheckedrecords_array_lean_zero_payload_checked_records_witness_span *out) {
  (void)out;
  if (!lb_buffer(value, 1, sizeof(*value), _Alignof(wasmtime_component_val_t)) || (out && !lb_buffer(out, 1, sizeof(*out), _Alignof(zeropayloadcheckedrecords_array_lean_zero_payload_checked_records_witness_span))) || !lb_charge(scope, 1, sizeof(wasmtime_component_val_t))) return false;
  if (value->kind != WASMTIME_COMPONENT_LIST || !lb_buffer(value->of.list.data, value->of.list.size, sizeof(wasmtime_component_val_t), _Alignof(wasmtime_component_val_t)) || !lb_charge(scope, value->of.list.size, sizeof(wasmtime_component_val_t) + sizeof(zeropayloadcheckedrecords_witness))) return false;
  zeropayloadcheckedrecords_witness *items = out ? lb_alloc(scope, value->of.list.size, sizeof(zeropayloadcheckedrecords_witness)) : NULL;
  if (out && value->of.list.size && !items) return false;
  for (size_t i = 0; i < value->of.list.size; ++i) {
    if (!lb_in_0(&value->of.list.data[i], scope, out ? &items[i] : NULL)) return false;
  }
  if (out) *out = (zeropayloadcheckedrecords_array_lean_zero_payload_checked_records_witness_span){.data = items, .length = value->of.list.size};
  return true;
}
static inline bool lb_out_8(const zeropayloadcheckedrecords_array_lean_zero_payload_checked_records_witness_span *value, lb_scope *scope, wasmtime_component_val_t *out) {
  (void)value;
  if (!lb_buffer(value, 1, sizeof(*value), _Alignof(zeropayloadcheckedrecords_array_lean_zero_payload_checked_records_witness_span)) || !lb_buffer(out, 1, sizeof(*out), _Alignof(wasmtime_component_val_t)) || !lb_charge(scope, 1, sizeof(wasmtime_component_val_t))) return false;
  if (!lb_buffer(value->data, value->length, sizeof(zeropayloadcheckedrecords_witness), _Alignof(zeropayloadcheckedrecords_witness)) || !lb_charge(scope, value->length, sizeof(wasmtime_component_val_t))) return false;
  out->kind = WASMTIME_COMPONENT_LIST; wasmtime_component_vallist_new_uninit(&out->of.list, value->length);
  if (value->length) memset(out->of.list.data, 0, value->length * sizeof(*out->of.list.data));
  for (size_t i = 0; i < value->length; ++i) {
    if (!lb_out_0(&value->data[i], scope, &out->of.list.data[i])) return false;
  }
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
  zeropayloadcheckedrecords_error native_error = {0};
  zeropayloadcheckedrecords_nat value = {0};
  wasmtime_component_val_t converted = {0};
  zeropayloadcheckedrecords_witness value0 = {0};
  if (!lb_in_0(&args[0], &scope, &value0)) { failure = wasmtime_error_new("Invalid copied WIT input, allocation failure or 16 MiB conversion limit"); goto done; }
  if (zeropayloadcheckedrecords_absent_count(&value0, &value, &native_error) != ZEROPAYLOADCHECKEDRECORDS_STATUS_OK) {
    failure = wasmtime_error_new(native_error.message ? native_error.message : "Native Lean call failed"); goto done;
  }
  if (!lb_out_1(&value, &scope, &converted)) { failure = wasmtime_error_new("16 MiB WIT result conversion limit"); goto done; }
  results[0] = converted; converted = (wasmtime_component_val_t){0};
done:
  wasmtime_component_val_delete(&converted);
  zeropayloadcheckedrecords_nat_clear(&value);
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
  zeropayloadcheckedrecords_error native_error = {0};
  zeropayloadcheckedrecords_nat value = {0};
  wasmtime_component_val_t converted = {0};
  zeropayloadcheckedrecords_mark value0 = {0};
  if (!lb_in_2(&args[0], &scope, &value0)) { failure = wasmtime_error_new("Invalid copied WIT input, allocation failure or 16 MiB conversion limit"); goto done; }
  if (zeropayloadcheckedrecords_mark_count(&value0, &value, &native_error) != ZEROPAYLOADCHECKEDRECORDS_STATUS_OK) {
    failure = wasmtime_error_new(native_error.message ? native_error.message : "Native Lean call failed"); goto done;
  }
  if (!lb_out_1(&value, &scope, &converted)) { failure = wasmtime_error_new("16 MiB WIT result conversion limit"); goto done; }
  results[0] = converted; converted = (wasmtime_component_val_t){0};
done:
  wasmtime_component_val_delete(&converted);
  zeropayloadcheckedrecords_nat_clear(&value);
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
  zeropayloadcheckedrecords_error native_error = {0};
  zeropayloadcheckedrecords_nat value = {0};
  wasmtime_component_val_t converted = {0};
  zeropayloadcheckedrecords_marker value0 = {0};
  if (!lb_in_3(&args[0], &scope, &value0)) { failure = wasmtime_error_new("Invalid copied WIT input, allocation failure or 16 MiB conversion limit"); goto done; }
  if (zeropayloadcheckedrecords_marker_count(&value0, &value, &native_error) != ZEROPAYLOADCHECKEDRECORDS_STATUS_OK) {
    failure = wasmtime_error_new(native_error.message ? native_error.message : "Native Lean call failed"); goto done;
  }
  if (!lb_out_1(&value, &scope, &converted)) { failure = wasmtime_error_new("16 MiB WIT result conversion limit"); goto done; }
  results[0] = converted; converted = (wasmtime_component_val_t){0};
done:
  wasmtime_component_val_delete(&converted);
  zeropayloadcheckedrecords_nat_clear(&value);
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
  zeropayloadcheckedrecords_error native_error = {0};
  zeropayloadcheckedrecords_option_lean_zero_payload_checked_records_witness_value value = {0};
  wasmtime_component_val_t converted = {0};
  bool value0 = {0};
  if (!lb_in_4(&args[0], &scope, &value0)) { failure = wasmtime_error_new("Invalid copied WIT input, allocation failure or 16 MiB conversion limit"); goto done; }
  if (zeropayloadcheckedrecords_maybe_witness(value0, &value, &native_error) != ZEROPAYLOADCHECKEDRECORDS_STATUS_OK) {
    failure = wasmtime_error_new(native_error.message ? native_error.message : "Native Lean call failed"); goto done;
  }
  if (!lb_out_5(&value, &scope, &converted)) { failure = wasmtime_error_new("16 MiB WIT result conversion limit"); goto done; }
  results[0] = converted; converted = (wasmtime_component_val_t){0};
done:
  wasmtime_component_val_delete(&converted);
  zeropayloadcheckedrecords_option_lean_zero_payload_checked_records_witness_value_clear(&value);
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
  zeropayloadcheckedrecords_error native_error = {0};
  zeropayloadcheckedrecords_mark value = {0};
  wasmtime_component_val_t converted = {0};
  bool value0 = {0};
  if (!lb_in_4(&args[0], &scope, &value0)) { failure = wasmtime_error_new("Invalid copied WIT input, allocation failure or 16 MiB conversion limit"); goto done; }
  if (zeropayloadcheckedrecords_produce_mark(value0, &value, &native_error) != ZEROPAYLOADCHECKEDRECORDS_STATUS_OK) {
    failure = wasmtime_error_new(native_error.message ? native_error.message : "Native Lean call failed"); goto done;
  }
  if (!lb_out_2(&value, &scope, &converted)) { failure = wasmtime_error_new("16 MiB WIT result conversion limit"); goto done; }
  results[0] = converted; converted = (wasmtime_component_val_t){0};
done:
  wasmtime_component_val_delete(&converted);
  zeropayloadcheckedrecords_mark_clear(&value);
  lb_scope_close(&scope);
  return failure;
}

static wasmtime_error_t *lb_call_5(void *data, wasmtime_context_t *context,
    const wasmtime_component_func_type_t *type, wasmtime_component_val_t *args, size_t count,
    wasmtime_component_val_t *results, size_t result_count) {
  const char *package_failure = lb_package_failure();
  if (package_failure) return wasmtime_error_new(package_failure);
  (void)data; (void)context; (void)type;
  if (count != 0 || result_count != 1 || (0 && !args) || !results)
    return wasmtime_error_new("WIT import signature mismatch");
  lb_scope scope = {.remaining = 16u * 1024u * 1024u};
  wasmtime_error_t *failure = NULL;
  zeropayloadcheckedrecords_error native_error = {0};
  zeropayloadcheckedrecords_marker value = {0};
  wasmtime_component_val_t converted = {0};


  if (zeropayloadcheckedrecords_produce_marker(&value, &native_error) != ZEROPAYLOADCHECKEDRECORDS_STATUS_OK) {
    failure = wasmtime_error_new(native_error.message ? native_error.message : "Native Lean call failed"); goto done;
  }
  if (!lb_out_3(&value, &scope, &converted)) { failure = wasmtime_error_new("16 MiB WIT result conversion limit"); goto done; }
  results[0] = converted; converted = (wasmtime_component_val_t){0};
done:
  wasmtime_component_val_delete(&converted);
  zeropayloadcheckedrecords_marker_clear(&value);
  lb_scope_close(&scope);
  return failure;
}

static wasmtime_error_t *lb_call_6(void *data, wasmtime_context_t *context,
    const wasmtime_component_func_type_t *type, wasmtime_component_val_t *args, size_t count,
    wasmtime_component_val_t *results, size_t result_count) {
  const char *package_failure = lb_package_failure();
  if (package_failure) return wasmtime_error_new(package_failure);
  (void)data; (void)context; (void)type;
  if (count != 0 || result_count != 1 || (0 && !args) || !results)
    return wasmtime_error_new("WIT import signature mismatch");
  lb_scope scope = {.remaining = 16u * 1024u * 1024u};
  wasmtime_error_t *failure = NULL;
  zeropayloadcheckedrecords_error native_error = {0};
  zeropayloadcheckedrecords_token value = {0};
  wasmtime_component_val_t converted = {0};


  if (zeropayloadcheckedrecords_produce_token(&value, &native_error) != ZEROPAYLOADCHECKEDRECORDS_STATUS_OK) {
    failure = wasmtime_error_new(native_error.message ? native_error.message : "Native Lean call failed"); goto done;
  }
  if (!lb_out_7(&value, &scope, &converted)) { failure = wasmtime_error_new("16 MiB WIT result conversion limit"); goto done; }
  results[0] = converted; converted = (wasmtime_component_val_t){0};
done:
  wasmtime_component_val_delete(&converted);
  zeropayloadcheckedrecords_token_clear(&value);
  lb_scope_close(&scope);
  return failure;
}

static wasmtime_error_t *lb_call_7(void *data, wasmtime_context_t *context,
    const wasmtime_component_func_type_t *type, wasmtime_component_val_t *args, size_t count,
    wasmtime_component_val_t *results, size_t result_count) {
  const char *package_failure = lb_package_failure();
  if (package_failure) return wasmtime_error_new(package_failure);
  (void)data; (void)context; (void)type;
  if (count != 0 || result_count != 1 || (0 && !args) || !results)
    return wasmtime_error_new("WIT import signature mismatch");
  lb_scope scope = {.remaining = 16u * 1024u * 1024u};
  wasmtime_error_t *failure = NULL;
  zeropayloadcheckedrecords_error native_error = {0};
  zeropayloadcheckedrecords_witness value = {0};
  wasmtime_component_val_t converted = {0};


  if (zeropayloadcheckedrecords_produce_witness(&value, &native_error) != ZEROPAYLOADCHECKEDRECORDS_STATUS_OK) {
    failure = wasmtime_error_new(native_error.message ? native_error.message : "Native Lean call failed"); goto done;
  }
  if (!lb_out_0(&value, &scope, &converted)) { failure = wasmtime_error_new("16 MiB WIT result conversion limit"); goto done; }
  results[0] = converted; converted = (wasmtime_component_val_t){0};
done:
  wasmtime_component_val_delete(&converted);
  zeropayloadcheckedrecords_witness_clear(&value);
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
  zeropayloadcheckedrecords_error native_error = {0};
  uint8_t value = {0};
  wasmtime_component_val_t converted = {0};
  zeropayloadcheckedrecords_token value0 = {0};
  if (!lb_in_7(&args[0], &scope, &value0)) { failure = wasmtime_error_new("Invalid copied WIT input, allocation failure or 16 MiB conversion limit"); goto done; }
  if (zeropayloadcheckedrecords_token_tag(&value0, &native_error) != ZEROPAYLOADCHECKEDRECORDS_STATUS_OK) {
    failure = wasmtime_error_new(native_error.message ? native_error.message : "Native Lean call failed"); goto done;
  }
  if (!lb_out_6(&value, &scope, &converted)) { failure = wasmtime_error_new("16 MiB WIT result conversion limit"); goto done; }
  results[0] = converted; converted = (wasmtime_component_val_t){0};
done:
  wasmtime_component_val_delete(&converted);
  
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
  zeropayloadcheckedrecords_error native_error = {0};
  zeropayloadcheckedrecords_nat value = {0};
  wasmtime_component_val_t converted = {0};
  zeropayloadcheckedrecords_witness value0 = {0};
  if (!lb_in_0(&args[0], &scope, &value0)) { failure = wasmtime_error_new("Invalid copied WIT input, allocation failure or 16 MiB conversion limit"); goto done; }
  if (zeropayloadcheckedrecords_witness_count(&value0, &value, &native_error) != ZEROPAYLOADCHECKEDRECORDS_STATUS_OK) {
    failure = wasmtime_error_new(native_error.message ? native_error.message : "Native Lean call failed"); goto done;
  }
  if (!lb_out_1(&value, &scope, &converted)) { failure = wasmtime_error_new("16 MiB WIT result conversion limit"); goto done; }
  results[0] = converted; converted = (wasmtime_component_val_t){0};
done:
  wasmtime_component_val_delete(&converted);
  zeropayloadcheckedrecords_nat_clear(&value);
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
  zeropayloadcheckedrecords_error native_error = {0};
  zeropayloadcheckedrecords_array_lean_zero_payload_checked_records_witness_span value = {0};
  wasmtime_component_val_t converted = {0};
  zeropayloadcheckedrecords_nat value0 = {0};
  if (!lb_in_1(&args[0], &scope, &value0)) { failure = wasmtime_error_new("Invalid copied WIT input, allocation failure or 16 MiB conversion limit"); goto done; }
  if (zeropayloadcheckedrecords_witnesses(&value0, &value, &native_error) != ZEROPAYLOADCHECKEDRECORDS_STATUS_OK) {
    failure = wasmtime_error_new(native_error.message ? native_error.message : "Native Lean call failed"); goto done;
  }
  if (!lb_out_8(&value, &scope, &converted)) { failure = wasmtime_error_new("16 MiB WIT result conversion limit"); goto done; }
  results[0] = converted; converted = (wasmtime_component_val_t){0};
done:
  wasmtime_component_val_delete(&converted);
  zeropayloadcheckedrecords_array_lean_zero_payload_checked_records_witness_span_clear(&value);
  lb_scope_close(&scope);
  return failure;
}

static const uint8_t lb_component[] = {0,97,115,109,13,0,1,0,7,154,4,1,66,41,1,112,121,1,109,1,5,101,109,112,116,121,4,0,7,119,105,116,110,101,115,115,3,0,1,1,112,121,4,0,14,98,114,105,100,103,101,45,118,97,108,117,101,45,49,3,0,3,1,114,1,7,119,105,116,110,101,115,115,2,4,0,18,109,97,114,107,45,109,97,114,107,101,100,45,102,105,101,108,100,115,3,0,5,1,113,2,5,98,108,97,110,107,0,0,6,109,97,114,107,101,100,1,6,0,4,0,4,109,97,114,107,3,0,7,1,109,1,5,101,109,112,116,121,4,0,6,109,97,114,107,101,114,3,0,9,1,107,2,4,0,14,98,114,105,100,103,101,45,118,97,108,117,101,45,53,3,0,11,1,109,1,4,117,110,105,116,4,0,14,98,114,105,100,103,101,45,118,97,108,117,101,45,54,3,0,13,1,114,1,3,116,97,103,14,4,0,5,116,111,107,101,110,3,0,15,1,112,2,4,0,14,98,114,105,100,103,101,45,118,97,108,117,101,45,56,3,0,17,1,64,1,6,118,97,108,117,101,48,2,0,4,4,0,12,97,98,115,101,110,116,45,99,111,117,110,116,1,19,1,64,1,6,118,97,108,117,101,48,8,0,4,4,0,10,109,97,114,107,45,99,111,117,110,116,1,20,1,64,1,6,118,97,108,117,101,48,10,0,4,4,0,12,109,97,114,107,101,114,45,99,111,117,110,116,1,21,1,64,1,6,118,97,108,117,101,48,127,0,12,4,0,13,109,97,121,98,101,45,119,105,116,110,101,115,115,1,22,1,64,1,6,118,97,108,117,101,48,127,0,8,4,0,12,112,114,111,100,117,99,101,45,109,97,114,107,1,23,1,64,0,0,10,4,0,14,112,114,111,100,117,99,101,45,109,97,114,107,101,114,1,24,1,64,0,0,16,4,0,13,112,114,111,100,117,99,101,45,116,111,107,101,110,1,25,1,64,0,0,2,4,0,15,112,114,111,100,117,99,101,45,119,105,116,110,101,115,115,1,26,1,64,1,6,118,97,108,117,101,48,16,0,14,4,0,9,116,111,107,101,110,45,116,97,103,1,27,1,64,1,6,118,97,108,117,101,48,2,0,4,4,0,13,119,105,116,110,101,115,115,45,99,111,117,110,116,1,28,1,64,1,6,118,97,108,117,101,48,4,0,18,4,0,9,119,105,116,110,101,115,115,101,115,1,29,10,55,1,0,50,108,101,97,110,45,98,114,105,100,103,101,58,122,101,114,111,112,97,121,108,111,97,100,99,104,101,99,107,101,100,114,101,99,111,114,100,115,47,110,97,116,105,118,101,64,49,46,48,46,48,5,0,6,181,2,20,3,0,0,7,119,105,116,110,101,115,115,3,0,0,14,98,114,105,100,103,101,45,118,97,108,117,101,45,49,3,0,0,18,109,97,114,107,45,109,97,114,107,101,100,45,102,105,101,108,100,115,3,0,0,4,109,97,114,107,3,0,0,6,109,97,114,107,101,114,3,0,0,14,98,114,105,100,103,101,45,118,97,108,117,101,45,53,3,0,0,14,98,114,105,100,103,101,45,118,97,108,117,101,45,54,3,0,0,5,116,111,107,101,110,3,0,0,14,98,114,105,100,103,101,45,118,97,108,117,101,45,56,1,0,0,12,97,98,115,101,110,116,45,99,111,117,110,116,1,0,0,10,109,97,114,107,45,99,111,117,110,116,1,0,0,12,109,97,114,107,101,114,45,99,111,117,110,116,1,0,0,13,109,97,121,98,101,45,119,105,116,110,101,115,115,1,0,0,12,112,114,111,100,117,99,101,45,109,97,114,107,1,0,0,14,112,114,111,100,117,99,101,45,109,97,114,107,101,114,1,0,0,13,112,114,111,100,117,99,101,45,116,111,107,101,110,1,0,0,15,112,114,111,100,117,99,101,45,119,105,116,110,101,115,115,1,0,0,9,116,111,107,101,110,45,116,97,103,1,0,0,13,119,105,116,110,101,115,115,45,99,111,117,110,116,1,0,0,9,119,105,116,110,101,115,115,101,115,1,230,2,0,97,115,109,1,0,0,0,1,25,5,96,4,127,127,127,127,1,127,96,1,127,0,96,1,126,0,96,1,125,0,96,1,124,0,3,6,5,0,1,2,3,4,5,5,1,1,1,128,8,6,6,1,127,1,65,16,11,7,64,6,6,109,101,109,111,114,121,2,0,7,114,101,97,108,108,111,99,0,0,8,112,111,115,116,45,105,51,50,0,1,8,112,111,115,116,45,105,54,52,0,2,8,112,111,115,116,45,102,51,50,0,3,8,112,111,115,116,45,102,54,52,0,4,10,147,1,5,117,1,3,127,32,3,69,4,64,65,0,15,11,35,0,32,2,65,1,107,106,65,0,32,2,107,113,33,4,32,4,32,3,106,33,5,32,5,32,4,73,32,5,65,128,128,128,32,75,114,4,64,0,11,32,5,65,255,255,3,106,65,16,118,33,6,32,6,63,0,75,4,64,32,6,63,0,107,64,0,65,127,70,4,64,0,11,11,32,0,4,64,32,4,32,0,32,1,32,3,32,1,32,3,73,27,252,10,0,0,11,32,5,36,0,32,4,11,6,0,65,16,36,0,11,6,0,65,16,36,0,11,6,0,65,16,36,0,11,6,0,65,16,36,0,11,0,82,4,110,97,109,101,0,10,9,97,108,108,111,99,97,116,111,114,2,54,1,0,7,0,3,111,108,100,1,8,111,108,100,45,115,105,122,101,2,9,97,108,105,103,110,109,101,110,116,3,4,115,105,122,101,4,5,115,116,97,114,116,5,3,101,110,100,6,5,112,97,103,101,115,7,7,1,0,4,104,101,97,112,2,4,1,0,0,0,6,76,6,0,2,1,0,6,109,101,109,111,114,121,0,0,1,0,7,114,101,97,108,108,111,99,0,0,1,0,8,112,111,115,116,45,105,51,50,0,0,1,0,8,112,111,115,116,45,105,54,52,0,0,1,0,8,112,111,115,116,45,102,51,50,0,0,1,0,8,112,111,115,116,45,102,54,52,8,89,11,1,0,0,2,3,0,4,0,1,0,1,2,3,0,4,0,1,0,2,2,3,0,4,0,1,0,3,2,3,0,4,0,1,0,4,2,3,0,4,0,1,0,5,2,3,0,4,0,1,0,6,2,3,0,4,0,1,0,7,2,3,0,4,0,1,0,8,2,3,0,4,0,1,0,9,2,3,0,4,0,1,0,10,2,3,0,4,0,1,224,4,0,97,115,109,1,0,0,0,1,35,6,96,4,127,127,127,127,1,127,96,2,127,127,0,96,3,127,127,127,0,96,0,1,127,96,1,127,1,127,96,2,127,127,1,127,2,133,1,12,10,97,108,108,111,99,97,116,105,111,110,7,114,101,97,108,108,111,99,0,0,4,104,111,115,116,2,102,48,0,1,4,104,111,115,116,2,102,49,0,2,4,104,111,115,116,2,102,50,0,1,4,104,111,115,116,2,102,51,0,1,4,104,111,115,116,2,102,52,0,1,4,104,111,115,116,2,102,53,0,3,4,104,111,115,116,2,102,54,0,3,4,104,111,115,116,2,102,55,0,3,4,104,111,115,116,2,102,56,0,4,4,104,111,115,116,2,102,57,0,1,4,104,111,115,116,3,102,49,48,0,2,3,12,11,4,5,4,4,4,3,3,3,4,4,5,7,57,11,2,102,48,0,12,2,102,49,0,13,2,102,50,0,14,2,102,51,0,15,2,102,52,0,16,2,102,53,0,17,2,102,54,0,18,2,102,55,0,19,2,102,56,0,20,2,102,57,0,21,3,102,49,48,0,22,10,202,1,11,24,1,1,127,65,0,65,0,65,4,65,8,16,0,33,1,32,0,32,1,16,1,32,1,11,26,1,1,127,65,0,65,0,65,4,65,8,16,0,33,2,32,0,32,1,32,2,16,2,32,2,11,24,1,1,127,65,0,65,0,65,4,65,8,16,0,33,1,32,0,32,1,16,3,32,1,11,24,1,1,127,65,0,65,0,65,1,65,2,16,0,33,1,32,0,32,1,16,4,32,1,11,24,1,1,127,65,0,65,0,65,1,65,2,16,0,33,1,32,0,32,1,16,5,32,1,11,4,0,16,6,11,4,0,16,7,11,4,0,16,8,11,6,0,32,0,16,9,11,24,1,1,127,65,0,65,0,65,4,65,8,16,0,33,1,32,0,32,1,16,10,32,1,11,26,1,1,127,65,0,65,0,65,4,65,8,16,0,33,2,32,0,32,1,32,2,16,11,32,2,11,0,146,1,4,110,97,109,101,0,8,7,102,111,114,119,97,114,100,1,56,12,0,8,97,108,108,111,99,97,116,101,1,2,102,48,2,2,102,49,3,2,102,50,4,2,102,51,5,2,102,52,6,2,102,53,7,2,102,54,8,2,102,55,9,2,102,56,10,2,102,57,11,3,102,49,48,2,71,7,12,1,1,6,114,101,115,117,108,116,13,1,2,6,114,101,115,117,108,116,14,1,1,6,114,101,115,117,108,116,15,1,1,6,114,101,115,117,108,116,16,1,1,6,114,101,115,117,108,116,21,1,1,6,114,101,115,117,108,116,22,1,2,6,114,101,115,117,108,116,2,82,2,1,11,2,102,48,0,5,2,102,49,0,6,2,102,50,0,7,2,102,51,0,8,2,102,52,0,9,2,102,53,0,10,2,102,54,0,11,2,102,55,0,12,2,102,56,0,13,2,102,57,0,14,3,102,49,48,0,15,0,1,2,10,97,108,108,111,99,97,116,105,111,110,18,0,4,104,111,115,116,18,1,6,79,11,0,0,1,2,2,102,48,0,0,1,2,2,102,49,0,0,1,2,2,102,50,0,0,1,2,2,102,51,0,0,1,2,2,102,52,0,0,1,2,2,102,53,0,0,1,2,2,102,54,0,0,1,2,2,102,55,0,0,1,2,2,102,56,0,0,1,2,2,102,57,0,0,1,2,3,102,49,48,7,13,1,64,1,6,118,97,108,117,101,48,1,0,2,8,12,1,0,0,16,3,3,0,4,0,5,1,10,7,13,1,64,1,6,118,97,108,117,101,48,4,0,2,8,12,1,0,0,17,3,3,0,4,0,5,1,11,7,13,1,64,1,6,118,97,108,117,101,48,5,0,2,8,12,1,0,0,18,3,3,0,4,0,5,1,12,7,13,1,64,1,6,118,97,108,117,101,48,127,0,6,8,12,1,0,0,19,3,3,0,4,0,5,1,13,7,13,1,64,1,6,118,97,108,117,101,48,127,0,4,8,12,1,0,0,20,3,3,0,4,0,5,1,14,7,5,1,64,0,0,5,8,12,1,0,0,21,3,3,0,4,0,5,1,15,7,5,1,64,0,0,8,8,12,1,0,0,22,3,3,0,4,0,5,1,16,7,5,1,64,0,0,1,8,12,1,0,0,23,3,3,0,4,0,5,1,17,7,13,1,64,1,6,118,97,108,117,101,48,8,0,7,8,12,1,0,0,24,3,3,0,4,0,5,1,18,7,13,1,64,1,6,118,97,108,117,101,48,1,0,2,8,12,1,0,0,25,3,3,0,4,0,5,1,19,7,13,1,64,1,6,118,97,108,117,101,48,2,0,9,8,12,1,0,0,26,3,3,0,4,0,5,1,20,7,248,3,1,66,40,2,3,2,1,1,4,0,7,119,105,116,110,101,115,115,3,0,0,2,3,2,1,2,4,0,14,98,114,105,100,103,101,45,118,97,108,117,101,45,49,3,0,2,2,3,2,1,3,4,0,18,109,97,114,107,45,109,97,114,107,101,100,45,102,105,101,108,100,115,3,0,4,2,3,2,1,4,4,0,4,109,97,114,107,3,0,6,2,3,2,1,5,4,0,6,109,97,114,107,101,114,3,0,8,2,3,2,1,6,4,0,14,98,114,105,100,103,101,45,118,97,108,117,101,45,53,3,0,10,2,3,2,1,7,4,0,14,98,114,105,100,103,101,45,118,97,108,117,101,45,54,3,0,12,2,3,2,1,8,4,0,5,116,111,107,101,110,3,0,14,2,3,2,1,9,4,0,14,98,114,105,100,103,101,45,118,97,108,117,101,45,56,3,0,16,1,64,1,6,118,97,108,117,101,48,1,0,3,4,0,12,97,98,115,101,110,116,45,99,111,117,110,116,1,18,1,64,1,6,118,97,108,117,101,48,7,0,3,4,0,10,109,97,114,107,45,99,111,117,110,116,1,19,1,64,1,6,118,97,108,117,101,48,9,0,3,4,0,12,109,97,114,107,101,114,45,99,111,117,110,116,1,20,1,64,1,6,118,97,108,117,101,48,127,0,11,4,0,13,109,97,121,98,101,45,119,105,116,110,101,115,115,1,21,1,64,1,6,118,97,108,117,101,48,127,0,7,4,0,12,112,114,111,100,117,99,101,45,109,97,114,107,1,22,1,64,0,0,9,4,0,14,112,114,111,100,117,99,101,45,109,97,114,107,101,114,1,23,1,64,0,0,15,4,0,13,112,114,111,100,117,99,101,45,116,111,107,101,110,1,24,1,64,0,0,1,4,0,15,112,114,111,100,117,99,101,45,119,105,116,110,101,115,115,1,25,1,64,1,6,118,97,108,117,101,48,15,0,13,4,0,9,116,111,107,101,110,45,116,97,103,1,26,1,64,1,6,118,97,108,117,101,48,1,0,3,4,0,13,119,105,116,110,101,115,115,45,99,111,117,110,116,1,27,1,64,1,6,118,97,108,117,101,48,3,0,17,4,0,9,119,105,116,110,101,115,115,101,115,1,28,5,183,2,1,1,20,0,7,119,105,116,110,101,115,115,3,1,0,14,98,114,105,100,103,101,45,118,97,108,117,101,45,49,3,2,0,18,109,97,114,107,45,109,97,114,107,101,100,45,102,105,101,108,100,115,3,3,0,4,109,97,114,107,3,4,0,6,109,97,114,107,101,114,3,5,0,14,98,114,105,100,103,101,45,118,97,108,117,101,45,53,3,6,0,14,98,114,105,100,103,101,45,118,97,108,117,101,45,54,3,7,0,5,116,111,107,101,110,3,8,0,14,98,114,105,100,103,101,45,118,97,108,117,101,45,56,3,9,0,12,97,98,115,101,110,116,45,99,111,117,110,116,1,11,0,10,109,97,114,107,45,99,111,117,110,116,1,12,0,12,109,97,114,107,101,114,45,99,111,117,110,116,1,13,0,13,109,97,121,98,101,45,119,105,116,110,101,115,115,1,14,0,12,112,114,111,100,117,99,101,45,109,97,114,107,1,15,0,14,112,114,111,100,117,99,101,45,109,97,114,107,101,114,1,16,0,13,112,114,111,100,117,99,101,45,116,111,107,101,110,1,17,0,15,112,114,111,100,117,99,101,45,119,105,116,110,101,115,115,1,18,0,9,116,111,107,101,110,45,116,97,103,1,19,0,13,119,105,116,110,101,115,115,45,99,111,117,110,116,1,20,0,9,119,105,116,110,101,115,115,101,115,1,21,11,55,1,0,47,108,101,97,110,45,98,114,105,100,103,101,58,122,101,114,111,112,97,121,108,111,97,100,99,104,101,99,107,101,100,114,101,99,111,114,100,115,47,97,112,105,64,49,46,48,46,48,5,1,1,5,21,0,208,4,14,99,111,109,112,111,110,101,110,116,45,110,97,109,101,1,252,1,0,0,27,0,7,114,101,97,108,108,111,99,1,8,112,111,115,116,45,105,51,50,2,8,112,111,115,116,45,105,54,52,3,8,112,111,115,116,45,102,51,50,4,8,112,111,115,116,45,102,54,52,5,6,108,111,119,101,114,48,6,6,108,111,119,101,114,49,7,6,108,111,119,101,114,50,8,6,108,111,119,101,114,51,9,6,108,111,119,101,114,52,10,6,108,111,119,101,114,53,11,6,108,111,119,101,114,54,12,6,108,111,119,101,114,55,13,6,108,111,119,101,114,56,14,6,108,111,119,101,114,57,15,7,108,111,119,101,114,49,48,16,8,102,111,114,119,97,114,100,48,17,8,102,111,114,119,97,114,100,49,18,8,102,111,114,119,97,114,100,50,19,8,102,111,114,119,97,114,100,51,20,8,102,111,114,119,97,114,100,52,21,8,102,111,114,119,97,114,100,53,22,8,102,111,114,119,97,114,100,54,23,8,102,111,114,119,97,114,100,55,24,8,102,111,114,119,97,114,100,56,25,8,102,111,114,119,97,114,100,57,26,9,102,111,114,119,97,114,100,49,48,1,11,0,2,1,0,6,109,101,109,111,114,121,1,23,0,17,2,0,9,97,108,108,111,99,97,116,111,114,1,7,102,111,114,119,97,114,100,1,35,0,18,3,0,10,97,108,108,111,99,97,116,105,111,110,1,7,105,109,112,111,114,116,115,2,9,102,111,114,119,97,114,100,101,100,1,125,1,22,0,5,104,111,115,116,48,1,5,104,111,115,116,49,2,5,104,111,115,116,50,3,5,104,111,115,116,51,4,5,104,111,115,116,52,5,5,104,111,115,116,53,6,5,104,111,115,116,54,7,5,104,111,115,116,55,8,5,104,111,115,116,56,9,5,104,111,115,116,57,10,6,104,111,115,116,49,48,11,2,102,48,12,2,102,49,13,2,102,50,14,2,102,51,15,2,102,52,16,2,102,53,17,2,102,54,18,2,102,55,19,2,102,56,20,2,102,57,21,3,102,49,48,1,100,3,11,0,3,97,112,105,1,7,112,117,98,108,105,99,48,2,7,112,117,98,108,105,99,49,3,7,112,117,98,108,105,99,57,4,7,112,117,98,108,105,99,50,5,7,112,117,98,108,105,99,51,6,7,112,117,98,108,105,99,53,7,7,112,117,98,108,105,99,54,8,7,112,117,98,108,105,99,55,9,7,112,117,98,108,105,99,56,21,10,112,117,98,108,105,99,45,97,112,105,1,16,5,2,0,4,104,111,115,116,1,6,112,117,98,108,105,99};
struct zeropayloadcheckedrecords_wasmtime {
  wasm_engine_t *engine;
  wasmtime_component_t *component;
  wasmtime_store_t *store;
  wasmtime_component_linker_t *linker;
  wasmtime_component_instance_t instance;
};
wasmtime_error_t *zeropayloadcheckedrecords_wasmtime_link(wasmtime_component_linker_t *linker) {
  const char *package_failure = lb_package_failure();
  if (package_failure) return wasmtime_error_new(package_failure);
  if (!linker) return wasmtime_error_new("Missing Wasmtime linker");
  wasmtime_component_linker_instance_t *root = wasmtime_component_linker_root(linker), *host = NULL;
  wasmtime_error_t *error = wasmtime_component_linker_instance_add_instance(root, "lean-bridge:zeropayloadcheckedrecords/native@1.0.0", 50, &host);
  if (!error) {
    if (!error) error = wasmtime_component_linker_instance_add_func(host, "absent-count", 12, lb_call_0, NULL, NULL);
    if (!error) error = wasmtime_component_linker_instance_add_func(host, "mark-count", 10, lb_call_1, NULL, NULL);
    if (!error) error = wasmtime_component_linker_instance_add_func(host, "marker-count", 12, lb_call_2, NULL, NULL);
    if (!error) error = wasmtime_component_linker_instance_add_func(host, "maybe-witness", 13, lb_call_3, NULL, NULL);
    if (!error) error = wasmtime_component_linker_instance_add_func(host, "produce-mark", 12, lb_call_4, NULL, NULL);
    if (!error) error = wasmtime_component_linker_instance_add_func(host, "produce-marker", 14, lb_call_5, NULL, NULL);
    if (!error) error = wasmtime_component_linker_instance_add_func(host, "produce-token", 13, lb_call_6, NULL, NULL);
    if (!error) error = wasmtime_component_linker_instance_add_func(host, "produce-witness", 15, lb_call_7, NULL, NULL);
    if (!error) error = wasmtime_component_linker_instance_add_func(host, "token-tag", 9, lb_call_8, NULL, NULL);
    if (!error) error = wasmtime_component_linker_instance_add_func(host, "witness-count", 13, lb_call_9, NULL, NULL);
    if (!error) error = wasmtime_component_linker_instance_add_func(host, "witnesses", 9, lb_call_10, NULL, NULL);
    wasmtime_component_linker_instance_delete(host);
  }
  wasmtime_component_linker_instance_delete(root);
  return error;
}
static wasmtime_error_t *lb_refresh(zeropayloadcheckedrecords_wasmtime *session) {
  if (session->store) wasmtime_store_delete(session->store);
  session->store = wasmtime_store_new(session->engine, NULL, NULL);
  wasmtime_error_t *error = wasmtime_component_linker_instantiate(session->linker, wasmtime_store_context(session->store), session->component, &session->instance);
  if (error) { wasmtime_store_delete(session->store); session->store = NULL; }
  return error;
}
void zeropayloadcheckedrecords_wasmtime_close(zeropayloadcheckedrecords_wasmtime *session) {
  if (getpid() != lb_package_pid) return;
  if (!session) return;
  if (session->linker) wasmtime_component_linker_delete(session->linker);
  if (session->store) wasmtime_store_delete(session->store);
  if (session->component) wasmtime_component_delete(session->component);
  if (session->engine) wasm_engine_delete(session->engine);
  free(session);
}
wasmtime_error_t *zeropayloadcheckedrecords_wasmtime_open(zeropayloadcheckedrecords_wasmtime **out) {
  const char *package_failure = lb_package_failure();
  if (package_failure) return wasmtime_error_new(package_failure);
  if (!out) return wasmtime_error_new("Missing session output");
  zeropayloadcheckedrecords_wasmtime *session = calloc(1, sizeof(*session));
  if (!session) return wasmtime_error_new("Cannot allocate Wasmtime session");
  wasm_config_t *config = wasm_config_new();
  if (!config) { free(session); return wasmtime_error_new("Cannot allocate Wasmtime configuration"); }
  wasmtime_config_wasm_component_model_set(config, true);
  session->engine = wasm_engine_new_with_config(config);
  wasmtime_error_t *error = wasmtime_component_new(session->engine, lb_component, sizeof(lb_component), &session->component);
  if (!error) {
    session->linker = wasmtime_component_linker_new(session->engine);
    error = zeropayloadcheckedrecords_wasmtime_link(session->linker);
    if (!error) error = lb_refresh(session);
  }
  if (error) { zeropayloadcheckedrecords_wasmtime_close(session); return error; }
  *out = session; return NULL;
}
wasmtime_error_t *zeropayloadcheckedrecords_wasmtime_call(zeropayloadcheckedrecords_wasmtime *session, const char *name,
    const wasmtime_component_val_t *args, size_t count, wasmtime_component_val_t *out) {
  const char *package_failure = lb_package_failure();
  if (package_failure) return wasmtime_error_new(package_failure);
  if (!session || !session->store || !name || !out || (count && !args)) return wasmtime_error_new("Invalid WIT call arguments or unavailable session");
  /* Validate before Wasmtime copies caller buffers, including allocation bounds. */
  lb_scope scope = {.remaining = 16u * 1024u * 1024u};
  (void)scope; /* A package may contain only zero-argument exports. */
  bool valid = false;
  if (strcmp(name, "absent-count") == 0) valid = count == 1 && lb_in_0(&args[0], &scope, NULL);
  if (strcmp(name, "mark-count") == 0) valid = count == 1 && lb_in_2(&args[0], &scope, NULL);
  if (strcmp(name, "marker-count") == 0) valid = count == 1 && lb_in_3(&args[0], &scope, NULL);
  if (strcmp(name, "maybe-witness") == 0) valid = count == 1 && lb_in_4(&args[0], &scope, NULL);
  if (strcmp(name, "produce-mark") == 0) valid = count == 1 && lb_in_4(&args[0], &scope, NULL);
  if (strcmp(name, "produce-marker") == 0) valid = count == 0;
  if (strcmp(name, "produce-token") == 0) valid = count == 0;
  if (strcmp(name, "produce-witness") == 0) valid = count == 0;
  if (strcmp(name, "token-tag") == 0) valid = count == 1 && lb_in_7(&args[0], &scope, NULL);
  if (strcmp(name, "witness-count") == 0) valid = count == 1 && lb_in_0(&args[0], &scope, NULL);
  if (strcmp(name, "witnesses") == 0) valid = count == 1 && lb_in_1(&args[0], &scope, NULL);
  if (!valid) return wasmtime_error_new("Unknown export, invalid WIT input or 16 MiB conversion limit");
  wasmtime_context_t *context = wasmtime_store_context(session->store);
  wasmtime_component_export_index_t *api = wasmtime_component_instance_get_export_index(&session->instance, context, NULL, "lean-bridge:zeropayloadcheckedrecords/api@1.0.0", 47);
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

