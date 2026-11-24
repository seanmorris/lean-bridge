<?php
declare(strict_types=1);
namespace LeanBridge\Internal\PhpWasmObjectsV1;

if (!class_exists(Domain::class,false)) {
    /** @internal One interpreter and authenticated runtime, never process-global tokens. */
    final class Domain {
        private readonly \WeakMap $canonical;
        public function __construct(private readonly array $classes, private readonly \Closure $mint) {
            foreach ($classes as $kind=>$class) {
                if (!is_string($kind) || !preg_match('/^host:[0-9a-f]{64}$/D',$kind) ||
                    !is_string($class) || !class_exists($class)) throw new \TypeError('Invalid PHP worker object binding');
            }
            $this->canonical=new \WeakMap();
        }
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
