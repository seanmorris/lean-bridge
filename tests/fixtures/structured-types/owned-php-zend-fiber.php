<?php
$owner = owned_probe_new();
$fiber = new Fiber(function () use ($owner): void {
    rejects(5, fn() => owned_probe_new(), 'fiber_new');
    rejects(5, fn() => owned_probe_check($owner), 'fiber_check');
    rejects(5, fn() => owned_probe_retain($owner), 'fiber_retain');
    rejects(5, fn() => owned_probe_close($owner), 'fiber_explicit_close');
});
$fiber->start();
unset($fiber);
check(owned_probe_check($owner), 'main_after_fiber_rejection');
// Pass the only reference through a mutable holder so its final release occurs
// inside the Fiber, not in the suspended caller's argument slots.
$holder = [$owner]; unset($owner);
$fiber = new Fiber(function () use (&$holder): void {
    $holder = [];
    check(owned_probe_stats()['pending'] === 1, 'fiber_finalizer_deferred');
    check(owned_probe_stats()['identities'] === 1, 'fiber_did_not_enter_lean');
});
$fiber->start(); unset($fiber, $holder);
check(owned_probe_stats()['pending'] === 1, 'stats_do_not_drain');
owned_probe_drain();
check(owned_probe_stats()['identities'] === 0, 'main_drains_lean_identity');
owned_probe_shutdown();
emptyRuntime('fiber_cleanup');
