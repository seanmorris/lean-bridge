<?php
declare(strict_types=1);
require __DIR__.'/vendor/autoload.php';
use LeanRetained as R;

R\reset();
$registration=new R\RetainedCallback(static fn(int $n):int=>$n);
$weak=WeakReference::create($registration);
$work=R\queued($registration)->ignore();
unset($registration);
$timer=new Amp\TimeoutCancellation(15);
while (R\state()!==3) Amp\delay(.002,cancellation:$timer);
$observer=FFI::cdef('typedef struct { uint32_t abi_version,runtime_state,runtime_init_runs,component_init_runs,attached_components,live_identities; uint64_t runtime_instance_id,identity_domain_id; } snapshot;
void lean_bridge_native_snapshot_read(snapshot *out);');
if ($weak->get()===null || $work->isComplete()) throw new RuntimeException('expected a retained callable and a pending worker');
register_shutdown_function(static function() use ($observer,$weak) {
    // No event loop is driven after exit. The PHP callable must already be
    // released; the non-cooperative worker still needs its own gate opened.
    if ($weak->get()!==null) throw new RuntimeException('PHP callable survived native owner shutdown');
    R\release();
    $s=$observer->new('snapshot'); $deadline=hrtime(true)+5_000_000_000;
    do {
        $observer->lean_bridge_native_snapshot_read(FFI::addr($s));
        if (!$s->live_identities && R\state()===4) break;
        usleep(1000);
    } while (hrtime(true)<$deadline);
    if ($s->live_identities!==0 || R\state()!==4) throw new RuntimeException('revocation did not release the callback or worker');
    echo "shutdown released retained owners\n";
});
