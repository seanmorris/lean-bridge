unsafe extern "C" {
    fn rust_native_reset(fail: usize, bad: usize);
    fn rust_native_live() -> usize;
    fn rust_native_attempts() -> usize;
    fn rust_native_decodes() -> usize;
    fn rust_native_initialize() -> u32;
    fn rust_native_ready() -> i32;
    fn rust_native_retire();
    fn rust_native_hold() -> u32;
    fn rust_native_release();
    fn rust_native_detach();
}
static LIFECYCLE: GraphLifecycle = GraphLifecycle {
    initialize: rust_native_initialize, ready: rust_native_ready, retire: rust_native_retire,
};
thread_local! { static CHECKS: std::cell::Cell<usize> = const { std::cell::Cell::new(0) }; }
macro_rules! check { ($expression:expr) => {{ CHECKS.with(|n| n.set(n.get() + 1)); assert!($expression); }}; }
fn clean() {
    check!(GRAPH_LIVE.with(|live| live.get()) == 0);
    check!(unsafe { rust_native_live() } == 0);
}
fn reset(fail: usize, bad: usize) {
    GRAPH_FAULT.with(|state| state.set((0, 0, false)));
    unsafe { rust_native_reset(fail, bad) };
}
fn payload() -> Scalars {
    let natural = (BigUint::from(1u8) << 128usize) + 1u8;
    Scalars { unit: (), bool_: true, u8: u8::MAX, u16: u16::MAX, u32: u32::MAX, u64: u64::MAX,
        i8: i8::MIN, i16: i16::MIN, i32: i32::MIN, i64: i64::MIN,
        integer: -BigInt::from(natural.clone()), natural, f32: 1.5, f64: -2.25,
        text: "A\0🌱".into(), bytes: vec![0, 255, 1], char_: '🌱', word: u32::MAX.into(), signed_word: i32::MIN.into() }
}
unsafe extern "C" fn malformed_raw(input: *const TreeRaw, out: *mut TreeRaw) -> u32 {
    let status = unsafe { recursive_tree_graph(input, out) };
    if status == 0 { unsafe { (*out).kind = u32::MAX; } }
    status
}
unsafe extern "C" fn retire_during(input: *const TreeRaw, out: *mut TreeRaw) -> u32 {
    let status = unsafe { recursive_tree_graph(input, out) };
    unsafe { rust_native_retire() };
    status
}

