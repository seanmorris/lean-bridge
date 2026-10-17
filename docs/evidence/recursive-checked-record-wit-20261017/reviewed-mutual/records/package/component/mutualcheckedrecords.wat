(component
  (type $api (instance
    (type $limbs (list u32))
    (type $base1 (record (field "index" u32)))
    (export "lb-graph-ref3" (type $t1 (eq $base1)))
    (type $base2 (record (field "index" u32)))
    (export "lb-graph-ref1" (type $t2 (eq $base2)))
    (type $base3 (list $t2))
    (export "bridge-value-3" (type $t3 (eq $base3)))
    (type $base4 (list $t3))
    (export "bridge-value-4" (type $t4 (eq $base4)))
    (type $base5 (option $t1))
    (export "bridge-value-5" (type $t5 (eq $base5)))
    (type $base6 (list $t5))
    (export "bridge-value-6" (type $t6 (eq $base6)))
    (type $base7 (record (field "index" u32)))
    (export "lb-graph-ref4" (type $t7 (eq $base7)))
    (type $base8 (option $t7))
    (export "bridge-value-8" (type $t8 (eq $base8)))
    (type $base9 (list $t8))
    (export "bridge-value-9" (type $t9 (eq $base9)))
    (type $base10 (list u32))
    (export "bridge-value-10" (type $t10 (eq $base10)))
    (type $base11 (record (field "index" u32)))
    (export "lb-graph-ref2" (type $t11 (eq $base11)))
    (type $base12 (record (field "value" $t10) (field "mode" $t10) (field "next" $t11)))
    (export "lb-graph-node3" (type $t12 (eq $base12)))
    (type $base13 (list $t12))
    (export "bridge-value-13" (type $t13 (eq $base13)))
    (type $base30 (record (field "packet" $t1)))
    (export "lb-graph-node4-more-fields" (type $t30 (eq $base30)))
    (type $base14 (variant (case "stop") (case "more" $t30)))
    (export "lb-graph-node4" (type $t14 (eq $base14)))
    (type $base15 (list $t14))
    (export "bridge-value-15" (type $t15 (eq $base15)))
    (export "lb-graph-node0" (type $t21 (eq $t3)))
    (type $base22 (list $t21))
    (export "bridge-alias-value-22" (type $t22 (eq $base22)))
    (export "lb-graph-node1" (type $t23 (eq $t5)))
    (type $base24 (list $t23))
    (export "bridge-alias-value-24" (type $t24 (eq $base24)))
    (export "lb-graph-node2" (type $t25 (eq $t8)))
    (type $base26 (list $t25))
    (export "bridge-alias-value-26" (type $t26 (eq $base26)))
    (type $base16 (record (field "nodes0" $t22) (field "nodes1" $t24) (field "nodes2" $t26) (field "nodes3" $t13) (field "nodes4" $t15)))
    (export "lb-graph-arena" (type $t16 (eq $base16)))
    (type $base17 (record (field "root" $t1) (field "nodes" $t16)))
    (export "lb-graph-value3" (type $t17 (eq $base17)))
    (type $base18 (record (field "index" u32)))
    (export "lb-graph-ref0" (type $t18 (eq $base18)))
    (type $base19 (record (field "root" $t18) (field "nodes" $t16)))
    (export "lb-graph-value0" (type $t19 (eq $base19)))
    (type $base20 (record (field "root" $t7) (field "nodes" $t16)))
    (export "lb-graph-value4" (type $t20 (eq $base20)))
    (export "envelope" (type $t27 (eq $t17)))
    (export "envelope-alias" (type $t28 (eq $t17)))
    (export "step" (type $t29 (eq $t20)))
    (export "echo" (func (param "value0" $t27) (result $t27)))
    (export "echo-groups" (func (param "value0" $t19) (result $t19)))
    (export "first" (func (param "value0" $t27) (result $t10)))
    (export "groups" (func (param "value0" $t19) (result $t10)))
    (export "produce" (func (param "value0" $t10) (result $t27)))
    (export "second" (func (param "value0" $t27) (result $t10)))
  ))
  (import "lean-bridge:mutualcheckedrecords/native@1.0.0" (instance $host (type $api)))
  (alias export $host "lb-graph-ref3" (type $public1))
  (alias export $host "lb-graph-ref1" (type $public2))
  (alias export $host "bridge-value-3" (type $public3))
  (alias export $host "bridge-value-4" (type $public4))
  (alias export $host "bridge-value-5" (type $public5))
  (alias export $host "bridge-value-6" (type $public6))
  (alias export $host "lb-graph-ref4" (type $public7))
  (alias export $host "bridge-value-8" (type $public8))
  (alias export $host "bridge-value-9" (type $public9))
  (alias export $host "bridge-value-10" (type $public10))
  (alias export $host "lb-graph-ref2" (type $public11))
  (alias export $host "lb-graph-node3" (type $public12))
  (alias export $host "bridge-value-13" (type $public13))
  (alias export $host "lb-graph-node4-more-fields" (type $public30))
  (alias export $host "lb-graph-node4" (type $public14))
  (alias export $host "bridge-value-15" (type $public15))
  (alias export $host "lb-graph-node0" (type $public21))
  (alias export $host "bridge-alias-value-22" (type $public22))
  (alias export $host "lb-graph-node1" (type $public23))
  (alias export $host "bridge-alias-value-24" (type $public24))
  (alias export $host "lb-graph-node2" (type $public25))
  (alias export $host "bridge-alias-value-26" (type $public26))
  (alias export $host "lb-graph-arena" (type $public16))
  (alias export $host "lb-graph-value3" (type $public17))
  (alias export $host "lb-graph-ref0" (type $public18))
  (alias export $host "lb-graph-value0" (type $public19))
  (alias export $host "lb-graph-value4" (type $public20))
  (alias export $host "envelope" (type $public27))
  (alias export $host "envelope-alias" (type $public28))
  (alias export $host "step" (type $public29))
  (alias export $host "echo" (func $host0))
  (alias export $host "echo-groups" (func $host1))
  (alias export $host "first" (func $host2))
  (alias export $host "groups" (func $host3))
  (alias export $host "produce" (func $host4))
  (alias export $host "second" (func $host5))
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
  (core module $forward
    (import "allocation" "realloc" (func $allocate (param i32 i32 i32 i32) (result i32)))
    (import "host" "f0" (func $f0 (param i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32) ))
    (import "host" "f1" (func $f1 (param i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32) ))
    (import "host" "f2" (func $f2 (param i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32) ))
    (import "host" "f3" (func $f3 (param i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32) ))
    (import "host" "f4" (func $f4 (param i32 i32 i32) ))
    (import "host" "f5" (func $f5 (param i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32) ))
    (func (export "f0") (param i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32) (result i32) (local $result i32)
      (local.set $result (call $allocate (i32.const 0) (i32.const 0) (i32.const 4) (i32.const 44)))
      local.get 0
      local.get 1
      local.get 2
      local.get 3
      local.get 4
      local.get 5
      local.get 6
      local.get 7
      local.get 8
      local.get 9
      local.get 10
      local.get $result
      call $f0
      local.get $result
    )
    (func (export "f1") (param i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32) (result i32) (local $result i32)
      (local.set $result (call $allocate (i32.const 0) (i32.const 0) (i32.const 4) (i32.const 44)))
      local.get 0
      local.get 1
      local.get 2
      local.get 3
      local.get 4
      local.get 5
      local.get 6
      local.get 7
      local.get 8
      local.get 9
      local.get 10
      local.get $result
      call $f1
      local.get $result
    )
    (func (export "f2") (param i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32) (result i32) (local $result i32)
      (local.set $result (call $allocate (i32.const 0) (i32.const 0) (i32.const 4) (i32.const 8)))
      local.get 0
      local.get 1
      local.get 2
      local.get 3
      local.get 4
      local.get 5
      local.get 6
      local.get 7
      local.get 8
      local.get 9
      local.get 10
      local.get $result
      call $f2
      local.get $result
    )
    (func (export "f3") (param i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32) (result i32) (local $result i32)
      (local.set $result (call $allocate (i32.const 0) (i32.const 0) (i32.const 4) (i32.const 8)))
      local.get 0
      local.get 1
      local.get 2
      local.get 3
      local.get 4
      local.get 5
      local.get 6
      local.get 7
      local.get 8
      local.get 9
      local.get 10
      local.get $result
      call $f3
      local.get $result
    )
    (func (export "f4") (param i32 i32) (result i32) (local $result i32)
      (local.set $result (call $allocate (i32.const 0) (i32.const 0) (i32.const 4) (i32.const 44)))
      local.get 0
      local.get 1
      local.get $result
      call $f4
      local.get $result
    )
    (func (export "f5") (param i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32) (result i32) (local $result i32)
      (local.set $result (call $allocate (i32.const 0) (i32.const 0) (i32.const 4) (i32.const 8)))
      local.get 0
      local.get 1
      local.get 2
      local.get 3
      local.get 4
      local.get 5
      local.get 6
      local.get 7
      local.get 8
      local.get 9
      local.get 10
      local.get $result
      call $f5
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
  )
  (core instance $forwarded (instantiate $forward (with "allocation" (instance $allocation)) (with "host" (instance $imports))))
  (alias core export $forwarded "f0" (core func $forward0))
  (alias core export $forwarded "f1" (core func $forward1))
  (alias core export $forwarded "f2" (core func $forward2))
  (alias core export $forwarded "f3" (core func $forward3))
  (alias core export $forwarded "f4" (core func $forward4))
  (alias core export $forwarded "f5" (core func $forward5))
  (func $f0 (param "value0" $public27) (result $public27) (canon lift (core func $forward0) (memory $memory) (realloc $realloc) (post-return $post-i32)))
  (func $f1 (param "value0" $public19) (result $public19) (canon lift (core func $forward1) (memory $memory) (realloc $realloc) (post-return $post-i32)))
  (func $f2 (param "value0" $public27) (result $public10) (canon lift (core func $forward2) (memory $memory) (realloc $realloc) (post-return $post-i32)))
  (func $f3 (param "value0" $public19) (result $public10) (canon lift (core func $forward3) (memory $memory) (realloc $realloc) (post-return $post-i32)))
  (func $f4 (param "value0" $public10) (result $public27) (canon lift (core func $forward4) (memory $memory) (realloc $realloc) (post-return $post-i32)))
  (func $f5 (param "value0" $public27) (result $public10) (canon lift (core func $forward5) (memory $memory) (realloc $realloc) (post-return $post-i32)))
  (type $public-api (instance
    (alias outer 1 $public1 (type $outer1))
    (export "lb-graph-ref3" (type $public1 (eq $outer1)))
    (alias outer 1 $public2 (type $outer2))
    (export "lb-graph-ref1" (type $public2 (eq $outer2)))
    (alias outer 1 $public3 (type $outer3))
    (export "bridge-value-3" (type $public3 (eq $outer3)))
    (alias outer 1 $public4 (type $outer4))
    (export "bridge-value-4" (type $public4 (eq $outer4)))
    (alias outer 1 $public5 (type $outer5))
    (export "bridge-value-5" (type $public5 (eq $outer5)))
    (alias outer 1 $public6 (type $outer6))
    (export "bridge-value-6" (type $public6 (eq $outer6)))
    (alias outer 1 $public7 (type $outer7))
    (export "lb-graph-ref4" (type $public7 (eq $outer7)))
    (alias outer 1 $public8 (type $outer8))
    (export "bridge-value-8" (type $public8 (eq $outer8)))
    (alias outer 1 $public9 (type $outer9))
    (export "bridge-value-9" (type $public9 (eq $outer9)))
    (alias outer 1 $public10 (type $outer10))
    (export "bridge-value-10" (type $public10 (eq $outer10)))
    (alias outer 1 $public11 (type $outer11))
    (export "lb-graph-ref2" (type $public11 (eq $outer11)))
    (alias outer 1 $public12 (type $outer12))
    (export "lb-graph-node3" (type $public12 (eq $outer12)))
    (alias outer 1 $public13 (type $outer13))
    (export "bridge-value-13" (type $public13 (eq $outer13)))
    (alias outer 1 $public30 (type $outer30))
    (export "lb-graph-node4-more-fields" (type $public30 (eq $outer30)))
    (alias outer 1 $public14 (type $outer14))
    (export "lb-graph-node4" (type $public14 (eq $outer14)))
    (alias outer 1 $public15 (type $outer15))
    (export "bridge-value-15" (type $public15 (eq $outer15)))
    (alias outer 1 $public21 (type $outer21))
    (export "lb-graph-node0" (type $public21 (eq $outer21)))
    (alias outer 1 $public22 (type $outer22))
    (export "bridge-alias-value-22" (type $public22 (eq $outer22)))
    (alias outer 1 $public23 (type $outer23))
    (export "lb-graph-node1" (type $public23 (eq $outer23)))
    (alias outer 1 $public24 (type $outer24))
    (export "bridge-alias-value-24" (type $public24 (eq $outer24)))
    (alias outer 1 $public25 (type $outer25))
    (export "lb-graph-node2" (type $public25 (eq $outer25)))
    (alias outer 1 $public26 (type $outer26))
    (export "bridge-alias-value-26" (type $public26 (eq $outer26)))
    (alias outer 1 $public16 (type $outer16))
    (export "lb-graph-arena" (type $public16 (eq $outer16)))
    (alias outer 1 $public17 (type $outer17))
    (export "lb-graph-value3" (type $public17 (eq $outer17)))
    (alias outer 1 $public18 (type $outer18))
    (export "lb-graph-ref0" (type $public18 (eq $outer18)))
    (alias outer 1 $public19 (type $outer19))
    (export "lb-graph-value0" (type $public19 (eq $outer19)))
    (alias outer 1 $public20 (type $outer20))
    (export "lb-graph-value4" (type $public20 (eq $outer20)))
    (alias outer 1 $public27 (type $outer27))
    (export "envelope" (type $public27 (eq $outer27)))
    (alias outer 1 $public28 (type $outer28))
    (export "envelope-alias" (type $public28 (eq $outer28)))
    (alias outer 1 $public29 (type $outer29))
    (export "step" (type $public29 (eq $outer29)))

    (export "echo" (func (param "value0" $public27) (result $public27)))
    (export "echo-groups" (func (param "value0" $public19) (result $public19)))
    (export "first" (func (param "value0" $public27) (result $public10)))
    (export "groups" (func (param "value0" $public19) (result $public10)))
    (export "produce" (func (param "value0" $public10) (result $public27)))
    (export "second" (func (param "value0" $public27) (result $public10)))
  ))
  (instance $public
    (export "lb-graph-ref3" (type $public1))
    (export "lb-graph-ref1" (type $public2))
    (export "bridge-value-3" (type $public3))
    (export "bridge-value-4" (type $public4))
    (export "bridge-value-5" (type $public5))
    (export "bridge-value-6" (type $public6))
    (export "lb-graph-ref4" (type $public7))
    (export "bridge-value-8" (type $public8))
    (export "bridge-value-9" (type $public9))
    (export "bridge-value-10" (type $public10))
    (export "lb-graph-ref2" (type $public11))
    (export "lb-graph-node3" (type $public12))
    (export "bridge-value-13" (type $public13))
    (export "lb-graph-node4-more-fields" (type $public30))
    (export "lb-graph-node4" (type $public14))
    (export "bridge-value-15" (type $public15))
    (export "lb-graph-node0" (type $public21))
    (export "bridge-alias-value-22" (type $public22))
    (export "lb-graph-node1" (type $public23))
    (export "bridge-alias-value-24" (type $public24))
    (export "lb-graph-node2" (type $public25))
    (export "bridge-alias-value-26" (type $public26))
    (export "lb-graph-arena" (type $public16))
    (export "lb-graph-value3" (type $public17))
    (export "lb-graph-ref0" (type $public18))
    (export "lb-graph-value0" (type $public19))
    (export "lb-graph-value4" (type $public20))
    (export "envelope" (type $public27))
    (export "envelope-alias" (type $public28))
    (export "step" (type $public29))
    (export "echo" (func $f0))
    (export "echo-groups" (func $f1))
    (export "first" (func $f2))
    (export "groups" (func $f3))
    (export "produce" (func $f4))
    (export "second" (func $f5))
  )
  (export "lean-bridge:mutualcheckedrecords/api@1.0.0" (instance $public) (instance (type $public-api)))
)
