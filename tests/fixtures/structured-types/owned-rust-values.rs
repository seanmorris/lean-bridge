// Execute the generated Rust values and conversions, not a substitute codec.
use std::cell::Cell;
use std::panic::{catch_unwind, AssertUnwindSafe};
thread_local! { static CHECKS: Cell<usize> = const { Cell::new(0) }; }
macro_rules! check {
    ($value:expr) => {{ CHECKS.with(|count| count.set(count.get() + 1)); assert!($value); }};
}
unsafe extern "C" {
    fn owned_test_live() -> usize;
    fn owned_test_identities() -> usize;
    fn owned_test_attempts() -> usize;
    fn owned_test_fail_after(value: isize);
    fn owned_test_abi(index: usize) -> usize;
}
fn baseline() -> (usize, usize) { unsafe { (owned_test_live(), owned_test_identities()) } }
fn bundle_value(first: &Ticket, second: &Ticket) -> Bundle {
    Bundle { primary: first.clone(), spare: Some(second.clone()), peers: vec![first.clone(), second.clone(), first.clone()],
        history: vec![second.clone(), first.clone()], payload: Payload { count: -(BigInt::from(1) << 1024usize) - 29, bytes: vec![0, 255, 3] } }
}
fn chain_value(ticket: &Ticket, count: usize) -> Chain {
    let mut value = Chain::Stop;
    for _ in 0..count { value = Chain::Link { ticket: ticket.clone(), next: Some(Box::new(value)) }; }
    value
}
fn values(first: &Ticket, second: &Ticket) -> Mixed {
    let input = bundle_value(first, second);
    check!(call_bundle(first, &input.spare, &input.peers, &input.history, &input.payload).unwrap() == input);
    check!(call_primary(&input).unwrap() == *first);
    check!(call_payload(&input).unwrap() == input.payload);
    check!(call_retain_ticket(first).unwrap() == *first);
    check!(call_ticket_t_retain(first).unwrap() == *first);
    check!(call_echo_array(&input.peers).unwrap() == input.peers);
    check!(call_echo_array(&[]).unwrap().is_empty());
    check!(call_echo_list(&input.history).unwrap() == input.history);
    check!(call_echo_list(&[]).unwrap().is_empty());
    check!(call_echo_option(&None).unwrap().is_none());
    check!(call_echo_option(&Some(first.clone())).unwrap() == Some(first.clone()));
    let ok = Ok(input.clone()); let error = Err(first.clone());
    check!(call_echo_result(&ok).unwrap() == ok);
    check!(call_echo_result(&error).unwrap() == error);
    let product = (first.clone(), (Some(second.clone()), input.payload.clone()));
    check!(call_echo_tuple(&product).unwrap() == product);
    check!(call_echo_record(&input).unwrap() == input);
    let alias: BundleAlias = input.clone(); check!(call_echo_alias(&alias).unwrap() == alias);
    for value in [Choice::Empty, Choice::One { ticket: first.clone() }, Choice::Pair { first: first.clone(), second: second.clone() },
        Choice::Many { tickets: vec![] }, Choice::Many { tickets: vec![first.clone(), second.clone()] }] {
        check!(call_echo_variant(&value).unwrap() == value);
    }
    let row: TicketRow = vec![None, Some(first.clone()), Some(second.clone())];
    check!(call_echo_row(&row).unwrap() == row);
    let nested = vec![vec![], vec![None, Some(ok.clone()), Some(error.clone())]];
    check!(call_echo_nested(&nested).unwrap() == nested);
    let tree = Tree::Branch { children: vec![Tree::Leaf { ticket: first.clone() }, Tree::Branch { children: vec![Tree::Leaf { ticket: second.clone() }] }] };
    check!(call_echo_recursive(&tree).unwrap() == tree);
    check!(call_echo_recursive(&Tree::Branch { children: vec![] }).unwrap() == Tree::Branch { children: vec![] });
    let mut mixed = Mixed { ticket: first.clone(), markers: vec![None, Some(None), Some(Some(false)), Some(Some(true))], unit: Some(()), result: ok,
        signed_: -(BigInt::from(1) << 2048usize) - 19, unsigned_: (BigUint::from(1u32) << 3072usize) + 27u32,
        scalar: '🌱', precise: -0.0, approximate: f32::INFINITY, bytes: vec![0, 255], words: vec![0, u64::MAX, 1u64 << 63],
        product, chain: chain_value(first, 24) };
    let copy = call_echo_mixed(&mixed).unwrap();
    check!(copy == mixed); check!(copy.markers == vec![None, Some(None), Some(Some(false)), Some(Some(true))]);
    check!(copy.unit == Some(())); check!(copy.precise.is_sign_negative()); check!(copy.approximate == f32::INFINITY);
    mixed.unit = None; mixed.result = error; check!(call_echo_mixed(&mixed).unwrap() == mixed);
    mixed.precise = f64::NAN; mixed.approximate = f32::NEG_INFINITY;
    let copy = call_echo_mixed(&mixed).unwrap(); check!(copy.precise.is_nan()); check!(copy.approximate == f32::NEG_INFINITY);
    mixed.precise = 4.5; mixed.approximate = -0.0;
    check!(call_echo_mixed(&mixed).unwrap().approximate.is_sign_negative());
    check!(call_echo_chain(&Chain::Stop).unwrap() == Chain::Stop);
    let terminal = Chain::Link { ticket: first.clone(), next: None };
    check!(call_echo_chain(&terminal).unwrap() == terminal);
    let mut independent = mixed.clone(); independent.chain = Chain::Stop; independent.markers[0] = Some(Some(true));
    independent.bytes[0] = 8; independent.product.1.1.count += 1;
    check!(independent != mixed); check!(call_echo_mixed(&mixed).unwrap() == mixed);
    let before = baseline();
    unsafe { owned_test_fail_after(-1) };
    check!(call_echo_chain(&chain_value(first, 140)) == Err(Error::Limit));
    check!(unsafe { owned_test_attempts() } == 0); check!(baseline() == before);
    let excessive = vec![first.clone(); 262145];
    check!(call_echo_array(&excessive) == Err(Error::Limit));
    check!(unsafe { owned_test_attempts() } == 0); check!(baseline() == before);
    let excessive_text = "x".repeat(16 * 1024 * 1024 + 1);
    check!(call_new_ticket(&BigUint::from(1u32), &excessive_text) == Err(Error::Limit));
    check!(unsafe { owned_test_attempts() } == 0); check!(baseline() == before);
    let mut closed = input.clone(); closed.primary.close();
    check!(call_echo_record(&closed) == Err(Error::Closed));
    check!(unsafe { owned_test_attempts() } == 0); check!(baseline() == before);
    mixed
}
fn allocation_faults(mixed: &Mixed) -> (usize, usize) {
    let original_hook = std::panic::take_hook(); std::panic::set_hook(Box::new(|info| {
        if info.payload().downcast_ref::<&str>() != Some(&"injected owned conversion panic") { eprintln!("{info}"); }
    }));
    let expected = baseline(); let mut rust_failures = 0;
    for panic in [false, true] {
        let mut completed = false;
        for position in 1..8192 {
            OWNED_FAULT.with(|state| state.set((position, 0, panic)));
            let result = catch_unwind(AssertUnwindSafe(|| call_echo_mixed(mixed)));
            OWNED_FAULT.with(|state| state.set((0, 0, false)));
            match result {
                Ok(Ok(value)) => { check!(value == *mixed); completed = true; }
                Ok(Err(error)) => { check!(!panic && error == Error::Allocation); rust_failures += 1; }
                Err(error) => { check!(panic); check!(error.downcast_ref::<&str>() == Some(&"injected owned conversion panic")); rust_failures += 1; }
            }
            check!(OWNED_LIVE.with(Cell::get) == 0);
            check!(baseline() == expected);
            if completed { break; }
        }
        check!(completed);
    }
    std::panic::set_hook(original_hook);
    let mut native_failures = 0; let mut completed = false;
    for position in 0..8192 {
        unsafe { owned_test_fail_after(position) };
        let result = call_echo_mixed(mixed);
        unsafe { owned_test_fail_after(-1) };
        match result {
            Ok(value) => { check!(value == *mixed); completed = true; }
            Err(error) => { check!(error == Error::Allocation); native_failures += 1; }
        }
        check!(OWNED_LIVE.with(Cell::get) == 0); check!(baseline() == expected);
        if completed { break; }
    }
    check!(completed); check!(rust_failures > 50); check!(native_failures > 20);
    (rust_failures, native_failures)
}
#[test]
fn compiled_owned_values() {
    check!(baseline() == (0, 0));
    test_abi();
    let (rust_failures, native_failures);
    {
        let first = call_new_ticket(&BigUint::from(1u32), "a\0🌱").unwrap();
        let second_id = (BigUint::from(1u32) << 1024usize) + 3u32;
        let second = call_new_ticket(&second_id, "second").unwrap();
        check!(call_label(&first).unwrap() == "a\0🌱"); check!(call_serial(&second).unwrap() == second_id);
        for id in [BigUint::from(0u32), BigUint::from(u64::MAX), BigUint::from(1u32) << 64usize] {
            let ticket = call_new_ticket(&id, "").unwrap(); check!(call_serial(&ticket).unwrap() == id); check!(call_label(&ticket).unwrap().is_empty());
        }
        let mixed = values(&first, &second);
        callbacks(&first, &second);
        (rust_failures, native_failures) = allocation_faults(&mixed);
        test_malformed(&first, &mixed);
        for index in 0..128u32 {
            let local = call_new_ticket(&BigUint::from(index), "loop").unwrap();
            let input = bundle_value(&local, &first);
            let output = call_echo_record(&input).unwrap(); let retained = output.primary.clone();
            drop(output); drop(input); drop(local);
            check!(call_serial(&retained).unwrap() == BigUint::from(index));
            check!(call_echo_chain(&chain_value(&retained, 24)).unwrap() == chain_value(&retained, 24));
        }
        let state = current_state().unwrap(); let borrowed = owned_runtime::BorrowFrame::new(&state).unwrap();
        let copy = call_echo_record(&bundle_value(&first, &second)).unwrap();
        state.close().unwrap();
        check!(copy.primary.is_closed() && first.is_closed() && second.is_closed());
        check!(call_serial(&copy.primary) == Err(Error::Closed));
        drop(borrowed);
    }
    check!(baseline() == (0, 0)); check!(OWNED_LIVE.with(Cell::get) == 0);
    println!("owned-rust-values:{}:{}:{}:0:0", CHECKS.with(Cell::get), rust_failures, native_failures);
}
