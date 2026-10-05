<?php
declare(strict_types=0);

$checks = 0;
function check(bool $condition, string $label): void {
    ++$GLOBALS['checks'];
    if (!$condition) throw new RuntimeException($label . ': ' . json_encode(owned_probe_stats()));
}
function rejects(int $status, callable $call, string $label): void {
    try { $call(); } catch (Exception $failure) {
        check($failure->getCode() === $status, $label . '_status_' . $failure->getCode());
        return;
    }
    throw new RuntimeException($label . '_accepted');
}
function emptyRuntime(string $label): void {
    $stats = owned_probe_stats();
    foreach (['live', 'leases', 'pending', 'identities', 'scopes'] as $key)
        check($stats[$key] === 0, $label . '_' . $key);
    check(!$stats['current'] && !$stats['retired'], $label . '_state');
}
function sameRuntime(array $baseline, string $label): void {
    $stats = owned_probe_stats();
    foreach (['live', 'leases', 'pending', 'identities', 'scopes', 'current', 'retired'] as $key)
        check($stats[$key] === $baseline[$key], $label . '_' . $key);
}

emptyRuntime('initial');
check(PHP_INT_SIZE * 8 === OWNED_EXPECTED_BITS && owned_probe_stats()['phpBits'] === OWNED_EXPECTED_BITS, 'actual_word_width');
$owner = owned_probe_new();
check(owned_probe_check($owner), 'real_compiled_lean_high_token');
$view = owned_probe_view($owner);
$retained = owned_probe_retain($view);
check(owned_probe_stats()['leases'] === 2, 'independent_retained_lease');
check(owned_probe_stats()['identities'] === 1, 'shared_lean_identity');
owned_probe_close($owner);
owned_probe_close($owner);
rejects(4, fn() => owned_probe_check($owner), 'closed_original');
check(owned_probe_check($view) && owned_probe_check($retained), 'views_survive_original_close');
owned_probe_close($view);
check(owned_probe_check($retained), 'retained_survives_shared_lease');
rejects(1, fn() => owned_probe_wrong_type($retained), 'nominal_kind');
$foreign = fopen('php://memory', 'r+');
foreach ([$foreign, 1, null, new stdClass(), []] as $invalid)
    rejects(1, fn() => owned_probe_check($invalid), 'foreign_value');
fclose($foreign);
unset($foreign, $invalid, $owner, $view, $retained);
owned_probe_shutdown();
emptyRuntime('owned_cleanup');

$owner = owned_probe_new();
$escaped = $saved = $nested = null;
owned_probe_borrow($owner, function ($borrow) use (&$owner, &$escaped, &$saved, &$nested): void {
    $escaped = owned_probe_view($borrow);
    check(owned_probe_check($borrow), 'borrow_live');
    owned_probe_close($owner);
    check(owned_probe_check($borrow), 'borrow_pins_closed_owner');
    $saved = owned_probe_retain($borrow);
    owned_probe_borrow($borrow, function ($inner) use ($borrow, &$nested): void {
        $nested = $inner;
        check(owned_probe_check($inner) && owned_probe_check($borrow), 'ancestor_scope_visible');
    });
    rejects(4, fn() => owned_probe_check($nested), 'nested_borrow_expires');
    check(owned_probe_check($borrow), 'outer_scope_still_live');
});
rejects(4, fn() => owned_probe_check($escaped), 'escaped_borrow_check');
rejects(4, fn() => owned_probe_retain($escaped), 'escaped_borrow_retain');
check(owned_probe_check($saved), 'retained_borrow_survives');
owned_probe_close($escaped);
owned_probe_close($nested);
unset($owner, $escaped, $saved, $nested);
owned_probe_shutdown();
emptyRuntime('borrow_cleanup');

