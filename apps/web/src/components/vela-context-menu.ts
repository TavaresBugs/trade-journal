import { configureVelaContextMenuDefaults } from "@luxalgo/vela/widget";
import { preOrderStore } from "@/lib/paper-trading/pre-order-store";
import { formatPrice, getPaperInstrumentSpec } from "@/lib/paper-trading/symbol-specs";
import { alertsStore } from "@/lib/alerts/alerts-store";

configureVelaContextMenuDefaults({
  getTickSize: (sym) => getPaperInstrumentSpec(sym)?.tickSize ?? 0.25,
  formatPrice: (sym, price) => formatPrice(sym, price),
  onPlaceOrder: (side, type, price, sym = "MNQ") => {
    preOrderStore.open(sym, side, type, price);
  },
  onCreateAlert: (sym, price) => {
    alertsStore.openCreateDialog(sym, price);
  },
});

export * from "@luxalgo/vela/widget";
