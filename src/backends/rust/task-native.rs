// Private implementation for one compiler-checked component.
use super::*;
use lean_bridge_task_runtime::{abi, Source};
use std::{convert::Infallible, ffi::{c_void, c_char}, os::fd::BorrowedFd,
    sync::{OnceLock, atomic::{AtomicU32, Ordering}}};
#[path = "assets.rs"] mod assets;
unsafe extern "C" { fn dlsym(lib:*mut c_void, name:*const c_char)->*mut c_void; fn gettid()->i32; }

#[derive(Clone,Copy,Default)] #[repr(C)] struct Handle { id:u64, domain:u64 }
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

type PollFn=unsafe extern "C" fn(Handle,*mut i32)->i32;
type CloseFn=unsafe extern "C" fn(*mut Handle)->i32;
type PullFn=unsafe extern "C" fn(Handle)->i32;
type Dispatch = dyn FnMut(u32,&Api,Handle)->Result<Option<CallbackError>,Fault>;
struct Callbacks {
    declaration:&'static str, fd:PollFn, next:unsafe extern "C" fn(Handle,*mut u32)->i32,
    fail:unsafe extern "C" fn(Handle,View,*mut u32)->i32, poison:PullFn,
    dispatch:Box<Dispatch>, faults:Vec<CallbackError>,
}
struct Channel<T,E,H=Infallible> {
    api:&'static Api, h:Handle, poll:PollFn, close:CloseFn, pull:Option<PullFn>,
    take:fn(&Api,&mut Handle,&[CallbackError])->Result<Option<T>,Error<E,H>>,
    callbacks:Option<Callbacks>,
}
impl<T,E,H> Source<T,E,H> for Channel<T,E,H> {
    fn request(&mut self)->Result<(),Fault>{
        abi::status(unsafe{self.pull.ok_or(Fault::Protocol)?(self.h)})
    }
    fn readiness(&mut self)->Result<Option<BorrowedFd<'_>>,Fault>{
        let mut fd=-1;
        match unsafe{(self.poll)(self.h,&mut fd)}{
            0=>Ok(None),1 if fd>=0=>Ok(Some(unsafe{BorrowedFd::borrow_raw(fd)})),
            n=>{abi::status(n)?;Err(Fault::Protocol)}
        }
    }
    fn take(&mut self)->Result<Option<T>,Error<E,H>>{
        (self.take)(self.api,&mut self.h,self.callbacks.as_ref().map_or(&[],|c|c.faults.as_slice()))
    }
    fn callback_fd(&self)->Result<Option<BorrowedFd<'_>>,Fault>{
        let Some(c)=&self.callbacks else{return Ok(None)};
        let mut fd=-1;abi::status(unsafe{(c.fd)(self.h,&mut fd)})?;
        if fd<0{return Err(Fault::Protocol);}
        Ok(Some(unsafe{BorrowedFd::borrow_raw(fd)}))
    }
    fn dispatch_callbacks(&mut self)->Result<(),Fault>{
        let c=self.callbacks.as_mut().ok_or(Fault::Protocol)?;
        for _ in 0..16 {
            let mut slot=0;let s=unsafe{(c.next)(self.h,&mut slot)};
            if s==1{break} abi::status(s)?;
            // Both the closure and its error's Display are application code.
            // Neither executes in a native frame or under the queue lock.
            let result=std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                (c.dispatch)(slot,self.api,self.h).map(|e|e.map(|e|{let msg=e.to_string();(e,msg)}))
            }));
            match result {
                Ok(Ok(None))=>(),
                Ok(Ok(Some((e,msg))))=>{
                    let mut id=0;c.faults.try_reserve(1).map_err(|_|Fault::Allocation)?;
                    abi::status(unsafe{(c.fail)(self.h,view(msg.as_bytes()),&mut id)})?;
                    if id as usize!=c.faults.len()+1{return Err(Fault::Protocol);}
                    c.faults.push(e);
                }
                Ok(Err(e))=>return Err(e),
                Err(payload)=>{
                    unsafe{(c.poison)(self.h)};
                    // A panic payload can itself panic in Drop.
                    if let Err(second)=std::panic::catch_unwind(std::panic::AssertUnwindSafe(||drop(payload))){std::mem::forget(second);}
                    return Err(Fault::CallbackPanic{declaration:c.declaration})
                }
            }
        }
        Ok(())
    }
    fn close(&mut self)->Result<(),Fault>{
        if self.h.id==0{return Ok(());}
        let n=unsafe{(self.close)(&mut self.h)};
        if n==6 {self.h.id=0;Ok(())} else {abi::status(n)}
    }
}
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
