//! Process-main-thread owner for generated synchronous Rust host components.
//! One Cargo dependency owns all tickets; application objects remain Rust Rc values.
use std::{
    any::{Any, TypeId}, cell::{Cell, RefCell}, collections::HashMap,
    marker::PhantomData, ops::Deref, rc::Rc, sync::atomic::{AtomicU32, Ordering},
};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OwnerError { WrongContext, Invalid, Closed, Limit }
type Checked<T> = Result<T, OwnerError>;
type Erased = Rc<dyn Any>;
type Key = &'static str;
type Address = (Key, usize);
const LIMIT: usize = 1 << 20;
static PID: AtomicU32 = AtomicU32::new(0);
#[doc(hidden)]
pub fn instance()->usize { &PID as *const AtomicU32 as usize }
extern "C" { fn gettid() -> i32; }
fn context() -> Checked<()> {
    let pid=std::process::id();
    if unsafe { gettid() } as u32 != pid { return Err(OwnerError::WrongContext); }
    match PID.compare_exchange(0,pid,Ordering::Relaxed,Ordering::Relaxed) {
        Ok(_) => Ok(()), Err(old) if old==pid => Ok(()), _ => Err(OwnerError::WrongContext),
    }
}

/// An owned application object. Borrowed results also keep their declared
/// parent alive, even when Rust stores its fields in separate Rc allocations.
pub struct HostRef<T: 'static> { value: Rc<T>, anchors: Vec<Erased> }
impl<T> From<Rc<T>> for HostRef<T> {
    fn from(value:Rc<T>)->Self {Self{value,anchors:Vec::new()}}
}
impl<T> Clone for HostRef<T> {
    fn clone(&self)->Self {Self{value:self.value.clone(),anchors:self.anchors.clone()}}
}
impl<T> Deref for HostRef<T> {type Target=T; fn deref(&self)->&T {&self.value}}
impl<T> std::fmt::Debug for HostRef<T> {
    fn fmt(&self,f:&mut std::fmt::Formatter<'_>)->std::fmt::Result {
        f.debug_tuple("HostRef").field(&std::any::type_name::<T>()).finish()
    }
}
impl<T> HostRef<T> {
    pub fn as_rc(&self)->&Rc<T> {&self.value}
    pub fn ptr_eq(&self,other:&Self)->bool {Rc::ptr_eq(&self.value,&other.value)}
}
/// A member returns this when its result borrows from a specific receiver or argument.
pub struct Borrowed<T: 'static> { value: Rc<T>, parent: Erased }
impl<T> Borrowed<T> {
    pub fn new<A:'static>(parent:&Rc<A>,value:Rc<T>)->Self {Self{value,parent:parent.clone()}}
}

