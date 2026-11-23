<?php
declare(strict_types=1);
require __DIR__.'/vendor/autoload.php';

use LeanPulse as P;

// Keep both owners reachable until PHP shutdown. Neither receives an explicit
// close and no event loop is driven during this application exit.
P\reset();
$cursor=P\series(false,false,'unused');
$future=P\late(true,13)->ignore();
$observer=FFI::cdef('typedef struct { uint32_t abi_version,runtime_state,runtime_init_runs,component_init_runs,attached_components,live_identities; uint64_t runtime_instance_id,identity_domain_id; } snapshot;
void lean_bridge_native_snapshot_read(snapshot *out);');
$live=static function() use ($observer): int {
    $s=$observer->new('snapshot'); $observer->lean_bridge_native_snapshot_read(FFI::addr($s)); return $s->live_identities;
};
if ($future->isComplete() || $live()!==3) throw new RuntimeException('Expected cursor, pending task and notification');
register_shutdown_function(static function() use ($live) {
    // The generated shutdown hook ran first. Let the cancelled worker finish
    // dropping its own notification reference, with a bounded test-only wait.
    $until=hrtime(true)+5_000_000_000;
    while ($live() && hrtime(true)<$until) usleep(1000);
    if ($live() || P\closes()!==1) throw new RuntimeException('Shutdown leaked an owner or missed the Lean cursor close');
    echo "shutdown released all owners\n";
});
