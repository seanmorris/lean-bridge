// Built exclusively against the relocated package. No private runtime access.
#include "workshop.hpp"
#include <cassert>
#include <cstdio>
#include <string_view>
namespace sv=lean_bridge::sync_v1;

struct Dial {
    static inline int destroyed=0;
    uint32_t value=27;
    std::exception_ptr fault;
    uint32_t read() const {if(fault) std::rethrow_exception(fault); return value;}
    std::shared_ptr<Dial> leased() {return {this,[](Dial*){}};}
    ~Dial() {++destroyed;}
};
struct Box {
    static inline int destroyed=0;
    Dial first, second;
    bool offset=false, unrelated=false;
    std::weak_ptr<Box> home;
    std::shared_ptr<Dial> kept;
    std::shared_ptr<Dial> child() {
        if(unrelated) return std::make_shared<Dial>();
        return {home.lock(),offset?&second:&first};
    }
    std::shared_ptr<Dial> prefer(std::shared_ptr<Dial> argument) {
        return unrelated?std::shared_ptr<Dial>(home.lock(),&first):argument;
    }
    uint32_t keep(std::shared_ptr<Dial> d) {kept=std::move(d); return kept->read();}
    uint32_t takeOwned(std::shared_ptr<Dial> d) {kept=std::move(d); return kept->read();}
    ~Box() {++destroyed;}
};
using Binding=lean_bridge::workshop::Binding<Box,Dial>;
int main(int argc,char** argv) {
    assert(argc==2);
    const std::string_view mode=argv[1];
    Binding a,b;
    auto box=std::make_shared<Box>(); box->home=box;
    auto input=std::make_shared<Dial>(); input->value=73;
    if(mode!="valid") {
        box->unrelated=true;
        try {
            if(mode=="wrong-receiver") (void)a.child_of(box);
            else if(mode=="wrong-parameter") (void)a.prefer_dial(box,input);
            else {assert(mode=="wrong-control-block"); (void)a.leased_dial(input);}
            assert(false);
        } catch(const sv::Unavailable&) {}
        try {(void)b.read_dial(input); assert(false);} catch(const sv::Unavailable&) {}
        a.close(); b.close(); input.reset(); box.reset();
        assert(Box::destroyed==1 && Dial::destroyed==(mode=="wrong-receiver"?4:3));
        std::puts("unrelated result retired both bindings; deterministic destruction");
        return 0;
    }
    const boost::multiprecision::cpp_int wide=(boost::multiprecision::cpp_int(1)<<320)+5;
    assert(a.exact_int(wide)==wide && a.exact_int(-wide)==-wide);
    try {(void)b.exact_int(boost::multiprecision::cpp_int(1)<<(16u*1024u*1024u*8u)); assert(false);}
    catch(const std::length_error&) {}
    input->fault=std::make_exception_ptr(std::invalid_argument("from user method"));
    try {(void)b.read_dial(input); assert(false);} catch(const std::invalid_argument&) {
        assert(std::current_exception()==input->fault);
    }
    input->fault={}; assert(b.read_dial(input)==73);
    auto first=a.child_of(box);
    assert(static_cast<void*>(box.get())==static_cast<void*>(first.get()));
    assert(!first.owner_before(box) && !box.owner_before(first));
    assert(first.get()==&box->first && b.inner_read(box)==27);
    box->offset=true; box->second.value=58;
    auto second=b.child_of(box);
    assert(static_cast<void*>(box.get())!=static_cast<void*>(second.get()));
    assert(second.get()==&box->second && !second.owner_before(box) && !box.owner_before(second));
    assert(a.read_dial(second)==58 && b.inner_read(box)==58);
    auto preferred=a.prefer_dial(box,input);
    assert(preferred==input && !preferred.owner_before(input) && !input.owner_before(preferred));
    assert(a.keep_dial(box,input)==73);
    auto other=std::make_shared<Dial>(); other->value=96;
    assert(b.take_dial(box,other)==96 && box->kept==other);
    std::weak_ptr<Dial> external=input, transferred=other;
    preferred.reset(); input.reset(); other.reset();
    assert(external.expired() && !transferred.expired());
    box->kept.reset(); assert(transferred.expired());
    std::weak_ptr<Box> owner=box; box.reset();
    assert(b.read_dial(first)==27 && a.read_dial(second)==58);
    first.reset(); second.reset(); a.close();
    assert(!owner.expired()); // The other binding still owns the strong canonical type.
    b.close(); assert(owner.expired() && Box::destroyed==1 && Dial::destroyed==4);
    std::puts("both alias addresses, both anchors, retained owners, final strong release");
}
