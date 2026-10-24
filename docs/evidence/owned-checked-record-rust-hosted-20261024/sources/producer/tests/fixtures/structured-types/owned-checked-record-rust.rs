// Installed-crate consumer for owned proof-erased checked records.
use owned_checked_records::*;

fn check(checks: &mut usize, value: bool, message: &str) {
    *checks += 1;
    assert!(value, "owned checked-record Rust check {}: {}", *checks, message);
}

fn rejected<T>(checks: &mut usize, result: Result<T, Error>) {
    check(checks, matches!(result, Err(Error::InvalidArgument)),
        "expected checked-constructor rejection");
}

fn claim(ticket: &Ticket, quota: u32) -> Claim {
    Claim { holder: ticket.clone(), quota: BigUint::from(quota) }
}

fn booking(ticket: &Ticket, lo: u32, hi: u32) -> Booking {
    Booking {
        holder: ticket.clone(),
        window: Window { lo: BigUint::from(lo), hi: BigUint::from(hi) },
    }
}

fn close_claim(mut value: Claim) { value.holder.close(); }

fn close_booking(mut value: Booking) { value.holder.close(); }

fn serial_is(checks: &mut usize, ticket: &Ticket, expected: u32, message: &str) {
    check(checks, serial(ticket).expect("serial") == BigUint::from(expected), message);
}

