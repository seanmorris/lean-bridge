<?php
declare(strict_types=1);
namespace LeanBridge\Internal\PhpWasmTasksV1;

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
