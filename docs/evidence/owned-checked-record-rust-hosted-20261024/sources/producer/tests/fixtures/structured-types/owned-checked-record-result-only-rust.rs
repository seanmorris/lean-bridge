// Installed-crate result-only consumer for owned checked records.
use owned_checked_records_result_only::*;

fn check(checks: &mut usize, value: bool, message: &str) {
    *checks += 1;
    assert!(value, "{message}");
}

fn main() {
    let mut checks = 0usize;
    let mut ticket = new_ticket(&BigUint::from(20u32), "result-only").expect("ticket");
    let mut produced = claim_for(&ticket).expect("claim result").expect("claim is present");
    check(&mut checks, produced.quota == BigUint::from(0u32), "proof is erased");
    check(&mut checks, serial(&produced.holder).expect("serial") == BigUint::from(20u32),
        "resource is usable");
    produced.holder.close();
    ticket.close();
    check(&mut checks, ticket.is_closed(), "owner closes");
    println!("owned-checked-record-result-only-rust:{checks}");
}
