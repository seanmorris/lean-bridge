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

fn grant(ticket: &Ticket, weight: u32, limit: u32) -> Grant {
    Grant {
        holder: ticket.clone(), weight: BigUint::from(weight), limit: BigUint::from(limit),
    }
}

#[derive(Debug, PartialEq)]
struct CallbackPanic(&'static str);

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

    let invalid_booking = booking(&ticket, 8, 3);
    for _ in 0..10 {
        rejected(&mut checks, echo_booking(&invalid_booking));
        check(&mut checks, invalid_booking.window.lo == BigUint::from(8u32)
            && invalid_booking.window.hi == BigUint::from(3u32),
            "nested copied rejection preserves both input fields");
        serial_is(&mut checks, &invalid_booking.holder, 41,
            "nested copied rejection preserves owner");
    }
    let equal_booking = echo_booking(&booking(&ticket, 3, 3)).expect("equal window");
    check(&mut checks, equal_booking.window.lo == BigUint::from(3u32)
        && equal_booking.window.hi == BigUint::from(3u32),
        "nested copied constructor accepts equality and recovers");
    serial_is(&mut checks, &equal_booking.holder, 41,
        "nested copied recovery retains resource");
    close_booking(equal_booking);

    check(&mut checks, booking_span(&valid_booking).expect("span") == BigUint::from(5u32),
        "copied payload consumed");
    check(&mut checks, claim_quota(&valid).expect("quota") == BigUint::from(7u32),
        "owned payload consumed");
    let mut echoed_grant = echo_grant(&grant(&ticket, 7, 8)).expect("grant");
    check(&mut checks,
        echoed_grant.weight == BigUint::from(7u32) && echoed_grant.limit == BigUint::from(8u32),
        "nested Subtype and outer checked record accepted");
    serial_is(&mut checks, &echoed_grant.holder, 41, "grant retains resource");
    echoed_grant.holder.close();
    rejected(&mut checks, echo_grant(&grant(&ticket, 0, 8)));
    rejected(&mut checks, echo_grant(&grant(&ticket, 7, 3)));
    let claims = echo_claims(&vec![valid.clone(), valid.clone()]).expect("claims");
    check(&mut checks, claims.len() == 2 && claims[1].quota == BigUint::from(7u32),
        "owned checked-record array round trips");
    serial_is(&mut checks, &claims[0].holder, 41, "array retains resource");
    for value in claims { close_claim(value); }
    for _ in 0..10 {
        rejected(&mut checks, echo_claims(&vec![valid.clone(), claim(&ticket, 99)]));
        check(&mut checks, !ticket.is_closed(), "later array rejection preserves owner");
    }
    check(&mut checks, echo_claims(&vec![]).expect("empty claims").is_empty(),
        "empty owned array");
    let array_recovery = echo_claims(&vec![valid.clone()]).expect("array recovery");
    check(&mut checks, array_recovery.len() == 1, "array rejection recovers");
    for value in array_recovery { close_claim(value); }

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

    let first = new_ticket(&BigUint::from(71u32), "first").expect("first");
    let second = new_ticket(&BigUint::from(81u32), "second").expect("second");
    let mut first_kept = first.retain().expect("first retain");
    let mut second_kept = second.retain().expect("second retain");
    let mut moving_booking = booking(&first, 3, 8);
    let mut moving_claim = claim(&second, 99);
    rejected(&mut checks, transfer_pair_claim(&mut moving_booking, &mut moving_claim));
    check(&mut checks, !first.is_closed() && !second.is_closed(),
        "late failure aborts both transfers");
    serial_is(&mut checks, &first, 71, "first rejected transfer intact");
    serial_is(&mut checks, &second, 81, "second rejected transfer intact");
    let mut accepted_pair_claim = claim(&second, 7);
    let pair = transfer_pair_claim(&mut moving_booking, &mut accepted_pair_claim)
        .expect("pair transfer");
    check(&mut checks, first.is_closed() && second.is_closed() && pair.quota == BigUint::from(7u32),
        "both transfers commit together");
    serial_is(&mut checks, &first_kept, 71, "first independent retain survives");
    serial_is(&mut checks, &second_kept, 81, "second independent retain survives");
    close_claim(pair);
    first_kept.close();
    second_kept.close();

    for failure in 0..3 {
        let input = new_ticket(&BigUint::from(91u32), "post-transfer").expect("post input");
        let independent = input.retain().expect("post retain");
        let mut transferred = claim(&input, 7);
        let mut entered = 0usize;
        let previous_hook = std::panic::take_hook();
        std::panic::set_hook(Box::new(|_| {}));
        let outcome = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            transfer_with_claim_callback(&mut transferred, with_recovery(
                |incoming: Claim| -> Result<Claim, Error> {
                    entered += 1;
                    match failure {
                        0 => Ok(claim(&incoming.holder, 99)),
                        1 => Err(Error::CallbackFailed),
                        _ => std::panic::panic_any(CallbackPanic("post-transfer callback")),
                    }
                }, claim(&independent, 7)))
        }));
        std::panic::set_hook(previous_hook);
        match failure {
            0 => rejected(&mut checks, outcome.expect("unexpected panic")),
            1 => check(&mut checks,
                matches!(outcome.expect("unexpected panic"), Err(Error::CallbackFailed)),
                "post-transfer callback error identity preserved"),
            _ => {
                let panic = match outcome {
                    Err(panic) => panic,
                    Ok(_) => panic!("post-transfer panic was swallowed"),
                };
                check(&mut checks,
                    panic.downcast_ref::<CallbackPanic>() == Some(&CallbackPanic("post-transfer callback")),
                    "post-transfer callback panic identity preserved");
            }
        }
        check(&mut checks, entered == 1 && input.is_closed(),
            "failure after transfer consumes input");
        serial_is(&mut checks, &independent, 91,
            "post-transfer failure preserves independent retain");
        let mut retry = claim(&independent, 7);
        let recovery = claim(&independent, 7);
        let recovered = transfer_with_claim_callback(&mut retry, with_recovery(
            |incoming: Claim| Ok(claim(&incoming.holder, 9)), recovery))
            .expect("post-transfer recovery");
        check(&mut checks, independent.is_closed() && recovered.quota == BigUint::from(9u32),
            "post-transfer callback failure recovers on next call");
        serial_is(&mut checks, &recovered.holder, 91, "recovered transfer resource is usable");
        close_claim(recovered);
    }

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
