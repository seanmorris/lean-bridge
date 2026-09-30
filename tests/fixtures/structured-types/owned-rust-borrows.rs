// One oracle for the instrumented compiled Lean probe and installed Cargo users.
use std::cell::Cell;
std::thread_local! { static CHECKS: Cell<usize> = const { Cell::new(0) }; }
macro_rules! check { ($value:expr) => {{ CHECKS.with(|count| count.set(count.get() + 1)); let passed = $value;
    if !passed { eprintln!("owned Rust borrow check failed at {}:{}: {}", file!(), line!(), stringify!($value)); } assert!(passed); }}; }
fn ticket(serial: u32) -> Value<Ticket> { new_ticket(&BigUint::from(serial), "owner\0λ").unwrap() }
fn data() -> Payload { Payload { count: -(BigInt::from(1u32) << 1024usize) - 37, bytes: vec![0, 255, 19] } }
fn sample() -> Bundle {
    let first = ticket(7).get().unwrap().clone(); let second = ticket(9).get().unwrap().clone();
    Bundle { primary: first.clone(), spare: Some(second.clone()), peers: vec![first.clone(), second.clone(), first.clone()],
        history: vec![second, first], payload: data() }
}
fn number(value: &Ticket, expected: u32) { check!(serial(value).unwrap() == BigUint::from(expected)); }

fn owners() {
    let mut root = ticket(17); let mut alias = root.clone(); let kept = root.retain().unwrap();
    let view = retain_ticket(&root).unwrap(); let child = retain_ticket(&view).unwrap();
    check!(view == root && child == kept);
    let independent = child.retain().unwrap(); let leaf = child.get().unwrap().clone();
    root.close(); check!(!view.is_closed()); number(alias.get().unwrap(), 17);
    alias.close(); check!(view.is_closed() && child.is_closed() && leaf.is_closed());
    check!(serial(&leaf) == Err(Error::Closed)); check!(view.retain() == Err(Error::Closed));
    check!(view.try_equal(&kept) == Err(Error::Closed)); check!(view != kept);
    number(kept.get().unwrap(), 17); number(independent.get().unwrap(), 17);
    let mut input = copy_value(&sample()).unwrap(); let view = echo_record(&input).unwrap();
    let copy = view.retain().unwrap(); check!(view == input);
    check!(primary(&view).unwrap().get().unwrap() == &input.get().unwrap().primary);
    check!(payload(view.get().unwrap()).unwrap() == data());
    input.close(); check!(view.is_closed()); number(&copy.get().unwrap().primary, 7);
    for serial in 0..64 { let fresh = ticket(serial); number(fresh.get().unwrap(), serial); check!(view.is_closed()); }
}

fn shape<T: ValueType + PartialEq>(raw: &T, echo: fn(&Value<T>) -> Result<Value<T>, Error>) {
    let mut owner = copy_value(raw).unwrap(); check!(!owner.is_closed());
    let view = echo(&owner).unwrap(); check!(!view.is_closed());
    let independent = view.retain().unwrap(); check!(view.get().unwrap() == raw && independent == owner);
    let child = echo(&view).unwrap(); owner.close(); check!(view.is_closed() && child.is_closed());
    check!(view.get().is_err()); check!(independent.get().unwrap() == raw);
}
fn shapes() {
    let value = sample(); let item = value.primary.clone();
    shape(&Vec::<Ticket>::new(), echo_array); shape(&vec![item.clone(), item.clone()], echo_array);
    shape(&Vec::<Ticket>::new(), echo_list); shape(&vec![item.clone()], echo_list);
    shape(&None::<Ticket>, echo_option); shape(&Some(item.clone()), echo_option);
    shape(&Ok(value.clone()), echo_result); shape(&Err(item.clone()), echo_result);
    shape(&(item.clone(), (Some(item.clone()), data())), echo_tuple);
    shape(&value, echo_record); shape(&value, echo_alias);
    for branch in [Choice::Empty, Choice::One { ticket: item.clone() }, Choice::Pair { first: item.clone(), second: item.clone() },
        Choice::Many { tickets: vec![item.clone(), item.clone()] }, Choice::Many { tickets: vec![] }] { shape(&branch, echo_variant); }
    shape(&TicketRow::new(), echo_row); shape(&vec![None, Some(item.clone())], echo_row);
    shape(&vec![vec![], vec![None, Some(Ok(value.clone())), Some(Err(item.clone()))]], echo_nested);
    shape(&vec![], echo_nested); shape(&Tree::Branch { children: vec![] }, echo_recursive);
    let mut tree = Tree::Leaf { ticket: item.clone() };
    for _ in 0..35 { tree = Tree::Branch { children: vec![tree] }; }
    shape(&tree, echo_recursive);
    let mut peers = copy_value(&vec![item.clone()]).unwrap();
    let value = bundle(&item, &None, &peers, &[], &data()).unwrap();
    check!(value.get().unwrap().primary == item); peers.close(); check!(value.is_closed());
}

