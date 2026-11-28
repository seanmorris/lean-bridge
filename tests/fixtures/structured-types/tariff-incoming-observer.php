<?php
declare(strict_types=1);

require __DIR__ . '/vendor/autoload.php';
require __DIR__ . '/tariff-incoming.php';
if (($argv[1] ?? null) === 'uncaught') incomingTypeError();
if (($argv[1] ?? null) === 'locked') {
    $calls = 0;
    try { \LeanTariffQuotes\visit_quote(40,function($q,$n) use (&$calls) { ++$calls; return $q($n); },2); }
    catch (RuntimeException $error) {
        if ($calls !== 0 || !str_contains($error->getMessage(),'zend.exception_ignore_args')) throw $error;
        $t = \LeanTariffQuotes\make_tariff(6); $answer = ($t->quote)(36); $t->quote->close();
        if ($answer !== 42) throw new LogicException('noncallback API unavailable');
        echo "refused before dispatch\n"; return;
    }
    throw new RuntimeException('unsafe trace configuration accepted');
}
$traceSetting = ini_get('zend.exception_ignore_args');
$lib = realpath(__DIR__ . '/vendor/example/tariff-quotes/native/linux-x64/liblean_bridge_native.so');
if (!$lib || !str_starts_with($lib,__DIR__ . '/vendor/')) throw new RuntimeException('missing installed broker');
$counts = [];
$live = static function() use ($lib): int {
    static $ffi;
    $ffi ??= FFI::cdef('typedef struct { uint32_t version,state,inits,components,attached,live; uint64_t instance,domain; } snapshot;
void lean_bridge_native_snapshot_read(snapshot *);',$lib);
    $s = $ffi->new('snapshot'); $ffi->lean_bridge_native_snapshot_read(FFI::addr($s));
    if ($s->version !== 1) throw new RuntimeException('unexpected broker ABI');
    return $s->live;
};
exerciseIncoming(static function(string $key) use (&$counts,$live) {
    $n = $live();
    if (isset($counts[$key]) || ($key === 'baseline' ? $n !== 1
        : ($key === 'held' ? $n <= $counts['baseline'] : $n !== $counts['baseline'])))
        throw new RuntimeException("unexpected native owners at $key: $n");
    $counts[$key] = $n;
});
try { incomingTypeError(); }
catch (TypeError $expected) {
    if (!str_contains($expected->getMessage(),'strlen()') || $live() !== $counts['baseline']) throw $expected;
    if (!str_contains($expected->getTraceAsString(),'incomingTypeError')) throw new LogicException('lost application frame');
}
// Even exceptions saved by user code without throwing through Lean stay printable.
$saved = \LeanTariffQuotes\visit_quote(1,static function($q,$n) use (&$trace) {
    $trace = new RuntimeException('saved inside callback'); return $q($n);
},1);
if ($saved !== 2 || !str_contains($trace->getTraceAsString(),'visit_quote')
    || $traceSetting !== ini_get('zend.exception_ignore_args') || $live() !== $counts['baseline'])
    throw new LogicException('callback trace or host trace policy was not preserved');
register_shutdown_function(static function() use ($counts,$live) {
    $counts['afterShutdown'] = $live();
    if ($counts['afterShutdown'] !== 0) throw new RuntimeException('native owners survived shutdown');
    echo json_encode(['php'=>PHP_VERSION,'counts'=>$counts],JSON_THROW_ON_ERROR),"\n";
});
