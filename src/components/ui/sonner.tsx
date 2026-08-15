import React from "react";
import { useTheme } from "next-themes";
import { Toaster as Sonner, toast as sonnerToast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

// Safe wrapper to avoid rendering [object Object] if callers pass an object
function formatArg(arg: any) {
  if (arg === undefined || arg === null) return arg;
  if (typeof arg === 'string') return arg;

  // Handle native Error instances explicitly
  if (arg instanceof Error) {
    return arg.message || String(arg);
  }

  if (arg && typeof arg === 'object') {
    if (typeof arg.message === 'string') return arg.message;

    // Try JSON.stringify with circular reference handling
    try {
      const seen = new WeakSet();
      const json = JSON.stringify(arg, function (_key, value) {
        if (value && typeof value === 'object') {
          if (seen.has(value)) return '[Circular]';
          seen.add(value);
        }
        return value;
      }, 2);
      if (json && json !== '{}') return json;
    } catch (err) {
      // fallthrough to other attempts
    }

    // Try toString if it provides something useful
    try {
      if (typeof arg.toString === 'function') {
        const s = arg.toString();
        if (s && s !== '[object Object]') return s;
      }
    } catch (e) {
      // ignore
    }

    // As a last resort, produce a shallow key: value preview
    try {
      const keys = Object.keys(arg as Record<string, any>);
      if (keys.length > 0) {
        const pairs = keys.slice(0, 10).map((k) => {
          try { return `${k}: ${String((arg as any)[k])}`; } catch { return `${k}: [unserializable]`; }
        });
        return pairs.join(', ');
      }
    } catch (e) {
      // ignore
    }

    return '[object Object]';
  }

  try { return String(arg); } catch { return '[object]'; }
}

function makeSafe(fn: any) {
  return (...args: any[]) => {
    if (args.length === 0) return fn();
    const first = args[0];
    const rest = args.slice(1);

    // If caller passed an object with title/description, format those fields instead of stringifying whole object
    if (first && typeof first === 'object' && (first.title || first.description)) {
      const safe = { ...first } as any;
      if (safe.title && typeof safe.title !== 'string' && !React.isValidElement(safe.title)) safe.title = formatArg(safe.title);
      if (safe.description && typeof safe.description !== 'string' && !React.isValidElement(safe.description)) safe.description = formatArg(safe.description);
      return fn(safe, ...rest);
    }

    return fn(formatArg(first), ...rest);
  };
}

const toast = ((...args: any[]) => makeSafe(sonnerToast)(...args)) as any;

toast.success = makeSafe(sonnerToast.success);
toast.error = makeSafe(sonnerToast.error);
toast.loading = makeSafe(sonnerToast.loading);

// Support common aliases used across the app
const messageFn = (sonnerToast as any).message ?? sonnerToast;
toast.message = makeSafe(messageFn);
toast.info = makeSafe((sonnerToast as any).info ?? messageFn);
toast.warning = makeSafe((sonnerToast as any).warning ?? messageFn);

toast.dismiss = sonnerToast.dismiss.bind(sonnerToast);

export { Toaster, toast };
