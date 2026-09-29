// Shared by the instrumented real-Lean probe and the source-free Cargo consumer.
use std::cell::Cell;
std::thread_local! { static CHECKS: Cell<usize> = const { Cell::new(0) }; }
macro_rules! check { ($value:expr) => {{ CHECKS.with(|count| count.set(count.get() + 1)); assert!($value); }}; }
fn ticket(serial: u32) -> Ticket { new_ticket(&BigUint::from(serial), "input\0λ").unwrap() }
fn data() -> Payload { Payload { count: -(BigInt::from(1u32) << 1024usize) - 37, bytes: vec![0, 255, 19] } }
fn sample() -> Bundle {
    let first = ticket(7); let second = ticket(9);
    Bundle { primary: first.clone(), spare: Some(second.clone()),
        peers: vec![first.clone(), second.clone(), first.clone()], history: vec![second, first], payload: data() }
}
fn number(value: &Ticket, expected: u32) { check!(serial(value).unwrap() == BigUint::from(expected)); }

fn owners() {
    #[cfg(test)] {
        let before = unsafe { owned_test_identities() };
        let mut source = ticket(16); let mut output = retain_ticket(&mut source).unwrap(); output.close();
        check!(source.is_closed() && unsafe { owned_test_identities() } == before);
    }
    let mut first = ticket(17); let alias = first.clone(); let kept = first.retain().unwrap();
    let moved = retain_ticket(&mut first).unwrap();
    check!(first.is_closed() && alias.is_closed()); number(&moved, 17); number(&kept, 17);
    check!(serial(&alias) == Err(Error::Closed));
    check!(label(&moved).unwrap() == "input\0λ");
    let mut input = sample(); let old = input.clone(); let independent = input.primary.retain().unwrap();
    let result = echo_record(&mut input).unwrap();
    check!(input.primary.is_closed() && input.spare.as_ref().unwrap().is_closed() && old.peers[2].is_closed());
    number(&result.primary, 7); number(result.spare.as_ref().unwrap(), 9); number(&independent, 7);
    check!(result.payload == data() && input.payload == data());
    let mut one = result.primary.clone(); let sibling = result.spare.as_ref().unwrap().clone();
    let sibling_kept = sibling.retain().unwrap(); let detached = retain_ticket(&mut one).unwrap();
    check!(one.is_closed() && sibling.is_closed() && result.primary.is_closed());
    number(&detached, 7); number(&sibling_kept, 9);
    let mut invalid = sample(); invalid.spare = Some(Ticket::default());
    check!(echo_record(&mut invalid) == Err(Error::Closed)); number(&invalid.primary, 7);
    let mut duplicate = ticket(23); let mut repeated = vec![duplicate.clone()];
    check!(bundle(&mut duplicate, &None, &mut repeated, &[], &data()) == Err(Error::InvalidArgument));
    number(&duplicate, 23); number(&repeated[0], 23);
    let mut primary = ticket(31); let peer = ticket(32);
    let borrowed = Some(primary.clone()); let mut peers = vec![peer.clone()]; let history = vec![peer.clone()];
    let bundled = bundle(&mut primary, &borrowed, &mut peers, &history, &data()).unwrap();
    check!(primary.is_closed() && peer.is_closed() && borrowed.as_ref().unwrap().is_closed() && history[0].is_closed());
    number(&bundled.primary, 31); number(&bundled.peers[0], 32);
}

