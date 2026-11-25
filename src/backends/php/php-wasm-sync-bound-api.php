<?php
declare(strict_types=1);
namespace __LB_PUBLIC__;
use LeanBridge\Internal\PhpWasmObjectsV1\Domain;

function withHosts(array $classes): BoundApi {return BoundApi::bind($classes);}

/** Immediate PHP calls on the standalone Lean heap; no pump, tasks or scheduler. */
final class BoundApi {
    private function __construct(private ?object $owner, private ?Domain $domain, private ?Internal\ZendMembers $members) {}
    public static function bind(array $classes): self {
        $model=json_decode(<<<'LB_MODEL'
__LB_MODEL__
LB_MODEL,true,flags: JSON_THROW_ON_ERROR);
        $members=new Internal\ZendMembers($model,$classes);
        $open=vrzno_shared('__LB_BIND__');
        if (!is_callable($open)) throw new LeanBridgeError('The matching PHP-Wasm host descriptor is not installed');
        $owner=$open();
        if (!is_object($owner)) throw new LeanBridgeError('Could not open the synchronous PHP-Wasm binding');
        try {
            $types=[];foreach ($model['kinds'] as $kind) $types['host:'.$kind['key']]=$classes[$kind['name']];
            $domain=new Domain($types,static fn($kind)=>$owner->mint($kind),$owner->id(),
                __LB_FUNCTIONS__ ? static fn($kind,$cap)=>$owner->retains($kind,$cap) : null);
            return new self($owner,$domain,$members);
        } catch (\Throwable $e) {try {$owner->close();} finally {throw $e;}}
    }
    public function close(): void {
        if ($this->owner===null) return;
        if ($this->owner->busy()) throw new \LogicException('Cannot close a binding during its own active call');
        $owner=$this->owner;$this->owner=null;
        try {$owner->close();}
        finally {
            try {$this->domain->collect();}
            finally {try {$this->domain->release();} finally {$this->domain=null;$this->members=null;}}
        }
    }
    public function __destruct() {$this->close();}
    private function __clone() {}
    public function __serialize(): array {throw new \LogicException('Cannot serialize a PHP-Wasm binding');}
    public function __unserialize(array $data): void {throw new \LogicException('Cannot restore a PHP-Wasm binding');}
    private function entry(int $slot): \Closure {
        $owner=$this->owner??throw new \LogicException('PHP-Wasm binding has been closed');
        return static fn(...$args)=>$owner->run($slot,...$args);
    }
__LB_METHODS__
}