#[doc(hidden)]
#[derive(Clone,Copy,PartialEq,Eq)]
pub struct Kind { key:Key, ty:TypeId }
impl Kind {pub fn of<T:'static>(key:Key)->Self {Self{key,ty:TypeId::of::<T>()}}}
struct Payload {kind:Kind, value:Erased, anchors:RefCell<Vec<Erased>>}
#[derive(Clone)]
enum Entry {Binder(Rc<Cell<bool>>), Type(Kind), Object(Rc<Payload>)}
impl Entry {
    fn same(&self,b:&Self)->bool {match (self,b) {
        (Self::Binder(a),Self::Binder(b))=>Rc::ptr_eq(a,b),
        (Self::Type(a),Self::Type(b))=>a==b,
        (Self::Object(a),Self::Object(b))=>Rc::ptr_eq(a,b), _=>false,
    }}
}
#[derive(Default)]
struct Ledger {
    next:u64, slots:HashMap<u64,(Key,Entry)>,
    objects:HashMap<Address,(Rc<Payload>,usize)>,
    claims:HashMap<(Key,Key),(TypeId,usize)>,
}
thread_local! {static LEDGER:RefCell<Ledger>=RefCell::new(Ledger::default());}
fn ledger<T>(f:impl FnOnce(&RefCell<Ledger>)->Checked<T>)->Checked<T> {
    LEDGER.try_with(f).map_err(|_|OwnerError::Closed)?
}
fn addr(domain:Key,p:&Payload)->Address {(domain,Rc::as_ptr(&p.value) as *const () as usize)}
impl Ledger {
    fn lookup(&self,d:Key,id:u64)->Checked<&Entry> {
        match self.slots.get(&id) {Some((dom,x)) if *dom==d=>Ok(x), _=>Err(OwnerError::Closed)}
    }
    fn check_capacity(&mut self)->Checked<()> {
        if self.slots.len()>=LIMIT || self.next==u64::MAX {return Err(OwnerError::Limit)}
        self.slots.try_reserve(1).map_err(|_|OwnerError::Limit)
    }
    fn insert(&mut self,d:Key,e:Entry)->u64 {
        self.next+=1;
        if let Entry::Object(p)=&e {
            let row=self.objects.get_mut(&addr(d,p)).expect("registered Rust host object"); row.1+=1;
        }
        self.slots.insert(self.next,(d,e)); self.next
    }
    fn unclaim(&mut self,d:Key,k:Kind) {
        let row=self.claims.get_mut(&(d,k.key)).expect("registered Rust host type");
        row.1-=1; if row.1==0 {self.claims.remove(&(d,k.key));}
    }
    fn remove(&mut self,d:Key,id:u64)->Checked<Entry> {
        self.lookup(d,id)?;
        let (_,e)=self.slots.remove(&id).unwrap();
        if let Entry::Object(p)=&e {
            let address=addr(d,p); let row=self.objects.get_mut(&address).unwrap(); row.1-=1;
            if row.1==0 {self.objects.remove(&address); self.unclaim(d,p.kind);}
        }
        Ok(e) // Drop outside the RefCell: application destructors may call another component.
    }
}
fn release(d:Key,id:u64)->Checked<()> {
    context()?;
    let retired=ledger(|l|l.borrow_mut().remove(d,id))?;
    drop(retired); Ok(())
}

#[doc(hidden)]
pub struct Ticket {domain:Key,id:u64, _owner:PhantomData<Rc<()>>}
impl Ticket {pub fn id(&self)->u64 {self.id}}
impl Drop for Ticket {fn drop(&mut self){let _=release(self.domain,self.id);}}

#[doc(hidden)]
pub struct Session {domain:Key,kinds:Vec<Kind>,binder:Ticket,live:Rc<Cell<bool>>}
impl Session {
    pub fn new(domain:Key,kinds:Vec<Kind>)->Checked<Self> {
        context()?;
        if kinds.is_empty() || kinds.len()>64 || kinds.iter().enumerate().any(|(i,k)|kinds[..i].iter().any(|v|v.key==k.key)) {
            return Err(OwnerError::Invalid);
        }
        let live=Rc::new(Cell::new(true));
        let id=ledger(|l|->Checked<u64>{
            let mut s=l.borrow_mut();s.check_capacity()?;
            for k in &kinds {if s.claims.get(&(domain,k.key)).is_some_and(|r|r.0!=k.ty) {return Err(OwnerError::Invalid)}}
            s.claims.try_reserve(kinds.len()).map_err(|_|OwnerError::Limit)?;
            for k in &kinds {s.claims.entry((domain,k.key)).or_insert((k.ty,0)).1+=1;}
            Ok(s.insert(domain,Entry::Binder(live.clone())))
        })?;
        Ok(Self{domain,kinds,binder:Ticket{domain,id,_owner:PhantomData},live})
    }
    fn check(&self)->Checked<()> {context()?; if self.live.get(){Ok(())}else{Err(OwnerError::Closed)}}
    pub fn validate(&self)->Checked<()> {self.check()}
    fn kind<T:'static>(&self,i:usize)->Checked<Kind> {
        self.check()?; self.kinds.get(i).filter(|k|k.ty==TypeId::of::<T>()).copied().ok_or(OwnerError::Invalid)
    }
    pub fn pin<T:'static>(&self,i:usize,v:&HostRef<T>)->Checked<Ticket> {
        let k=self.kind::<T>(i)?;let domain=self.domain;
        let value:Erased=v.value.clone();
        let address=(domain,Rc::as_ptr(&value) as *const () as usize);
        let id=ledger(|l|->Checked<u64> {
            let mut s=l.borrow_mut();s.check_capacity()?;
            let fresh=!s.objects.contains_key(&address);
            let p=if let Some((p,_))=s.objects.get(&address) {
                if p.kind!=k {return Err(OwnerError::Invalid)}
                p.clone()
            } else {
                s.objects.try_reserve(1).map_err(|_|OwnerError::Limit)?;
                Rc::new(Payload{kind:k,value:value.clone(),anchors:RefCell::new(Vec::new())})
            };
            let mut a=p.anchors.borrow_mut();
            let mut missing=Vec::new();
            for parent in &v.anchors {
                if !Rc::ptr_eq(&p.value,parent) && !a.iter().chain(&missing).any(|x|Rc::ptr_eq(x,parent)) {
                    if a.len()+missing.len()>=1024 {return Err(OwnerError::Limit)}
                    missing.try_reserve(1).map_err(|_|OwnerError::Limit)?;missing.push(parent.clone());
                }
            }
            a.try_reserve(missing.len()).map_err(|_|OwnerError::Limit)?;a.extend(missing);drop(a);
            if fresh {s.objects.insert(address,(p.clone(),0));s.claims.get_mut(&(domain,k.key)).unwrap().1+=1;}
            Ok(s.insert(domain,Entry::Object(p)))
        })?;
        Ok(Ticket{domain,id,_owner:PhantomData})
    }
    pub fn get<T:'static>(&self,i:usize,id:u64)->Checked<HostRef<T>> {
        let k=self.kind::<T>(i)?;
        ledger(|l|{let s=l.borrow();match s.lookup(self.domain,id)? {
            Entry::Object(p) if p.kind==k => Ok(HostRef{value:p.value.clone().downcast::<T>().map_err(|_|OwnerError::Invalid)?,anchors:p.anchors.borrow().clone()}),
            _=>Err(OwnerError::Invalid),
        }})
    }
    pub fn borrowed<T:'static,A:'static>(&self,i:usize,v:Borrowed<T>,parent:&HostRef<A>)->Checked<Ticket> {
        let actual:Erased=parent.value.clone();
        if !Rc::ptr_eq(&actual,&v.parent) {return Err(OwnerError::Invalid)}
        let mut object=HostRef::from(v.value);
        object.anchors=parent.anchors.clone();object.anchors.push(actual);self.pin(i,&object)
    }
    // Native host-domain.c uses these nine operations. Positive member slots
    // go to the generated application methods, never to this registry.
    pub fn refop(&self,op:i32,a:u64,b:u64)->Checked<u64> {
        self.check()?;let d=self.domain;
        if op == -8 {release(d,a)?; return Ok(0)}
        ledger(|l|{let mut s=l.borrow_mut();let e=match op {
            -1=>s.lookup(d,self.binder.id)?.clone(),
            -2=>return Ok(matches!(s.lookup(d,a),Ok(Entry::Binder(x)) if x.get()) as u64),
            -3=>return Ok(matches!(s.lookup(d,a),Ok(Entry::Binder(x)) if Rc::ptr_eq(x,&self.live)) as u64),
            -4=>Entry::Type(*self.kinds.get(a as usize).ok_or(OwnerError::Invalid)?),
            -5=>return Ok(s.lookup(d,a)?.same(s.lookup(d,b)?) as u64),
            -6=>return Ok(matches!((s.lookup(d,a),s.lookup(d,b)),(Ok(Entry::Object(p)),Ok(Entry::Type(k))) if p.kind==*k) as u64),
            -7|-9=>match s.lookup(d,a)? {Entry::Object(p)=>Entry::Object(p.clone()), _=>return Err(OwnerError::Invalid)},
            _=>return Err(OwnerError::Invalid),
        };s.check_capacity()?;Ok(s.insert(d,e))})
    }
    pub fn take<T:'static>(&self,i:usize,id:u64)->Checked<HostRef<T>> {
        let v=self.get(i,id); release(self.domain,id)?;v
    }
}
impl Drop for Session {
    fn drop(&mut self) {if context().is_ok() && self.live.replace(false) {
        let _=ledger(|l|{let mut s=l.borrow_mut();for k in &self.kinds {s.unclaim(self.domain,*k);}Ok(())});
    }}
}
