// Independent prepared-package consumer. No bridge internals or raw ABI access.
use owned_values::*;
use std::cell::Cell;
use std::panic::{catch_unwind, AssertUnwindSafe};
thread_local! { static CHECKS: Cell<usize> = const { Cell::new(0) }; }
macro_rules! check { ($value:expr) => {{ CHECKS.with(|n| n.set(n.get() + 1)); assert!($value); }}; }
fn sample(first: &Ticket, second: &Ticket) -> Bundle {
    Bundle { primary: first.clone(), spare: Some(second.clone()), peers: vec![first.clone(), second.clone(), first.clone()],
        history: vec![second.clone(), first.clone()], payload: Payload { count: -(BigInt::from(1) << 1024usize) - 29, bytes: vec![0, 255, 3] } }
}
fn chain(ticket: &Ticket, depth: usize) -> Chain {
    let mut result = Chain::Stop;
    for _ in 0..depth { result = Chain::Link { ticket: ticket.clone(), next: Some(Box::new(result)) }; }
    result
}
fn values(first: &Ticket, second: &Ticket) {
    let input = sample(first, second);
    check!(bundle(first, &input.spare, &input.peers, &input.history, &input.payload).unwrap() == input);
    check!(primary(&input).unwrap() == *first); check!(payload(&input).unwrap() == input.payload);
    check!(retain_ticket(first).unwrap() == *first); check!(first.retain().unwrap() == *first);
    check!(echo_array(&input.peers).unwrap() == input.peers); check!(echo_array(&[]).unwrap().is_empty());
    check!(echo_list(&input.history).unwrap() == input.history); check!(echo_list(&[]).unwrap().is_empty());
    check!(echo_option(&None).unwrap().is_none()); check!(echo_option(&Some(first.clone())).unwrap() == Some(first.clone()));
    let ok = Ok(input.clone()); let error = Err(first.clone());
    check!(echo_result(&ok).unwrap() == ok); check!(echo_result(&error).unwrap() == error);
    let product = (first.clone(), (Some(second.clone()), input.payload.clone()));
    check!(echo_tuple(&product).unwrap() == product);
    let alias: BundleAlias = input.clone(); check!(echo_alias(&alias).unwrap() == alias); check!(echo_record(&input).unwrap() == input);
    for value in [Choice::Empty, Choice::One { ticket: first.clone() }, Choice::Pair { first: first.clone(), second: second.clone() },
        Choice::Many { tickets: vec![] }, Choice::Many { tickets: vec![first.clone(), second.clone()] }] { check!(echo_variant(&value).unwrap() == value); }
    let row: TicketRow = vec![None, Some(first.clone()), Some(second.clone())]; check!(echo_row(&row).unwrap() == row);
    let nested = vec![vec![], vec![None, Some(ok.clone()), Some(error.clone())]]; check!(echo_nested(&nested).unwrap() == nested);
    let tree = Tree::Branch { children: vec![Tree::Leaf { ticket: first.clone() }, Tree::Branch { children: vec![Tree::Leaf { ticket: second.clone() }] }] };
    check!(echo_recursive(&tree).unwrap() == tree);
    check!(echo_recursive(&Tree::Branch { children: vec![] }).unwrap() == Tree::Branch { children: vec![] });
    let mut mixed = Mixed { ticket: first.clone(), markers: vec![None, Some(None), Some(Some(false)), Some(Some(true))], unit: Some(()), result: ok,
        signed_: -(BigInt::from(1) << 2048usize) - 19, unsigned_: (BigUint::from(1u32) << 3072usize) + 27u32,
        scalar: '🌱', precise: -0.0, approximate: f32::INFINITY, bytes: vec![0, 255], words: vec![0, u64::MAX, 1u64 << 63], product,
        chain: chain(first, 24) };
    let copy = echo_mixed(&mixed).unwrap(); check!(copy == mixed);
    check!(copy.markers == vec![None, Some(None), Some(Some(false)), Some(Some(true))]); check!(copy.unit == Some(()));
    check!(copy.precise.is_sign_negative()); check!(copy.approximate == f32::INFINITY);
    mixed.unit = None; mixed.result = error; check!(echo_mixed(&mixed).unwrap() == mixed);
    mixed.precise = f64::NAN; mixed.approximate = f32::NEG_INFINITY;
    let copy = echo_mixed(&mixed).unwrap(); check!(copy.precise.is_nan()); check!(copy.approximate == f32::NEG_INFINITY);
    mixed.precise = 4.5; mixed.approximate = -0.0; check!(echo_mixed(&mixed).unwrap().approximate.is_sign_negative());
    check!(echo_chain(&Chain::Stop).unwrap() == Chain::Stop);
    let terminal = Chain::Link { ticket: first.clone(), next: None }; check!(echo_chain(&terminal).unwrap() == terminal);
    let mut independent = mixed.clone(); independent.chain = Chain::Stop; independent.bytes[0] = 8;
    independent.product.1.1.count += 1; check!(independent != mixed); check!(echo_mixed(&mixed).unwrap() == mixed);
    check!(echo_chain(&chain(first, 140)) == Err(Error::Limit));
    check!(echo_array(&vec![first.clone(); 262145]) == Err(Error::Limit));
    check!(new_ticket(&BigUint::from(1u32), &"x".repeat(16 * 1024 * 1024 + 1)) == Err(Error::Limit));
    let mut closed = input.clone(); closed.primary.close(); check!(echo_record(&closed) == Err(Error::Closed));
}
fn callbacks(first: &Ticket, second: &Ticket) {
    let input = sample(first, second); let mut escaped = Ticket::default(); let mut retained = Ticket::default();
    let result = callback_record(&input, |mut value: Bundle| {
        escaped = value.primary.clone(); retained = value.primary.retain()?;
        value.primary = new_ticket(&BigUint::from(91u32), "callback")?; value.payload.bytes = vec![9, 8]; Ok(value)
    }).unwrap();
    check!(escaped.is_closed()); check!(serial(&retained).unwrap() == BigUint::from(1u32));
    check!(serial(&result.primary).unwrap() == BigUint::from(91u32)); check!(result.payload.bytes == vec![9, 8]);
    check!(escaped.retain() == Err(Error::Closed));
    check!(callback_record(&input, |_: Bundle| Err(Error::Native(718))) == Err(Error::Native(718)));
    let original_hook = std::panic::take_hook(); std::panic::set_hook(Box::new(|info| { if !info.payload().is::<u32>() { eprintln!("{info}"); } }));
    let caught = catch_unwind(AssertUnwindSafe(|| callback_record(&input, |_: Bundle| std::panic::panic_any(917u32))));
    check!(*caught.unwrap_err().downcast::<u32>().unwrap() == 917);
    check!(callback_record(&input, |value: Bundle| {
        let caught = catch_unwind(AssertUnwindSafe(|| callback_record(&value, |_: Bundle| std::panic::panic_any(918u32))));
        check!(*caught.unwrap_err().downcast::<u32>().unwrap() == 918); echo_record(&value)
    }).unwrap() == input);
    let mut count = 0; let mut mutable = |mut value: Bundle| { count += 1; value.payload.count = BigInt::from(count); Ok(value) };
    check!(twice(&input, &mut mutable).unwrap().payload.count == BigInt::from(2));
    let dispatcher = dispatch(&input).unwrap(); check!(dispatcher.call(&mut mutable).unwrap().payload.count == BigInt::from(3));
    check!(dispatcher.call(|mut value: Bundle| { value.payload.count = BigInt::from(5); Ok(value) }).unwrap().payload.count == BigInt::from(5));
    let caught = catch_unwind(AssertUnwindSafe(|| dispatcher.call(|_: Bundle| std::panic::panic_any(919u32))));
    check!(*caught.unwrap_err().downcast::<u32>().unwrap() == 919);
    let identity = identity_closure(()).unwrap(); check!(dispatcher.call(&identity).unwrap() == input);
    check!(callback_record(&input, &identity).unwrap() == input);
    let mut chosen = make_record(&input).unwrap(); let alternate = sample(second, first);
    check!(chosen.call(true, &alternate).unwrap() == input); check!(chosen.call(false, &alternate).unwrap() == alternate);
    let independent = chosen.retain().unwrap(); chosen.close(); check!(independent.call(true, &alternate).unwrap() == input);
    check!(chosen.call(true, &alternate) == Err(Error::Closed)); check!(retain_callback(&identity).unwrap().call(&input).unwrap() == input);
    check!(retain_callback(|value: Bundle| Ok(value)).unwrap().call(&input) == Err(Error::CallbackFailed));
    let made = factory(with_recovery(|()| new_ticket(&BigUint::from(92u32), "factory"), first.clone())).unwrap();
    check!(serial(&made).unwrap() == BigUint::from(92u32));
    let caught = catch_unwind(AssertUnwindSafe(|| factory(with_recovery(|()| std::panic::panic_any(920u32), first.clone()))));
    check!(*caught.unwrap_err().downcast::<u32>().unwrap() == 920);
    check!(construct(first, |ticket: Ticket| Ok(sample(&ticket, second))).unwrap() == input);
    let mut calls = 0; check!(repeatedly(&input, |value: Bundle| { calls += 1; Ok(value) }, &BigUint::from(10000u32)) == Err(Error::Limit));
    check!(calls > 1 && calls < 10000);
    let tree = Tree::Leaf { ticket: first.clone() }; check!(callback_recursive(&tree, |value: Tree| Ok(value)).unwrap() == tree);
    let chooser = make_recursive(&tree).unwrap(); check!(chooser.call(true, &Tree::Branch { children: vec![] }).unwrap() == tree);
    check!(chooser.call(false, &Tree::Branch { children: vec![] }).unwrap() == Tree::Branch { children: vec![] });
    std::panic::set_hook(original_hook);
}
fn main() {
    if let Some(expected) = std::env::args().nth(1) {
        for _ in 0..2 {
            match new_ticket(&BigUint::from(1u32), "loader probe") {
                Err(Error::Load(message)) => assert!(message.contains(&expected), "{message}"),
                other => panic!("expected a checked loading failure: {other:?}"),
            }
        }
        println!("owned-loader-rejected");
        return;
    }
    let first = new_ticket(&BigUint::from(1u32), "a\0🌱").unwrap();
    let second_id = (BigUint::from(1u32) << 1024usize) + 3u32; let second = new_ticket(&second_id, "second").unwrap();
    check!(label(&first).unwrap() == "a\0🌱"); check!(serial(&second).unwrap() == second_id);
    for id in [BigUint::from(0u32), BigUint::from(u64::MAX), BigUint::from(1u32) << 64usize] {
        let ticket = new_ticket(&id, "").unwrap(); check!(serial(&ticket).unwrap() == id); check!(label(&ticket).unwrap().is_empty());
    }
    values(&first, &second); callbacks(&first, &second);
    for index in 0..256u32 {
        let local = new_ticket(&BigUint::from(index), "loop").unwrap(); let input = sample(&local, &first);
        let output = echo_record(&input).unwrap(); let retained = output.primary.clone(); drop(output); drop(input); drop(local);
        check!(serial(&retained).unwrap() == BigUint::from(index)); check!(echo_chain(&chain(&retained, 24)).unwrap() == chain(&retained, 24));
    }
    check!(std::thread::spawn(|| { let local = new_ticket(&BigUint::from(7u32), "thread").unwrap(); serial(&local).unwrap() == BigUint::from(7u32) }).join().unwrap());
    unsafe extern "C" { fn fork() -> i32; fn waitpid(pid: i32, status: *mut i32, options: i32) -> i32; fn _exit(status: i32) -> !; }
    let child = unsafe { fork() }; check!(child >= 0);
    if child == 0 { let ok = serial(&first) == Err(Error::WrongProcess); drop(first); unsafe { _exit(if ok { 0 } else { 1 }) }; }
    let mut status = 0; check!(unsafe { waitpid(child, &mut status, 0) } == child); check!(status == 0);
    check!(serial(&first).unwrap() == BigUint::from(1u32));
    println!("owned-installed-rust:{}", CHECKS.with(Cell::get));
}
