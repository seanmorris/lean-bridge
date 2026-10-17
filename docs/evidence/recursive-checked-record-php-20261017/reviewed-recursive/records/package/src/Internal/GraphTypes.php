<?php
declare(strict_types=1);
namespace LeanRecursivecheckedrecords\Internal;

final class GraphTypes
{
    public const NODES = [
        ['kind' => 'array', 'element' => 1, 'fields' => [], 'classes' => []],
        ['kind' => 'option', 'element' => null, 'fields' => [['value', 2]], 'classes' => ['LeanRecursivecheckedrecords\\Some']],
        ['kind' => 'record', 'element' => null, 'fields' => [['value', 3], ['digit', 3], ['tail', 1]], 'classes' => ['LeanRecursivecheckedrecords\\Packet']],
        ['kind' => 'primitive', 'name' => 'nat', 'host' => 'bigint', 'min' => '0', 'max' => null],
    ];
    public const CLASSES = [
        'LeanRecursivecheckedrecords\\Packet' => ['fields' => [['value', 3], ['digit', 3], ['tail', 1]]],
        'LeanRecursivecheckedrecords\\Some' => ['fields' => [['value', null]]],
        'LeanRecursivecheckedrecords\\Ok' => ['fields' => [['value', null]]],
        'LeanRecursivecheckedrecords\\Err' => ['fields' => [['value', null]]],
    ];
}
