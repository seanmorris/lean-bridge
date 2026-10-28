use directprooferasure as api;

fn main() -> Result<(), api::Error> {
    let mut checks = 0;
    for value in 0..1005u32 {
        assert_eq!(api::keep(value)?, value);
        checks += 1;
    }
    println!("direct-proof-rust:{checks}");
    Ok(())
}
