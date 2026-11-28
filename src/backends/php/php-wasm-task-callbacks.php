<?php
declare(strict_types=1);
namespace __LB_PUBLIC__;

/*__LB_ONCE_EXCEPTION__*/final class CallbackClosed extends \RuntimeException {}

/** Ordinary callables need no wrapper. Use this owner to stop future invocations explicitly. */
final class RetainedCallback {
    private ?\Closure $fn;
    public function __construct(callable $fn) { $this->fn=Internal\CallbackScope::bind($fn); }
    public function __invoke(mixed $v): mixed {
        $fn=$this->fn??throw new CallbackClosed('Retained PHP callback is closed');
        return $fn($v);
    }
    public function close(): void { $this->fn=null; }
    public function isClosed(): bool { return $this->fn===null; }
    private function __clone() {}
    public function __serialize(): array { throw new \LogicException('Cannot serialize a retained callback'); }
    public function __unserialize(array $data): void { throw new \LogicException('Cannot restore a retained callback'); }
}

namespace __LB_PUBLIC__\Internal;

/** @internal Zend owns these callables and exceptions; neither is marshalled to JS. */
final class CallbackScope {
    private array $slots=[];
    private array $errors=[];
    private bool $live=true;
    private bool $dispatching=false;
    private ?object $owner=null;
    private ?string $key=null;
    public static function bind(mixed $value): \Closure {
        if (!is_callable($value)) throw new \TypeError('Expected a unary PHP callable');
        $call=\Closure::fromCallable($value); $r=new \ReflectionFunction($call); $p=$r->getParameters();
        if (!$p || $p[0]->isPassedByReference() || $r->getNumberOfRequiredParameters()>1 || $r->isGenerator() || $r->returnsReference())
            throw new \TypeError('Expected a unary by-value PHP callback');
        return $call;
    }
    public function __construct(array $spec,array $args,private readonly ?\LeanBridge\Internal\PhpWasmObjectsV1\Scope $objects=null) {
        foreach ($spec as [$i,$in,$out]) $this->slots[$i]=[self::bind($args[$i]),$in,$out];
    }
    public function attach(object $owner): void {
        $this->owner=$owner; $this->key=$owner->key();
        \LeanBridge\Internal\PhpWasmTasksV1\Pump::attach($this->key,$this);
    }
    public function dispatching(): bool { return $this->dispatching; }
    public function close(): void {
        if ($this->key!==null) \LeanBridge\Internal\PhpWasmTasksV1\Pump::detach($this->key);
        $this->key=null; $this->owner=null; $this->live=false; $this->slots=[]; $this->errors=[];
    }
    public function decode(mixed $packet,\Closure $decode): mixed {
        /*__LB_ONCE_DECODE__*/if (is_string($packet) && str_starts_with($packet,'["throw",')) {
            [, $id]=json_decode($packet,true,flags: JSON_THROW_ON_ERROR);
            throw $this->errors[$id]??new \__LB_PUBLIC__\LeanBridgeError('Unknown PHP callback failure');
        }
        return $decode($packet);
    }
    public function dispatch(int $id,int $slot,string $bytes): void {
        if (!$this->live || !isset($this->slots[$slot]))
            throw new \__LB_PUBLIC__\LeanBridgeError('Invalid PHP callback request');
        [$fn,$in,$out]=$this->slots[$slot]; $owner=$this->owner; $this->dispatching=true;
        try {
            if ($this->objects?->has($in)) $input=$this->objects->resolve($in,$bytes);
            else {
                $arg=base64_decode($bytes,true);
                if ($arg===false) throw new \__LB_PUBLIC__\LeanBridgeError('Invalid PHP callback bytes');
                $input=WireValues::output($in,'',$arg);
            }
            try { $value=$fn($input); }
            catch (\Exception $error) {
                $message=$error->getMessage();
                if (strlen($message)>4096 || preg_match('//u',$message)!==1) $message='PHP callback failed';
                if ($this->live && $owner->answer($id,false,base64_encode($message))) $this->errors[$id]=$error;
                return;
            } catch (\Error $trap) {
                if ($owner->trap($id)) $this->errors[$id]=$trap;
                else throw $trap;
                return;
            }
            if (!$this->live) return;
            try { $wire=$this->objects?->has($out)?$this->objects->pin($out,$value):base64_encode(WireValues::input($out,$value,new Budget())); }
            catch (\Throwable $error) {
                if ($owner->invalid($id)) $this->errors[$id]=$error;
                return;
            }
            $owner->answer($id,true,$wire);
        } finally { $this->dispatching=false; }
    }
}
