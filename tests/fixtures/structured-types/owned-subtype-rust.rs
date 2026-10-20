// Independent installed-crate consumer for checked owned aggregates.
use owned_subtypes::*;

fn check(checks: &mut usize, value: bool, message: &str) {
    *checks += 1;
    assert!(value, "owned Subtype Rust check {}: {}", *checks, message);
}

fn rejected<T>(checks: &mut usize, result: Result<T, Error>) {
    check(checks, matches!(result, Err(Error::InvalidArgument)),
        "expected checked-constructor rejection");
}

fn bundle(ticket: &Ticket, count: i64) -> Bundle {
    Bundle {
        primary: ticket.clone(),
        spare: None,
        peers: vec![ticket.clone()],
        history: vec![ticket.clone()],
        payload: Payload { count: BigInt::from(count), bytes: vec![0, 255] },
    }
}

fn close_bundle(mut value: Bundle) {
    value.primary.close();
    if let Some(mut ticket) = value.spare { ticket.close(); }
    for ticket in &mut value.peers { ticket.close(); }
    for ticket in &mut value.history { ticket.close(); }
}

fn serial_is(checks: &mut usize, ticket: &Ticket, expected: u32, message: &str) {
    check(checks, serial(ticket).expect("serial") == BigUint::from(expected), message);
}

fn main() {
    let mut checks = 0usize;
    let mut ticket = new_ticket(&BigUint::from(41u32), "rust\0checked").expect("ticket");
    let mut retained = ticket.retain().expect("retain");
    serial_is(&mut checks, &ticket, 41, "fresh resource is usable");
    serial_is(&mut checks, &retained, 41, "explicit retain is independent");

    let valid = bundle(&ticket, 7);
    for _ in 0..25 {
        let echoed = echo_record(&valid).expect("echo");
        check(&mut checks, echoed.payload.count == BigInt::from(7),
            "selected constructor accepts a valid value");
        serial_is(&mut checks, &echoed.primary, 41,
            "selected constructor preserves the resource");
        let alternate = echo_record_alternate(&valid).expect("alternate");
        check(&mut checks, alternate.payload.bytes == vec![0, 255],
            "alternate constructor preserves bytes");
        serial_is(&mut checks, &alternate.primary, 41,
            "alternate constructor preserves the resource");
        close_bundle(echoed);
        close_bundle(alternate);
    }
    check(&mut checks, !ticket.is_closed(), "borrowed calls do not consume the input owner");

    let invalid = bundle(&ticket, -1);
    rejected(&mut checks, echo_record(&invalid));
    rejected(&mut checks, echo_record_alternate(&invalid));
    check(&mut checks, !ticket.is_closed(), "borrowed rejection preserves the input owner");
    serial_is(&mut checks, &ticket, 41, "borrowed rejection leaves the resource usable");

    let mut moving = new_ticket(&BigUint::from(51u32), "moving").expect("moving");
    let mut kept = moving.retain().expect("retain moving");
    let mut rejected_bundle = bundle(&moving, -1);
    rejected(&mut checks, transfer_record(&mut rejected_bundle));
    check(&mut checks, !moving.is_closed(), "transfer rejection happens before ownership movement");
    serial_is(&mut checks, &moving, 51, "rejected transfer leaves the original usable");
    serial_is(&mut checks, &kept, 51, "rejected transfer leaves the retain usable");

    let mut moving_bundle = bundle(&moving, 9);
    let moved = transfer_record(&mut moving_bundle).expect("transfer");
    check(&mut checks, moving.is_closed(), "successful transfer consumes the selected owner");
    serial_is(&mut checks, &kept, 51, "successful transfer preserves an independent retain");
    check(&mut checks, moved.payload.count == BigInt::from(9),
        "successful transfer preserves the checked field");
    serial_is(&mut checks, &moved.primary, 51,
        "successful transfer returns a usable resource");

    close_bundle(moved);
    close_bundle(rejected_bundle);
    ticket.close();
    retained.close();
    moving.close();
    kept.close();
    check(&mut checks,
        ticket.is_closed() && retained.is_closed() && moving.is_closed() && kept.is_closed(),
        "cleanup is explicit and idempotent");

    println!("owned-subtype-rust:{checks}");
}