fn main() {
    let mut checks = 0usize;
    let mut ticket = new_ticket(&BigUint::from(41u32), "rust\0checked").expect("ticket");
    let mut retained = ticket.retain().expect("retain");
    serial_is(&mut checks, &ticket, 41, "fresh resource is usable");
    serial_is(&mut checks, &retained, 41, "explicit retain is independent");
    let valid = claim(&ticket, 7);
    let valid_booking = booking(&ticket, 3, 8);

    for _ in 0..25 {
        let echoed = echo_claim(&valid).expect("echo claim");
        check(&mut checks, echoed.quota == BigUint::from(7u32),
            "selected constructor accepts the claim");
        serial_is(&mut checks, &echoed.holder, 41, "claim preserves its resource");
        let echoed_booking = echo_booking(&valid_booking).expect("echo booking");
        check(&mut checks, echoed_booking.window.hi == BigUint::from(8u32),
            "nested copied checked record preserves its fields");
        serial_is(&mut checks, &echoed_booking.holder, 41,
            "booking preserves its resource");
        close_claim(echoed);
        close_booking(echoed_booking);
    }

    let invalid = claim(&ticket, 99);
    rejected(&mut checks, echo_claim(&invalid));
    rejected(&mut checks, pair_claim(&valid_booking, &invalid));
    check(&mut checks, !ticket.is_closed(),
        "early and late borrowed rejection preserve input");
    serial_is(&mut checks, &ticket, 41, "borrowed rejection recovers");

    let mut moving = new_ticket(&BigUint::from(51u32), "moving").expect("moving");
    let mut kept = moving.retain().expect("retain moving");
    let mut rejected_claim = claim(&moving, 99);
    rejected(&mut checks, transfer_claim(&mut rejected_claim));
    check(&mut checks, !moving.is_closed() && !rejected_claim.holder.is_closed(),
        "transfer rejection precedes movement");
    serial_is(&mut checks, &moving, 51, "rejected transfer leaves input usable");
    serial_is(&mut checks, &kept, 51, "rejected transfer leaves retain usable");
    let mut accepted_claim = claim(&moving, 9);
    let moved = transfer_claim(&mut accepted_claim).expect("accepted transfer");
    check(&mut checks, moving.is_closed() && accepted_claim.holder.is_closed(),
        "successful transfer consumes the shared owner");
    check(&mut checks, moved.quota == BigUint::from(9u32),
        "successful transfer preserves payload");
    serial_is(&mut checks, &moved.holder, 51, "transferred result is usable");
    serial_is(&mut checks, &kept, 51, "independent retain survives transfer");

    let mut calls = 0usize;
    let callback_result = with_claim_callback(&valid, with_recovery(
        |incoming: Claim| {
            calls += 1;
            assert_eq!(incoming.quota, BigUint::from(7u32));
            Ok(claim(&incoming.holder, 10))
        }, valid.clone())).expect("valid host callback");
    check(&mut checks, calls == 1 && callback_result.quota == BigUint::from(10u32),
        "valid host callback reply accepted");
    serial_is(&mut checks, &callback_result.holder, 41,
        "host reply resource retained");
    close_claim(callback_result);

    let before = calls;
    let bare_result = with_claim_callback(&valid, |incoming: Claim| {
        calls += 1;
        Ok(claim(&incoming.holder, 10))
    }).expect("bare callback result");
    check(&mut checks, calls == before + 1 && bare_result.quota == BigUint::from(10u32),
        "successful callback needs no failure-path recovery");
    close_claim(bare_result);
    let before = calls;
    rejected(&mut checks, with_claim_callback(&valid, with_recovery(
        |incoming: Claim| { calls += 1; Ok(incoming) }, invalid.clone())));
    check(&mut checks, calls == before, "invalid recovery stops callback");
    rejected(&mut checks, with_claim_callback(&valid, with_recovery(
        |incoming: Claim| Ok(claim(&incoming.holder, 99)), valid.clone())));
    serial_is(&mut checks, &ticket, 41, "invalid host reply recovers");

    let callback_error = with_claim_callback(&valid, with_recovery(
        |_incoming: Claim| Err(Error::CallbackFailed), valid.clone()));
    check(&mut checks, matches!(callback_error, Err(Error::CallbackFailed)),
        "callback error identity preserved");

    #[derive(Debug, PartialEq)]
    struct CallbackPanic(&'static str);
    let previous_hook = std::panic::take_hook();
    std::panic::set_hook(Box::new(|_| {}));
    let panic = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        let _ = with_claim_callback(&valid, with_recovery(
            |_incoming: Claim| -> Result<Claim, Error> {
                std::panic::panic_any(CallbackPanic("owned checked callback"));
            }, valid.clone()));
    })).expect_err("callback panic was swallowed");
    std::panic::set_hook(previous_hook);
    check(&mut checks,
        panic.downcast_ref::<CallbackPanic>() == Some(&CallbackPanic("owned checked callback")),
        "callback panic identity preserved");

    let mut closure = claim_closure().expect("claim closure");
    let from_closure = closure.call(&valid).expect("closure result");
    check(&mut checks, from_closure.quota == BigUint::from(7u32),
        "returned closure accepts valid claim");
    serial_is(&mut checks, &from_closure.holder, 41,
        "closure result resource retained");
    close_claim(from_closure);
    rejected(&mut checks, closure.call(&invalid));
    let reused = closure.call(&claim(&ticket, 6)).expect("closure reuse");
    check(&mut checks, reused.quota == BigUint::from(6u32),
        "returned closure recovers and reuses");
    close_claim(reused);
    closure.close();
    closure.close();
    check(&mut checks, closure.is_closed(), "closure closes idempotently");

    let produced = claim_for(&retained).expect("Lean-produced claim")
        .expect("claim is present");
    check(&mut checks, produced.quota == BigUint::from(0u32),
        "Lean-produced claim erases its proof");
    serial_is(&mut checks, &produced.holder, 41,
        "Lean-produced resource is usable");
    close_claim(produced);

    let dropped = new_ticket(&BigUint::from(61u32), "dropped").expect("drop owner");
    let mut survivor = dropped.retain().expect("retain drop owner");
    drop(dropped);
    serial_is(&mut checks, &survivor, 61,
        "Drop preserves an independent retain");
    survivor.close();
    check(&mut checks, survivor.is_closed(),
        "retained owner supports explicit cleanup after Drop");
    let after_drop = new_ticket(&BigUint::from(62u32), "after-drop").expect("after drop");
    serial_is(&mut checks, &after_drop, 62,
        "runtime remains usable after automatic Drop cleanup");
    drop(after_drop);

    close_claim(valid);
    close_claim(invalid);
    close_booking(valid_booking);
    close_claim(moved);
    close_claim(rejected_claim);
    ticket.close();
    retained.close();
    moving.close();
    kept.close();
    check(&mut checks,
        ticket.is_closed() && retained.is_closed() && moving.is_closed() && kept.is_closed(),
        "cleanup is explicit and idempotent");

    println!("owned-checked-record-rust:{checks}");
}
