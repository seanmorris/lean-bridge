<?php
declare(strict_types=1);
namespace LeanBridge\Internal\PhpWasmObjectsV1;

if (!class_exists(Domain::class,false)) {
    /** @internal One interpreter and authenticated runtime, never process-global tokens. */
    final class Domain {
        private static array $shared=[];
        private readonly \WeakMap $canonical;
        private ?string $registry=null;
        public function __construct(private readonly array $classes, private readonly \Closure $mint,?string $registry=null,
                private readonly ?\Closure $retains=null) {
            foreach ($classes as $kind=>$class) {
                if (!is_string($kind) || !preg_match('/^host:[0-9a-f]{64}$/D',$kind) ||
                    !is_string($class) || (!class_exists($class) && !interface_exists($class))) throw new \TypeError('Invalid PHP worker object binding');
            }
            if ($registry===null) {$this->canonical=new \WeakMap();return;}
            if (preg_match('/^[0-9a-f]{32}$/D',$registry)!==1) throw new \TypeError('Invalid PHP worker identity domain');
            $row=self::$shared[$registry]??['objects'=>new \WeakMap(),'classes'=>[],'retained'=>[],'sweeping'=>false];
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
            // Detach the retiring generation before invoking application destructors.
            // A destructor may immediately bind the same class and park another capture.
            $retired=[];
            foreach ($this->classes as $kind=>$_) if (--self::$shared[$key]['classes'][$kind][1]===0) {
                $retired[$kind]=self::$shared[$key]['retained'][$kind]??[];
                unset(self::$shared[$key]['classes'][$kind]);
                unset(self::$shared[$key]['retained'][$kind]);
            }
            if (!self::$shared[$key]['classes']) unset(self::$shared[$key]);
            $first=null;
            foreach (array_keys($retired) as $kind) foreach (array_keys($retired[$kind]) as $id) {
                try {unset($retired[$kind][$id]);} catch (\Throwable $e) {$first??=$e;}
            }
            if ($first!==null) throw $first;
        }
        public function __destruct() {$this->release();}
        private function __clone() {}
        public function __serialize(): array {throw new \LogicException('Cannot serialize a Zend host binding');}
        public function __unserialize(array $data): void {throw new \LogicException('Cannot restore a Zend host binding');}
        public function has(mixed $kind): bool {return is_string($kind) && isset($this->classes[$kind]);}
        public function open(): Scope {return new Scope($this);}
        /** Extend a temporary root only if Lean still owns its canonical wrapper. */
        public function park(string $kind,string $key,object $value): void {
            if ($this->retains===null || $this->registry===null) return;
            $cap=$this->canonical[$value][$kind][1];
            if (($this->retains)($kind,$cap)===true) self::$shared[$this->registry]['retained'][$kind][$key]=[$value,$cap];
        }
        /** A later invocation can receive a captured object not among its own inputs. */
        public function captured(string $kind,string $key): object {
            if ($this->registry!==null && isset(self::$shared[$this->registry]['retained'][$kind][$key]))
                return self::$shared[$this->registry]['retained'][$kind][$key][0];
            throw new \UnexpectedValueException('Unknown Zend object for this delivery');
        }
        public function collect(): void {
            $reg=$this->registry;
            if ($reg===null || $this->retains===null || self::$shared[$reg]['sweeping']) return;
            self::$shared[$reg]['sweeping']=true;$failure=null;
            try {
                foreach ($this->classes as $kind=>$_) foreach (array_keys(self::$shared[$reg]['retained'][$kind]??[]) as $key) {
                    try {
                        $cap=self::$shared[$reg]['retained'][$kind][$key][1]??null;
                        if ($cap!==null && ($this->retains)($kind,$cap)!==true) unset(self::$shared[$reg]['retained'][$kind][$key]);
                    } catch (\Throwable $e) {$failure??=$e;}
                }
            } finally {if (isset(self::$shared[$reg])) self::$shared[$reg]['sweeping']=false;}
            if ($failure!==null) throw $failure;
        }
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
    /** @internal Roots this delivery's values until completion or adoption by a live native wrapper. */
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
            if (!$this->has($kind)) throw new \TypeError('Unknown PHP worker object kind');
            return $this->roots[$kind][$key]??= $this->domain->captured($kind,$key);
        }
        public function close(bool $suppress=false): void {
            if ($this->closed) return;
            $this->closed=true;$first=null;
            foreach (array_keys($this->roots) as $kind) foreach (array_keys($this->roots[$kind]) as $key) {
                try {$this->domain->park($kind,$key,$this->roots[$kind][$key]);} catch (\Throwable $e) {$first??=$e;}
                try {unset($this->roots[$kind][$key]);} catch (\Throwable $e) {$first??=$e;}
            }
            $this->roots=[];
            try {$this->domain->collect();} catch (\Throwable $e) {$first??=$e;}
            if ($first!==null && !$suppress) throw $first;
        }
        public function __destruct() {$this->close(true);}
        private function __clone() {}
        public function __serialize(): array {throw new \LogicException('Cannot serialize a Zend worker scope');}
        public function __unserialize(array $data): void {throw new \LogicException('Cannot restore a Zend worker scope');}
    }
}
