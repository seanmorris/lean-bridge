<?php
declare(strict_types=1);
require __DIR__ . '/probe.php';

use Brick\Math\BigInteger as Big;
use LeanOwnedAggregates\Internal\Native;
use function LeanOwnedAggregates\{new_ticket, retain_ticket, transfer_ticket, copy_value, echo_array};

function balanced(): void {
    gc_collect_cycles(); $stats = owned_transfer_stats();
    check($stats['nativeLive'] === 0 && $stats['identities'] === 0, json_encode($stats));
    check($stats['scopes'] === 0 && $stats['depth'] === 0, json_encode($stats));
}
$root = new_ticket(Big::of(77), 'fiber'); $alias = $root->share(); $view = retain_ticket($root);
$before = owned_transfer_stats();
$fiber = new Fiber(static function() use ($root, $view): void {
    reject(fn() => $root->get(), 5); reject(fn() => $root->close(), 5);
    reject(fn() => $root->share(), 5); reject(fn() => $root->retain(), 5);
    reject(fn() => retain_ticket($root), 5); reject(fn() => transfer_ticket($root), 5);
    reject(fn() => $view->equals($root), 5);
});
$fiber->start(); check($fiber->isTerminated()); unset($fiber);
check(owned_transfer_stats()['handoffs'] === $before['handoffs']);
check(!$root->closed() && !$view->closed());
dispose([$root, $alias, $view]); unset($root, $alias, $view); balanced();

foreach ([false, true] as $empty) {
    $root = $empty ? copy_value([], resultOf: 'echo_array') : new_ticket(Big::of(77), 'deferred');
    $view = $empty ? echo_array($root) : retain_ticket($root);
    $before = owned_transfer_stats(); $holder = [$root]; unset($root);
    $fiber = new Fiber(static function() use (&$holder, $before): void {
        $holder = []; gc_collect_cycles();
        $after = owned_transfer_stats();
        check($after['nativeLive'] === $before['nativeLive'], 'Fiber finalizer never enters Lean');
        check($after['identities'] === $before['identities'], 'Fiber finalizer defers identities');
    });
    $fiber->start(); unset($fiber, $holder);
    check($view->closed(), 'implicit last-root release expires descendants in a Fiber');
    $probe = new_ticket(Big::of(88), 'drain'); $probe->close();
    dispose($view); unset($probe, $view); balanced();
}

$root = new_ticket(Big::of(77), 'fork'); $view = retain_ticket($root);
if (!function_exists('pcntl_fork')) throw new RuntimeException('Native Zend companion requires pcntl');
$pid = pcntl_fork(); if ($pid === -1) throw new RuntimeException('fork failed');
if ($pid === 0) {
    try {
        reject(fn() => $root->get(), 6); reject(fn() => $root->close(), 6);
        reject(fn() => transfer_ticket($root), 6); exit(0);
    } catch (Throwable $error) { fwrite(STDERR, (string) $error); exit(93); }
}
pcntl_waitpid($pid, $status); check(pcntl_wifexited($status) && pcntl_wexitstatus($status) === 0);
check(!$root->closed() && !$view->closed());
dispose([$root, $view]); unset($root, $view); balanced();
Native::close(); gc_collect_cycles(); $stats = owned_transfer_stats();
check($stats['live'] === 0 && $stats['identities'] === 0, json_encode($stats));
echo json_encode(['checks' => $checks, 'phpBits' => $stats['phpBits'], 'fiberExecution' => true, 'forkExecution' => true,
    'live' => $stats['live'], 'identities' => $stats['identities']]);
