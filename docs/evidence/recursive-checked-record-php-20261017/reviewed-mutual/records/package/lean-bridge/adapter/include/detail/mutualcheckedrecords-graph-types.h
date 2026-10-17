#ifndef MUTUALCHECKEDRECORDS_COPIED_GRAPH_H
#define MUTUALCHECKEDRECORDS_COPIED_GRAPH_H
#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>
#include <string.h>

typedef struct mutualcheckedrecords_graph_6586a61fcab9df3e21b7_t mutualcheckedrecords_graph_6586a61fcab9df3e21b7_t;
typedef struct mutualcheckedrecords_graph_c8c78faf2eecb4e21389_t mutualcheckedrecords_graph_c8c78faf2eecb4e21389_t;
typedef struct mutualcheckedrecords_graph_d2fe45ba488df4ece96d_t mutualcheckedrecords_graph_d2fe45ba488df4ece96d_t;
typedef struct mutualcheckedrecords_envelope_t mutualcheckedrecords_envelope_t;
typedef struct mutualcheckedrecords_step_t mutualcheckedrecords_step_t;
typedef struct mutualcheckedrecords_scalar_nat_t mutualcheckedrecords_scalar_nat_t;
struct mutualcheckedrecords_graph_6586a61fcab9df3e21b7_t {
  void *_bridge_owner;
  void (*_bridge_release)(void *owner);
  const mutualcheckedrecords_graph_c8c78faf2eecb4e21389_t *data;
  size_t length;
};
static inline void mutualcheckedrecords_graph_6586a61fcab9df3e21b7_t_init(mutualcheckedrecords_graph_6586a61fcab9df3e21b7_t *value) {
  if (!value) return;
  memset(value, 0, sizeof(*value));
}
static inline void mutualcheckedrecords_graph_6586a61fcab9df3e21b7_t_clear(mutualcheckedrecords_graph_6586a61fcab9df3e21b7_t *value) {
  if (!value) return;
  void *owner = value->_bridge_owner;
  void (*release)(void *) = value->_bridge_release;
  mutualcheckedrecords_graph_6586a61fcab9df3e21b7_t_init(value);
  if (owner && release) release(owner);
}

struct mutualcheckedrecords_scalar_nat_t {
  void *_bridge_owner;
  void (*_bridge_release)(void *owner);
  const uint32_t *data;
  size_t length;
};
static inline void mutualcheckedrecords_scalar_nat_t_init(mutualcheckedrecords_scalar_nat_t *value) {
  if (!value) return;
  memset(value, 0, sizeof(*value));
}
static inline void mutualcheckedrecords_scalar_nat_t_clear(mutualcheckedrecords_scalar_nat_t *value) {
  if (!value) return;
  void *owner = value->_bridge_owner;
  void (*release)(void *) = value->_bridge_release;
  mutualcheckedrecords_scalar_nat_t_init(value);
  if (owner && release) release(owner);
}

struct mutualcheckedrecords_envelope_t {
  void *_bridge_owner;
  void (*_bridge_release)(void *owner);
  mutualcheckedrecords_scalar_nat_t value;
  mutualcheckedrecords_scalar_nat_t mode;
  const mutualcheckedrecords_graph_d2fe45ba488df4ece96d_t *next;
};
static inline void mutualcheckedrecords_envelope_t_init(mutualcheckedrecords_envelope_t *value) {
  if (!value) return;
  memset(value, 0, sizeof(*value));
}
static inline void mutualcheckedrecords_envelope_t_clear(mutualcheckedrecords_envelope_t *value) {
  if (!value) return;
  void *owner = value->_bridge_owner;
  void (*release)(void *) = value->_bridge_release;
  mutualcheckedrecords_envelope_t_init(value);
  if (owner && release) release(owner);
}

struct mutualcheckedrecords_graph_c8c78faf2eecb4e21389_t {
  void *_bridge_owner;
  void (*_bridge_release)(void *owner);
  uint8_t has_value;
  mutualcheckedrecords_envelope_t value;
};
static inline void mutualcheckedrecords_graph_c8c78faf2eecb4e21389_t_init(mutualcheckedrecords_graph_c8c78faf2eecb4e21389_t *value) {
  if (!value) return;
  memset(value, 0, sizeof(*value));
}
static inline void mutualcheckedrecords_graph_c8c78faf2eecb4e21389_t_clear(mutualcheckedrecords_graph_c8c78faf2eecb4e21389_t *value) {
  if (!value) return;
  void *owner = value->_bridge_owner;
  void (*release)(void *) = value->_bridge_release;
  mutualcheckedrecords_graph_c8c78faf2eecb4e21389_t_init(value);
  if (owner && release) release(owner);
}

struct mutualcheckedrecords_graph_d2fe45ba488df4ece96d_t {
  void *_bridge_owner;
  void (*_bridge_release)(void *owner);
  uint8_t has_value;
  const mutualcheckedrecords_step_t *value;
};
static inline void mutualcheckedrecords_graph_d2fe45ba488df4ece96d_t_init(mutualcheckedrecords_graph_d2fe45ba488df4ece96d_t *value) {
  if (!value) return;
  memset(value, 0, sizeof(*value));
}
static inline void mutualcheckedrecords_graph_d2fe45ba488df4ece96d_t_clear(mutualcheckedrecords_graph_d2fe45ba488df4ece96d_t *value) {
  if (!value) return;
  void *owner = value->_bridge_owner;
  void (*release)(void *) = value->_bridge_release;
  mutualcheckedrecords_graph_d2fe45ba488df4ece96d_t_init(value);
  if (owner && release) release(owner);
}

typedef enum mutualcheckedrecords_step_t_tag { MUTUALCHECKEDRECORDS_STEP_T_KIND_STOP = 0, MUTUALCHECKEDRECORDS_STEP_T_KIND_MORE = 1 } mutualcheckedrecords_step_t_tag;
struct mutualcheckedrecords_step_t {
  void *_bridge_owner;
  void (*_bridge_release)(void *owner);
  uint32_t kind;
  union {
    struct {
      uint8_t empty;
    } stop;
    struct {
      const mutualcheckedrecords_envelope_t *packet;
    } more;
  } cases;
};
static inline void mutualcheckedrecords_step_t_init(mutualcheckedrecords_step_t *value) {
  if (!value) return;
  memset(value, 0, sizeof(*value));
  value->kind = UINT32_MAX;
}
static inline void mutualcheckedrecords_step_t_clear(mutualcheckedrecords_step_t *value) {
  if (!value) return;
  void *owner = value->_bridge_owner;
  void (*release)(void *) = value->_bridge_release;
  mutualcheckedrecords_step_t_init(value);
  if (owner && release) release(owner);
}

typedef mutualcheckedrecords_envelope_t mutualcheckedrecords_envelope_alias_t;
static inline void mutualcheckedrecords_envelope_alias_t_init(mutualcheckedrecords_envelope_alias_t *value) { mutualcheckedrecords_envelope_t_init(value); }
static inline void mutualcheckedrecords_envelope_alias_t_clear(mutualcheckedrecords_envelope_alias_t *value) { mutualcheckedrecords_envelope_t_clear(value); }

#endif /* MUTUALCHECKEDRECORDS_COPIED_GRAPH_H */
