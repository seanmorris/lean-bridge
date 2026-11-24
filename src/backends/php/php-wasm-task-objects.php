<?php
declare(strict_types=1);
namespace LeanBridge\Internal\PhpWasmObjectsV1;

if (!class_exists(Domain::class,false)) {
    /** @internal One interpreter and authenticated runtime, never process-global tokens. */
    final class Domain {
        private static array $shared=[];
        private readonly \WeakMap $canonical;
        private ?string $registry=null;
        public function __construct(private readonly array $classes, private readonly \Closure $mint,?string $registry=null) {
            foreach ($classes as $kind=>$class) {
                if (!is_string($kind) || !preg_match('/^host:[0-9a-f]{64}$/D',$kind) ||
                    !is_string($class) || (!class_exists($class) && !interface_exists($class))) throw new \TypeError('Invalid PHP worker object binding');
            }
            if ($registry===null) {$this->canonical=new \WeakMap();return;}
            if (preg_match('/^[0-9a-f]{32}$/D',$registry)!==1) throw new \TypeError('Invalid PHP worker identity domain');
            $row=self::$shared[$registry]??['objects'=>new \WeakMap(),'classes'=>[]];
            foreach ($classes as $kind=>$class) {
                $name=(new \ReflectionClass($class))->getName();
                [$old,$uses]=$row['classes'][$kind]??[$name,0];
                if ($old!==$name) throw new \TypeError('Incompatible PHP host classes for one shared nominal kind');
                $row['classes'][$kind]=[$name,$uses+1];
            }
            $this->canonical=$row['objects'];self::$shared[$registry]=$row;$this->registry=$registry;
        }
        public function release(): void {
            $key=$this->registry;if ($key===null) return;$this->registry=null;
            foreach ($this->classes as $kind=>$_) if (--self::$shared[$key]['classes'][$kind][1]===0) unset(self::$shared[$key]['classes'][$kind]);
            if (!self::$shared[$key]['classes']) unset(self::$shared[$key]);
        }
        public function __destruct() {$this->release();}
        private function __clone() {}
        public function __serialize(): array {throw new \LogicException('Cannot serialize a Zend host binding');}
        public function __unserialize(array $data): void {throw new \LogicException('Cannot restore a Zend host binding');}
        public function has(mixed $kind): bool {return is_string($kind) && isset($this->classes[$kind]);}
        public function open(): Scope {return new Scope($this);}
        public function capability(string $kind,mixed $value): array {
            $class=$this->classes[$kind]??throw new \TypeError('Unknown PHP worker object kind');
            if (!($value instanceof $class)) throw new \TypeError('Expected a PHP object of class '.$class);
            $known=$this->canonical[$value]??[];
            if (!isset($known[$kind])) {
                $cap=($this->mint)($kind);
                if (!is_object($cap) || !is_string($key=$cap->key()) || !preg_match('/^z[0-9a-f]{32}:[1-9][0-9]*$/D',$key))
                    throw new \UnexpectedValueException('Invalid worker object capability');
                $known[$kind]=[$key,$cap];$this->canonical[$value]=$known;
            }
            return $known[$kind];
        }
    }
    /** @internal Strong Zend roots exist only for the lifetime of this delivery. */
    final class Scope {
        private array $roots=[];
        private bool $closed=false;
        public function __construct(private readonly Domain $domain) {}
        public function has(mixed $kind): bool {return $this->domain->has($kind);}
        public function pin(string $kind,mixed $value): object {
            if ($this->closed) throw new \LogicException('Closed Zend worker scope');
            [$key,$cap]=$this->domain->capability($kind,$value);
            $this->roots[$kind][$key]=$value;
            return $cap;
        }
        public function resolve(string $kind,string $key): object {
            if ($this->closed) throw new \LogicException('Closed Zend worker scope');
            return $this->roots[$kind][$key]??throw new \UnexpectedValueException('Unknown Zend object for this delivery');
        }
        public function close(bool $suppress=false): void {
            if ($this->closed) return;
            $this->closed=true;$first=null;
            foreach (array_keys($this->roots) as $kind) foreach (array_keys($this->roots[$kind]) as $key) {
                try {unset($this->roots[$kind][$key]);} catch (\Throwable $e) {$first??=$e;}
            }
            $this->roots=[];if ($first!==null && !$suppress) throw $first;
        }
        public function __destruct() {$this->close(true);}
        private function __clone() {}
        public function __serialize(): array {throw new \LogicException('Cannot serialize a Zend worker scope');}
        public function __unserialize(array $data): void {throw new \LogicException('Cannot restore a Zend worker scope');}
    }
}
