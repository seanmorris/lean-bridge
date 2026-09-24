/**
 * Private SHA-256 file verification for prepared native WIT dependencies.
 * No extra shared library or command-line tool is required by consumers.
 *
 * @file
 */

/**
 * C source implementing FIPS 180-4 sections 4.1.2, 5 and 6.2.
 * Specification: https://doi.org/10.6028/NIST.FIPS.180-4.
 * This checks receipt bytes, not executable memory or a hostile native caller.
 */
export const witHostLibraryHash = `
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
`;
