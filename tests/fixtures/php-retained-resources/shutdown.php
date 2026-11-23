<?php
declare(strict_types=1);
require __DIR__.'/vendor/autoload.php';
use LeanCounter as C;
use LeanDepot as D;

function held(): int {
    $n=0; foreach (glob('/proc/self/fd/*') as $p) if (@readlink($p)==='/dev/null') ++$n; return $n;
}
$baseline=held(); $ticket=C\issue(7);
$registered=new D\RetainedCallback(static function(int $v): int { throw new LogicException('unexpected PHP callback during shutdown'); });
$weak=WeakReference::create($registered); $work=D\revisit($ticket,$registered)->ignore();
$ticket->close(); unset($registered);
if ($weak->get()===null || $work->isComplete() || held()!==$baseline+1) throw new RuntimeException('missing pending worker, PHP callback or retained file');
$observer=FFI::cdef('typedef struct { uint32_t abi_version,runtime_state,runtime_init_runs,component_init_runs,attached_components,live_identities; uint64_t runtime_instance_id,identity_domain_id; } snapshot;
void lean_bridge_native_snapshot_read(snapshot *out);');
// Registered after the generated component hook; do not pump the event loop.
register_shutdown_function(static function() use ($observer,$weak,$baseline) {
    if ($weak->get()!==null) throw new RuntimeException('shutdown retained the PHP callable');
    $deadline=hrtime(true)+10_000_000_000; $s=$observer->new('snapshot');
    do {
        $observer->lean_bridge_native_snapshot_read(FFI::addr($s));
        if (!$s->live_identities && held()===$baseline) { echo "released callback, worker and file\n"; return; }
        usleep(1000);
    } while (hrtime(true)<$deadline);
    throw new RuntimeException('shutdown retained a worker identity or the loaned file');
});
