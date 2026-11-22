// Private implementation for one compiler-checked component.
use super::*;
use lean_bridge_task_runtime::abi;
use std::{convert::Infallible, ffi::{c_void, c_char},
    sync::{OnceLock, atomic::{AtomicU32, Ordering}}};
#[path = "assets.rs"] mod assets;
unsafe extern "C" { fn dlsym(lib:*mut c_void, name:*const c_char)->*mut c_void; fn gettid()->i32; }

#[derive(Clone,Copy)] #[repr(C)] struct View { data:*const u8, len:usize }
#[derive(Clone,Copy)] #[repr(C)] struct Buffer { data:*mut u8, len:usize }
#[derive(Clone,Copy)] #[repr(C)] struct Words { words:*mut u64, len:usize, negative:bool }
#[derive(Clone,Copy)] #[repr(C)] struct WordView { words:*const u64, len:usize, negative:bool }
const LIMIT:usize = 16*1024*1024;
fn view(x:&[u8]) -> View { View {data:x.as_ptr(),len:x.len()} }
fn bytes(v:&Buffer) -> Result<Vec<u8>,Fault> {
    if v.len>LIMIT { return Err(Fault::Limit); }
    if v.len==0 { return Ok(Vec::new()); }
    if v.data.is_null() { return Err(Fault::Protocol); }
    let mut out=Vec::new(); out.try_reserve_exact(v.len).map_err(|_|Fault::Allocation)?;
    out.extend_from_slice(unsafe {std::slice::from_raw_parts(v.data,v.len)}); Ok(out)
}
fn text(v:&Buffer) -> Result<String,Fault> {String::from_utf8(bytes(v)?).map_err(|_|Fault::Protocol)}
fn magnitude(v:&Words) -> Result<num_bigint::BigUint,Fault> {
    if v.len>LIMIT/8 {return Err(Fault::Limit);}
    if v.len==0 {return if v.negative {Err(Fault::Protocol)} else {Ok(0u8.into())};}
    if v.words.is_null() || !v.words.is_aligned() {return Err(Fault::Protocol);}
    let src=unsafe {std::slice::from_raw_parts(v.words,v.len)};
    if src.last()==Some(&0) {return Err(Fault::Protocol);}
    let mut limbs=Vec::new(); limbs.try_reserve_exact(src.len()*2).map_err(|_|Fault::Allocation)?;
    for &w in src {limbs.push(w as u32);limbs.push((w>>32) as u32);}
    Ok(num_bigint::BigUint::new(limbs))
}
enum Clear<R> { None, Void(unsafe extern "C" fn(*mut R)), Status(unsafe extern "C" fn(*mut R)->i32) }
struct Guard<R> { v:R, clear:Clear<R> }
impl<R> Guard<R> {
    // Every generated raw layout is a zero-valid scalar/C union of plain
    // integers, buffers or leases; the safe public types are never zeroed.
    unsafe fn zero(clear:Clear<R>) -> Self {Self{v:unsafe{std::mem::zeroed()},clear}}
}
impl<R> Drop for Guard<R> {fn drop(&mut self) {unsafe{match self.clear {
    Clear::None=>(), Clear::Void(f)=>f(&mut self.v), Clear::Status(f)=>{f(&mut self.v);}
}}}}

/* GENERATED_DELIVERY */
static API:OnceLock<Result<Api,Fault>>=OnceLock::new();
static PID:AtomicU32=AtomicU32::new(0);
fn runtime()->Result<&'static Api,Fault>{
    let pid=std::process::id();
    if unsafe{gettid()} as u32!=pid {return Err(Fault::WrongContext);}
    let old=PID.compare_exchange(0,pid,Ordering::Relaxed,Ordering::Relaxed).unwrap_or_else(|n|n);
    if old!=0 && old!=pid {return Err(Fault::WrongContext);}
    API.get_or_init(||{
        let lib=assets::load()? as *mut c_void;
        macro_rules! sym {($n:literal,$t:ty)=>{{
            let v=unsafe{dlsym(lib,concat!($n,"\0").as_ptr().cast())};
            if v.is_null(){return Err(Fault::Load(format!("Missing native symbol {}",$n)));}
            unsafe{std::mem::transmute::<*mut c_void,$t>(v)}
        }}}
        Ok(Api { /* GENERATED_SYMBOLS */ })
    }).as_ref().map_err(Clone::clone)
}
