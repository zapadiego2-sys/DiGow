import { Button } from './Button';
import { Dialog } from './Dialog';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Solo para acciones destructivas. */
export function ConfirmDialog(props: ConfirmDialogProps) {
  const { open, title, description, confirmLabel, cancelLabel, onConfirm, onCancel } = props;
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
      title={title}
      description={description}
      footer={
        <>
          <Button onClick={onCancel}>{cancelLabel}</Button>
          <Button variant="danger" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    />
  );
}
