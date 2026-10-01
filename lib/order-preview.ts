import { FEE_RATE, SLIPPAGE, type OrderType } from './replay.ts';

// A quote only: future gaps and limit-price improvement change actual fills.
export function cashPreview(amount: number, reference: number, stop: number, target: number,
  type: OrderType, filledEntry?: number | null, filledQuantity?: number | null, paidFee?: number, side: "long" | "short" = "long") {
  if (![amount, reference, stop, target].every(v => Number.isFinite(v) && v > 0)) return null;
  const sign=side==="short"?-1:1;
  const entry = filledEntry ?? reference * (type === 'limit' ? 1 : 1 + sign * SLIPPAGE);
  const quantity = filledQuantity ?? amount / entry;
  const fee = paidFee ?? amount * FEE_RATE;
  const net = (exit: number) => sign * (exit - entry) * quantity - fee - exit * quantity * FEE_RATE;
  return { fee, total: amount + fee, stopNet: net(stop * (1 - sign * SLIPPAGE)), targetNet: net(target) };
}
