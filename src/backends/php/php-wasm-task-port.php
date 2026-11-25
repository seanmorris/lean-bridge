<?php
declare(strict_types=1);
namespace __LB_PUBLIC__\Internal;
use LeanBridge\Internal\PhpWasmTasksV1\MemberStack;

/** @internal The per-site public class supplies the PHP return type. */
abstract class BoundFunction {
    final protected function __construct(private ?object $cap,private readonly array $site,
            private readonly string $declaration,private readonly ?array $error) {}
    final protected function apply(mixed $value): mixed {
        $ctx=($this->site[3])();
        if ($ctx===null || $this->cap===null) throw new \LogicException('Returned PHP-Wasm function is closed');
        [$binding,$domain,$members]=$ctx;$cap=$this->cap;
        return Port::call(static fn(...$args)=>$cap->run(...$args),[$value],[$this->site[1]],null,null,
            $this->declaration,$this->site[2],$this->error,null,[],$domain,$members,$binding);
    }
    final public function close(): void {
        if ($this->cap===null) return;
        $cap=$this->cap;$this->cap=null;
        try {$cap->close();} finally {$ctx=($this->site[3])();if ($ctx!==null) $ctx[1]->collect();}
    }
    final public function __destruct() {try {$this->close();} catch (\Throwable) {}}
    private function __clone() {}
    final public function __serialize(): array {throw new \LogicException('Cannot serialize a returned Lean function');}
    final public function __unserialize(array $data): void {throw new \LogicException('Cannot restore a returned Lean function');}
}

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
        if ($objects!==null && is_array($expected)) {
            $tags=$packet->tags();
            if (!is_string($tags) || strlen($tags)>32) throw new \UnexpectedValueException('Invalid Zend object branch tags');
            $type=$expected;
            foreach (str_split($tags) as $tag) {
                if (!is_array($type) || ($tag!=='0' && $tag!=='1')) throw new \UnexpectedValueException('Unexpected Zend object branch');
                $type=$type[$tag==='1'?0:1];
            }
            if (!is_string($type) || (!$objects->has($type) && !isset(self::LEASES[$type]))) throw new \UnexpectedValueException('Missing object result branch');
            $value=self::unpack($packet,$type,$objects);
            for ($i=strlen($tags)-1;$i>=0;--$i) $value=$tags[$i]==='1'?new \__LB_PUBLIC__\Ok($value):new \__LB_PUBLIC__\Err($value);
            return $value;
        }
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
    public static function call(string|\Closure $key, array $args, array $kinds, ?string $delivery, ?string $class,
            string $declaration, array|string $result, ?array $start, ?array $terminal, array $callbacks=[],
            ?\LeanBridge\Internal\PhpWasmObjectsV1\Domain $domain=null,?ZendMembers $members=null,?object $binding=null,?array $function=null): mixed {
        $budget=new Budget(); $encoded=[];
        $objects=$domain?->open();$scope=$callbacks ? new CallbackScope($callbacks,$args,$objects) : null;
        foreach ($args as $i=>$v) $encoded[]=$kinds[$i]==='callback' ? '' :
            ($objects?->has($kinds[$i])?$objects->pin($kinds[$i],$v):self::input($kinds[$i],$v,$budget));
        $submit=is_string($key)?vrzno_shared($key):$key;
        if (!is_callable($submit)) throw new \__LB_PUBLIC__\LeanBridgeError('Missing PHP-Wasm host for '.$declaration);
        $decode=static function(mixed $packet) use ($declaration,$result,$start,$terminal,$objects,$function): mixed {
            if (is_object($packet)) {
                try {
                    $phase=$packet->form();
                    if ($phase==='value' && $function!==null) {
                        $cap=$packet->claim($result);$class=$function[0];
                        if (!is_object($cap)) throw new \UnexpectedValueException('Missing returned Lean function');
                        try {
                            $make=\Closure::bind(static fn()=>new $class($cap,$function,$declaration,$start),null,BoundFunction::class);
                            return $make();
                        } catch (\Throwable $error) {try {$cap->close();} finally {throw $error;}}
                    }
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
        if ($members!==null) {
            if ($delivery!==null || $objects===null) throw new \LogicException('PHP member call requires an immediate object scope');
            $frame=$members->open($objects);$failed=true;
            try {
                // VRZNO calls a plain closure; a first-class PHP method callable
                // is not interchangeable with a closure at this Wasm boundary.
                MemberStack::enter();
                try {$reply=$submit(static fn(...$args)=>$frame->invoke(...$args),...$encoded);}
                finally {MemberStack::leave();}
                $frame->check($reply);$value=$decode($reply);$failed=false;return $value;
            } finally {
                try {$frame->close();} catch (\Throwable $cleanup) {if (!$failed) {$failed=true;throw $cleanup;}}
                finally {$objects->close($failed);}
            }
        }
        if ($delivery===null) {
            $failed=true;
            try {$v=$decode($submit(...$encoded));$failed=false;return $v;}
            finally {$objects?->close($failed);}
        }
        $reply=$submit(...$encoded);
        if (is_string($reply) || (is_object($reply) && $reply->form()!=='owner')) return $decode($reply);
        if (!is_object($reply)) throw new \__LB_PUBLIC__\LeanBridgeError('Missing task owner for '.$declaration);
        $open=$delivery==='task'
            ? \Closure::bind(static fn()=>new $class($reply,$decode,$scope,$objects,$binding),null,\__LB_PUBLIC__\Awaitable::class)
            : \Closure::bind(static fn()=>new $class($reply,$decode,$objects,$binding),null,\__LB_PUBLIC__\PullStream::class);
        return $open();
    }
}
