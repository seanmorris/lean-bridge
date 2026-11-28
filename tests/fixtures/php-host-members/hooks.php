<?php
declare(strict_types=1);
// Loaded only on PHP versions that implement declared property hooks.
use __LB_PUBLIC__\Internal\HostMembers;
class HookMeter {
    private int $value=2;
    public int $level {
        get => $this->value*2;
        set { $this->value=$value; }
    }
}
class ReadOnlyHook { public int $level { get => 7; } }
class RestrictedSet { public private(set) int $level=1; }
$props=$model;$props['members']=array_values(array_filter($model['members'],fn($m)=>in_array($m['op'],['get','set'],true)));
[$get,$set]=array_map(fn($m)=>array_search($m,array_column($props['members'],'op'),true),['get','set']);
$hooks=new HostMembers($props,['Box'=>HookMeter::class]);$hook=new HookMeter();
check($hooks->invoke($get,[$hook])===[true,4],'declared PHP property getter');
check($hooks->invoke($set,[$hook,6])===[true,null] && $hooks->invoke($get,[$hook])===[true,12],'declared PHP property setter');
refuses(fn()=>new HostMembers($props,['Box'=>ReadOnlyHook::class]),\TypeError::class);
refuses(fn()=>new HostMembers($props,['Box'=>RestrictedSet::class]),\TypeError::class);