fn transfers() {
    let mut root = ticket(23); let alias = root.clone(); let kept = root.retain().unwrap();
    let mut view = retain_ticket(&root).unwrap(); let child = retain_ticket(&view).unwrap();
    check!(transfer_ticket(&mut view) == Err(Error::InvalidArgument)); number(view.get().unwrap(), 23);
    let mut moved = transfer_ticket(&mut root).unwrap();
    check!(root.is_closed() && alias.is_closed() && view.is_closed() && child.is_closed());
    number(moved.get().unwrap(), 23); number(kept.get().unwrap(), 23);
    let mut other = ticket(0); let other_alias = other.clone();
    let mixed = mixed_ticket(&moved, &mut other).unwrap(); check!(other.is_closed() && other_alias.is_closed() && mixed == moved);
    let anchor_alias = moved.clone();
    check!(mixed_ticket(&anchor_alias, &mut moved) == Err(Error::InvalidArgument));
    check!(mixed_ticket(&mixed, &mut moved) == Err(Error::InvalidArgument));
    check!(!moved.is_closed() && !mixed.is_closed()); drop(anchor_alias); moved.close(); check!(mixed.is_closed());
    let mut empty = copy_value(&Vec::<Ticket>::new()).unwrap(); let alias = empty.clone();
    let view = echo_array(&empty).unwrap(); let child = echo_array(&view).unwrap();
    check!(move_array(&mut empty).unwrap().get().unwrap().is_empty());
    check!(empty.is_closed() && alias.is_closed() && view.is_closed() && child.is_closed());
}

fn depth() {
    let mut root = ticket(33); let kept = root.retain().unwrap(); let mut chain = vec![root.clone()];
    let mut limited = false;
    for _ in 0..140 {
        match retain_ticket(chain.last().unwrap()) { Ok(view) => chain.push(view), Err(error) => { check!(error == Error::Limit); limited = true; break; } }
    }
    check!(limited && chain.len() >= 100); number(chain.last().unwrap().get().unwrap(), 33);
    chain[48].close(); check!(!chain[47].is_closed() && chain[49].is_closed() && chain.last().unwrap().is_closed());
    number(kept.get().unwrap(), 33); root.close(); chain[0].close();
    for view in &chain[1..] { check!(view.is_closed()); }
}

fn callbacks() {
    let mut root = copy_value(&sample()).unwrap(); let mut escaped = Ticket::default(); let mut retained = Ticket::default();
    let view = callback_record(&root, |input: Bundle| {
        escaped = input.primary.clone(); retained = input.primary.retain()?;
        let own = copy_value(&input)?; let nested = echo_record(&own)?; check!(nested.get()? == &input); Ok(input)
    }).unwrap();
    check!(escaped.is_closed() && !retained.is_closed() && view == root);
    let closure = make_record(&root).unwrap(); let kept = closure.retain().unwrap();
    check!(closure.call(true, &sample()).unwrap().get().unwrap() == root.get().unwrap());
    let mut original = Some(Box::new(87u32)); let address = &**original.as_ref().unwrap() as *const u32;
    let panic = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        callback_record(&root, |_: Bundle| -> Result<Bundle, Error> { std::panic::panic_any(original.take().unwrap()); })
    })).unwrap_err();
    let caught = panic.downcast::<Box<u32>>().unwrap(); check!(**caught == 87 && &**caught as *const u32 == address);
    check!(!root.is_closed()); root.close(); check!(view.is_closed() && closure.is_closed());
    number(&kept.call(true, &sample()).unwrap().get().unwrap().primary, 7);
    let mut consuming = copy_value(&sample()).unwrap(); let alias = consuming.clone(); let dependent = echo_record(&consuming).unwrap();
    let child = echo_record(&dependent).unwrap(); let independent = dependent.retain().unwrap();
    let moved = move_record(&mut consuming, |input: Bundle| {
        check!(alias.is_closed() && dependent.is_closed() && child.is_closed());
        check!(dependent.get().is_err()); number(&independent.get()?.primary, 7); number(&input.primary, 7); Ok(input)
    }).unwrap();
    check!(consuming.is_closed()); number(&moved.get().unwrap().primary, 7);
    let tree = copy_value(&Tree::Leaf { ticket: sample().primary }).unwrap();
    let callback = make_recursive(&tree).unwrap();
    check!(callback.call(true, &Tree::Branch { children: vec![] }).unwrap().get().unwrap() == tree.get().unwrap());
    let echoed = callback_recursive(&tree, |value: Tree| Ok(value)).unwrap(); check!(echoed == tree);
}

