<?php
declare(strict_types=1);

require __DIR__ . '/vendor/autoload.php';
require __DIR__ . '/tariff-fields.php';
$lib = realpath(__DIR__ . '/vendor/example/tariff-quotes/native/linux-x64/liblean_bridge_native.so');
if (!$lib || !str_starts_with($lib, __DIR__ . '/vendor/')) throw new RuntimeException('missing installed broker');
// Attach only after the public API has authenticated and loaded its broker.
$live = static function() use ($lib): int {
    static $ffi;
    $ffi ??= FFI::cdef('typedef struct { uint32_t abi_version, runtime_state, runtime_init_runs, component_init_runs, attached_components, live_identities; uint64_t runtime_instance_id, identity_domain_id; } snapshot;
void lean_bridge_native_snapshot_read(snapshot *);', $lib);
    $s = $ffi->new('snapshot'); $ffi->lean_bridge_native_snapshot_read(FFI::addr($s)); return $s->live_identities;
};
$observed = exercise($live);
// Registered after the component initialized its own shutdown hook.
register_shutdown_function(static function() use ($observed, $live) {
    $afterShutdown = $live();
    if ($afterShutdown !== 0) throw new RuntimeException('native identities survived PHP shutdown');
    echo json_encode($observed + ['afterShutdown' => $afterShutdown, 'php' => PHP_VERSION], JSON_THROW_ON_ERROR), "\n";
});
