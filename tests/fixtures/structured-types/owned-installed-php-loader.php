<?php
declare(strict_types=1);

// Independent observer. The application imports and calls only its public API.
ob_start();
require __DIR__ . '/strict.php';
$consumer = json_decode(ob_get_clean(), true, 512, JSON_THROW_ON_ERROR);
$root = __DIR__ . '/vendor/lean-bridge/owned-values/native/linux-x64';
$ffi = FFI::cdef('typedef struct {
    uint32_t abi_version, runtime_state, runtime_init_runs, component_init_runs, attached_components, live_identities;
    uint64_t runtime_instance_id, identity_domain_id;
} snapshot;
void lean_bridge_native_snapshot_read(snapshot *);', $root . '/liblean_bridge_native.so');
$snapshot = $ffi->new('snapshot'); $ffi->lean_bridge_native_snapshot_read(FFI::addr($snapshot));
// The lazy API keeps one reusable session until request shutdown. All returned
// resources and result owners must already be gone before that session closes.
if ($snapshot->live_identities !== 1 || $snapshot->runtime_init_runs !== 1 || $snapshot->component_init_runs !== 1)
    throw new RuntimeException('Installed ownership cleanup or shared initialization differs: ' . json_encode([
        'live' => $snapshot->live_identities, 'runtime' => $snapshot->runtime_init_runs, 'component' => $snapshot->component_init_runs]));
$mappings = [];
foreach (explode("\n", file_get_contents('/proc/self/maps')) as $line) {
    if (preg_match('~\s(/[^\n]+/(lib(?:[^/]+_php|lean[^/]*|gmp-lean-bridge[^/]*|component_[^/]*)\.so(?:\.\d+)*))$~', $line, $match)) {
        if (!str_starts_with($match[1], $root . '/')) throw new RuntimeException('Library outside relocated deployment');
        $mappings[$match[2]][$match[1]] = true;
    }
}
if (count($mappings) !== 5) throw new RuntimeException('Missing installed native mappings: ' . json_encode(array_keys($mappings)));
foreach ($mappings as $paths) if (count($paths) !== 1) throw new RuntimeException('Duplicate native library mapping');
$dl = FFI::cdef('void *dlopen(const char *, int); void *dlsym(void *, const char *);', 'libdl.so.2');
$gmp = $dl->dlopen($root . '/libgmp-lean-bridge.so.10', 2 | 8 | 4096);
$privateGmp = $dl->dlsym($gmp, '__gmpz_init') != $dl->dlsym(null, '__gmpz_init');
if (!$privateGmp) throw new RuntimeException('Private GMP resolved to shared Lean symbols');
// Registered after the generated runtime's shutdown hook, without invoking a
// private cleanup method from the consumer or bypassing the package bootstrap.
register_shutdown_function(static function() use ($ffi, $consumer, $privateGmp, $mappings): void {
    $final = $ffi->new('snapshot'); $ffi->lean_bridge_native_snapshot_read(FFI::addr($final));
    if ($final->live_identities !== 0) throw new RuntimeException('Automatic PHP session cleanup leaked an identity');
    echo json_encode(['consumer' => $consumer, 'liveIdentities' => $final->live_identities,
        'runtimeInitializations' => $final->runtime_init_runs, 'componentInitializations' => $final->component_init_runs,
        'idleSessionIdentities' => 1, 'automaticShutdown' => true,
        'privateGmp' => $privateGmp, 'mappings' => $mappings], JSON_THROW_ON_ERROR), "\n";
});