fn shapes() {
    let item = ticket(41); let mut array = vec![item.clone(), item.clone()];
    let output = echo_array(&mut array).unwrap(); check!(output.len() == 2 && item.is_closed()); number(&output[1], 41);
    number(&output[0], 41); check!(output[0] == output[1]);
    check!(echo_array(&mut []).unwrap().is_empty());
    let item = ticket(42); let mut list = vec![item.clone()];
    number(&echo_list(&mut list).unwrap()[0], 42); check!(item.is_closed());
    check!(echo_list(&mut []).unwrap().is_empty()); check!(echo_option(&mut None).unwrap().is_none());
    let item = ticket(43); let mut optional = Some(item.clone());
    number(&echo_option(&mut optional).unwrap().unwrap(), 43); check!(item.is_closed());
    let mut good = Ok(sample()); let output = echo_result(&mut good).unwrap().unwrap();
    number(&output.primary, 7); check!(good.as_ref().unwrap().primary.is_closed());
    let item = ticket(44); let mut bad = Err(item.clone());
    number(&echo_result(&mut bad).unwrap().unwrap_err(), 44); check!(item.is_closed());
    let item = ticket(45); let mut tuple = (item.clone(), (Some(item.clone()), data()));
    let output = echo_tuple(&mut tuple).unwrap(); number(&output.0, 45);
    check!(item.is_closed() && output.1.1 == data());
    for branch in 0..5 {
        let item = ticket(46 + branch);
        let mut value = match branch {
            0 => Choice::Empty, 1 => Choice::One { ticket: item.clone() },
            2 => Choice::Pair { first: item.clone(), second: item.clone() },
            3 => Choice::Many { tickets: vec![item.clone(), item.clone()] },
            _ => Choice::Many { tickets: vec![] },
        };
        let result = echo_variant(&mut value).unwrap();
        match result {
            Choice::Empty => check!(branch == 0),
            Choice::One { ticket } => { check!(branch == 1); number(&ticket, 47); },
            Choice::Pair { first, second } => { check!(branch == 2); number(&first, 48); number(&second, 48); },
            Choice::Many { tickets } => { check!(branch == 3 || branch == 4); check!(tickets.len() == if branch == 3 { 2 } else { 0 }); },
        }
        check!(item.is_closed() == (branch > 0 && branch < 4));
    }
    let mut alias: BundleAlias = sample(); number(&echo_alias(&mut alias).unwrap().primary, 7); check!(alias.primary.is_closed());
    let item = ticket(51); let mut row: TicketRow = vec![None, Some(item.clone())];
    let output = echo_row(&mut row).unwrap(); check!(output[0].is_none() && item.is_closed()); number(output[1].as_ref().unwrap(), 51);
    let item = ticket(52); let value = sample();
    let mut nested = vec![vec![], vec![None, Some(Ok(value.clone())), Some(Err(item.clone()))]];
    let output = echo_nested(&mut nested).unwrap();
    check!(output.len() == 2 && output[1].len() == 3);
    check!(output[0].is_empty() && output[1][0].is_none() && value.primary.is_closed() && item.is_closed());
    number(&output[1][1].as_ref().unwrap().as_ref().unwrap().primary, 7);
    check!(output[1][1].as_ref().unwrap().as_ref().unwrap().payload == data());
    number(output[1][2].as_ref().unwrap().as_ref().unwrap_err(), 52);
    let item = ticket(53); let mut tree = Tree::Leaf { ticket: item.clone() };
    for _ in 0..40 { tree = Tree::Branch { children: vec![tree] }; }
    let mut deep = echo_recursive(&mut tree).unwrap(); check!(item.is_closed());
    let output = callback_recursive(&mut deep, |value: Tree| Ok(value)).unwrap();
    let mut cursor = &output;
    for _ in 0..40 {
        match cursor {
            Tree::Branch { children } => { check!(children.len() == 1); cursor = &children[0]; },
            _ => panic!("lost recursive branch"),
        }
    }
    match cursor { Tree::Leaf { ticket } => number(ticket, 53), _ => panic!("lost recursive leaf") }
    check!(echo_recursive(&mut Tree::Branch { children: vec![] }).unwrap() == Tree::Branch { children: vec![] });
    let item = ticket(54); let mut deep = Tree::Leaf { ticket: item.clone() };
    for _ in 0..130 { deep = Tree::Branch { children: vec![deep] }; }
    check!(echo_recursive(&mut deep) == Err(Error::Limit)); number(&item, 54);
}

