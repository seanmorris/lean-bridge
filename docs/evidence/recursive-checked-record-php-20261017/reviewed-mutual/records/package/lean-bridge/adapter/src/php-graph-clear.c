#include <stdint.h>
#include <string.h>
/* Root-only cleanup never follows child pointers, tags or lengths. */
void mutualcheckedrecords_php_graph_clear(void *value) {
  if (!value) return;
  void *owner; void (*release)(void *);
  _Static_assert(sizeof(owner) == 8 && sizeof(release) == 8, "64-bit graph ABI");
  memcpy(&owner, value, sizeof(owner));
  memcpy(&release, (uint8_t *)value + 8, sizeof(release));
  memset(value, 0, 16);
  if (owner && release) release(owner);
}
