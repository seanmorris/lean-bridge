<?php
declare(strict_types=1);
namespace LeanMutualcheckedrecords\Internal;

require_once __DIR__ . '/Runtime.php';
require_once __DIR__ . '/GraphNative.php';

final class Native
{
    private const DEFINITIONS = <<<'CDEFS'
uint32_t mutualcheckedrecords_graph_initialize(void);
int mutualcheckedrecords_graph_ready(void);
void mutualcheckedrecords_graph_retire(void);
void mutualcheckedrecords_php_graph_clear(void *);
const char *mutualcheckedrecords_graph_error(void);
uint32_t mutualcheckedrecords_echo_graph(const void *, void *);
uint32_t mutualcheckedrecords_echo_groups_graph(const void *, void *);
uint32_t mutualcheckedrecords_first_graph(const void *, void *);
uint32_t mutualcheckedrecords_groups_graph(const void *, void *);
uint32_t mutualcheckedrecords_produce_graph(const void *, void *);
uint32_t mutualcheckedrecords_second_graph(const void *, void *);
CDEFS;
    private static ?array $targets = null;
    private static function load(): \FFI {
        return \LeanBridge\CopiedNativeV1\Runtime::load(__DIR__ . '/../../native/linux-x64', json_decode(<<<'EVIDENCE'
{
  "componentId": "mutualcheckedrecords@1.0.0",
  "componentReceiptSha256": "42ed306d39c61614856c3fce4b036599cbe5bedaeaf0b3562c574f3e4c5213da",
  "copiedGraph": {
    "layoutSha256": "d1e59688830ad32403bddb9f4ef537b219d81c50a52e0f06ab850a26e0c67ca2",
    "schemaVersion": 1
  },
  "identity": "77dc909276b270cdfb96465c9f97c40e1a0bffbf240631a0cd362a68894e1399",
  "libraries": {
    "libcomponent_4ca822048b1456593639.so": "0a653afe4fbd821506805722622d3fd3074c0fd5e046e22b7f1beb4990125b42",
    "liblean_bridge_native.so": "459fcd2098d4b646ab6ae0f4cdccd1f222908cb162562bfc3940a533cd4e4e21",
    "libleanshared.so": "d7768b88d8162736da4305777cd6f147676038fd885bd8a265c958b0ecea00b4",
    "libmutualcheckedrecords.so": "85b5eeaa8fcf54647edcc02b010a9e68392cb4a695cdd83e74c54d32b5fd5803"
  },
  "library": "libmutualcheckedrecords.so",
  "loadOrder": [
    "libleanshared.so",
    "liblean_bridge_native.so",
    "libcomponent_4ca822048b1456593639.so",
    "libmutualcheckedrecords.so"
  ],
  "runtimeIdentity": "4b5a7fdf0cb11d4bb429181cfd50b330c5622ed8f5f5382a293955a439b595b5"
}
EVIDENCE, true, 512, JSON_THROW_ON_ERROR), self::DEFINITIONS);
    }
    private static function target(int $function): GraphTarget {
        \LeanBridge\CopiedNativeV1\Runtime::ensureProcess();
        if (self::$targets === null) {
            $ffi = self::load();
            self::$targets = [
                new GraphTarget($ffi, 'mutualcheckedrecords_echo_graph', 'mutualcheckedrecords_php_graph_clear', 'mutualcheckedrecords_graph_initialize', 'mutualcheckedrecords_graph_ready', 'mutualcheckedrecords_graph_retire'),
                new GraphTarget($ffi, 'mutualcheckedrecords_echo_groups_graph', 'mutualcheckedrecords_php_graph_clear', 'mutualcheckedrecords_graph_initialize', 'mutualcheckedrecords_graph_ready', 'mutualcheckedrecords_graph_retire'),
                new GraphTarget($ffi, 'mutualcheckedrecords_first_graph', 'mutualcheckedrecords_php_graph_clear', 'mutualcheckedrecords_graph_initialize', 'mutualcheckedrecords_graph_ready', 'mutualcheckedrecords_graph_retire'),
                new GraphTarget($ffi, 'mutualcheckedrecords_groups_graph', 'mutualcheckedrecords_php_graph_clear', 'mutualcheckedrecords_graph_initialize', 'mutualcheckedrecords_graph_ready', 'mutualcheckedrecords_graph_retire'),
                new GraphTarget($ffi, 'mutualcheckedrecords_produce_graph', 'mutualcheckedrecords_php_graph_clear', 'mutualcheckedrecords_graph_initialize', 'mutualcheckedrecords_graph_ready', 'mutualcheckedrecords_graph_retire'),
                new GraphTarget($ffi, 'mutualcheckedrecords_second_graph', 'mutualcheckedrecords_php_graph_clear', 'mutualcheckedrecords_graph_initialize', 'mutualcheckedrecords_graph_ready', 'mutualcheckedrecords_graph_retire'),
            ];
        }
        return self::$targets[$function];
    }
    public static function call(int $function, array $arguments): mixed {
        try {
            return GraphRuntime::call($function, static fn(): GraphTarget => self::target($function), $arguments);
        } catch (GraphInvalidNative $error) {
            throw new \LeanMutualcheckedrecords\LeanBridgeError($error->getMessage(), 4, $error);
        }
    }
}
