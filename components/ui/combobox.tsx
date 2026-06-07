"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  filterOptionsByLabel,
  type ComboboxOption,
} from "@/lib/filter-options";

export interface ComboboxProps
  extends Omit<React.ComponentProps<"input">, "value" | "onChange"> {
  options: ComboboxOption[];
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  emptyMessage?: string;
}

const Combobox = React.forwardRef<HTMLInputElement, ComboboxProps>(
  (
    {
      options,
      value = "",
      onChange,
      onBlur,
      onFocus,
      placeholder = "Cari atau pilih...",
      emptyMessage = "Tidak ada hasil",
      disabled,
      className,
      ...props
    },
    ref
  ) => {
    const innerRef = React.useRef<HTMLInputElement>(null);
    const listRef = React.useRef<HTMLUListElement>(null);
    const listId = React.useId();
    const [open, setOpen] = React.useState(false);
    const [search, setSearch] = React.useState("");
    const [highlightIndex, setHighlightIndex] = React.useState(0);

    const selected = React.useMemo(
      () => options.find((o) => o.value === value),
      [options, value]
    );

    const filtered = React.useMemo(
      () => filterOptionsByLabel(options, search),
      [options, search]
    );

    const setRefs = React.useCallback(
      (node: HTMLInputElement | null) => {
        innerRef.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) ref.current = node;
      },
      [ref]
    );

    React.useEffect(() => {
      setHighlightIndex(0);
    }, [search, filtered.length]);

    React.useEffect(() => {
      if (!open) return;
      const item = listRef.current?.children[highlightIndex] as
        | HTMLElement
        | undefined;
      item?.scrollIntoView({ block: "nearest" });
    }, [highlightIndex, open]);

    function close() {
      setOpen(false);
      setSearch("");
    }

    function selectOption(option: ComboboxOption) {
      onChange?.(option.value);
      close();
      innerRef.current?.focus();
    }

    function handleFocus(e: React.FocusEvent<HTMLInputElement>) {
      setOpen(true);
      setSearch(selected?.searchText ?? selected?.label ?? "");
      requestAnimationFrame(() => {
        const input = innerRef.current;
        input?.select();
      });
      onFocus?.(e);
    }

    function handleBlur(e: React.FocusEvent<HTMLInputElement>) {
      close();
      onBlur?.(e);
    }

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
      setSearch(e.target.value);
      setOpen(true);
      if (!e.target.value.trim()) onChange?.("");
    }

    function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }

      if (!open) {
        if (e.key === "ArrowDown" || e.key === "Enter") {
          setOpen(true);
          e.preventDefault();
        }
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightIndex((i) => Math.min(i + 1, Math.max(filtered.length - 1, 0)));
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightIndex((i) => Math.max(i - 1, 0));
        return;
      }

      if (e.key === "Enter" && filtered[highlightIndex]) {
        e.preventDefault();
        selectOption(filtered[highlightIndex]!);
      }
    }

    const inputValue = open ? search : (selected?.label ?? "");

    return (
      <div className="relative w-full">
        <Input
          ref={setRefs}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          aria-controls={open ? listId : undefined}
          autoComplete="off"
          disabled={disabled}
          placeholder={placeholder}
          value={inputValue}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className={cn("pr-8", className)}
          {...props}
        />
        <ChevronsUpDown
          className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />

        {open && (
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10"
          >
            {filtered.length === 0 ? (
              <li className="px-2 py-2 text-sm text-muted-foreground">
                {emptyMessage}
              </li>
            ) : (
              filtered.map((option, index) => {
                const isSelected = option.value === value;
                const isHighlighted = index === highlightIndex;

                return (
                  <li
                    key={option.value}
                    role="option"
                    aria-selected={isSelected}
                    className={cn(
                      "relative flex cursor-default items-center rounded-md py-1.5 pr-8 pl-2 text-sm outline-none select-none max-sm:py-3 max-sm:pl-3 max-sm:text-base",
                      isHighlighted && "bg-accent text-accent-foreground",
                      !isHighlighted && "hover:bg-accent hover:text-accent-foreground"
                    )}
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => setHighlightIndex(index)}
                    onClick={() => selectOption(option)}
                  >
                    <span className="flex w-full min-w-0 items-center justify-between gap-4">
                      <span className="truncate">{option.label}</span>
                      {option.detail}
                    </span>
                    {isSelected && (
                      <Check className="absolute right-2 size-4" />
                    )}
                  </li>
                );
              })
            )}
          </ul>
        )}
      </div>
    );
  }
);

Combobox.displayName = "Combobox";

export { Combobox };
