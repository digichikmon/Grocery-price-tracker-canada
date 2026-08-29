// Quebec sales tax: GST/TPS (federal) + QST/TVQ (provincial).
// Both are calculated independently on the pre-tax price (not compounded) —
// this has been the rule since QST harmonization in 2013.
export const TPS_RATE = 0.05;      // GST / TPS — 5%
export const TVQ_RATE = 0.09975;   // QST / TVQ — 9.975%

// cartItems: [{ price, quantity, taxable }]
export function computeCartTotals(cartItems) {
  let subtotal = 0;
  let taxableSubtotal = 0;

  for (const line of cartItems) {
    const lineTotal = (Number(line.price) || 0) * (Number(line.quantity) || 0);
    subtotal += lineTotal;
    if (line.taxable) taxableSubtotal += lineTotal;
  }

  const tps = taxableSubtotal * TPS_RATE;
  const tvq = taxableSubtotal * TVQ_RATE;
  const total = subtotal + tps + tvq;

  return {
    subtotal,
    taxableSubtotal,
    nonTaxableSubtotal: subtotal - taxableSubtotal,
    tps,
    tvq,
    total,
  };
}

export function formatCAD(amount) {
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(amount || 0);
}
