<?php
declare(strict_types=1);

require __DIR__ . '/dependencies/brick-math/autoload.php';
require __DIR__ . '/src/Api.php';
require __DIR__ . '/src/Internal/OwnedRuntime.php';
require __DIR__ . '/loader.php';

use LeanOwnedAggregates\Ticket;
use LeanOwnedAggregates\Internal\{OwnedRuntime, OwnedState, OwnedOwner, OwnedBorrowFrame, NativeBinding, ResourceAccess};

$checks = 0; $phpFailures = 0; $nativeFailures = 0; $remaining = -1;
$injected = new RuntimeException('Injected PHP allocation checkpoint');
function check(bool $condition, string $message = ''): void {
    global $checks; $checks++;
    if (!$condition) throw new RuntimeException('PHP native ownership: ' . $message);
}
function reject(callable $call, int $status): void {
    try { $call(); } catch (Throwable $error) {
        check($error instanceof LeanOwnedAggregates\LeanBridgeError, get_class($error));
        check($error->getCode() === $status, $error->getMessage()); return;
    }
    throw new RuntimeException('Missing native PHP rejection');
}
function retain_binding(NativeBinding $input): NativeBinding {
    $state = $input->state(); $ffi = $state->runtime->ffi; $owner = new OwnedOwner($state);
    try {
        $output = $ffi->new('void *');
        OwnedRuntime::checked($ffi->owned_test_retain($state->requireOpen(), $input->raw($state), FFI::addr($output), FFI::addr($owner->value())));
        $binding = new NativeBinding($state->adopt($owner), $output, retain_binding(...));
        $owner->publish(); return $binding;
    } finally { $owner->close(); }
}
function new_ticket(OwnedRuntime $runtime, int $serial, bool $pair = false): Ticket|array {
    $state = $runtime->current(); $ffi = $runtime->ffi; $owner = new OwnedOwner($state);
    try {
        $output = $ffi->new('void *');
        OwnedRuntime::checked($ffi->owned_test_new($state->requireOpen(), $serial, FFI::addr($output), FFI::addr($owner->value())));
        $lease = $state->adopt($owner);
        $ticket = ResourceAccess::wrap(Ticket::class, new NativeBinding($lease, $output, retain_binding(...)));
        if ($pair) $other = ResourceAccess::wrap(Ticket::class, new NativeBinding($lease, $output, retain_binding(...)));
        $owner->publish(); return $pair ? [$ticket, $other] : $ticket;
    } finally { $owner->close(); }
}
function serial(Ticket $ticket): int {
    $binding = ResourceAccess::binding($ticket); $state = $binding->state(); $ffi = $state->runtime->ffi;
    $owner = new OwnedOwner($state);
    try {
        $output = $ffi->new('uint64_t');
        OwnedRuntime::checked($ffi->owned_test_serial($state->requireOpen(), $binding->raw($state), FFI::addr($output), FFI::addr($owner->value())));
        return $output->cdata;
    } finally { $owner->close(); }
}

$ffi = LeanBridge\CopiedNativeV1\Runtime::load(__DIR__ . '/runtime/lib',
    json_decode(file_get_contents(__DIR__ . '/native-evidence.json'), true, 512, JSON_THROW_ON_ERROR),
    file_get_contents(__DIR__ . '/native.ffi'));
$runtime = new OwnedRuntime($ffi, LeanBridge\CopiedNativeV1\Runtime::ensureProcess(...), static function() use (&$remaining, $injected): void {
    if ($remaining === 0) throw $injected;
    if ($remaining > 0) $remaining--;
});
$state = $runtime->current();
if (($argv[1] ?? '') === 'shutdown') {
    $ticket = new_ticket($runtime, 99);
    check(serial($ticket) === 99);
    // The C library's finalizer independently requires zero allocations and
    // identities after PHP's registered ownership shutdown has run.
    echo json_encode(['shutdownCleanup' => true, 'checks' => $checks]), "\n";
    exit;
}
$base = $ffi->owned_test_live(); $baseIdentities = $ffi->owned_test_identities();
check($base === 1 && $baseIdentities === 1, 'one open session');
$ticket = new_ticket($runtime, 42); check(serial($ticket) === 42);
$kept = $ticket->retain(); check(serial($kept) === 42);
$ticket->close(); $ticket->close(); reject(fn() => serial($ticket), 4);
check(serial($kept) === 42); $kept->close();
check($ffi->owned_test_live() === $base); check($ffi->owned_test_identities() === $baseIdentities);
[$left, $right] = new_ticket($runtime, 55, true);
$left->close(); check(serial($right) === 55); $right->close();
check($ffi->owned_test_live() === $base);

