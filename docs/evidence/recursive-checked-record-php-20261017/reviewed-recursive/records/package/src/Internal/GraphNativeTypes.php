<?php
declare(strict_types=1);
namespace LeanRecursivecheckedrecords\Internal;

final class GraphNativeTypes
{
    public const DEFINITIONS = <<<'CDEFS'
typedef uint8_t *lb_php_graph_byte_pointer;
typedef uint8_t **lb_php_graph_byte_slot;
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

struct recursivecheckedrecords_graph_2c3080f9e24fa7c11cff_t {
  void *_bridge_owner;
  void (*_bridge_release)(void *owner);
  uint8_t has_value;
  const recursivecheckedrecords_packet_t *value;
};

struct recursivecheckedrecords_scalar_nat_t {
  void *_bridge_owner;
  void (*_bridge_release)(void *owner);
  const uint32_t *data;
  size_t length;
};

struct recursivecheckedrecords_packet_t {
  void *_bridge_owner;
  void (*_bridge_release)(void *owner);
  recursivecheckedrecords_scalar_nat_t value;
  recursivecheckedrecords_scalar_nat_t digit;
  const recursivecheckedrecords_graph_2c3080f9e24fa7c11cff_t *tail;
};

typedef recursivecheckedrecords_packet_t recursivecheckedrecords_packet_alias_t;
CDEFS;
    public const NODES = [
        ['ctype' => 'recursivecheckedrecords_graph_bf065e9a21862d87767f_t', 'kind' => 'array', 'scalar' => null, 'aggregate' => true, 'inhabited' => true, 'element' => 1, 'branches' => [['class' => null, 'fields' => []]]],
        ['ctype' => 'recursivecheckedrecords_graph_2c3080f9e24fa7c11cff_t', 'kind' => 'option', 'scalar' => null, 'aggregate' => true, 'inhabited' => true, 'element' => null, 'branches' => [['class' => null, 'fields' => []], ['class' => 'LeanRecursivecheckedrecords\\Some', 'fields' => [['type' => 2, 'path' => ['value'], 'pointer' => true, 'key' => 'value']]]]],
        ['ctype' => 'recursivecheckedrecords_packet_t', 'kind' => 'record', 'scalar' => null, 'aggregate' => true, 'inhabited' => true, 'element' => null, 'branches' => [['class' => 'LeanRecursivecheckedrecords\\Packet', 'fields' => [['type' => 3, 'path' => ['value'], 'pointer' => false, 'key' => 'value'], ['type' => 3, 'path' => ['digit'], 'pointer' => false, 'key' => 'digit'], ['type' => 1, 'path' => ['tail'], 'pointer' => true, 'key' => 'tail']]]]],
        ['ctype' => 'recursivecheckedrecords_scalar_nat_t', 'kind' => 'primitive', 'scalar' => 'nat', 'aggregate' => true, 'inhabited' => true, 'element' => null, 'branches' => [['class' => null, 'fields' => []]]],
    ];
    public const FUNCTIONS = [['parameters' => [2], 'result' => 2], ['parameters' => [0], 'result' => 0], ['parameters' => [2], 'result' => 3], ['parameters' => [0], 'result' => 3], ['parameters' => [3], 'result' => 2], ['parameters' => [2], 'result' => 3]];
}
