import * as RadixDialog from '@radix-ui/react-dialog';
import type { ReactNode } from 'react';

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
}

export function Dialog({ open, onOpenChange, title, description, children, footer }: DialogProps) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="dialog-overlay fixed inset-0 z-40" />
        <RadixDialog.Content
          {...(description ? {} : { 'aria-describedby': undefined })}
          className="dialog-content fixed z-50 flex w-full max-w-dialog flex-col gap-md overflow-y-auto rounded-lg bg-surface p-lg shadow-floating"
        >
          <RadixDialog.Title className="text-title text-text">{title}</RadixDialog.Title>
          {description ? (
            <RadixDialog.Description className="text-body text-text-muted">
              {description}
            </RadixDialog.Description>
          ) : null}
          {children}
          {footer ? (
            <div className="flex flex-col-reverse gap-sm sm:flex-row sm:justify-end">{footer}</div>
          ) : null}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
