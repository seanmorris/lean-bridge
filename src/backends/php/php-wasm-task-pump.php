<?php
declare(strict_types=1);
namespace LeanBridge\Internal\PhpWasmTasksV1;

// VRZNO enters a PHP member on a synchronous Wasm stack. Asyncify cannot
// suspend that stack, even to await an already fulfilled JavaScript promise.
if (!class_exists(MemberStack::class,false)) {
    /** @internal Shared by every component on this Zend interpreter. */
    final class MemberStack {
        private static int $depth=0;
        public static function enter(): void {++self::$depth;}
        public static function leave(): void {--self::$depth;}
        public static function active(): bool {return self::$depth!==0;}
        public static function assertCanWait(): void {
            if (self::active()) throw new \LogicException('Cannot suspend a synchronous PHP-Wasm member; wait after the member returns');
        }
    }
}
// All independently installed Composer APIs in this interpreter share the same
// reader. Weak registrations cannot keep an abandoned Zend task owner alive.
if (!class_exists(Pump::class,false)) {
    final class Pump {
        private static array $receivers=[];
        public static function attach(string $key,object $scope): void {
            if (isset(self::$receivers[$key])) throw new \LogicException('Duplicate PHP callback owner');
            self::$receivers[$key]=\WeakReference::create($scope);
        }
        public static function detach(string $key): void { unset(self::$receivers[$key]); }
        public static function read(object $source): mixed {
            MemberStack::assertCanWait();
            for (;;) {
                $packet=vrzno_await($source->result());
                if (!is_string($packet) || !str_starts_with($packet,'["call",')) return $packet;
                [$tag,$key,$ticket,$slot,$bytes]=json_decode($packet,true,flags: JSON_THROW_ON_ERROR);
                $receiver=(self::$receivers[$key]??null)?->get();
                if ($receiver===null) throw new \LogicException('Orphaned PHP callback request');
                $receiver->dispatch($ticket,$slot,$bytes);
            }
        }
    }
}
