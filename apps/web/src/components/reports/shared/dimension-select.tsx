"use client";

import { Field, fieldClass } from "@/components/filter-fields";
import { OptionSelect } from "@/components/ui/option-select";
import { DIMENSIONS, type Dimension } from "@luxalgo/journal-core";

export function DimensionSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Dimension;
  onChange: (d: Dimension) => void;
}) {
  return (
    <Field label={label}>
      <OptionSelect
        className={fieldClass}
        value={value}
        onValueChange={(next) => onChange(next as Dimension)}
      >
        {Object.entries(DIMENSIONS).map(([key, label]) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </OptionSelect>
    </Field>
  );
}
