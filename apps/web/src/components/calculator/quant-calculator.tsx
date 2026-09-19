"use client";

import { Shield, Crosshair, Layers } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useCalculatorState } from "@/lib/use-calculator-state";

// Tab 1: Risk & Execution
import { PointsSizingCard } from "./points-sizing-card";
import { CapitalSurvivalCard } from "./capital-survival-card";
import { LossRecoveryCard } from "./loss-recovery-card";

// Tab 2: Strategy & Edge
import { SweetSpotMatrixCard } from "./sweet-spot-matrix-card";
import { RealExpectancyCard } from "./real-expectancy-card";
import { VarianceStreakCard } from "./variance-streak-card";

// Tab 3: Portfolio & Capital
import { EvCalculatorCard } from "./ev-calculator-card";
import { BinomialOddsCard } from "./binomial-odds-card";
import { ReturnsSimulatorCard } from "./returns-simulator-card";

export function QuantCalculator() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab") as "risk" | "strategy" | "portfolio" | null;
  const { state, updateState, setActiveTab } = useCalculatorState();

  const activeTab = tabParam || state.activeTab || "risk";

  const handleTabChange = (val: string) => {
    const tab = val as "risk" | "strategy" | "portfolio";
    setActiveTab(tab);
  };

  return (
    <div className="space-y-6">
      {/* HEADER & TABS NAVIGATION */}
      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        className="w-full space-y-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/60 pb-4">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-foreground">Quantitative Calculators</h2>
            <p className="text-xs text-muted-foreground">
              From daily position sizing and capital survival to system sweet spots and prop evaluations.
            </p>
          </div>

          <TabsList className="h-10 p-1 bg-muted/60 border border-border/60 self-start sm:self-auto">
            <TabsTrigger
              value="risk"
              className="group text-xs px-3 py-1.5 gap-1.5 font-medium transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
            >
              <Shield className="h-3.5 w-3.5 text-profit/70 transition-colors group-hover:text-profit group-data-[state=active]:text-profit" />
              1. Risk &amp; Execution
            </TabsTrigger>
            <TabsTrigger
              value="strategy"
              className="group text-xs px-3 py-1.5 gap-1.5 font-medium transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
            >
              <Crosshair className="h-3.5 w-3.5 text-amber-400/70 transition-colors group-hover:text-amber-400 group-data-[state=active]:text-amber-400" />
              2. Strategy &amp; Edge
            </TabsTrigger>
            <TabsTrigger
              value="portfolio"
              className="group text-xs px-3 py-1.5 gap-1.5 font-medium transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
            >
              <Layers className="h-3.5 w-3.5 text-brand/70 transition-colors group-hover:text-brand group-data-[state=active]:text-brand" />
              3. Portfolio &amp; Capital
            </TabsTrigger>
          </TabsList>
        </div>

        {/* TAB 1: RISK & EXECUTION */}
        <TabsContent value="risk" className="space-y-6 mt-0">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <PointsSizingCard
              values={state.sizing}
              onChange={(patch) => updateState("sizing", patch)}
            />
            <CapitalSurvivalCard
              balance={state.sizing.riskDollars * 50}
              riskPercent={state.survival.riskPercent}
              mode={state.survival.mode ?? "funded"}
              onModeChange={(m) => updateState("survival", { mode: m })}
              onChange={(patch) => updateState("survival", patch)}
            />
            <div className="lg:col-span-2">
              <LossRecoveryCard
                initialCapital={state.sizing.riskDollars * 50}
                drawdownPercent={state.survival.drawdownPercent}
                mode={state.recovery?.mode ?? "funded"}
                onModeChange={(m) => updateState("recovery", { mode: m })}
                onChange={(patch) => updateState("survival", patch)}
              />
            </div>
          </div>
        </TabsContent>

        {/* TAB 2: STRATEGY & EDGE */}
        <TabsContent value="strategy" className="space-y-6 mt-0">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="lg:col-span-2">
              <SweetSpotMatrixCard
                winRate={state.strategy.winRate}
                riskReward={state.strategy.riskReward}
                onSelect={(wr, rr) => updateState("strategy", { winRate: wr, riskReward: rr })}
              />
            </div>
            <RealExpectancyCard
              winRate={state.strategy.winRate}
              riskReward={state.strategy.riskReward}
              riskDollars={state.strategy.riskDollars}
              feePerTrade={state.strategy.feePerTrade}
              slippageDollars={state.strategy.slippageDollars}
              onChange={(patch) => updateState("strategy", patch)}
            />
            <VarianceStreakCard
              winRate={state.strategy.winRate}
              sampleTrades={state.strategy.sampleTrades}
              onChange={(patch) => updateState("strategy", patch)}
            />
          </div>
        </TabsContent>

        {/* TAB 3: PORTFOLIO & CAPITAL */}
        <TabsContent value="portfolio" className="space-y-6 mt-0">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <EvCalculatorCard
              values={state.ev}
              onChange={(patch) => updateState("ev", patch)}
            />
            <BinomialOddsCard
              values={state.budget}
              onChange={(patch) => updateState("budget", patch)}
            />
            <div className="lg:col-span-2">
              <ReturnsSimulatorCard
                values={state.simulator}
                onChange={(patch) => updateState("simulator", patch)}
              />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
