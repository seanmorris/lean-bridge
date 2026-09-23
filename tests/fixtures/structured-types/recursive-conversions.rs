unsafe extern "C" {
    fn graph_fixture_reset(mode: u32);
    fn graph_fixture_calls() -> u32;
    fn graph_fixture_live() -> u32;
    fn graph_fixture_clears() -> u32;
    fn graph_fixture_scalars(input: *const ScalarsRaw, out: *mut ScalarsRaw) -> u32;
    fn graph_fixture_tree(input: *const TreeRaw, out: *mut TreeRaw) -> u32;
    fn graph_fixture_spine(input: *const SpineRaw, out: *mut SpineRaw) -> u32;
    fn graph_fixture_marker(input: *const MarkerRaw, out: *mut MarkerRaw) -> u32;
    fn graph_fixture_bad_tree(input: *const TreeRaw, out: *mut TreeRaw) -> u32;
    fn graph_fixture_envelope(input: *const EnvelopeRaw, out: *mut EnvelopeRaw) -> u32;
    fn graph_fixture_link(input: *const LinkRaw, out: *mut LinkRaw) -> u32;
    fn graph_fixture_result_link(input: *const ResultLinkRaw, out: *mut ResultLinkRaw) -> u32;
}

fn scalar_value() -> Scalars {
    let natural = (BigUint::from(1u8) << 1000usize) + 7u8;
    Scalars { unit: (), bool_: true, u8: u8::MAX, u16: u16::MAX,
        u32: u32::MAX, u64: u64::MAX, i8: i8::MIN, i16: i16::MIN,
        i32: i32::MIN, i64: i64::MIN, integer: -BigInt::from(natural.clone()), natural,
        f32: f32::INFINITY, f64: -0.0, text: "a\0🌿".into(), bytes: vec![0, 255, 128],
        char_: '🌿', word: u64::MAX, signed_word: i64::MIN }
}
fn tree_value() -> Tree {
    Tree::Branch { children: vec![Tree::Leaf { payload: scalar_value() },
        Tree::Branch { children: vec![Tree::Leaf { payload: scalar_value() }, Tree::Leaf { payload: scalar_value() }] }] }
}
fn envelope_value() -> Envelope {
    Envelope { tree: tree_value(), alternatives: vec![vec![tree_value()]], fallback: Some(tree_value()),
        outcome: Box::new(Ok((tree_value(), tree_value()))), marker: Some(Some(())) }
}
fn reset(mode: u32) { GRAPH_FAULT.with(|state| state.set((0, 0, false))); unsafe { graph_fixture_reset(mode) }; }
fn clean() {
    assert_eq!(GRAPH_LIVE.with(|live| live.get()), 0);
    assert_eq!(unsafe { graph_fixture_live() }, 0);
    assert_eq!(unsafe { graph_fixture_calls() }, unsafe { graph_fixture_clears() });
}

#[test]
fn independent_native_values_and_statuses() {
    reset(0);
    let expected = scalar_value();
    let value = unsafe { graph_call_scalars(graph_fixture_scalars, &expected) }.unwrap();
    assert_eq!(value, expected); assert_eq!(value.f64.to_bits(), (-0.0f64).to_bits());
    assert_eq!(value.natural.bits(), 1001); clean();
    for (status, expected_error) in [(1, GraphError::InvalidInput), (2, GraphError::Limit),
        (3, GraphError::Allocation), (4, GraphError::InvalidNative), (5, GraphError::Unavailable), (77, GraphError::InvalidNative)] {
        reset(100 + status);
        assert_eq!(unsafe { graph_call_scalars(graph_fixture_scalars, &expected) }, Err(expected_error));
        clean();
    }
}

#[test]
fn malformed_native_values_release_the_root() {
    for mode in 2..=9 {
        reset(mode);
        let expected = if mode == 9 { GraphError::Limit } else { GraphError::InvalidNative };
        assert_eq!(unsafe { graph_call_scalars(graph_fixture_scalars, &scalar_value()) }, Err(expected));
        clean();
    }
    reset(0);
    assert_eq!(unsafe { graph_call_tree(graph_fixture_bad_tree, &tree_value()) }, Err(GraphError::InvalidNative)); clean();
    for mode in [12, 13] {
        reset(mode);
        assert_eq!(unsafe { graph_call_envelope(graph_fixture_envelope, &envelope_value()) }, Err(GraphError::InvalidNative)); clean();
    }
}

#[test]
fn recursive_copies_are_owned_and_bounded() {
    reset(0);
    let source = tree_value();
    let copy = unsafe { graph_call_tree(graph_fixture_tree, &source) }.unwrap();
    assert_eq!(copy, source); clean();
    drop(source);
    assert_eq!(copy, tree_value());
    let mut spine = Spine::Leaf { value: 7 };
    for _ in 0..127 { spine = Spine::Next { value: Box::new(spine) }; }
    assert_eq!(unsafe { graph_call_spine(graph_fixture_spine, &spine) }.unwrap(), spine); clean();
    let too_deep = Spine::Next { value: Box::new(spine) };
    reset(0);
    assert_eq!(unsafe { graph_call_spine(graph_fixture_spine, &too_deep) }, Err(GraphError::Limit));
    assert_eq!(unsafe { graph_fixture_calls() }, 0);
    assert_eq!(GRAPH_FAULT.with(|state| state.get().1), 0); clean();
    for marker in [Marker::Empty, Marker::Unit { value: () }, Marker::Next { value: Box::new(Marker::Unit { value: () }) }] {
        reset(0);
        assert_eq!(unsafe { graph_call_marker(graph_fixture_marker, &marker) }.unwrap(), marker); clean();
    }
    for marker in [None, Some(None), Some(Some(()))] {
        let mut value = envelope_value(); value.marker = marker;
        reset(0);
        assert_eq!(unsafe { graph_call_envelope(graph_fixture_envelope, &value) }.unwrap(), value); clean();
        value.outcome = Box::new(Err("error\0🌿".into())); value.fallback = None;
        assert_eq!(unsafe { graph_call_envelope(graph_fixture_envelope, &value) }.unwrap(), value); clean();
    }
    reset(0);
    let link = Link { next: Some(Box::new(Link { next: None })) };
    assert_eq!(unsafe { graph_call_echo_link(graph_fixture_link, &link) }.unwrap(), link); clean();
    let link = ResultLink { next: Ok(Box::new(ResultLink { next: Err("end".into()) })) };
    assert_eq!(unsafe { graph_call_echo_result_link(graph_fixture_result_link, &link) }.unwrap(), link); clean();
}

