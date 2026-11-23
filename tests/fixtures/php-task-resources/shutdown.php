<?php
declare(strict_types=1);
require __DIR__.'/vendor/autoload.php';
use LeanCounter as C;
use LeanDepot as D;

function filesHeld(): int {
    $n=0; foreach (glob('/proc/self/fd/*') as $file) if (@readlink($file)==='/dev/null') ++$n; return $n;
}
D\reset(); C\issue(0)->close();
$baseline=filesHeld(); $t=C\issue(77);
$pending=D\pending($t,true)->ignore(); $cursor=D\tickets($t,false); $t->close();
$observer=FFI::cdef('typedef struct { uint32_t abi_version,runtime_state,runtime_init_runs,component_init_runs,attached_components,live_identities; uint64_t runtime_instance_id,identity_domain_id; } snapshot;
void lean_bridge_native_snapshot_read(snapshot *out);');
$ids=static function() use ($observer): int {
    $s=$observer->new('snapshot'); $observer->lean_bridge_native_snapshot_read(FFI::addr($s)); return $s->live_identities;
};
if ($ids()!==3 || filesHeld()!==$baseline+1 || $pending->isComplete()) throw new RuntimeException('Expected pending worker, notification and open cursor to hold one file');
// Runs after the generated cleanup hook. Ordinary application code deliberately
// did not call close(), cancel the worker, or drive the event loop.
register_shutdown_function(static function() use ($ids,$baseline): void {
    $deadline=hrtime(true)+5_000_000_000;
    while (($ids() || filesHeld()!==$baseline) && hrtime(true)<$deadline) usleep(1000);
    if ($ids() || filesHeld()!==$baseline || D\closes()!==1) throw new RuntimeException('Shutdown leaked the loaned resource or closed the cursor incorrectly');
    echo "released worker, stream and file\n";
});
