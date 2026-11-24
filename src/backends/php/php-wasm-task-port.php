<?php
declare(strict_types=1);
namespace __LB_PUBLIC__\Internal;

/** @internal Per-declaration functions supply the shape and the private owner key. */
final class Port {
    private const LEASES=/*__LB_LEASES__*/[];
    private static function input(string $kind,mixed $value,Budget $budget): mixed {
        if (!isset(self::LEASES[$kind])) return base64_encode(WireValues::input($kind,$value,$budget));
        if (!is_object($value) || $value::class!==self::LEASES[$kind]) throw new \TypeError('Expected a matching Lean resource');
        $get=\Closure::bind(static fn()=>$value->live(),null,\LeanBridge\WasmHeapV1\Lease::class);
        return $get();
    }
    private static function unpack(object $packet,mixed $expected,?\LeanBridge\Internal\PhpWasmObjectsV1\Scope $objects): object {
        if ($objects?->has($expected)) {
            $key=$packet->claim($expected);
            if (!is_string($key)) throw new \UnexpectedValueException('Missing or already delivered Zend object');
            return $objects->resolve($expected,$key);
        }
        if (!is_string($expected) || !isset(self::LEASES[$expected])) throw new \UnexpectedValueException('Unexpected Lean resource');
        $cap=$packet->claim($expected); $class=self::LEASES[$expected];
        if (!is_object($cap)) throw new \UnexpectedValueException('Missing or already delivered Lean resource');
        try {
            $make=\Closure::bind(static fn()=>new $class($cap),null,\LeanBridge\WasmHeapV1\Lease::class);
            return $make();
        } catch (\Throwable $error) { $cap->close(); throw $error; }
    }
    public static function call(string $key, array $args, array $kinds, ?string $delivery, ?string $class,
            string $declaration, array|string $result, ?array $start, ?array $terminal, array $callbacks=[],
            ?\LeanBridge\Internal\PhpWasmObjectsV1\Domain $domain=null): mixed {
        $budget=new Budget(); $encoded=[];
        $objects=$domain?->open();$scope=$callbacks ? new CallbackScope($callbacks,$args,$objects) : null;
        foreach ($args as $i=>$v) $encoded[]=$kinds[$i]==='callback' ? '' :
            ($objects?->has($kinds[$i])?$objects->pin($kinds[$i],$v):self::input($kinds[$i],$v,$budget));
        $submit=vrzno_shared($key);
        if (!is_callable($submit)) throw new \__LB_PUBLIC__\LeanBridgeError('Missing PHP-Wasm host for '.$declaration);
        $reply=$submit(...$encoded);
        $decode=static function(mixed $packet) use ($declaration,$result,$start,$terminal,$objects): mixed {
            if (is_object($packet)) {
                try {
                    $phase=$packet->form();
                    if ($phase==='value') return self::unpack($packet,$result,$objects);
                    $error=match ($phase) {'start'=>$start,'worker'=>$terminal,default=>null};
                    if ($error===null) throw new \__LB_PUBLIC__\LeanBridgeError('Undeclared resource error in '.$declaration);
                    [$type,$origin,$shape]=$error;
                    throw new $type($origin,self::unpack($packet,$shape,$objects));
                } finally { $packet->discard(); }
            }
            if (!is_string($packet)) throw new \__LB_PUBLIC__\LeanBridgeError('Missing result from '.$declaration);
            $fields=json_decode($packet,true,flags: JSON_THROW_ON_ERROR);
            if ($fields===['cancelled']) throw new \__LB_PUBLIC__\TaskCancelled($declaration.' was cancelled');
            if (!is_array($fields) || !array_is_list($fields) || count($fields)!==3
                || !is_string($fields[1]) || !is_string($fields[2])
                || ($tags=base64_decode($fields[1],true))===false || ($bytes=base64_decode($fields[2],true))===false)
                throw new \__LB_PUBLIC__\LeanBridgeError('Unexpected Lean runtime failure in '.$declaration);
            if ($fields[0]==='value') return WireValues::output($result,$tags,$bytes);
            $error=match ($fields[0]) {'start'=>$start,'worker'=>$terminal,default=>null};
            if ($error===null) throw new \__LB_PUBLIC__\LeanBridgeError('Undeclared error in '.$declaration);
            [$type,$origin,$shape]=$error;
            throw new $type($origin,WireValues::output($shape,$tags,$bytes));
        };
        if (is_string($reply) || $delivery===null || (is_object($reply) && $reply->form()!=='owner')) return $decode($reply);
        if (!is_object($reply)) throw new \__LB_PUBLIC__\LeanBridgeError('Missing task owner for '.$declaration);
        $open=$delivery==='task'
            ? \Closure::bind(static fn()=>new $class($reply,$decode,$scope,$objects),null,\__LB_PUBLIC__\Awaitable::class)
            : \Closure::bind(static fn()=>new $class($reply,$decode,$objects),null,\__LB_PUBLIC__\PullStream::class);
        return $open();
    }
}
