import type { Metadata } from "next";
import { MarketTerminalChart as ReplayMarketChart } from "@/components/market/market-terminal-chart";

export const metadata: Metadata = {
  title: "Replay | Trade Journal",
  description: "Market replay and technical chart analysis station",
};

export default function ReplayPage() {
  return (
    <div className="h-[calc(100dvh-3.5rem)] lg:h-dvh w-full overflow-hidden flex flex-col">
      <ReplayMarketChart />
    </div>
  );
}
