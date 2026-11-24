<?php
declare(strict_types=1);
namespace __LB_PUBLIC__\Internal;

/** @internal Per-declaration functions supply the shape and the private owner key. */
final class Port {
    public static function call(string $key, array $args, array $kinds, ?string $delivery, ?string $class,
            string $declaration, array|string $result, ?array $start, ?array $terminal): mixed {
        $budget=new Budget(); $encoded=[];
        foreach ($args as $i=>$v) $encoded[]=base64_encode(WireValues::input($kinds[$i],$v,$budget));
        $submit=vrzno_shared($key);
        if (!is_callable($submit)) throw new \__LB_PUBLIC__\LeanBridgeError('Missing PHP-Wasm host for '.$declaration);
        $reply=$submit(...$encoded);
        $decode=static function(mixed $packet) use ($declaration,$result,$start,$terminal): mixed {
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
        if (is_string($reply) || $delivery===null) return $decode($reply);
        if (!is_object($reply)) throw new \__LB_PUBLIC__\LeanBridgeError('Missing task owner for '.$declaration);
        $scope=$delivery==='task' ? \__LB_PUBLIC__\Awaitable::class : \__LB_PUBLIC__\PullStream::class;
        $open=\Closure::bind(static fn()=>new $class($reply,$decode),null,$scope);
        return $open();
    }
}
