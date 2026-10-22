(component
  (type $api (instance
    (type $limbs (list u32))
    (type $base0 (list u32))
    (export "bridge-value-0" (type $t0 (eq $base0)))
    (type $base1 (record (field "bound" $t0) (field "below" $t0)))
    (export "dependent" (type $t1 (eq $base1)))
    (export "dependent-result" (func (param "arg0" $t0) (result $t1)))
    (export "dependent-roundtrip" (func (param "arg0" $t1) (result $t1)))
    (export "dependent-total" (func (param "arg0" $t1) (result $t0)))
  ))
  (import "lean-bridge:dependentrecords/native@1.0.0" (instance $host (type $api)))
  (alias export $host "bridge-value-0" (type $public0))
  (alias export $host "dependent" (type $public1))
  (alias export $host "dependent-result" (func $host0))
  (alias export $host "dependent-roundtrip" (func $host1))
  (alias export $host "dependent-total" (func $host2))
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
  (core module $forward
    (import "allocation" "realloc" (func $allocate (param i32 i32 i32 i32) (result i32)))
    (import "host" "f0" (func $f0 (param i32 i32 i32) ))
    (import "host" "f1" (func $f1 (param i32 i32 i32 i32 i32) ))
    (import "host" "f2" (func $f2 (param i32 i32 i32 i32 i32) ))
    (func (export "f0") (param i32 i32) (result i32) (local $result i32)
      (local.set $result (call $allocate (i32.const 0) (i32.const 0) (i32.const 4) (i32.const 16)))
      local.get 0
      local.get 1
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
  )
  (core instance $imports
    (export "f0" (func $lower0))
    (export "f1" (func $lower1))
    (export "f2" (func $lower2))
  )
  (core instance $forwarded (instantiate $forward (with "allocation" (instance $allocation)) (with "host" (instance $imports))))
  (alias core export $forwarded "f0" (core func $forward0))
  (alias core export $forwarded "f1" (core func $forward1))
  (alias core export $forwarded "f2" (core func $forward2))
  (func $f0 (param "arg0" $public0) (result $public1) (canon lift (core func $forward0) (memory $memory) (realloc $realloc) (post-return $post-i32)))
  (func $f1 (param "arg0" $public1) (result $public1) (canon lift (core func $forward1) (memory $memory) (realloc $realloc) (post-return $post-i32)))
  (func $f2 (param "arg0" $public1) (result $public0) (canon lift (core func $forward2) (memory $memory) (realloc $realloc) (post-return $post-i32)))
  (instance $public
    (export "dependent-result" (func $f0))
    (export "dependent-roundtrip" (func $f1))
    (export "dependent-total" (func $f2))
  )
  (export "lean-bridge:dependentrecords/api@1.0.0" (instance $public))
)
