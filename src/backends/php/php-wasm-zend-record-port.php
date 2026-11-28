<?php
declare(strict_types=1);
namespace __LB_PUBLIC__\Internal;
use LeanBridge\Internal\PhpWasmObjectsV1\Scope;

/** @internal Only known record types from this installed component are admitted. */
final class RecordResult {
    private const TYPES=/*__LB_RECORDS__*/[];
    public static function has(string $type): bool {return isset(self::TYPES[$type]);}
    public static function read(string $type,object $packet,Scope $scope): object {
        [$class,$fields]=self::TYPES[$type];
        $values=[];$budget=new Budget();
        foreach ($fields as $i=>$kind) {
            $field=$packet->field($i,$kind);
            if (!is_string($field)) throw new \UnexpectedValueException('Missing or already delivered Zend record field');
            if ($scope->has($kind)) {
                $values[]=$scope->resolve($kind,$field);
                continue;
            }
            if (strlen($field)>22369624 || ($bytes=base64_decode($field,true))===false || base64_encode($bytes)!==$field)
                throw new \UnexpectedValueException('Invalid encoded Zend record field');
            $budget->charge(strlen($bytes));
            $values[]=WireValues::output($kind,'',$bytes);
        }
        return new $class(...$values);
    }
}
