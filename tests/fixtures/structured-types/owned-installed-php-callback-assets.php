<?php
declare(strict_types=1);
require __DIR__ . '/vendor/autoload.php';

// Loader-boundary observer, not a public consumer or per-call rehash guarantee.
$temperature = $argv[1] ?? ''; $kind = $argv[2] ?? ''; $name = $argv[3] ?? '';
if (!in_array($temperature, ['cold', 'warm'], true) || !in_array($kind, ['changed', 'symlink', 'missing'], true))
    throw new RuntimeException('Unknown asset probe');
$root = __DIR__ . '/vendor/lean-bridge/owned-values/native/linux-x64';
if (!preg_match('/\Alib[A-Za-z0-9_.-]+\.so(?:\.\d+)*\z/', $name)) throw new RuntimeException('Invalid asset name');
$path = $root . '/' . $name; $backup = $path . '.original';
$before = hash_file('sha256', $path);
if ($temperature === 'warm') LeanOwnedAggregates\new_ticket(Brick\Math\BigInteger::of(1), 'warm')->close();
if (!rename($path, $backup)) throw new RuntimeException('Cannot isolate native asset');
$diagnostic = null;
try {
    if ($kind === 'changed') { $bytes = file_get_contents($backup); $bytes[0] = chr(ord($bytes[0]) ^ 1); file_put_contents($path, $bytes); unset($bytes); }
    if ($kind === 'symlink' && !symlink($backup, $path)) throw new RuntimeException('Cannot create negative asset symlink');
    clearstatcache(true, $path);
    try { LeanOwnedAggregates\Internal\OwnedAssets::load(); }
    catch (Throwable $error) { $diagnostic = ['class' => get_class($error), 'message' => $error->getMessage(), 'code' => $error->getCode()]; }
    if ($diagnostic !== ['class' => RuntimeException::class, 'message' => 'Native library differs from compiled evidence: ' . $name, 'code' => 0])
        throw new RuntimeException('Expected exact loader asset rejection: ' . json_encode($diagnostic));
} finally {
    if (is_link($path) || is_file($path)) unlink($path);
    if (!rename($backup, $path)) throw new RuntimeException('Cannot restore native asset');
    clearstatcache(true, $path);
}
if (hash_file('sha256', $path) !== $before) throw new RuntimeException('Native asset restoration differs');
$value = LeanOwnedAggregates\new_ticket(Brick\Math\BigInteger::of(17), 'restored');
if ((string) LeanOwnedAggregates\serial($value->get()) !== '17') throw new RuntimeException('Restored public API failed');
$value->close(); unset($value); gc_collect_cycles();
$registry = new ReflectionProperty(LeanOwnedAggregates\Internal\OwnedStates::class, 'states');
$slots = new ReflectionProperty(LeanOwnedAggregates\Internal\OwnedState::class, 'slots');
$states = $registry->getValue();
$ffi = FFI::cdef('typedef struct {
    uint32_t abi_version, runtime_state, runtime_init_runs, component_init_runs, attached_components, live_identities;
    uint64_t runtime_instance_id, identity_domain_id;
} snapshot; void lean_bridge_native_snapshot_read(snapshot *);', $root . '/liblean_bridge_native.so');
register_shutdown_function(static function() use ($ffi, $temperature, $kind, $name, $before, $diagnostic, $registry, $slots, $states): void {
    $final = $ffi->new('snapshot'); $ffi->lean_bridge_native_snapshot_read(FFI::addr($final));
    $count = array_sum(array_map(fn($state) => count($slots->getValue($state)), $states));
    if ($count !== 0 || count($registry->getValue()) !== 0 || $final->live_identities !== 0)
        throw new RuntimeException('Loader probe cleanup left registered slots or broker identities');
    echo json_encode(['temperature' => $temperature, 'kind' => $kind, 'name' => $name,
        'boundary' => 'loader-reentry', 'diagnostic' => $diagnostic, 'restoredSha256' => $before,
        'restoredPublicCall' => true, 'resultSlots' => $count, 'registeredStates' => count($registry->getValue()),
        'brokerIdentities' => $final->live_identities], JSON_THROW_ON_ERROR), "\n";
});
