// A downstream translation unit can compare values without the callable header.
#include "tariff_quotes-values.hpp"
using Quote = decltype(lean_bridge::tariff_quotes::Tariff::quote);
bool frame_identity(const Quote& a, const Quote& b) { return a == b; }