fn boxed_values() {
    let item = ticket(62);
    let mut chain = Chain::Stop;
    for _ in 0..30 { chain = Chain::Link { ticket: item.clone(), next: Some(Box::new(chain)) }; }
    let output = echo_chain(&mut chain).unwrap(); check!(item.is_closed());
    let mut cursor = &output;
    for _ in 0..30 {
        match cursor {
            Chain::Link { ticket, next } => { number(ticket, 62); check!(next.is_some()); cursor = next.as_deref().unwrap(); },
            _ => panic!("lost boxed link"),
        }
    }
    check!(*cursor == Chain::Stop);
    let item = ticket(63);
    let mut end = Chain::Link { ticket: item.clone(), next: None };
    match echo_chain(&mut end).unwrap() { Chain::Link { ticket, next } => { number(&ticket, 63); check!(next.is_none()); }, _ => panic!("lost tail") }
    check!(item.is_closed());
    for error in [false, true] {
        let item = ticket(64); let value = sample();
        let mut mixed = Mixed { ticket: item.clone(), markers: vec![None, Some(None), Some(Some(false)), Some(Some(true))],
            unit: Some(()), result: if error { Err(item.clone()) } else { Ok(value.clone()) },
            signed_: data().count, unsigned_: (BigUint::from(1u8) << 1024usize) + 9u8,
            scalar: '🦀', precise: -0.0, approximate: f32::INFINITY, bytes: vec![0, 128, 255],
            words: vec![0, u64::MAX, 1], product: (item.clone(), (Some(item.clone()), data())),
            chain: Chain::Link { ticket: item.clone(), next: Some(Box::new(Chain::Stop)) } };
        let output = echo_mixed(&mut mixed).unwrap();
        check!(item.is_closed()); check!(value.primary.is_closed() != error);
        number(&output.ticket, 64); check!(output.markers == mixed.markers && output.unit == Some(()));
        check!(output.signed_ == mixed.signed_ && output.unsigned_ == mixed.unsigned_);
        check!(output.scalar == '🦀' && output.precise.to_bits() == (-0.0f64).to_bits());
        check!(output.approximate == f32::INFINITY && output.bytes == mixed.bytes && output.words == mixed.words);
        check!(output.product.1.1 == data()); number(&output.product.0, 64);
        if error { number(output.result.as_ref().unwrap_err(), 64); }
        else { number(&output.result.as_ref().unwrap().primary, 7); }
        match &output.chain { Chain::Link { ticket, next } => { number(ticket, 64); check!(next.as_deref() == Some(&Chain::Stop)); }, _ => panic!("lost mixed chain") }
    }
}

fn callbacks() {
    let mut input = sample(); let observed = input.clone(); let mut escaped = Ticket::default();
    let mut retained = Ticket::default(); let mut invoked = false;
    let result = callback_record(&mut input, |mut borrowed: Bundle| {
        invoked = true; check!(observed.primary.is_closed() && observed.spare.as_ref().unwrap().is_closed());
        check!(serial(&observed.primary) == Err(Error::Closed)); number(&borrowed.primary, 7);
        escaped = borrowed.primary.clone(); retained = borrowed.primary.retain()?;
        check!(echo_record(&mut borrowed) == Err(Error::InvalidArgument)); number(&borrowed.primary, 7);
        let mut independent = retained.retain()?; let owned = retain_ticket(&mut independent)?;
        check!(independent.is_closed()); number(&owned, 7);
        let mut local = sample(); let nested = callback_record(&mut local, |value: Bundle| Ok(value))?;
        check!(local.primary.is_closed()); number(&nested.primary, 7); Ok(borrowed)
    }).unwrap();
    check!(invoked && escaped.is_closed()); number(&retained, 7); number(&result.primary, 7);
    let mut failed = sample(); let observed = failed.primary.clone();
    let mut payload = Some(Box::new(87u32)); let address = &**payload.as_ref().unwrap() as *const u32 as usize;
    let error = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        callback_record(&mut failed, |_: Bundle| -> Result<Bundle, Error> {
            check!(observed.is_closed()); std::panic::panic_any(payload.take().unwrap());
        })
    })).unwrap_err();
    let caught = error.downcast::<Box<u32>>().unwrap();
    check!(**caught == 87 && &**caught as *const u32 as usize == address && failed.primary.is_closed());
    let mut failed = sample(); check!(callback_record(&mut failed, |_: Bundle| Err(Error::CallOrder)) == Err(Error::CallOrder));
    check!(failed.primary.is_closed());
    let mut captured = sample(); let supplied = sample(); let factory = make_record(&mut captured).unwrap();
    check!(captured.primary.is_closed()); number(&factory.call(true, &supplied).unwrap().primary, 7);
    let mut callback = new_record_callback().unwrap(); let independent = callback.retain().unwrap();
    let moved = transfer_callback(&mut callback).unwrap(); check!(callback.is_closed());
    number(&moved.call(&supplied).unwrap().primary, 7); number(&independent.call(&supplied).unwrap().primary, 7);
    let item = ticket(61); let mut tree = Tree::Leaf { ticket: item.clone() };
    let factory = make_recursive(&mut tree).unwrap(); check!(item.is_closed());
    match factory.call(true, &Tree::Branch { children: vec![] }).unwrap() {
        Tree::Leaf { ticket } => number(&ticket, 61), _ => panic!("lost captured tree"),
    }
}

