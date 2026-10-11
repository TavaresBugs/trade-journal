"use client";

import { Children, isValidElement, type ComponentProps, type ReactNode } from "react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "./select";

type Props = Omit<ComponentProps<typeof SelectTrigger>, "value" | "onChange" | "children"> & {
  value: string;
  onValueChange: (value: string) => void;
  children: ReactNode;
};

interface ParsedOption {
  value: string;
  label: ReactNode;
  disabled?: boolean;
}

interface ParsedGroup {
  label: ReactNode;
  options: ParsedOption[];
}

type ParsedItem = { isGroup: true; group: ParsedGroup } | { isGroup: false; option: ParsedOption };

/** Retains declarative option lists, with Radix keyboard navigation and typeahead. */
export function OptionSelect({ value, onValueChange, children, disabled, ...props }: Props) {
  const items: ParsedItem[] = Children.toArray(children).flatMap((child): ParsedItem[] => {
    if (isValidElement<ComponentProps<"optgroup">>(child) && child.type === "optgroup") {
      const options: ParsedOption[] = Children.toArray(child.props.children).flatMap(
        (sub): ParsedOption[] => {
          if (!isValidElement<ComponentProps<"option">>(sub)) return [];
          return [
            {
              value: String(sub.props.value ?? sub.props.children),
              label: sub.props.children,
              disabled: sub.props.disabled,
            },
          ];
        },
      );
      return [
        {
          isGroup: true,
          group: {
            label: child.props.label,
            options,
          },
        },
      ];
    }
    if (isValidElement<ComponentProps<"option">>(child)) {
      return [
        {
          isGroup: false,
          option: {
            value: String(child.props.value ?? child.props.children),
            label: child.props.children,
            disabled: child.props.disabled,
          },
        },
      ];
    }
    return [];
  });

  // Encode every option, including the empty-string "All" choice. Radix reserves
  // the empty string for placeholders, not selectable items.
  const encode = (option: string) => `option:${option}`;
  return (
    <Select
      value={encode(value)}
      onValueChange={(next) => onValueChange(next.slice(7))}
      disabled={disabled}
    >
      <SelectTrigger {...props}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((item, idx) => {
          if (!item.isGroup) {
            return (
              <SelectItem
                key={item.option.value}
                value={encode(item.option.value)}
                disabled={item.option.disabled}
              >
                {item.option.label}
              </SelectItem>
            );
          }
          return (
            <SelectGroup key={`group-${idx}`}>
              {item.group.label && <SelectLabel>{item.group.label}</SelectLabel>}
              {item.group.options.map((opt) => (
                <SelectItem key={opt.value} value={encode(opt.value)} disabled={opt.disabled}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectGroup>
          );
        })}
      </SelectContent>
    </Select>
  );
}
