(component
  (type $api (instance
    (type $limbs (list u32))
    (type $base0 (list u32))
    (export "bridge-value-0" (type $t0 (eq $base0)))
    (type $base1 (record (field "value" $t0) (field "marker" $t0)))
    (export "generic-nat" (type $t1 (eq $base1)))
    (type $base2 (record (field "payload" $t0) (field "digit" $t0)))
    (export "envelope" (type $t2 (eq $base2)))
    (type $base3 (option $t2))
    (export "bridge-value-3" (type $t3 (eq $base3)))
    (type $base4 (list $t3))
    (export "bridge-value-4" (type $t4 (eq $base4)))
    (type $base5 (list $t0))
    (export "bridge-value-5" (type $t5 (eq $base5)))
    (type $base6 (result $t0 (error $t0)))
    (export "bridge-value-6" (type $t6 (eq $base6)))
    (type $base7 (option $t6))
    (export "bridge-value-7" (type $t7 (eq $base7)))
    (type $base8 (list $t7))
    (export "bridge-value-8" (type $t8 (eq $base8)))
    (type $base18 (record (field "value" $t2)))
    (export "event-box-fields" (type $t18 (eq $base18)))
    (type $base19 (record (field "values" $t8)))
    (export "event-choices-fields" (type $t19 (eq $base19)))
    (type $base9 (variant (case "empty") (case "box" $t18) (case "choices" $t19)))
    (export "event" (type $t9 (eq $base9)))
    (export "envelope-alias" (type $t15 (eq $t2)))
    (type $base16 (option $t15))
    (export "bridge-alias-value-16" (type $t16 (eq $base16)))
    (type $base17 (list $t16))
    (export "bridge-alias-value-17" (type $t17 (eq $base17)))
    (type $base10 (record (field "left" $t17) (field "right" $t17)))
    (export "alias-pair" (type $t10 (eq $base10)))
    (type $base11 (list $t0))
    (export "bridge-value-11" (type $t11 (eq $base11)))
    (type $base12 (record (field "left" $t2) (field "right" $t2)))
    (export "pair" (type $t12 (eq $base12)))
    (type $base13 (option $t0))
    (export "bridge-value-13" (type $t13 (eq $base13)))
    (type $base14 (tuple $t0 $t0))
    (export "bridge-value-14" (type $t14 (eq $base14)))
    (export "echo-generic-first" (func (param "arg0" $t1) (result $t1)))
    (export "echo-generic-second" (func (param "arg0" $t1) (result $t1)))
    (export "generic-use" (func (param "arg0" $t1) (result $t0)))
    (export "aliases" (func (param "arg0" $t17) (param "arg1" $t17) (result $t0)))
    (export "array-values" (func (param "arg0" $t0) (result $t5)))
    (export "branch" (func (param "arg0" $t0) (result $t6)))
    (export "combine" (func (param "arg0" $t2) (param "arg1" $t2) (result $t0)))
    (export "echo" (func (param "arg0" $t2) (result $t2)))
    (export "echo-event" (func (param "arg0" $t9) (result $t9)))
    (export "echo-groups" (func (param "arg0" $t17) (result $t17)))
    (export "echo-pair" (func (param "arg0" $t10) (result $t10)))
    (export "event-choices" (func (param "arg0" $t0) (result $t9)))
    (export "event-empty" (func (param "arg0" $t0) (result $t9)))
    (export "event-first" (func (param "arg0" $t9) (result $t0)))
    (export "event-second" (func (param "arg0" $t9) (result $t0)))
    (export "event-value" (func (param "arg0" $t0) (result $t9)))
    (export "first" (func (param "arg0" $t2) (result $t0)))
    (export "group-values" (func (param "arg0" $t0) (result $t17)))
    (export "inspect-alias-pair" (func (param "arg0" $t10) (result $t0)))
    (export "list-values" (func (param "arg0" $t0) (result $t11)))
    (export "nested" (func (param "arg0" $t12) (result $t0)))
    (export "no-items" (func (param "arg0" $t0) (result $t5)))
    (export "optional" (func (param "arg0" $t0) (result $t13)))
    (export "pair-values" (func (param "arg0" $t0) (result $t10)))
    (export "plain-fin" (func (param "arg0" $t0) (result $t0)))
    (export "produce-envelope" (func (param "arg0" $t0) (result $t2)))
    (export "product" (func (param "arg0" $t0) (result $t14)))
    (export "scalar" (func (param "arg0" $t0) (result $t0)))
    (export "second" (func (param "arg0" $t2) (result $t0)))
  ))
  (import "lean-bridge:nominalsubtypes/native@1.0.0" (instance $host (type $api)))
  (alias export $host "bridge-value-0" (type $public0))
  (alias export $host "generic-nat" (type $public1))
  (alias export $host "envelope" (type $public2))
  (alias export $host "bridge-value-3" (type $public3))
  (alias export $host "bridge-value-4" (type $public4))
  (alias export $host "bridge-value-5" (type $public5))
  (alias export $host "bridge-value-6" (type $public6))
  (alias export $host "bridge-value-7" (type $public7))
  (alias export $host "bridge-value-8" (type $public8))
  (alias export $host "event-box-fields" (type $public18))
  (alias export $host "event-choices-fields" (type $public19))
  (alias export $host "event" (type $public9))
  (alias export $host "envelope-alias" (type $public15))
  (alias export $host "bridge-alias-value-16" (type $public16))
  (alias export $host "bridge-alias-value-17" (type $public17))
  (alias export $host "alias-pair" (type $public10))
  (alias export $host "bridge-value-11" (type $public11))
  (alias export $host "pair" (type $public12))
  (alias export $host "bridge-value-13" (type $public13))
  (alias export $host "bridge-value-14" (type $public14))
  (alias export $host "echo-generic-first" (func $host0))
  (alias export $host "echo-generic-second" (func $host1))
  (alias export $host "generic-use" (func $host2))
  (alias export $host "aliases" (func $host3))
  (alias export $host "array-values" (func $host4))
  (alias export $host "branch" (func $host5))
  (alias export $host "combine" (func $host6))
  (alias export $host "echo" (func $host7))
  (alias export $host "echo-event" (func $host8))
  (alias export $host "echo-groups" (func $host9))
  (alias export $host "echo-pair" (func $host10))
  (alias export $host "event-choices" (func $host11))
  (alias export $host "event-empty" (func $host12))
  (alias export $host "event-first" (func $host13))
  (alias export $host "event-second" (func $host14))
  (alias export $host "event-value" (func $host15))
  (alias export $host "first" (func $host16))
  (alias export $host "group-values" (func $host17))
  (alias export $host "inspect-alias-pair" (func $host18))
  (alias export $host "list-values" (func $host19))
  (alias export $host "nested" (func $host20))
  (alias export $host "no-items" (func $host21))
  (alias export $host "optional" (func $host22))
  (alias export $host "pair-values" (func $host23))
  (alias export $host "plain-fin" (func $host24))
  (alias export $host "produce-envelope" (func $host25))
  (alias export $host "product" (func $host26))
  (alias export $host "scalar" (func $host27))
  (alias export $host "second" (func $host28))
  (core module $allocator
    (memory (export "memory") 1 1024)
    (global $heap (mut i32) (i32.const 16))
    (func (export "realloc") (param $old i32) (param $old-size i32) (param $alignment i32) (param $size i32) (result i32)
      (local $start i32) (local $end i32) (local $pages i32)
      (if (i32.eqz (local.get $size)) (then (return (i32.const 0))))
      (local.set $start (i32.and
        (i32.add (global.get $heap) (i32.sub (local.get $alignment) (i32.const 1)))
        (i32.sub (i32.const 0) (local.get $alignment))))
      (local.set $end (i32.add (local.get $start) (local.get $size)))
      (if (i32.or (i32.lt_u (local.get $end) (local.get $start)) (i32.gt_u (local.get $end) (i32.const 67108864))) (then unreachable))
      (local.set $pages (i32.shr_u (i32.add (local.get $end) (i32.const 65535)) (i32.const 16)))
      (if (i32.gt_u (local.get $pages) (memory.size))
        (then (if (i32.eq (memory.grow (i32.sub (local.get $pages) (memory.size))) (i32.const -1)) (then unreachable))))
      (if (local.get $old)
        (then (memory.copy (local.get $start) (local.get $old)
          (select (local.get $old-size) (local.get $size) (i32.lt_u (local.get $old-size) (local.get $size))))))
      (global.set $heap (local.get $end))
      (local.get $start))
    (func (export "post-i32") (param i32) (global.set $heap (i32.const 16)))
    (func (export "post-i64") (param i64) (global.set $heap (i32.const 16)))
    (func (export "post-f32") (param f32) (global.set $heap (i32.const 16)))
    (func (export "post-f64") (param f64) (global.set $heap (i32.const 16)))
  )
  (core instance $allocation (instantiate $allocator))
  (alias core export $allocation "memory" (core memory $memory))
  (alias core export $allocation "realloc" (core func $realloc))
  (alias core export $allocation "post-i32" (core func $post-i32))
  (alias core export $allocation "post-i64" (core func $post-i64))
  (alias core export $allocation "post-f32" (core func $post-f32))
  (alias core export $allocation "post-f64" (core func $post-f64))
  (core func $lower0 (canon lower (func $host0) (memory $memory) (realloc $realloc)))
  (core func $lower1 (canon lower (func $host1) (memory $memory) (realloc $realloc)))
  (core func $lower2 (canon lower (func $host2) (memory $memory) (realloc $realloc)))
  (core func $lower3 (canon lower (func $host3) (memory $memory) (realloc $realloc)))
  (core func $lower4 (canon lower (func $host4) (memory $memory) (realloc $realloc)))
  (core func $lower5 (canon lower (func $host5) (memory $memory) (realloc $realloc)))
  (core func $lower6 (canon lower (func $host6) (memory $memory) (realloc $realloc)))
  (core func $lower7 (canon lower (func $host7) (memory $memory) (realloc $realloc)))
  (core func $lower8 (canon lower (func $host8) (memory $memory) (realloc $realloc)))
  (core func $lower9 (canon lower (func $host9) (memory $memory) (realloc $realloc)))
  (core func $lower10 (canon lower (func $host10) (memory $memory) (realloc $realloc)))
  (core func $lower11 (canon lower (func $host11) (memory $memory) (realloc $realloc)))
  (core func $lower12 (canon lower (func $host12) (memory $memory) (realloc $realloc)))
  (core func $lower13 (canon lower (func $host13) (memory $memory) (realloc $realloc)))
  (core func $lower14 (canon lower (func $host14) (memory $memory) (realloc $realloc)))
  (core func $lower15 (canon lower (func $host15) (memory $memory) (realloc $realloc)))
  (core func $lower16 (canon lower (func $host16) (memory $memory) (realloc $realloc)))
  (core func $lower17 (canon lower (func $host17) (memory $memory) (realloc $realloc)))
  (core func $lower18 (canon lower (func $host18) (memory $memory) (realloc $realloc)))
  (core func $lower19 (canon lower (func $host19) (memory $memory) (realloc $realloc)))
  (core func $lower20 (canon lower (func $host20) (memory $memory) (realloc $realloc)))
  (core func $lower21 (canon lower (func $host21) (memory $memory) (realloc $realloc)))
  (core func $lower22 (canon lower (func $host22) (memory $memory) (realloc $realloc)))
  (core func $lower23 (canon lower (func $host23) (memory $memory) (realloc $realloc)))
  (core func $lower24 (canon lower (func $host24) (memory $memory) (realloc $realloc)))
  (core func $lower25 (canon lower (func $host25) (memory $memory) (realloc $realloc)))
  (core func $lower26 (canon lower (func $host26) (memory $memory) (realloc $realloc)))
  (core func $lower27 (canon lower (func $host27) (memory $memory) (realloc $realloc)))
  (core func $lower28 (canon lower (func $host28) (memory $memory) (realloc $realloc)))
  (core module $forward
    (import "allocation" "realloc" (func $allocate (param i32 i32 i32 i32) (result i32)))
    (import "host" "f0" (func $f0 (param i32 i32 i32 i32 i32) ))
    (import "host" "f1" (func $f1 (param i32 i32 i32 i32 i32) ))
    (import "host" "f2" (func $f2 (param i32 i32 i32 i32 i32) ))
    (import "host" "f3" (func $f3 (param i32 i32 i32 i32 i32) ))
    (import "host" "f4" (func $f4 (param i32 i32 i32) ))
    (import "host" "f5" (func $f5 (param i32 i32 i32) ))
    (import "host" "f6" (func $f6 (param i32 i32 i32 i32 i32 i32 i32 i32 i32) ))
    (import "host" "f7" (func $f7 (param i32 i32 i32 i32 i32) ))
    (import "host" "f8" (func $f8 (param i32 i32 i32 i32 i32 i32) ))
    (import "host" "f9" (func $f9 (param i32 i32 i32) ))
    (import "host" "f10" (func $f10 (param i32 i32 i32 i32 i32) ))
    (import "host" "f11" (func $f11 (param i32 i32 i32) ))
    (import "host" "f12" (func $f12 (param i32 i32 i32) ))
    (import "host" "f13" (func $f13 (param i32 i32 i32 i32 i32 i32) ))
    (import "host" "f14" (func $f14 (param i32 i32 i32 i32 i32 i32) ))
    (import "host" "f15" (func $f15 (param i32 i32 i32) ))
    (import "host" "f16" (func $f16 (param i32 i32 i32 i32 i32) ))
    (import "host" "f17" (func $f17 (param i32 i32 i32) ))
    (import "host" "f18" (func $f18 (param i32 i32 i32 i32 i32) ))
    (import "host" "f19" (func $f19 (param i32 i32 i32) ))
    (import "host" "f20" (func $f20 (param i32 i32 i32 i32 i32 i32 i32 i32 i32) ))
    (import "host" "f21" (func $f21 (param i32 i32 i32) ))
    (import "host" "f22" (func $f22 (param i32 i32 i32) ))
    (import "host" "f23" (func $f23 (param i32 i32 i32) ))
    (import "host" "f24" (func $f24 (param i32 i32 i32) ))
    (import "host" "f25" (func $f25 (param i32 i32 i32) ))
    (import "host" "f26" (func $f26 (param i32 i32 i32) ))
    (import "host" "f27" (func $f27 (param i32 i32 i32) ))
    (import "host" "f28" (func $f28 (param i32 i32 i32 i32 i32) ))
    (func (export "f0") (param i32 i32 i32 i32) (result i32) (local $result i32)
      (local.set $result (call $allocate (i32.const 0) (i32.const 0) (i32.const 4) (i32.const 16)))
      local.get 0
      local.get 1
      local.get 2
      local.get 3
      local.get $result
      call $f0
      local.get $result
    )
    (func (export "f1") (param i32 i32 i32 i32) (result i32) (local $result i32)
      (local.set $result (call $allocate (i32.const 0) (i32.const 0) (i32.const 4) (i32.const 16)))
      local.get 0
      local.get 1
      local.get 2
      local.get 3
      local.get $result
      call $f1
      local.get $result
    )
    (func (export "f2") (param i32 i32 i32 i32) (result i32) (local $result i32)
      (local.set $result (call $allocate (i32.const 0) (i32.const 0) (i32.const 4) (i32.const 8)))
      local.get 0
      local.get 1
      local.get 2
      local.get 3
      local.get $result
      call $f2
      local.get $result
    )
    (func (export "f3") (param i32 i32 i32 i32) (result i32) (local $result i32)
      (local.set $result (call $allocate (i32.const 0) (i32.const 0) (i32.const 4) (i32.const 8)))
      local.get 0
      local.get 1
      local.get 2
      local.get 3
      local.get $result
      call $f3
      local.get $result
    )
    (func (export "f4") (param i32 i32) (result i32) (local $result i32)
      (local.set $result (call $allocate (i32.const 0) (i32.const 0) (i32.const 4) (i32.const 8)))
      local.get 0
      local.get 1
      local.get $result
      call $f4
      local.get $result
    )
    (func (export "f5") (param i32 i32) (result i32) (local $result i32)
      (local.set $result (call $allocate (i32.const 0) (i32.const 0) (i32.const 4) (i32.const 12)))
      local.get 0
      local.get 1
      local.get $result
      call $f5
      local.get $result
    )
    (func (export "f6") (param i32 i32 i32 i32 i32 i32 i32 i32) (result i32) (local $result i32)
      (local.set $result (call $allocate (i32.const 0) (i32.const 0) (i32.const 4) (i32.const 8)))
      local.get 0
      local.get 1
      local.get 2
      local.get 3
      local.get 4
      local.get 5
      local.get 6
      local.get 7
      local.get $result
      call $f6
      local.get $result
    )
    (func (export "f7") (param i32 i32 i32 i32) (result i32) (local $result i32)
      (local.set $result (call $allocate (i32.const 0) (i32.const 0) (i32.const 4) (i32.const 16)))
      local.get 0
      local.get 1
      local.get 2
      local.get 3
      local.get $result
      call $f7
      local.get $result
    )
    (func (export "f8") (param i32 i32 i32 i32 i32) (result i32) (local $result i32)
      (local.set $result (call $allocate (i32.const 0) (i32.const 0) (i32.const 4) (i32.const 20)))
      local.get 0
      local.get 1
      local.get 2
      local.get 3
      local.get 4
      local.get $result
      call $f8
      local.get $result
    )
    (func (export "f9") (param i32 i32) (result i32) (local $result i32)
      (local.set $result (call $allocate (i32.const 0) (i32.const 0) (i32.const 4) (i32.const 8)))
      local.get 0
      local.get 1
      local.get $result
      call $f9
      local.get $result
    )
    (func (export "f10") (param i32 i32 i32 i32) (result i32) (local $result i32)
      (local.set $result (call $allocate (i32.const 0) (i32.const 0) (i32.const 4) (i32.const 16)))
      local.get 0
      local.get 1
      local.get 2
      local.get 3
      local.get $result
      call $f10
      local.get $result
    )
    (func (export "f11") (param i32 i32) (result i32) (local $result i32)
      (local.set $result (call $allocate (i32.const 0) (i32.const 0) (i32.const 4) (i32.const 20)))
      local.get 0
      local.get 1
      local.get $result
      call $f11
      local.get $result
    )
    (func (export "f12") (param i32 i32) (result i32) (local $result i32)
      (local.set $result (call $allocate (i32.const 0) (i32.const 0) (i32.const 4) (i32.const 20)))
      local.get 0
      local.get 1
      local.get $result
      call $f12
      local.get $result
    )
    (func (export "f13") (param i32 i32 i32 i32 i32) (result i32) (local $result i32)
      (local.set $result (call $allocate (i32.const 0) (i32.const 0) (i32.const 4) (i32.const 8)))
      local.get 0
      local.get 1
      local.get 2
      local.get 3
      local.get 4
      local.get $result
      call $f13
      local.get $result
    )
    (func (export "f14") (param i32 i32 i32 i32 i32) (result i32) (local $result i32)
      (local.set $result (call $allocate (i32.const 0) (i32.const 0) (i32.const 4) (i32.const 8)))
      local.get 0
      local.get 1
      local.get 2
      local.get 3
      local.get 4
      local.get $result
      call $f14
      local.get $result
    )
    (func (export "f15") (param i32 i32) (result i32) (local $result i32)
      (local.set $result (call $allocate (i32.const 0) (i32.const 0) (i32.const 4) (i32.const 20)))
      local.get 0
      local.get 1
      local.get $result
      call $f15
      local.get $result
    )
    (func (export "f16") (param i32 i32 i32 i32) (result i32) (local $result i32)
      (local.set $result (call $allocate (i32.const 0) (i32.const 0) (i32.const 4) (i32.const 8)))
      local.get 0
      local.get 1
      local.get 2
      local.get 3
      local.get $result
      call $f16
      local.get $result
    )
    (func (export "f17") (param i32 i32) (result i32) (local $result i32)
      (local.set $result (call $allocate (i32.const 0) (i32.const 0) (i32.const 4) (i32.const 8)))
      local.get 0
      local.get 1
      local.get $result
      call $f17
      local.get $result
    )
    (func (export "f18") (param i32 i32 i32 i32) (result i32) (local $result i32)
      (local.set $result (call $allocate (i32.const 0) (i32.const 0) (i32.const 4) (i32.const 8)))
      local.get 0
      local.get 1
      local.get 2
      local.get 3
      local.get $result
      call $f18
      local.get $result
    )
    (func (export "f19") (param i32 i32) (result i32) (local $result i32)
      (local.set $result (call $allocate (i32.const 0) (i32.const 0) (i32.const 4) (i32.const 8)))
      local.get 0
      local.get 1
      local.get $result
      call $f19
      local.get $result
    )
    (func (export "f20") (param i32 i32 i32 i32 i32 i32 i32 i32) (result i32) (local $result i32)
      (local.set $result (call $allocate (i32.const 0) (i32.const 0) (i32.const 4) (i32.const 8)))
      local.get 0
      local.get 1
      local.get 2
      local.get 3
      local.get 4
      local.get 5
      local.get 6
      local.get 7
      local.get $result
      call $f20
      local.get $result
    )
    (func (export "f21") (param i32 i32) (result i32) (local $result i32)
      (local.set $result (call $allocate (i32.const 0) (i32.const 0) (i32.const 4) (i32.const 8)))
      local.get 0
      local.get 1
      local.get $result
      call $f21
      local.get $result
    )
    (func (export "f22") (param i32 i32) (result i32) (local $result i32)
      (local.set $result (call $allocate (i32.const 0) (i32.const 0) (i32.const 4) (i32.const 12)))
      local.get 0
      local.get 1
      local.get $result
      call $f22
      local.get $result
    )
    (func (export "f23") (param i32 i32) (result i32) (local $result i32)
      (local.set $result (call $allocate (i32.const 0) (i32.const 0) (i32.const 4) (i32.const 16)))
      local.get 0
      local.get 1
      local.get $result
      call $f23
      local.get $result
    )
    (func (export "f24") (param i32 i32) (result i32) (local $result i32)
      (local.set $result (call $allocate (i32.const 0) (i32.const 0) (i32.const 4) (i32.const 8)))
      local.get 0
      local.get 1
      local.get $result
      call $f24
      local.get $result
    )
    (func (export "f25") (param i32 i32) (result i32) (local $result i32)
      (local.set $result (call $allocate (i32.const 0) (i32.const 0) (i32.const 4) (i32.const 16)))
      local.get 0
      local.get 1
      local.get $result
      call $f25
      local.get $result
    )
    (func (export "f26") (param i32 i32) (result i32) (local $result i32)
      (local.set $result (call $allocate (i32.const 0) (i32.const 0) (i32.const 4) (i32.const 16)))
      local.get 0
      local.get 1
      local.get $result
      call $f26
      local.get $result
    )
    (func (export "f27") (param i32 i32) (result i32) (local $result i32)
      (local.set $result (call $allocate (i32.const 0) (i32.const 0) (i32.const 4) (i32.const 8)))
      local.get 0
      local.get 1
      local.get $result
      call $f27
      local.get $result
    )
    (func (export "f28") (param i32 i32 i32 i32) (result i32) (local $result i32)
      (local.set $result (call $allocate (i32.const 0) (i32.const 0) (i32.const 4) (i32.const 8)))
      local.get 0
      local.get 1
      local.get 2
      local.get 3
      local.get $result
      call $f28
      local.get $result
    )
  )
  (core instance $imports
    (export "f0" (func $lower0))
    (export "f1" (func $lower1))
    (export "f2" (func $lower2))
    (export "f3" (func $lower3))
    (export "f4" (func $lower4))
    (export "f5" (func $lower5))
    (export "f6" (func $lower6))
    (export "f7" (func $lower7))
    (export "f8" (func $lower8))
    (export "f9" (func $lower9))
    (export "f10" (func $lower10))
    (export "f11" (func $lower11))
    (export "f12" (func $lower12))
    (export "f13" (func $lower13))
    (export "f14" (func $lower14))
    (export "f15" (func $lower15))
    (export "f16" (func $lower16))
    (export "f17" (func $lower17))
    (export "f18" (func $lower18))
    (export "f19" (func $lower19))
    (export "f20" (func $lower20))
    (export "f21" (func $lower21))
    (export "f22" (func $lower22))
    (export "f23" (func $lower23))
    (export "f24" (func $lower24))
    (export "f25" (func $lower25))
    (export "f26" (func $lower26))
    (export "f27" (func $lower27))
    (export "f28" (func $lower28))
  )
  (core instance $forwarded (instantiate $forward (with "allocation" (instance $allocation)) (with "host" (instance $imports))))
  (alias core export $forwarded "f0" (core func $forward0))
  (alias core export $forwarded "f1" (core func $forward1))
  (alias core export $forwarded "f2" (core func $forward2))
  (alias core export $forwarded "f3" (core func $forward3))
  (alias core export $forwarded "f4" (core func $forward4))
  (alias core export $forwarded "f5" (core func $forward5))
  (alias core export $forwarded "f6" (core func $forward6))
  (alias core export $forwarded "f7" (core func $forward7))
  (alias core export $forwarded "f8" (core func $forward8))
  (alias core export $forwarded "f9" (core func $forward9))
  (alias core export $forwarded "f10" (core func $forward10))
  (alias core export $forwarded "f11" (core func $forward11))
  (alias core export $forwarded "f12" (core func $forward12))
  (alias core export $forwarded "f13" (core func $forward13))
  (alias core export $forwarded "f14" (core func $forward14))
  (alias core export $forwarded "f15" (core func $forward15))
  (alias core export $forwarded "f16" (core func $forward16))
  (alias core export $forwarded "f17" (core func $forward17))
  (alias core export $forwarded "f18" (core func $forward18))
  (alias core export $forwarded "f19" (core func $forward19))
  (alias core export $forwarded "f20" (core func $forward20))
  (alias core export $forwarded "f21" (core func $forward21))
  (alias core export $forwarded "f22" (core func $forward22))
  (alias core export $forwarded "f23" (core func $forward23))
  (alias core export $forwarded "f24" (core func $forward24))
  (alias core export $forwarded "f25" (core func $forward25))
  (alias core export $forwarded "f26" (core func $forward26))
  (alias core export $forwarded "f27" (core func $forward27))
  (alias core export $forwarded "f28" (core func $forward28))
  (func $f0 (param "arg0" $public1) (result $public1) (canon lift (core func $forward0) (memory $memory) (realloc $realloc) (post-return $post-i32)))
  (func $f1 (param "arg0" $public1) (result $public1) (canon lift (core func $forward1) (memory $memory) (realloc $realloc) (post-return $post-i32)))
  (func $f2 (param "arg0" $public1) (result $public0) (canon lift (core func $forward2) (memory $memory) (realloc $realloc) (post-return $post-i32)))
  (func $f3 (param "arg0" $public17) (param "arg1" $public17) (result $public0) (canon lift (core func $forward3) (memory $memory) (realloc $realloc) (post-return $post-i32)))
  (func $f4 (param "arg0" $public0) (result $public5) (canon lift (core func $forward4) (memory $memory) (realloc $realloc) (post-return $post-i32)))
  (func $f5 (param "arg0" $public0) (result $public6) (canon lift (core func $forward5) (memory $memory) (realloc $realloc) (post-return $post-i32)))
  (func $f6 (param "arg0" $public2) (param "arg1" $public2) (result $public0) (canon lift (core func $forward6) (memory $memory) (realloc $realloc) (post-return $post-i32)))
  (func $f7 (param "arg0" $public2) (result $public2) (canon lift (core func $forward7) (memory $memory) (realloc $realloc) (post-return $post-i32)))
  (func $f8 (param "arg0" $public9) (result $public9) (canon lift (core func $forward8) (memory $memory) (realloc $realloc) (post-return $post-i32)))
  (func $f9 (param "arg0" $public17) (result $public17) (canon lift (core func $forward9) (memory $memory) (realloc $realloc) (post-return $post-i32)))
  (func $f10 (param "arg0" $public10) (result $public10) (canon lift (core func $forward10) (memory $memory) (realloc $realloc) (post-return $post-i32)))
  (func $f11 (param "arg0" $public0) (result $public9) (canon lift (core func $forward11) (memory $memory) (realloc $realloc) (post-return $post-i32)))
  (func $f12 (param "arg0" $public0) (result $public9) (canon lift (core func $forward12) (memory $memory) (realloc $realloc) (post-return $post-i32)))
  (func $f13 (param "arg0" $public9) (result $public0) (canon lift (core func $forward13) (memory $memory) (realloc $realloc) (post-return $post-i32)))
  (func $f14 (param "arg0" $public9) (result $public0) (canon lift (core func $forward14) (memory $memory) (realloc $realloc) (post-return $post-i32)))
  (func $f15 (param "arg0" $public0) (result $public9) (canon lift (core func $forward15) (memory $memory) (realloc $realloc) (post-return $post-i32)))
  (func $f16 (param "arg0" $public2) (result $public0) (canon lift (core func $forward16) (memory $memory) (realloc $realloc) (post-return $post-i32)))
  (func $f17 (param "arg0" $public0) (result $public17) (canon lift (core func $forward17) (memory $memory) (realloc $realloc) (post-return $post-i32)))
  (func $f18 (param "arg0" $public10) (result $public0) (canon lift (core func $forward18) (memory $memory) (realloc $realloc) (post-return $post-i32)))
  (func $f19 (param "arg0" $public0) (result $public11) (canon lift (core func $forward19) (memory $memory) (realloc $realloc) (post-return $post-i32)))
  (func $f20 (param "arg0" $public12) (result $public0) (canon lift (core func $forward20) (memory $memory) (realloc $realloc) (post-return $post-i32)))
  (func $f21 (param "arg0" $public0) (result $public5) (canon lift (core func $forward21) (memory $memory) (realloc $realloc) (post-return $post-i32)))
  (func $f22 (param "arg0" $public0) (result $public13) (canon lift (core func $forward22) (memory $memory) (realloc $realloc) (post-return $post-i32)))
  (func $f23 (param "arg0" $public0) (result $public10) (canon lift (core func $forward23) (memory $memory) (realloc $realloc) (post-return $post-i32)))
  (func $f24 (param "arg0" $public0) (result $public0) (canon lift (core func $forward24) (memory $memory) (realloc $realloc) (post-return $post-i32)))
  (func $f25 (param "arg0" $public0) (result $public2) (canon lift (core func $forward25) (memory $memory) (realloc $realloc) (post-return $post-i32)))
  (func $f26 (param "arg0" $public0) (result $public14) (canon lift (core func $forward26) (memory $memory) (realloc $realloc) (post-return $post-i32)))
  (func $f27 (param "arg0" $public0) (result $public0) (canon lift (core func $forward27) (memory $memory) (realloc $realloc) (post-return $post-i32)))
  (func $f28 (param "arg0" $public2) (result $public0) (canon lift (core func $forward28) (memory $memory) (realloc $realloc) (post-return $post-i32)))
  (type $public-api (instance
    (alias outer 1 $public0 (type $outer0))
    (export "bridge-value-0" (type $public0 (eq $outer0)))
    (alias outer 1 $public1 (type $outer1))
    (export "generic-nat" (type $public1 (eq $outer1)))
    (alias outer 1 $public2 (type $outer2))
    (export "envelope" (type $public2 (eq $outer2)))
    (alias outer 1 $public3 (type $outer3))
    (export "bridge-value-3" (type $public3 (eq $outer3)))
    (alias outer 1 $public4 (type $outer4))
    (export "bridge-value-4" (type $public4 (eq $outer4)))
    (alias outer 1 $public5 (type $outer5))
    (export "bridge-value-5" (type $public5 (eq $outer5)))
    (alias outer 1 $public6 (type $outer6))
    (export "bridge-value-6" (type $public6 (eq $outer6)))
    (alias outer 1 $public7 (type $outer7))
    (export "bridge-value-7" (type $public7 (eq $outer7)))
    (alias outer 1 $public8 (type $outer8))
    (export "bridge-value-8" (type $public8 (eq $outer8)))
    (alias outer 1 $public18 (type $outer18))
    (export "event-box-fields" (type $public18 (eq $outer18)))
    (alias outer 1 $public19 (type $outer19))
    (export "event-choices-fields" (type $public19 (eq $outer19)))
    (alias outer 1 $public9 (type $outer9))
    (export "event" (type $public9 (eq $outer9)))
    (alias outer 1 $public15 (type $outer15))
    (export "envelope-alias" (type $public15 (eq $outer15)))
    (alias outer 1 $public16 (type $outer16))
    (export "bridge-alias-value-16" (type $public16 (eq $outer16)))
    (alias outer 1 $public17 (type $outer17))
    (export "bridge-alias-value-17" (type $public17 (eq $outer17)))
    (alias outer 1 $public10 (type $outer10))
    (export "alias-pair" (type $public10 (eq $outer10)))
    (alias outer 1 $public11 (type $outer11))
    (export "bridge-value-11" (type $public11 (eq $outer11)))
    (alias outer 1 $public12 (type $outer12))
    (export "pair" (type $public12 (eq $outer12)))
    (alias outer 1 $public13 (type $outer13))
    (export "bridge-value-13" (type $public13 (eq $outer13)))
    (alias outer 1 $public14 (type $outer14))
    (export "bridge-value-14" (type $public14 (eq $outer14)))

    (export "echo-generic-first" (func (param "arg0" $public1) (result $public1)))
    (export "echo-generic-second" (func (param "arg0" $public1) (result $public1)))
    (export "generic-use" (func (param "arg0" $public1) (result $public0)))
    (export "aliases" (func (param "arg0" $public17) (param "arg1" $public17) (result $public0)))
    (export "array-values" (func (param "arg0" $public0) (result $public5)))
    (export "branch" (func (param "arg0" $public0) (result $public6)))
    (export "combine" (func (param "arg0" $public2) (param "arg1" $public2) (result $public0)))
    (export "echo" (func (param "arg0" $public2) (result $public2)))
    (export "echo-event" (func (param "arg0" $public9) (result $public9)))
    (export "echo-groups" (func (param "arg0" $public17) (result $public17)))
    (export "echo-pair" (func (param "arg0" $public10) (result $public10)))
    (export "event-choices" (func (param "arg0" $public0) (result $public9)))
    (export "event-empty" (func (param "arg0" $public0) (result $public9)))
    (export "event-first" (func (param "arg0" $public9) (result $public0)))
    (export "event-second" (func (param "arg0" $public9) (result $public0)))
    (export "event-value" (func (param "arg0" $public0) (result $public9)))
    (export "first" (func (param "arg0" $public2) (result $public0)))
    (export "group-values" (func (param "arg0" $public0) (result $public17)))
    (export "inspect-alias-pair" (func (param "arg0" $public10) (result $public0)))
    (export "list-values" (func (param "arg0" $public0) (result $public11)))
    (export "nested" (func (param "arg0" $public12) (result $public0)))
    (export "no-items" (func (param "arg0" $public0) (result $public5)))
    (export "optional" (func (param "arg0" $public0) (result $public13)))
    (export "pair-values" (func (param "arg0" $public0) (result $public10)))
    (export "plain-fin" (func (param "arg0" $public0) (result $public0)))
    (export "produce-envelope" (func (param "arg0" $public0) (result $public2)))
    (export "product" (func (param "arg0" $public0) (result $public14)))
    (export "scalar" (func (param "arg0" $public0) (result $public0)))
    (export "second" (func (param "arg0" $public2) (result $public0)))
  ))
  (instance $public
    (export "bridge-value-0" (type $public0))
    (export "generic-nat" (type $public1))
    (export "envelope" (type $public2))
    (export "bridge-value-3" (type $public3))
    (export "bridge-value-4" (type $public4))
    (export "bridge-value-5" (type $public5))
    (export "bridge-value-6" (type $public6))
    (export "bridge-value-7" (type $public7))
    (export "bridge-value-8" (type $public8))
    (export "event-box-fields" (type $public18))
    (export "event-choices-fields" (type $public19))
    (export "event" (type $public9))
    (export "envelope-alias" (type $public15))
    (export "bridge-alias-value-16" (type $public16))
    (export "bridge-alias-value-17" (type $public17))
    (export "alias-pair" (type $public10))
    (export "bridge-value-11" (type $public11))
    (export "pair" (type $public12))
    (export "bridge-value-13" (type $public13))
    (export "bridge-value-14" (type $public14))
    (export "echo-generic-first" (func $f0))
    (export "echo-generic-second" (func $f1))
    (export "generic-use" (func $f2))
    (export "aliases" (func $f3))
    (export "array-values" (func $f4))
    (export "branch" (func $f5))
    (export "combine" (func $f6))
    (export "echo" (func $f7))
    (export "echo-event" (func $f8))
    (export "echo-groups" (func $f9))
    (export "echo-pair" (func $f10))
    (export "event-choices" (func $f11))
    (export "event-empty" (func $f12))
    (export "event-first" (func $f13))
    (export "event-second" (func $f14))
    (export "event-value" (func $f15))
    (export "first" (func $f16))
    (export "group-values" (func $f17))
    (export "inspect-alias-pair" (func $f18))
    (export "list-values" (func $f19))
    (export "nested" (func $f20))
    (export "no-items" (func $f21))
    (export "optional" (func $f22))
    (export "pair-values" (func $f23))
    (export "plain-fin" (func $f24))
    (export "produce-envelope" (func $f25))
    (export "product" (func $f26))
    (export "scalar" (func $f27))
    (export "second" (func $f28))
  )
  (export "lean-bridge:nominalsubtypes/api@1.0.0" (instance $public) (instance (type $public-api)))
)
