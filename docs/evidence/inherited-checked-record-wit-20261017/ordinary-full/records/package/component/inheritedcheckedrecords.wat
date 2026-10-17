(component
  (type $api (instance
    (type $limbs (list u32))
    (type $base0 (list u32))
    (export "bridge-value-0" (type $t0 (eq $base0)))
    (type $base1 (record (field "lo" $t0) (field "hi" $t0)))
    (export "span" (type $t1 (eq $base1)))
    (type $base2 (record (field "to-span" $t1) (field "word" $t0)))
    (export "ticket" (type $t2 (eq $base2)))
    (type $base3 (record (field "to-ticket" $t2) (field "mark" $t0)))
    (export "stamped" (type $t3 (eq $base3)))
    (export "ticket-alias" (type $t4 (eq $t2)))
    (export "aliased" (func (param "arg0" $t4) (result $t0)))
    (export "echo" (func (param "arg0" $t2) (result $t2)))
    (export "first" (func (param "arg0" $t2) (result $t0)))
    (export "nested" (func (param "arg0" $t3) (result $t0)))
    (export "normalized" (func (param "arg0" $t2) (result $t0)))
    (export "pair" (func (param "arg0" $t2) (param "arg1" $t2) (result $t0)))
    (export "produce" (func (param "arg0" $t0) (result $t2)))
    (export "produce-stamped" (func (param "arg0" $t0) (result $t3)))
  ))
  (import "lean-bridge:inheritedcheckedrecords/native@1.0.0" (instance $host (type $api)))
  (alias export $host "bridge-value-0" (type $public0))
  (alias export $host "span" (type $public1))
  (alias export $host "ticket" (type $public2))
  (alias export $host "stamped" (type $public3))
  (alias export $host "ticket-alias" (type $public4))
  (alias export $host "aliased" (func $host0))
  (alias export $host "echo" (func $host1))
  (alias export $host "first" (func $host2))
  (alias export $host "nested" (func $host3))
  (alias export $host "normalized" (func $host4))
  (alias export $host "pair" (func $host5))
  (alias export $host "produce" (func $host6))
  (alias export $host "produce-stamped" (func $host7))
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
  (core module $forward
    (import "allocation" "realloc" (func $allocate (param i32 i32 i32 i32) (result i32)))
    (import "host" "f0" (func $f0 (param i32 i32 i32 i32 i32 i32 i32) ))
    (import "host" "f1" (func $f1 (param i32 i32 i32 i32 i32 i32 i32) ))
    (import "host" "f2" (func $f2 (param i32 i32 i32 i32 i32 i32 i32) ))
    (import "host" "f3" (func $f3 (param i32 i32 i32 i32 i32 i32 i32 i32 i32) ))
    (import "host" "f4" (func $f4 (param i32 i32 i32 i32 i32 i32 i32) ))
    (import "host" "f5" (func $f5 (param i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32) ))
    (import "host" "f6" (func $f6 (param i32 i32 i32) ))
    (import "host" "f7" (func $f7 (param i32 i32 i32) ))
    (func (export "f0") (param i32 i32 i32 i32 i32 i32) (result i32) (local $result i32)
      (local.set $result (call $allocate (i32.const 0) (i32.const 0) (i32.const 4) (i32.const 8)))
      local.get 0
      local.get 1
      local.get 2
      local.get 3
      local.get 4
      local.get 5
      local.get $result
      call $f0
      local.get $result
    )
    (func (export "f1") (param i32 i32 i32 i32 i32 i32) (result i32) (local $result i32)
      (local.set $result (call $allocate (i32.const 0) (i32.const 0) (i32.const 4) (i32.const 24)))
      local.get 0
      local.get 1
      local.get 2
      local.get 3
      local.get 4
      local.get 5
      local.get $result
      call $f1
      local.get $result
    )
    (func (export "f2") (param i32 i32 i32 i32 i32 i32) (result i32) (local $result i32)
      (local.set $result (call $allocate (i32.const 0) (i32.const 0) (i32.const 4) (i32.const 8)))
      local.get 0
      local.get 1
      local.get 2
      local.get 3
      local.get 4
      local.get 5
      local.get $result
      call $f2
      local.get $result
    )
    (func (export "f3") (param i32 i32 i32 i32 i32 i32 i32 i32) (result i32) (local $result i32)
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
      call $f3
      local.get $result
    )
    (func (export "f4") (param i32 i32 i32 i32 i32 i32) (result i32) (local $result i32)
      (local.set $result (call $allocate (i32.const 0) (i32.const 0) (i32.const 4) (i32.const 8)))
      local.get 0
      local.get 1
      local.get 2
      local.get 3
      local.get 4
      local.get 5
      local.get $result
      call $f4
      local.get $result
    )
    (func (export "f5") (param i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32) (result i32) (local $result i32)
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
      local.get 11
      local.get $result
      call $f5
      local.get $result
    )
    (func (export "f6") (param i32 i32) (result i32) (local $result i32)
      (local.set $result (call $allocate (i32.const 0) (i32.const 0) (i32.const 4) (i32.const 24)))
      local.get 0
      local.get 1
      local.get $result
      call $f6
      local.get $result
    )
    (func (export "f7") (param i32 i32) (result i32) (local $result i32)
      (local.set $result (call $allocate (i32.const 0) (i32.const 0) (i32.const 4) (i32.const 32)))
      local.get 0
      local.get 1
      local.get $result
      call $f7
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
  (func $f0 (param "arg0" $public4) (result $public0) (canon lift (core func $forward0) (memory $memory) (realloc $realloc) (post-return $post-i32)))
  (func $f1 (param "arg0" $public2) (result $public2) (canon lift (core func $forward1) (memory $memory) (realloc $realloc) (post-return $post-i32)))
  (func $f2 (param "arg0" $public2) (result $public0) (canon lift (core func $forward2) (memory $memory) (realloc $realloc) (post-return $post-i32)))
  (func $f3 (param "arg0" $public3) (result $public0) (canon lift (core func $forward3) (memory $memory) (realloc $realloc) (post-return $post-i32)))
  (func $f4 (param "arg0" $public2) (result $public0) (canon lift (core func $forward4) (memory $memory) (realloc $realloc) (post-return $post-i32)))
  (func $f5 (param "arg0" $public2) (param "arg1" $public2) (result $public0) (canon lift (core func $forward5) (memory $memory) (realloc $realloc) (post-return $post-i32)))
  (func $f6 (param "arg0" $public0) (result $public2) (canon lift (core func $forward6) (memory $memory) (realloc $realloc) (post-return $post-i32)))
  (func $f7 (param "arg0" $public0) (result $public3) (canon lift (core func $forward7) (memory $memory) (realloc $realloc) (post-return $post-i32)))
  (type $public-api (instance
    (alias outer 1 $public0 (type $outer0))
    (export "bridge-value-0" (type $public0 (eq $outer0)))
    (alias outer 1 $public1 (type $outer1))
    (export "span" (type $public1 (eq $outer1)))
    (alias outer 1 $public2 (type $outer2))
    (export "ticket" (type $public2 (eq $outer2)))
    (alias outer 1 $public3 (type $outer3))
    (export "stamped" (type $public3 (eq $outer3)))
    (alias outer 1 $public4 (type $outer4))
    (export "ticket-alias" (type $public4 (eq $outer4)))

    (export "aliased" (func (param "arg0" $public4) (result $public0)))
    (export "echo" (func (param "arg0" $public2) (result $public2)))
    (export "first" (func (param "arg0" $public2) (result $public0)))
    (export "nested" (func (param "arg0" $public3) (result $public0)))
    (export "normalized" (func (param "arg0" $public2) (result $public0)))
    (export "pair" (func (param "arg0" $public2) (param "arg1" $public2) (result $public0)))
    (export "produce" (func (param "arg0" $public0) (result $public2)))
    (export "produce-stamped" (func (param "arg0" $public0) (result $public3)))
  ))
  (instance $public
    (export "bridge-value-0" (type $public0))
    (export "span" (type $public1))
    (export "ticket" (type $public2))
    (export "stamped" (type $public3))
    (export "ticket-alias" (type $public4))
    (export "aliased" (func $f0))
    (export "echo" (func $f1))
    (export "first" (func $f2))
    (export "nested" (func $f3))
    (export "normalized" (func $f4))
    (export "pair" (func $f5))
    (export "produce" (func $f6))
    (export "produce-stamped" (func $f7))
  )
  (export "lean-bridge:inheritedcheckedrecords/api@1.0.0" (instance $public) (instance (type $public-api)))
)
