import { Suspense } from "react";
import { FilterBar } from "@/components/filter-bar";
import { QuantCalculator } from "@/components/calculator/quant-calculator";

export default function CalculatorPage() {
  return (
    <Suspense>
      <div>
        <FilterBar title="Calculator" />
        <div className="p-4 md:p-6">
          <QuantCalculator />
        </div>
      </div>
    </Suspense>
  );
}
