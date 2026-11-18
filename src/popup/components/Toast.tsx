import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'neutral';

export interface ToastState {
  message: string;
  type: ToastType;
}

interface ToastProps {
  toast: ToastState | null;
}

export function Toast({ toast }: ToastProps) {
  return (
    <div className="fixed bottom-3 left-0 right-0 flex justify-center pointer-events-none px-4 z-50">
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-[8px] text-[12px] font-medium border shadow-xs pointer-events-auto ${
              toast.type === 'success'
                ? 'bg-[var(--badge-active-bg)] text-[var(--badge-active-text)] border-[var(--badge-active-text)]/30'
                : toast.type === 'error'
                ? 'bg-[var(--color-surface)] text-[var(--color-danger)] border-[var(--color-danger)]/40'
                : 'bg-[var(--badge-open-bg)] text-[var(--badge-open-text)] border-[var(--badge-open-text)]/30'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            ) : toast.type === 'error' ? (
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            ) : (
              <Info className="w-3.5 h-3.5 shrink-0" />
            )}
            <span>{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