#[test]
fn node_and_byte_budgets_cover_input_and_output() {
    unsafe extern "C" fn echo(input: *const UnitsRaw, out: *mut UnitsRaw) -> u32 { unsafe { *out = *input; } 0 }
    let values = vec![(); 131071];
    reset(0);
    assert_eq!(unsafe { graph_call_units(echo, &values[..]) }.unwrap().len(), values.len()); clean();
    assert_eq!(unsafe { graph_call_units(echo, &vec![(); 131072]) }, Err(GraphError::Limit)); clean();
    let mut value = scalar_value(); value.text = "x".repeat(16 * 1024 * 1024);
    reset(0);
    assert_eq!(unsafe { graph_call_scalars(graph_fixture_scalars, &value) }, Err(GraphError::Limit));
    assert_eq!(unsafe { graph_fixture_calls() }, 0); assert_eq!(GRAPH_FAULT.with(|state| state.get().1), 0); clean();
}

#[test]
fn all_inputs_validate_before_allocations_or_invocation() {
    unsafe extern "C" fn never_call(_a: *const TreeRaw, _b: *const TreeRaw, _out: *mut TreeRaw) -> u32 { std::process::abort(); }
    let first = tree_value();
    let mut second = Tree::Branch { children: vec![] };
    for _ in 0..130 { second = Tree::Branch { children: vec![second] }; }
    reset(0);
    assert_eq!(unsafe { graph_call_join_trees(never_call, &first, &second) }, Err(GraphError::Limit));
    assert_eq!(GRAPH_FAULT.with(|state| state.get().1), 0); clean();
}

#[test]
fn allocation_errors_and_panics_release_every_owner() {
    reset(0);
    let source = envelope_value();
    assert_eq!(unsafe { graph_call_envelope(graph_fixture_envelope, &source) }.unwrap(), source);
    let checkpoints = GRAPH_FAULT.with(|state| state.get().1);
    assert!(checkpoints > 30); clean();
    let hook = std::panic::take_hook(); std::panic::set_hook(Box::new(|_| {}));
    for target in 1..=checkpoints {
        reset(0); GRAPH_FAULT.with(|state| state.set((target, 0, false)));
        assert_eq!(unsafe { graph_call_envelope(graph_fixture_envelope, &source) }, Err(GraphError::Allocation));
        clean();
        reset(0); GRAPH_FAULT.with(|state| state.set((target, 0, true)));
        assert!(std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| unsafe { graph_call_envelope(graph_fixture_envelope, &source) })).is_err());
        clean();
    }
    std::panic::set_hook(hook);
    reset(0);
    assert_eq!(unsafe { graph_call_envelope(graph_fixture_envelope, &source) }.unwrap(), source); clean();
    println!("graph-failure-checkpoints:{}", checkpoints);
}

#[test]
fn guarded_calls_retire_unknown_status_and_check_readiness_before_publishing() {
    thread_local! { static STATE: std::cell::Cell<(bool, u32)> = const { std::cell::Cell::new((true, 0)) }; }
    unsafe extern "C" fn initialize() -> u32 { STATE.with(|s| if s.get().0 { 0 } else { 5 }) }
    unsafe extern "C" fn ready() -> i32 { STATE.with(|s| i32::from(s.get().0)) }
    unsafe extern "C" fn retire() { STATE.with(|s| s.set((false, s.get().1 + 1))); }
    unsafe extern "C" fn unavailable_after_init() -> u32 { 0 }
    let runtime = GraphLifecycle { initialize, ready, retire };
    for mode in [104, 177, 2] {
        STATE.with(|s| s.set((true, 0))); reset(mode);
        assert_eq!(unsafe { graph_call_scalars_guarded(Some(&runtime), graph_fixture_scalars, &scalar_value()) }, Err(GraphError::InvalidNative));
        assert_eq!(STATE.with(|s| s.get()), (false, 1)); clean();
        reset(0);
        assert_eq!(unsafe { graph_call_scalars_guarded(Some(&runtime), graph_fixture_scalars, &scalar_value()) }, Err(GraphError::Unavailable));
        assert_eq!(unsafe { graph_fixture_calls() }, 0); assert_eq!(GRAPH_FAULT.with(|s| s.get().1), 0); clean();
    }
    let unavailable = GraphLifecycle { initialize: unavailable_after_init, ready, retire };
    reset(0);
    assert_eq!(unsafe { graph_call_scalars_guarded(Some(&unavailable), graph_fixture_scalars, &scalar_value()) }, Err(GraphError::Unavailable));
    assert_eq!(unsafe { graph_fixture_calls() }, 0); clean();
    STATE.with(|s| s.set((true, 0)));
    for mode in [101, 102, 103, 105] {
        reset(mode);
        assert!(unsafe { graph_call_scalars_guarded(Some(&runtime), graph_fixture_scalars, &scalar_value()) }.is_err());
        assert_eq!(STATE.with(|s| s.get()), (true, 0)); clean();
    }
}
