"use client";

import * as React from "react";
import { Input as InputPrimitive } from "@base-ui/react/input";
import { cn } from "@/lib/utils";
import {
  RUPIAH_INPUT_PREFIX,
  countDigitsBefore,
  cursorFromDigitCount,
  formatRupiahInput,
} from "@/lib/format";

function digitsFromValue(value: number): string {
  return value > 0 ? String(value) : "";
}

function digitsToValue(digits: string): number {
  const cleaned = digits.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  if (!cleaned) return 0;
  return parseInt(cleaned, 10) || 0;
}

function applyDigitEdit(
  value: number,
  digitStart: number,
  digitEnd: number,
  insert: string
): { value: number; cursorDigits: number } {
  const digits = digitsFromValue(value);
  const inserted = insert.replace(/\D/g, "");
  const newDigits = digits.slice(0, digitStart) + inserted + digits.slice(digitEnd);
  return {
    value: digitsToValue(newDigits),
    cursorDigits: digitStart + inserted.length,
  };
}

export interface InputRupiahProps
  extends Omit<React.ComponentProps<"input">, "value" | "onChange" | "type"> {
  value?: number;
  onChange?: (value: number) => void;
}

const InputRupiah = React.forwardRef<HTMLInputElement, InputRupiahProps>(
  (
    {
      className,
      value = 0,
      onChange,
      disabled,
      readOnly,
      onFocus,
      onClick,
      onKeyDown,
      onPaste,
      ...props
    },
    ref
  ) => {
    const innerRef = React.useRef<HTMLInputElement>(null);
    const pendingCursor = React.useRef<number | null>(null);
    const display = formatRupiahInput(value);

    const setRefs = React.useCallback(
      (node: HTMLInputElement | null) => {
        innerRef.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) ref.current = node;
      },
      [ref]
    );

    React.useLayoutEffect(() => {
      const el = innerRef.current;
      if (!el || pendingCursor.current === null) return;
      const pos = cursorFromDigitCount(display, pendingCursor.current);
      el.setSelectionRange(pos, pos);
      pendingCursor.current = null;
    }, [display, value]);

    function clampSelection(el: HTMLInputElement) {
      const start = el.selectionStart ?? 0;
      const end = el.selectionEnd ?? 0;
      if (start < RUPIAH_INPUT_PREFIX.length || end < RUPIAH_INPUT_PREFIX.length) {
        el.setSelectionRange(
          Math.max(start, RUPIAH_INPUT_PREFIX.length),
          Math.max(end, RUPIAH_INPUT_PREFIX.length)
        );
      }
    }

    function getDigitRange(el: HTMLInputElement) {
      const start = Math.max(el.selectionStart ?? 0, RUPIAH_INPUT_PREFIX.length);
      const end = Math.max(el.selectionEnd ?? 0, RUPIAH_INPUT_PREFIX.length);
      return {
        digitStart: countDigitsBefore(display, start),
        digitEnd: countDigitsBefore(display, end),
      };
    }

    function commit(next: number, cursorDigits: number) {
      pendingCursor.current = cursorDigits;
      onChange?.(next);
    }

    function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
      if (disabled || readOnly) {
        onKeyDown?.(e);
        return;
      }

      const el = e.currentTarget;
      const isModifier = e.ctrlKey || e.metaKey;
      const isNavigation =
        e.key === "Tab" ||
        e.key === "Enter" ||
        e.key === "Escape" ||
        e.key.startsWith("Arrow") ||
        e.key === "Home" ||
        e.key === "End";

      if (e.key === "ArrowLeft" || e.key === "Home") {
        requestAnimationFrame(() => {
          const input = innerRef.current;
          if (input) clampSelection(input);
        });
        onKeyDown?.(e);
        return;
      }

      if (/\d/.test(e.key)) {
        e.preventDefault();
        const { digitStart, digitEnd } = getDigitRange(el);
        const { value: next, cursorDigits } = applyDigitEdit(
          value,
          digitStart,
          digitEnd,
          e.key
        );
        commit(next, cursorDigits);
        onKeyDown?.(e);
        return;
      }

      if (e.key === "Backspace") {
        e.preventDefault();
        const { digitStart, digitEnd } = getDigitRange(el);
        const digits = digitsFromValue(value);

        if (digitStart === digitEnd && digitStart === 0) {
          onKeyDown?.(e);
          return;
        }

        let nextDigits: string;
        let cursorDigits: number;

        if (digitStart !== digitEnd) {
          nextDigits = digits.slice(0, digitStart) + digits.slice(digitEnd);
          cursorDigits = digitStart;
        } else {
          nextDigits = digits.slice(0, digitStart - 1) + digits.slice(digitStart);
          cursorDigits = digitStart - 1;
        }

        commit(digitsToValue(nextDigits), cursorDigits);
        onKeyDown?.(e);
        return;
      }

      if (e.key === "Delete") {
        e.preventDefault();
        const { digitStart, digitEnd } = getDigitRange(el);
        const digits = digitsFromValue(value);

        if (digitStart === digitEnd && digitStart >= digits.length) {
          onKeyDown?.(e);
          return;
        }

        let nextDigits: string;
        let cursorDigits: number;

        if (digitStart !== digitEnd) {
          nextDigits = digits.slice(0, digitStart) + digits.slice(digitEnd);
          cursorDigits = digitStart;
        } else {
          nextDigits = digits.slice(0, digitStart) + digits.slice(digitStart + 1);
          cursorDigits = digitStart;
        }

        commit(digitsToValue(nextDigits), cursorDigits);
        onKeyDown?.(e);
        return;
      }

      if (
        e.key.length === 1 &&
        !isNavigation &&
        !isModifier
      ) {
        e.preventDefault();
      }

      onKeyDown?.(e);
    }

    function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
      if (disabled || readOnly) {
        onPaste?.(e);
        return;
      }

      e.preventDefault();
      const pasted = e.clipboardData.getData("text").replace(/\D/g, "");
      if (!pasted) return;

      const { digitStart, digitEnd } = getDigitRange(e.currentTarget);
      const { value: next, cursorDigits } = applyDigitEdit(
        value,
        digitStart,
        digitEnd,
        pasted
      );
      commit(next, cursorDigits);
      onPaste?.(e);
    }

    function handleFocus(e: React.FocusEvent<HTMLInputElement>) {
      requestAnimationFrame(() => {
        const input = innerRef.current;
        if (!input) return;
        if ((input.selectionStart ?? 0) < RUPIAH_INPUT_PREFIX.length) {
          input.setSelectionRange(input.value.length, input.value.length);
        }
      });
      onFocus?.(e);
    }

    function handleClick(e: React.MouseEvent<HTMLInputElement>) {
      requestAnimationFrame(() => {
        const input = innerRef.current;
        if (input) clampSelection(input);
      });
      onClick?.(e);
    }

    function handleSelect() {
      requestAnimationFrame(() => {
        const input = innerRef.current;
        if (input) clampSelection(input);
      });
    }

    return (
      <InputPrimitive
        ref={setRefs}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        data-slot="input-rupiah"
        disabled={disabled}
        readOnly={readOnly}
        value={display}
        onChange={() => {}}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onFocus={handleFocus}
        onClick={handleClick}
        onSelect={handleSelect}
        className={cn(
          "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
          className
        )}
        {...props}
      />
    );
  }
);

InputRupiah.displayName = "InputRupiah";

export { InputRupiah };
