<?php
declare(strict_types=1);
namespace LeanMutualcheckedrecords\Internal;

final class GraphNativeTypes
{
    public const DEFINITIONS = <<<'CDEFS'
typedef uint8_t *lb_php_graph_byte_pointer;
typedef uint8_t **lb_php_graph_byte_slot;
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

struct mutualcheckedrecords_scalar_nat_t {
  void *_bridge_owner;
  void (*_bridge_release)(void *owner);
  const uint32_t *data;
  size_t length;
};

struct mutualcheckedrecords_envelope_t {
  void *_bridge_owner;
  void (*_bridge_release)(void *owner);
  mutualcheckedrecords_scalar_nat_t value;
  mutualcheckedrecords_scalar_nat_t mode;
  const mutualcheckedrecords_graph_d2fe45ba488df4ece96d_t *next;
};

struct mutualcheckedrecords_graph_c8c78faf2eecb4e21389_t {
  void *_bridge_owner;
  void (*_bridge_release)(void *owner);
  uint8_t has_value;
  mutualcheckedrecords_envelope_t value;
};

struct mutualcheckedrecords_graph_d2fe45ba488df4ece96d_t {
  void *_bridge_owner;
  void (*_bridge_release)(void *owner);
  uint8_t has_value;
  const mutualcheckedrecords_step_t *value;
};

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

typedef mutualcheckedrecords_envelope_t mutualcheckedrecords_envelope_alias_t;
CDEFS;
    public const NODES = [
        ['ctype' => 'mutualcheckedrecords_graph_6586a61fcab9df3e21b7_t', 'kind' => 'array', 'scalar' => null, 'aggregate' => true, 'inhabited' => true, 'element' => 1, 'branches' => [['class' => null, 'fields' => []]]],
        ['ctype' => 'mutualcheckedrecords_graph_c8c78faf2eecb4e21389_t', 'kind' => 'option', 'scalar' => null, 'aggregate' => true, 'inhabited' => true, 'element' => null, 'branches' => [['class' => null, 'fields' => []], ['class' => 'LeanMutualcheckedrecords\\Some', 'fields' => [['type' => 3, 'path' => ['value'], 'pointer' => false, 'key' => 'value']]]]],
        ['ctype' => 'mutualcheckedrecords_graph_d2fe45ba488df4ece96d_t', 'kind' => 'option', 'scalar' => null, 'aggregate' => true, 'inhabited' => true, 'element' => null, 'branches' => [['class' => null, 'fields' => []], ['class' => 'LeanMutualcheckedrecords\\Some', 'fields' => [['type' => 4, 'path' => ['value'], 'pointer' => true, 'key' => 'value']]]]],
        ['ctype' => 'mutualcheckedrecords_envelope_t', 'kind' => 'record', 'scalar' => null, 'aggregate' => true, 'inhabited' => true, 'element' => null, 'branches' => [['class' => 'LeanMutualcheckedrecords\\Envelope', 'fields' => [['type' => 5, 'path' => ['value'], 'pointer' => false, 'key' => 'value'], ['type' => 5, 'path' => ['mode'], 'pointer' => false, 'key' => 'mode'], ['type' => 2, 'path' => ['next'], 'pointer' => true, 'key' => 'next']]]]],
        ['ctype' => 'mutualcheckedrecords_step_t', 'kind' => 'variant', 'scalar' => null, 'aggregate' => true, 'inhabited' => true, 'element' => null, 'branches' => [['class' => 'LeanMutualcheckedrecords\\StepStop', 'fields' => []], ['class' => 'LeanMutualcheckedrecords\\StepMore', 'fields' => [['type' => 3, 'path' => ['cases', 'more', 'packet'], 'pointer' => true, 'key' => 'packet']]]]],
        ['ctype' => 'mutualcheckedrecords_scalar_nat_t', 'kind' => 'primitive', 'scalar' => 'nat', 'aggregate' => true, 'inhabited' => true, 'element' => null, 'branches' => [['class' => null, 'fields' => []]]],
    ];
    public const FUNCTIONS = [['parameters' => [3], 'result' => 3], ['parameters' => [0], 'result' => 0], ['parameters' => [3], 'result' => 5], ['parameters' => [0], 'result' => 5], ['parameters' => [5], 'result' => 3], ['parameters' => [3], 'result' => 5]];
}