fn fork_guard() {
    unsafe extern "C" { fn fork() -> i32; fn waitpid(pid: i32, status: *mut i32, options: i32) -> i32; fn _exit(code: i32) -> !; }
    let mut value = ticket(71); let child = unsafe { fork() }; check!(child >= 0);
    if child == 0 {
        let result = retain_ticket(&mut value);
        unsafe { _exit(if result == Err(Error::WrongProcess) { 0 } else { 2 }) }
    }
    let mut status = -1; check!(unsafe { waitpid(child, &mut status, 0) } == child && status == 0); number(&value, 71);
}

#[cfg(test)]
unsafe extern "C" {
    fn owned_test_live() -> usize;
    fn owned_test_identities() -> usize;
    fn owned_test_handoffs() -> usize;
    fn owned_test_fail_after(value: isize);
}
#[cfg(test)]
fn baseline() -> (usize, usize, usize) {
    (unsafe { owned_test_live() }, unsafe { owned_test_identities() }, OWNED_LIVE.with(Cell::get))
}
#[cfg(test)]
fn faults(native: bool, panic: bool, multiple: bool) -> (usize, usize) {
    let mut before = 0; let mut after = 0; let base = baseline(); let mut complete = false;
    for at in 1..2048 {
        {
            let mut value = sample(); let independent = value.primary.retain().unwrap();
            let second = value.spare.as_ref().unwrap().retain().unwrap();
            let observed = value.primary.clone(); let mut primary = value.primary.clone();
            let mut peers = vec![value.spare.as_ref().unwrap().clone()];
            let handoffs = unsafe { owned_test_handoffs() };
            if native { unsafe { owned_test_fail_after(at as isize - 1) }; }
            else { OWNED_FAULT.with(|state| state.set((at, 0, panic))); }
            let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                if multiple { bundle(&mut primary, &Some(value.primary.clone()), &mut peers, &value.history, &value.payload) }
                else { callback_record(&mut value, |input: Bundle| { check!(observed.is_closed()); Ok(input) }) }
            }));
            unsafe { owned_test_fail_after(-1) }; OWNED_FAULT.with(|state| state.set((0, 0, false)));
            match result {
                Ok(Ok(result)) => { number(&result.primary, 7); complete = true; },
                Ok(Err(error)) => check!(error == Error::Allocation),
                Err(_) => check!(!native && panic),
            }
            let consumed = unsafe { owned_test_handoffs() } - handoffs;
            check!(consumed <= 1); check!(value.primary.is_closed() == (consumed != 0));
            check!(value.spare.as_ref().unwrap().is_closed() == value.primary.is_closed());
            if !complete {
                if consumed != 0 { after += 1; } else { before += 1; number(&value.primary, 7); }
            }
            number(&independent, 7); number(&second, 9);
        }
        check!(baseline() == base);
        if complete { break; }
    }
    check!(complete && before > 0 && after > 0); (before, after)
}

fn main() {
    let hook = std::panic::take_hook(); std::panic::set_hook(Box::new(|_| {}));
    #[cfg(test)] let state = current_state().unwrap();
    #[cfg(test)] let initial = baseline();
    owners(); shapes(); boxed_values(); callbacks(); fork_guard();
    #[cfg(test)] {
        check!(baseline() == initial);
        let rust = faults(false, false, false); let native = faults(true, false, false);
        let multi_rust = faults(false, false, true); let multi_native = faults(true, false, true);
        let panic = faults(false, true, false); let multi_panic = faults(false, true, true);
        let mut value = sample();
        check!(callback_record(&mut value, |input: Bundle| { state.close()?; Ok(input) }) == Err(Error::Closed));
        check!(value.primary.is_closed()); drop(value); state.close().unwrap();
        check!(baseline() == (0, 0, 0));
        println!("owned-rust-transfers:{{\"checks\":{},\"rustBefore\":{},\"rustAfter\":{},\"nativeBefore\":{},\"nativeAfter\":{},\"multiRustBefore\":{},\"multiRustAfter\":{},\"multiNativeBefore\":{},\"multiNativeAfter\":{},\"panicBefore\":{},\"panicAfter\":{},\"multiPanicBefore\":{},\"multiPanicAfter\":{},\"live\":0,\"identities\":0}}",
            CHECKS.with(Cell::get), rust.0, rust.1, native.0, native.1, multi_rust.0, multi_rust.1,
            multi_native.0, multi_native.1, panic.0, panic.1, multi_panic.0, multi_panic.1);
    }
    #[cfg(not(test))] println!("owned-rust-transfers-installed:{}", CHECKS.with(Cell::get));
    std::panic::set_hook(hook);
}
