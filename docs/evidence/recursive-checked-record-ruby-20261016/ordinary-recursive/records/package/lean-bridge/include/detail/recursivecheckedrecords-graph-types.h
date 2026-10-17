#ifndef RECURSIVECHECKEDRECORDS_COPIED_GRAPH_H
#define RECURSIVECHECKEDRECORDS_COPIED_GRAPH_H
#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>
#include <string.h>

typedef struct recursivecheckedrecords_graph_bf065e9a21862d87767f_t recursivecheckedrecords_graph_bf065e9a21862d87767f_t;
typedef struct recursivecheckedrecords_graph_2c3080f9e24fa7c11cff_t recursivecheckedrecords_graph_2c3080f9e24fa7c11cff_t;
typedef struct recursivecheckedrecords_packet_t recursivecheckedrecords_packet_t;
typedef struct recursivecheckedrecords_scalar_nat_t recursivecheckedrecords_scalar_nat_t;
struct recursivecheckedrecords_graph_bf065e9a21862d87767f_t {
  void *_bridge_owner;
  void (*_bridge_release)(void *owner);
  const recursivecheckedrecords_graph_2c3080f9e24fa7c11cff_t *data;
  size_t length;
};
static inline void recursivecheckedrecords_graph_bf065e9a21862d87767f_t_init(recursivecheckedrecords_graph_bf065e9a21862d87767f_t *value) {
  if (!value) return;
  memset(value, 0, sizeof(*value));
}
static inline void recursivecheckedrecords_graph_bf065e9a21862d87767f_t_clear(recursivecheckedrecords_graph_bf065e9a21862d87767f_t *value) {
  if (!value) return;
  void *owner = value->_bridge_owner;
  void (*release)(void *) = value->_bridge_release;
  recursivecheckedrecords_graph_bf065e9a21862d87767f_t_init(value);
  if (owner && release) release(owner);
}

struct recursivecheckedrecords_graph_2c3080f9e24fa7c11cff_t {
  void *_bridge_owner;
  void (*_bridge_release)(void *owner);
  uint8_t has_value;
  const recursivecheckedrecords_packet_t *value;
};
static inline void recursivecheckedrecords_graph_2c3080f9e24fa7c11cff_t_init(recursivecheckedrecords_graph_2c3080f9e24fa7c11cff_t *value) {
  if (!value) return;
  memset(value, 0, sizeof(*value));
}
static inline void recursivecheckedrecords_graph_2c3080f9e24fa7c11cff_t_clear(recursivecheckedrecords_graph_2c3080f9e24fa7c11cff_t *value) {
  if (!value) return;
  void *owner = value->_bridge_owner;
  void (*release)(void *) = value->_bridge_release;
  recursivecheckedrecords_graph_2c3080f9e24fa7c11cff_t_init(value);
  if (owner && release) release(owner);
}

struct recursivecheckedrecords_scalar_nat_t {
  void *_bridge_owner;
  void (*_bridge_release)(void *owner);
  const uint32_t *data;
  size_t length;
};
static inline void recursivecheckedrecords_scalar_nat_t_init(recursivecheckedrecords_scalar_nat_t *value) {
  if (!value) return;
  memset(value, 0, sizeof(*value));
}
static inline void recursivecheckedrecords_scalar_nat_t_clear(recursivecheckedrecords_scalar_nat_t *value) {
  if (!value) return;
  void *owner = value->_bridge_owner;
  void (*release)(void *) = value->_bridge_release;
  recursivecheckedrecords_scalar_nat_t_init(value);
  if (owner && release) release(owner);
}

struct recursivecheckedrecords_packet_t {
  void *_bridge_owner;
  void (*_bridge_release)(void *owner);
  recursivecheckedrecords_scalar_nat_t value;
  recursivecheckedrecords_scalar_nat_t digit;
  const recursivecheckedrecords_graph_2c3080f9e24fa7c11cff_t *tail;
};
static inline void recursivecheckedrecords_packet_t_init(recursivecheckedrecords_packet_t *value) {
  if (!value) return;
  memset(value, 0, sizeof(*value));
}
static inline void recursivecheckedrecords_packet_t_clear(recursivecheckedrecords_packet_t *value) {
  if (!value) return;
  void *owner = value->_bridge_owner;
  void (*release)(void *) = value->_bridge_release;
  recursivecheckedrecords_packet_t_init(value);
  if (owner && release) release(owner);
}

typedef recursivecheckedrecords_packet_t recursivecheckedrecords_packet_alias_t;
static inline void recursivecheckedrecords_packet_alias_t_init(recursivecheckedrecords_packet_alias_t *value) { recursivecheckedrecords_packet_t_init(value); }
static inline void recursivecheckedrecords_packet_alias_t_clear(recursivecheckedrecords_packet_alias_t *value) { recursivecheckedrecords_packet_t_clear(value); }

#endif /* RECURSIVECHECKEDRECORDS_COPIED_GRAPH_H */
