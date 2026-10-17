<?php
declare(strict_types=1);
namespace LeanMutualcheckedrecords\Internal;

final class GraphTypes
{
    public const NODES = [
        ['kind' => 'array', 'element' => 1, 'fields' => [], 'classes' => []],
        ['kind' => 'option', 'element' => null, 'fields' => [['value', 3]], 'classes' => ['LeanMutualcheckedrecords\\Some']],
        ['kind' => 'option', 'element' => null, 'fields' => [['value', 4]], 'classes' => ['LeanMutualcheckedrecords\\Some']],
        ['kind' => 'record', 'element' => null, 'fields' => [['value', 5], ['mode', 5], ['next', 2]], 'classes' => ['LeanMutualcheckedrecords\\Envelope']],
        ['kind' => 'variant', 'element' => null, 'fields' => [], 'classes' => ['LeanMutualcheckedrecords\\StepStop', 'LeanMutualcheckedrecords\\StepMore']],
        ['kind' => 'primitive', 'name' => 'nat', 'host' => 'bigint', 'min' => '0', 'max' => null],
    ];
    public const CLASSES = [
        'LeanMutualcheckedrecords\\Envelope' => ['fields' => [['value', 5], ['mode', 5], ['next', 2]]],
        'LeanMutualcheckedrecords\\StepStop' => ['fields' => []],
        'LeanMutualcheckedrecords\\StepMore' => ['fields' => [['packet', 3]]],
        'LeanMutualcheckedrecords\\Some' => ['fields' => [['value', null]]],
        'LeanMutualcheckedrecords\\Ok' => ['fields' => [['value', null]]],
        'LeanMutualcheckedrecords\\Err' => ['fields' => [['value', null]]],
    ];
}