fn fork_guard() {
    unsafe extern "C" { fn fork() -> i32; fn waitpid(pid: i32, status: *mut i32, options: i32) -> i32; fn _exit(code: i32) -> !; }
    let root = ticket(41); let view = retain_ticket(&root).unwrap(); let child = unsafe { fork() }; check!(child >= 0);
    if child == 0 { unsafe { _exit(if view.get() == Err(Error::WrongProcess) { 0 } else { 2 }) } }
    let mut status = -1; check!(unsafe { waitpid(child, &mut status, 0) } == child && status == 0); number(view.get().unwrap(), 41);
}

#[cfg(test)] unsafe extern "C" {
    fn owned_test_live() -> usize; fn owned_test_identities() -> usize;
    fn owned_test_handoffs() -> usize; fn owned_test_fail_after(value: isize);
}
#[cfg(test)] fn baseline() -> (usize, usize, usize) {
    (unsafe { owned_test_live() }, unsafe { owned_test_identities() }, OWNED_LIVE.with(Cell::get))
}
#[cfg(test)] fn faults(native: bool, panic: bool, transferring: bool) -> (usize, usize) {
    let base = baseline(); let mut before = 0; let mut after = 0; let mut complete = false;
    for at in 1..1024 {
        {
            let mut input = copy_value(&sample()).unwrap(); let observed = input.clone();
            let dependent = echo_record(&input).unwrap(); let descendant = echo_record(&dependent).unwrap();
            let independent = dependent.retain().unwrap(); let handoffs = unsafe { owned_test_handoffs() };
            if native { unsafe { owned_test_fail_after(at as isize - 1) }; }
            else { OWNED_FAULT.with(|state| state.set((at, 0, panic))); }
            let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                if transferring { move_record(&mut input, |value: Bundle| { check!(observed.is_closed()); Ok(value) }) }
                else { callback_record(&input, |value: Bundle| Ok(value)) }
            }));
            unsafe { owned_test_fail_after(-1) }; OWNED_FAULT.with(|state| state.set((0, 0, false)));
            match result {
                Ok(Ok(value)) => { number(&value.get().unwrap().primary, 7); complete = true; }
                Ok(Err(error)) => check!(error == Error::Allocation),
                Err(_) => check!(!native && panic),
            }
            let consumed = unsafe { owned_test_handoffs() } - handoffs;
            check!(consumed <= 1); check!(observed.is_closed() == (consumed != 0));
            check!(dependent.is_closed() == (consumed != 0) && descendant.is_closed() == (consumed != 0));
            if consumed == 0 { number(&input.get().unwrap().primary, 7); check!(!dependent.is_closed()); }
            else { check!(input.get().is_err() && dependent.get().is_err() && descendant.get().is_err()); }
            number(&independent.get().unwrap().primary, 7);
            if !complete { if consumed == 0 { before += 1; } else { after += 1; } }
        }
        check!(baseline() == base);
        if complete { break; }
    }
    check!(complete && before > 0); if transferring { check!(after > 0); } else { check!(after == 0); }
    (before, after)
}
fn main() {
    std::panic::set_hook(Box::new(|_| {}));
    #[cfg(test)] let state = current_state().unwrap();
    #[cfg(test)] let baseline = (unsafe { owned_test_live() }, unsafe { owned_test_identities() });
    for operation in [owners, shapes, transfers, depth, callbacks, fork_guard] {
        operation();
        #[cfg(test)] check!((unsafe { owned_test_live() }, unsafe { owned_test_identities() }) == baseline);
    }
    #[cfg(test)] {
        let mut rust_faults = 0; let mut native_faults = 0; let mut panic_faults = 0;
        let mut before = 0; let mut after = 0;
        for transferring in [false, true] {
            for (native, panic) in [(false, false), (true, false), (false, true)] {
                let (earlier, later) = faults(native, panic, transferring); before += earlier; after += later;
                if native { native_faults += earlier + later; } else if panic { panic_faults += earlier + later; } else { rust_faults += earlier + later; }
            }
        }
        state.close().unwrap(); check!(unsafe { owned_test_live() } == 0 && unsafe { owned_test_identities() } == 0);
        println!("owned-rust-borrows:{{\"checks\":{},\"rustFaults\":{},\"nativeFaults\":{},\"panicFaults\":{},\"before\":{},\"after\":{},\"live\":0,\"identities\":0}}",
            CHECKS.with(Cell::get), rust_faults, native_faults, panic_faults, before, after);
    }
    #[cfg(not(test))] println!("owned-rust-borrows:{}", CHECKS.with(Cell::get));
}
