<?php
declare(strict_types=1);
namespace LeanRecursivecheckedrecords\Internal;

require_once __DIR__ . '/Runtime.php';
require_once __DIR__ . '/GraphNative.php';

final class Native
{
    private const DEFINITIONS = <<<'CDEFS'
uint32_t recursivecheckedrecords_graph_initialize(void);
int recursivecheckedrecords_graph_ready(void);
void recursivecheckedrecords_graph_retire(void);
void recursivecheckedrecords_php_graph_clear(void *);
const char *recursivecheckedrecords_graph_error(void);
uint32_t recursivecheckedrecords_echo_graph(const void *, void *);
uint32_t recursivecheckedrecords_echo_groups_graph(const void *, void *);
uint32_t recursivecheckedrecords_first_graph(const void *, void *);
uint32_t recursivecheckedrecords_groups_graph(const void *, void *);
uint32_t recursivecheckedrecords_produce_graph(const void *, void *);
uint32_t recursivecheckedrecords_second_graph(const void *, void *);
CDEFS;
    private static ?array $targets = null;
    private static function load(): \FFI {
        return \LeanBridge\CopiedNativeV1\Runtime::load(__DIR__ . '/../../native/linux-x64', json_decode(<<<'EVIDENCE'
{
  "componentId": "recursivecheckedrecords@1.0.0",
  "componentReceiptSha256": "d5b4711a1db312989a3d00c0494c706afbc596f170c9e29496d37091efd6fdbd",
  "copiedGraph": {
    "layoutSha256": "b564479bbec603724b6ab1629e1962aac552aa5775c5a65fdf7a1e063b7c5c94",
    "schemaVersion": 1
  },
  "identity": "8fb598f2a60c8a91a20d1b0d34aac56bd969a1eb2667ee4be5c8b0cf31648eee",
  "libraries": {
    "libcomponent_a1d30b9a0f384ed52541.so": "9f4a6baad4cba0cd5a57730d6a225398f0a9ec36a1fe25cf766f92c64301afe0",
    "liblean_bridge_native.so": "459fcd2098d4b646ab6ae0f4cdccd1f222908cb162562bfc3940a533cd4e4e21",
    "libleanshared.so": "d7768b88d8162736da4305777cd6f147676038fd885bd8a265c958b0ecea00b4",
    "librecursivecheckedrecords.so": "5e792d752f3c1e955642b48769c166c6819be326d8393d586c509f1e82676f4d"
  },
  "library": "librecursivecheckedrecords.so",
  "loadOrder": [
    "libleanshared.so",
    "liblean_bridge_native.so",
    "libcomponent_a1d30b9a0f384ed52541.so",
    "librecursivecheckedrecords.so"
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
                new GraphTarget($ffi, 'recursivecheckedrecords_echo_graph', 'recursivecheckedrecords_php_graph_clear', 'recursivecheckedrecords_graph_initialize', 'recursivecheckedrecords_graph_ready', 'recursivecheckedrecords_graph_retire'),
                new GraphTarget($ffi, 'recursivecheckedrecords_echo_groups_graph', 'recursivecheckedrecords_php_graph_clear', 'recursivecheckedrecords_graph_initialize', 'recursivecheckedrecords_graph_ready', 'recursivecheckedrecords_graph_retire'),
                new GraphTarget($ffi, 'recursivecheckedrecords_first_graph', 'recursivecheckedrecords_php_graph_clear', 'recursivecheckedrecords_graph_initialize', 'recursivecheckedrecords_graph_ready', 'recursivecheckedrecords_graph_retire'),
                new GraphTarget($ffi, 'recursivecheckedrecords_groups_graph', 'recursivecheckedrecords_php_graph_clear', 'recursivecheckedrecords_graph_initialize', 'recursivecheckedrecords_graph_ready', 'recursivecheckedrecords_graph_retire'),
                new GraphTarget($ffi, 'recursivecheckedrecords_produce_graph', 'recursivecheckedrecords_php_graph_clear', 'recursivecheckedrecords_graph_initialize', 'recursivecheckedrecords_graph_ready', 'recursivecheckedrecords_graph_retire'),
                new GraphTarget($ffi, 'recursivecheckedrecords_second_graph', 'recursivecheckedrecords_php_graph_clear', 'recursivecheckedrecords_graph_initialize', 'recursivecheckedrecords_graph_ready', 'recursivecheckedrecords_graph_retire'),
            ];
        }
        return self::$targets[$function];
    }
    public static function call(int $function, array $arguments): mixed {
        try {
            return GraphRuntime::call($function, static fn(): GraphTarget => self::target($function), $arguments);
        } catch (GraphInvalidNative $error) {
            throw new \LeanRecursivecheckedrecords\LeanBridgeError($error->getMessage(), 4, $error);
        }
    }
}