$ticket = new_ticket($runtime, 77); $binding = ResourceAccess::binding($ticket);
$frame = new OwnedBorrowFrame($state);
$borrowed = ResourceAccess::wrap(Ticket::class, new NativeBinding($frame->lease, $binding->raw($state), retain_binding(...)));
check(serial($borrowed) === 77); $retainedBorrow = $borrowed->retain();
$frame->close(); reject(fn() => serial($borrowed), 4); reject(fn() => $borrowed->retain(), 4);
$ticket->close(); check(serial($retainedBorrow) === 77);
$borrowed->close(); $retainedBorrow->close(); unset($frame, $binding);
check($ffi->owned_test_live() === $base);

$owner = new OwnedOwner($state); $output = $ffi->new('void *');
OwnedRuntime::checked($ffi->owned_test_new($state->requireOpen(), 88, FFI::addr($output), FFI::addr($owner->value())));
$partial = ResourceAccess::wrap(Ticket::class, new NativeBinding($state->adopt($owner), $output, retain_binding(...)));
$owner->close(); reject(fn() => serial($partial), 4); $partial->close();
check($ffi->owned_test_live() === $base);
$emptyOwner = new OwnedOwner($state); reject(fn() => $state->adopt($emptyOwner), 1); $emptyOwner->close();

$ticket = new_ticket($runtime, 101); $otherRuntime = new OwnedRuntime($ffi);
$foreign = $otherRuntime->current();
reject(fn() => ResourceAccess::binding($ticket)->raw($foreign), 1);
$foreignOwner = new OwnedOwner($foreign); reject(fn() => $state->adopt($foreignOwner), 1);
$foreignOwner->close(); $otherRuntime->close();
check(serial($ticket) === 101);
$fiber = new Fiber(static function() use ($ticket, $runtime): void {
    reject(fn() => serial($ticket), 5); reject(fn() => $ticket->retain(), 5);
    reject(fn() => $ticket->close(), 5); reject(fn() => $runtime->current(), 5);
});
$fiber->start(); check($fiber->isTerminated()); check(serial($ticket) === 101);
$ticket->close(); unset($fiber);

$dropped = new_ticket($runtime, 202); $before = $ffi->owned_test_live();
$fiber = new Fiber(static function() use (&$dropped): void { $dropped = null; gc_collect_cycles(); });
$fiber->start(); check($ffi->owned_test_live() === $before);
$state->requireOpen(); check($ffi->owned_test_live() === $base); unset($fiber);

if (!function_exists('pcntl_fork')) throw new RuntimeException('Native ownership probe requires pcntl');
$ticket = new_ticket($runtime, 303); $pid = pcntl_fork();
if ($pid === -1) throw new RuntimeException('fork failed');
if ($pid === 0) {
    try {
        reject(fn() => serial($ticket), 6); reject(fn() => $ticket->close(), 6);
        reject(fn() => $runtime->current(), 6); reject(fn() => $runtime->close(), 6);
        exit(0);
    } catch (Throwable $error) { fwrite(STDERR, $error->getMessage()); exit(91); }
}
pcntl_waitpid($pid, $status); check(pcntl_wifexited($status) && pcntl_wexitstatus($status) === 0);
check(serial($ticket) === 303); $ticket->close(); check($ffi->owned_test_live() === $base);

for ($index = 0; $index < 40; $index++) {
    $value = null; $remaining = $index;
    try { $value = new_ticket($runtime, 404, true); }
    catch (Throwable $error) { check($error === $injected, $error->getMessage()); $phpFailures++; }
    finally { $remaining = -1; if ($value !== null) foreach ($value as $ticket) $ticket->close(); }
    check($ffi->owned_test_live() === $base, 'PHP allocation cleanup');
    check($ffi->owned_test_identities() === $baseIdentities);
}
for ($index = 0; $index < 80; $index++) {
    $value = null; $ffi->owned_test_fail_after($index);
    try { $value = new_ticket($runtime, 505); }
    catch (Throwable $error) { check($error->getCode() === 3, $error->getMessage()); $nativeFailures++; }
    finally { $ffi->owned_test_fail_after(-1); $value?->close(); }
    check($ffi->owned_test_live() === $base, 'native allocation cleanup');
    check($ffi->owned_test_identities() === $baseIdentities);
}
check($phpFailures > 0); check($nativeFailures > 0);
$ticket = new_ticket($runtime, 606); check(serial($ticket) === 606); $runtime->close();
reject(fn() => serial($ticket), 4); $ticket->close(); $runtime->close();
reject(fn() => $runtime->current(), 4);
check($ffi->owned_test_live() === 0); check($ffi->owned_test_identities() === 0);
echo json_encode(['checks' => $checks, 'phpFailures' => $phpFailures, 'nativeFailures' => $nativeFailures,
    'live' => $ffi->owned_test_live(), 'identities' => $ffi->owned_test_identities()]), "\n";