$owner = owned_probe_new();
$baseline = owned_probe_stats();
$original = new RuntimeException('original_callback_failure', 901);
try {
    owned_probe_borrow($owner, function ($borrow) use ($original): void {
        check(owned_probe_check($borrow), 'throwing_callback_argument');
        throw $original;
    });
    throw new RuntimeException('original_failure_lost');
} catch (Throwable $caught) { check($caught === $original, 'exception_identity'); }
sameRuntime($baseline, 'exception_cleanup');
try {
    owned_probe_borrow($owner, fn($borrow) => new class($borrow) {
        public function __construct(public mixed $borrow) {}
        public function __destruct() {
            rejects(4, fn() => owned_probe_check($this->borrow), 'borrow_expires_before_reply_dtor');
            throw new RuntimeException('reply_destructor', 902);
        }
    });
    throw new RuntimeException('destructor_failure_lost');
} catch (RuntimeException $caught) { check($caught->getCode() === 902, 'reply_destructor_exception'); }
unset($caught);
sameRuntime($baseline, 'destructor_cleanup');
try {
    owned_probe_cleanup($original, fn() => new class {
        public function __destruct() { throw new RuntimeException('secondary_cleanup_failure', 903); }
    });
    throw new RuntimeException('cleanup_overwrote_original');
} catch (Throwable $caught) { check($caught === $original, 'cleanup_preserves_original_exception'); }
sameRuntime($baseline, 'second_exception_cleanup');
unset($caught, $original, $owner);
owned_probe_shutdown();
emptyRuntime('exception_end');

// The pinned wasm32 host cannot start Fibers because getcontext is absent.
// Execute this same C runtime's real Fiber cases in the native Zend companion.
if (OWNED_EXPECTED_BITS === 64) require __DIR__ . '/fiber.php';
else check(Fiber::getCurrent() === null, 'wasm_main_context');

$faults = [];
// Every counted C allocation is denied once, including initial state creation.
for ($point = 1; $point < 100; ++$point) {
    owned_probe_fault($point);
    $value = null; $failed = false;
    try { $value = owned_probe_new(); } catch (Exception $failure) {
        check($failure->getCode() === 3, 'cold_new_fault_status'); $failed = true;
    }
    $attempts = owned_probe_stats()['attempts'];
    owned_probe_fault(0);
    if ($value !== null) check(owned_probe_check($value), 'cold_new_recovery');
    unset($value, $failure);
    owned_probe_shutdown(); emptyRuntime('cold_new_fault_' . $point);
    if (!$failed) { check($attempts < $point, 'cold_new_exhausted'); $faults['coldNew'] = $point - 1; break; }
}
check(isset($faults['coldNew']) && $faults['coldNew'] > 0, 'cold_new_fault_coverage');
$owner = owned_probe_new();
$operations = [
    'new' => fn() => owned_probe_new(),
    'view' => fn() => owned_probe_view($owner),
    'retain' => fn() => owned_probe_retain($owner),
    'borrow' => fn() => owned_probe_borrow($owner, fn($value) => null),
    'borrowRetain' => fn() => owned_probe_borrow($owner, fn($value) => owned_probe_retain($value)),
    'check' => fn() => owned_probe_check($owner),
];
$baseline = owned_probe_stats();
foreach ($operations as $name => $operation) {
    for ($point = 1; $point < 100; ++$point) {
        owned_probe_fault($point);
        $value = null; $failed = false;
        try { $value = $operation(); } catch (Exception $failure) {
            check($failure->getCode() === 3, $name . '_fault_status'); $failed = true;
        }
        $attempts = owned_probe_stats()['attempts'];
        owned_probe_fault(0);
        unset($value, $failure);
        sameRuntime($baseline, $name . '_fault_' . $point);
        check(owned_probe_check($owner), $name . '_anchor_survives');
        if (!$failed) { check($attempts < $point, $name . '_exhausted'); $faults[$name] = $point - 1; break; }
    }
    check(isset($faults[$name]) && $faults[$name] > 0, $name . '_fault_coverage');
}
unset($operations, $operation, $owner);
owned_probe_shutdown();
emptyRuntime('allocation_cleanup');

$owner = owned_probe_new();
$escaped = null;
owned_probe_borrow($owner, function ($borrow) use (&$owner, &$escaped): void {
    $escaped = $borrow;
    owned_probe_shutdown();
    rejects(4, fn() => owned_probe_check($borrow), 'shutdown_invalidates_borrow');
    owned_probe_close($owner);
    owned_probe_close($borrow);
});
unset($owner, $escaped);
emptyRuntime('shutdown_during_callback');
$owner = owned_probe_new();
check(owned_probe_check($owner), 'reopen_after_active_shutdown');
unset($owner); owned_probe_shutdown(); emptyRuntime('final');
echo json_encode(['checks' => $checks, 'faults' => $faults, 'fiberExecution' => OWNED_EXPECTED_BITS === 64, 'stats' => owned_probe_stats()], JSON_THROW_ON_ERROR);
