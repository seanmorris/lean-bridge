<?php
declare(strict_types=1);

// Observer only. The separately hashed consumer uses exclusively public APIs.
ob_start();
require __DIR__ . '/' . ($argv[2] ?? 'strict') . '.php';
$consumer = json_decode(ob_get_clean(), true, 512, JSON_THROW_ON_ERROR);
$registry = new ReflectionProperty(LeanOwnedAggregates\Internal\OwnedStates::class, 'states');
$slots = new ReflectionProperty(LeanOwnedAggregates\Internal\OwnedState::class, 'slots');
$states = $registry->getValue();
if (count($states) !== 1) throw new RuntimeException('Expected one idle registered PHP state');
$registeredSlots = array_sum(array_map(fn($state) => count($slots->getValue($state)), $states));
if ($registeredSlots !== 0) throw new RuntimeException('Public consumer left registered result slots');
$root = __DIR__ . '/vendor/lean-bridge/owned-values/native/linux-x64';
$ffi = FFI::cdef('typedef struct {
    uint32_t abi_version, runtime_state, runtime_init_runs, component_init_runs, attached_components, live_identities;
    uint64_t runtime_instance_id, identity_domain_id;
} snapshot;
void lean_bridge_native_snapshot_read(snapshot *);', $root . '/liblean_bridge_native.so');
$snapshot = $ffi->new('snapshot'); $ffi->lean_bridge_native_snapshot_read(FFI::addr($snapshot));
if ($snapshot->live_identities !== 1 || $snapshot->runtime_init_runs !== 1 || $snapshot->component_init_runs !== 1)
    throw new RuntimeException('Expected one idle session broker identity and shared initialization');
$mappings = [];
foreach (explode("\n", file_get_contents('/proc/self/maps')) as $line) {
    if (preg_match('~\s(/[^\n]+/(lib(?:[^/]+_php|lean[^/]*|gmp-lean-bridge[^/]*|component_[^/]*)\.so(?:\.\d+)*))$~', $line, $match)) {
        if (!str_starts_with($match[1], $root . '/')) throw new RuntimeException('Library outside relocated deployment');
        $mappings[$match[2]][$match[1]] = true;
    }
}
if (count($mappings) !== 5) throw new RuntimeException('Missing installed native mappings');
foreach ($mappings as $paths) if (count($paths) !== 1) throw new RuntimeException('Duplicate native mapping');
$dl = FFI::cdef('void *dlopen(const char *, int); void *dlsym(void *, const char *);', 'libdl.so.2');
$gmp = $dl->dlopen($root . '/libgmp-lean-bridge.so.10', 2 | 8 | 4096);
$privateGmp = $dl->dlsym($gmp, '__gmpz_init') != $dl->dlsym(null, '__gmpz_init');
if (!$privateGmp) throw new RuntimeException('Private GMP bound to global Lean symbols');
register_shutdown_function(static function() use ($ffi, $consumer, $registry, $slots, $states, $privateGmp, $mappings): void {
    $final = $ffi->new('snapshot'); $ffi->lean_bridge_native_snapshot_read(FFI::addr($final));
    $registeredSlots = array_sum(array_map(fn($state) => count($slots->getValue($state)), $states));
    $registeredStates = count($registry->getValue());
    if ($final->live_identities !== 0 || $registeredSlots !== 0 || $registeredStates !== 0)
        throw new RuntimeException('Automatic shutdown left registered PHP slots or broker identities');
    echo json_encode(['consumer' => $consumer, 'resultSlots' => $registeredSlots,
        'registeredStates' => $registeredStates, 'brokerIdentities' => $final->live_identities,
        'idleSessionIdentities' => 1, 'automaticShutdown' => true, 'privateGmp' => $privateGmp,
        'runtimeInitializations' => $final->runtime_init_runs, 'componentInitializations' => $final->component_init_runs,
        'mappings' => $mappings], JSON_THROW_ON_ERROR), "\n";
});
