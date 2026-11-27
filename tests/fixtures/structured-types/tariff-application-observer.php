<?php
declare(strict_types=1);
require __DIR__.'/vendor/autoload.php';
require __DIR__.'/tariff-application.php';

// The client uses only the package API. Observe the already loaded broker
// after its first public call, including after the package's shutdown hook.
$lib=realpath(__DIR__.'/vendor/example/tariff-quotes/native/linux-x64/liblean_bridge_native.so');
if (!$lib || !str_starts_with($lib,__DIR__.'/vendor/')) throw new RuntimeException('missing installed broker');
$live = static function() use ($lib): int {
    static $ffi;
    $ffi ??= FFI::cdef('typedef struct { uint32_t version,state,inits,components,attached,live; uint64_t instance,domain; } snapshot;
void lean_bridge_native_snapshot_read(snapshot *);',$lib);
    $s=$ffi->new('snapshot'); $ffi->lean_bridge_native_snapshot_read(FFI::addr($s));
    if ($s->version !== 1) throw new RuntimeException('unexpected broker ABI');
    return $s->live;
};
$counts=[];
$values=forwardedPrices(static function(string $stage) use ($live,&$counts) {
    if (array_key_exists($stage,$counts)) throw new LogicException('duplicate checkpoint');
    $counts[$stage]=$live();
});
register_shutdown_function(static function() use ($counts,$values,$live) {
    $counts['afterShutdown']=$live();
    echo json_encode(['counts'=>$counts,'values'=>$values,'php'=>PHP_VERSION],JSON_THROW_ON_ERROR),"\n";
});
