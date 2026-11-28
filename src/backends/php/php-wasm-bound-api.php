<?php
declare(strict_types=1);
namespace __LB_PUBLIC__;
use LeanBridge\Internal\PhpWasmObjectsV1\Domain;
use LeanBridge\Internal\PhpWasmTasksV1\MemberStack;
use LeanBridge\Internal\PhpWasmTasksV1\Pump;

/** Bind this package's imported class names to application PHP classes. */
function withHosts(array $classes): BoundApi {return BoundApi::bind($classes);}

final class BoundApi {
    private readonly \WeakMap $deliveries;
    private function __construct(private ?object $owner,private ?Domain $domain,private ?Internal\ZendMembers $members) {
        $this->deliveries=new \WeakMap();
    }
    /** The delivery retains its binding while live; the binding does not keep abandoned deliveries alive. */
    private function retain(object $delivery): object {$this->deliveries[$delivery]=true;return $delivery;}
    /** @internal Validates every declared selector before allocating an owner. */
    public static function bind(array $classes): self {
        MemberStack::assertCanWait();
        $model=json_decode(<<<'LB_MODEL'
__LB_MODEL__
LB_MODEL,true,flags: JSON_THROW_ON_ERROR);
        $members=new Internal\ZendMembers($model,$classes);
        $open=vrzno_shared('__LB_BIND__');
        if (!is_callable($open)) throw new LeanBridgeError('The matching PHP-Wasm host descriptor is not installed');
        $owner=vrzno_await($open());
        if (!is_object($owner)) throw new LeanBridgeError('Could not open the compiled PHP-Wasm binding');
        try {
            $types=[];foreach ($model['kinds'] as $kind) $types['host:'.$kind['key']]=$classes[$kind['name']];
            $objects=new Domain($types,static fn($kind)=>$owner->mint($kind),$owner->id(),
                __LB_FUNCTIONS__ ? static fn($kind,$cap)=>$owner->retains($kind,$cap) : null);
            return new self($owner,$objects,$members);
        } catch (\Throwable $e) {try {Pump::read($owner->close());} finally {throw $e;}}
    }
    public function close(): void {
        if ($this->owner===null) return;
        MemberStack::assertCanWait();
        $taskBusy=\Closure::bind(static fn($task)=>$task->observing || $task->callbacks?->dispatching(),null,Awaitable::class);
        $pullBusy=\Closure::bind(static fn($cursor)=>$cursor->pulling,null,PullStream::class);
        foreach ($this->deliveries as $delivery=>$_)
            if ($delivery instanceof Awaitable ? $taskBusy($delivery) : $pullBusy($delivery))
                throw new \LogicException('Cannot close a binding while observing its own delivery');
        $owner=$this->owner;$this->owner=null;$first=null;
        try {if (Pump::read($owner->close())!=='["end"]') throw new LeanBridgeError('Could not drain the PHP-Wasm binding');}
        catch (\Throwable $e) {$first=$e;}
        try {
            foreach ($this->deliveries as $delivery=>$_) {
                try {if ($delivery instanceof Awaitable) $delivery->awaitCleanup();else $delivery->close();}
                catch (\Throwable $e) {$first??=$e;}
            }
        } finally {
            try {$this->domain->collect();} catch (\Throwable $e) {$first??=$e;}
            try {$this->domain->release();} catch (\Throwable $e) {$first??=$e;}
            $this->domain=null;$this->members=null;
        }
        if ($first!==null) throw $first;
    }
    public function __destruct() {
        try {$this->owner?->abandon();}
        finally {try {$this->domain?->collect();} finally {$this->domain?->release();}}
    }
    private function __clone() {}
    public function __serialize(): array {throw new \LogicException('Cannot serialize a PHP-Wasm binding');}
    public function __unserialize(array $data): void {throw new \LogicException('Cannot restore a PHP-Wasm binding');}
    private function entry(int $slot): \Closure {
        $owner=$this->owner??throw new \LogicException('PHP-Wasm binding has been closed');
        return static fn(...$args)=>$owner->run($slot,...$args);
    }
__LB_METHODS__
}
