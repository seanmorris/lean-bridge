/* Receiver tests use public members, not generated dispatch or native handles. */
template<class T> concept HasSerial = requires(const T& value) { value.serial(); };
template<class T> concept HasPrimary = requires(const T& value) { value.primary(); };
template<class T> concept HasTransfer = requires(T&& value) { std::forward<T>(value).transfer_ticket(); };
template<class T> concept HasChosen = requires(const api::Value<api::Ticket>& value, const T& source) { value.choose_ticket(source); };
static_assert(HasSerial<api::Value<api::Ticket>> && HasSerial<api::Ticket>);
static_assert(!HasSerial<api::Value<api::Bundle>> && !HasSerial<api::Value<api::Choice>>);
static_assert(HasPrimary<api::Value<api::Bundle>> && !HasPrimary<api::Value<api::Ticket>>);
static_assert(HasTransfer<api::Value<api::Ticket>> && !HasTransfer<api::Value<api::Ticket>&>);
static_assert(!HasTransfer<const api::Value<api::Ticket>> && !HasTransfer<api::Ticket>);
static_assert(HasChosen<api::Value<api::Ticket>> && !HasChosen<api::Ticket>);

static void test_receiver_members() {
  auto receiver = api::new_ticket(42, std::string("key\0label", 9));
  CHECK(receiver.serial() == 42 && receiver.get().serial() == 42);
  const auto label = receiver.label(); CHECK(label == std::string("key\0label", 9));
  auto borrowed = receiver.retain_ticket(), descendant = borrowed.retain_ticket();
  auto kept = descendant.retain(); CHECK(descendant.serial() == 42);
  receiver.close(); CHECK(borrowed.is_closed() && descendant.is_closed());
  rejects([&] { (void)descendant.serial(); }, OWNED_AGGREGATES_CLOSED);
  CHECK(kept.serial() == 42 && label.size() == 9);

  auto unrelated = api::new_ticket(5, "receiver"), source = api::new_ticket(73, "source");
  auto chosen = unrelated.choose_ticket(source);
  CHECK(chosen.serial() == 73); unrelated.close(); CHECK(chosen.serial() == 73);
  source.close(); CHECK(chosen.is_closed());
  rejects([&] { (void)chosen.serial(); }, OWNED_AGGREGATES_CLOSED);

  auto record = api::copy_value(sample());
  const auto payload = record.payload(); auto primary = record.primary();
  auto echoed = record.echo_record(), nested = echoed.echo_record();
  CHECK(primary.serial() == 7 && payload == record->payload && nested == record);
  api::Ticket escaped, retained;
  auto callback = record.callback_record([&](const api::Bundle& input) {
    CHECK(input.primary.serial() == 7);
    escaped = input.primary; retained = input.primary.retain();
    auto own = api::copy_value(input), reentered = own.echo_record();
    CHECK(reentered.payload() == input.payload); return input;
  });
  CHECK(escaped.is_closed() && retained.serial() == 7 && callback == record);
  auto closure = record.make_record(), closureKept = closure.retain();
  CHECK(closure(true, sample()).payload() == payload);
  record.close(); CHECK(primary.is_closed() && nested.is_closed() && callback.is_closed());
  CHECK(closure.is_closed() && payload.count == -(api::Int(1) << 1024) - 37);
  CHECK(closureKept(true, sample()).primary().serial() == 7);

  auto variant = api::copy_value(api::Choice{api::ChoiceMany{}});
  auto variantView = variant.echo_variant(); CHECK(variantView == variant);
  variant.close(); CHECK(variantView.is_closed());
  auto tree = api::copy_value(api::Tree{api::TreeBranch{}});
  auto treeView = tree.echo_recursive();
  auto treeCallback = tree.callback_recursive([](const api::Tree& input) { return input; });
  auto treeClosure = tree.make_recursive();
  CHECK(treeView == tree && treeCallback == tree && treeClosure(true, tree.get()) == tree);
  tree.close(); CHECK(treeView.is_closed() && treeCallback.is_closed() && treeClosure.is_closed());

  auto consumed = api::new_ticket(0, "consumed"), consumedAlias = consumed;
  auto mixed = kept.mixed_ticket(std::move(consumed));
  CHECK(consumed.is_closed() && consumedAlias.is_closed() && mixed == kept);
  auto keptAlias = kept, keptView = kept.retain_ticket();
  auto moved = std::move(kept).transfer_ticket();
  CHECK(moved.serial() == 42 && kept.is_closed() && keptAlias.is_closed() && keptView.is_closed() && mixed.is_closed());

  auto moving = api::copy_value(sample()), old = moving, view = moving.echo_record();
  auto output = std::move(moving).move_record([&](const api::Bundle& input) {
    CHECK(moving.is_closed() && old.is_closed() && view.is_closed());
    CHECK(input.primary.serial() == 7); return input;
  });
  CHECK(output.primary().serial() == 7);
}
