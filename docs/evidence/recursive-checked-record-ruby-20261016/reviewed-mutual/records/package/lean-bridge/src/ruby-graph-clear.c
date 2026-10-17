#include <string.h>
void mutualcheckedrecords_ruby_graph_clear(void *value) {
  struct owner { void *pointer; void (*release)(void *); } owner;
  if (!value) return;
  memcpy(&owner, value, sizeof(owner));
  memset(value, 0, sizeof(owner));
  if (owner.pointer && owner.release) owner.release(owner.pointer);
}