#[test]
fn compiled_lean_graphs() {
    reset(0, 0);
    check!(unsafe { rust_native_ready() } == 0);
    let mut too_deep = Tree::Branch { children: vec![] };
    for _ in 0..130 { too_deep = Tree::Branch { children: vec![too_deep] }; }
    let leaf = Tree::Leaf { payload: payload() };
    check!(call_join_trees(&leaf, &too_deep) == Err(GraphError::Limit));
    check!(unsafe { rust_native_ready() } == 0);
    check!(unsafe { rust_native_decodes() } == 0);
    check!(GRAPH_FAULT.with(|state| state.get().1) == 0); clean();
    let scalar = payload();
    check!(call_inspect(&scalar).unwrap()); check!(call_scalars(&scalar).unwrap() == scalar);
    check!(call_word_max(&u64::MAX).unwrap()); check!(call_signed_min(&i64::MIN).unwrap());
    let mut large = scalar.clone(); large.natural = (BigUint::from(1u8) << 1000usize) + 7u8;
    large.integer = -BigInt::from(large.natural.clone());
    check!(call_scalars(&large).unwrap() == large);
    let mut empty = scalar.clone(); empty.natural = 0u8.into(); empty.integer = 0u8.into(); empty.text.clear(); empty.bytes.clear();
    check!(call_scalars(&empty).unwrap() == empty);
    let mut special = scalar.clone(); special.f32 = f32::NAN; special.f64 = -0.0;
    let copy = call_scalars(&special).unwrap(); check!(copy.f32.is_nan()); check!(copy.f64.to_bits() == (-0.0f64).to_bits());
    special.f32 = f32::NEG_INFINITY; special.f64 = f64::INFINITY;
    check!(call_scalars(&special).unwrap() == special); clean();

    let tree = Tree::Branch { children: vec![leaf.clone(), Tree::Branch { children: vec![] }] };
    check!(call_tree(&tree).unwrap() == tree);
    check!(call_join_trees(&tree, &leaf).unwrap() == Tree::Branch { children: vec![tree.clone(), leaf.clone()] });
    check!(call_empty().unwrap() == Tree::Branch { children: vec![] });
    let forest = vec![tree.clone(); 512]; check!(call_forest(&forest[..]).unwrap() == forest);
    let mut envelope = Envelope { tree: tree.clone(), alternatives: vec![vec![], vec![tree.clone()]], fallback: Some(leaf.clone()),
        outcome: Box::new(Ok((tree.clone(), leaf.clone()))), marker: None };
    for marker in [None, Some(None), Some(Some(()))] {
        envelope.marker = marker; check!(call_envelope(&envelope).unwrap() == envelope);
        let mut error = envelope.clone(); error.outcome = Box::new(Err("error\0🌿".into())); error.fallback = None;
        check!(call_envelope(&error).unwrap() == error);
    }
    let left = LeftTree::Next { right: RightTree::Many { lefts: vec![LeftTree::Leaf { value: 9 }] } };
    check!(call_left(&left).unwrap() == left);
    let right = RightTree::Many { lefts: vec![left] }; check!(call_right(&right).unwrap() == right);
    let mut spine = Spine::Leaf { value: 41 };
    for _ in 0..127 { spine = Spine::Next { value: Box::new(spine) }; }
    let mut copy = call_spine(&spine).unwrap(); check!(copy == spine);
    let (mut a, mut b) = (&spine, &mut copy);
    for _ in 0..127 {
        check!(!std::ptr::eq(a, b));
        a = match a { Spine::Next { value } => value, _ => panic!("missing input child") };
        b = match b { Spine::Next { value } => value, _ => panic!("missing copied child") };
    }
    match b { Spine::Leaf { value } => *value = 42, _ => panic!("missing leaf") };
    check!(copy != spine);
    check!(call_grow(&spine) == Err(GraphError::Limit)); clean();
    check!(call_grow(&Spine::Leaf { value: 7 }).unwrap() == Spine::Next { value: Box::new(Spine::Leaf { value: 7 }) });
    let wide = wide_value(); check!(call_wide(&wide).unwrap() == wide);
    for marker in [Marker::Empty, Marker::Unit { value: () }, Marker::Next { value: Box::new(Marker::Empty) }] {
        check!(call_marker(&marker).unwrap() == marker);
    }
    check!(call_empty_record(&EmptyRecord {}).unwrap() == EmptyRecord {});
    check!(call_units(&[(); 123]).unwrap().len() == 123); clean();

    reset(0, 0);
    check!(call_envelope(&envelope).unwrap() == envelope);
    let native_count = unsafe { rust_native_attempts() };
    let rust_count = GRAPH_FAULT.with(|state| state.get().1);
    check!(native_count > 1 && rust_count > 1); clean();
    for fail in 1..=native_count {
        reset(fail, 0); check!(call_envelope(&envelope) == Err(GraphError::Allocation)); clean();
        check!(unsafe { rust_native_ready() } != 0);
    }
    let hook = std::panic::take_hook(); std::panic::set_hook(Box::new(|_| {}));
    let (mut input_failures, mut output_failures) = (0, 0);
    for fail in 1..=rust_count {
        reset(0, 0); GRAPH_FAULT.with(|state| state.set((fail, 0, false)));
        check!(call_envelope(&envelope) == Err(GraphError::Allocation)); clean();
        if unsafe { rust_native_decodes() } == 0 { input_failures += 1; } else { output_failures += 1; }
        reset(0, 0); GRAPH_FAULT.with(|state| state.set((fail, 0, true)));
        check!(std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| call_envelope(&envelope))).is_err()); clean();
        check!(unsafe { rust_native_ready() } != 0);
    }
    std::panic::set_hook(hook); check!(input_failures > 0 && output_failures > 0);
    reset(0, 0); check!(call_envelope(&envelope).unwrap() == envelope); clean();

    // Retain a separate native result across the irreversible retirement.
    check!(unsafe { rust_native_hold() } == 0);
    let retained = unsafe { rust_native_live() }; check!(retained > 0);
    match std::env::var("LEAN_BRIDGE_GRAPH_FAILURE").unwrap().as_str() {
        "carrier" => { reset(0, 1); check!(call_tree(&tree) == Err(GraphError::InvalidNative)); }
        "raw" => check!(unsafe { graph_call_tree_guarded(Some(&LIFECYCLE), malformed_raw, &tree) } == Err(GraphError::InvalidNative)),
        "during" => check!(unsafe { graph_call_tree_guarded(Some(&LIFECYCLE), retire_during, &tree) } == Err(GraphError::Unavailable)),
        _ => panic!("unknown retirement scenario"),
    }
    check!(unsafe { rust_native_ready() } == 0);
    check!(unsafe { rust_native_live() } == retained);
    check!(GRAPH_LIVE.with(|live| live.get()) == 0);
    reset(0, 0);
    check!(call_envelope(&envelope) == Err(GraphError::Unavailable));
    check!(unsafe { rust_native_decodes() } == 0);
    check!(GRAPH_FAULT.with(|state| state.get().1) == 0);
    unsafe { rust_native_release(); rust_native_release(); rust_native_detach(); } clean();
    println!("rust-lean-graphs:{}:{}:{}", CHECKS.with(|n| n.get()), native_count, rust_count);
}
