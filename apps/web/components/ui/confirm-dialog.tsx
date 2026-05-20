'use client';

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      className="fixed inset-0 z-[70] flex items-center justify-center bg-[rgba(26,43,46,0.55)] px-4"
      onClick={onCancel}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="w-[360px] max-w-[90vw] rounded-[10px] border border-[#e8efee] bg-white p-6 shadow-[0_12px_32px_rgba(26,43,46,0.18)]"
      >
        <h2 id="confirm-dialog-title" className="text-[16px] font-semibold text-[var(--color-charcoal)]">
          {title}
        </h2>
        <p className="mb-5 mt-2 text-[13px] text-[#5a6b6e]">{body}</p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="cursor-pointer rounded-[6px] border border-[#e8efee] bg-white px-4 py-2 text-[13px] font-medium text-[var(--color-charcoal)] hover:border-[var(--color-mid-gray)]"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`cursor-pointer rounded-[6px] px-4 py-2 text-[13px] font-semibold text-white ${
              destructive ? 'bg-[var(--color-coral)] hover:opacity-90' : 'bg-[var(--color-teal)] hover:bg-[var(--color-teal-dark)]'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
