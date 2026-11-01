import * as RadixSelect from '@radix-ui/react-select';
import { cn } from '../lib/cn';
import { Icon } from './Icon';
import { inputClass } from './Input';

export interface SelectOption<T extends string> {
  value: T;
  label: string;
}

interface SelectProps<T extends string> {
  id?: string;
  value: T | undefined;
  options: readonly SelectOption<T>[];
  onValueChange: (value: T) => void;
  placeholder?: string;
  disabled?: boolean;
  'aria-label'?: string;
  'aria-invalid'?: true;
  'aria-describedby'?: string;
}

export function Select<T extends string>({
  value,
  options,
  onValueChange,
  placeholder,
  disabled,
  ...triggerProps
}: SelectProps<T>) {
  return (
    <RadixSelect.Root
      value={value ?? ''}
      onValueChange={(next) => onValueChange(next as T)}
      disabled={disabled}
    >
      <RadixSelect.Trigger
        {...triggerProps}
        className={cn(
          inputClass,
          'flex min-h-control items-center justify-between gap-sm text-left data-placeholder:text-text-muted',
        )}
      >
        <span className="truncate">
          <RadixSelect.Value placeholder={placeholder} />
        </span>
        <RadixSelect.Icon>
          <Icon name="chevronDown" />
        </RadixSelect.Icon>
      </RadixSelect.Trigger>
      <RadixSelect.Portal>
        <RadixSelect.Content
          position="popper"
          sideOffset={4}
          className="select-content z-50 overflow-hidden rounded-md border border-border bg-surface shadow-floating"
        >
          <RadixSelect.Viewport className="p-xs">
            {options.map((option) => (
              <RadixSelect.Item
                key={option.value}
                value={option.value}
                className="flex min-h-control cursor-pointer items-center justify-between gap-sm rounded-sm px-cell text-body text-text outline-none select-none data-highlighted:bg-primary-subtle"
              >
                <RadixSelect.ItemText>{option.label}</RadixSelect.ItemText>
                <RadixSelect.ItemIndicator>
                  <Icon name="check" />
                </RadixSelect.ItemIndicator>
              </RadixSelect.Item>
            ))}
          </RadixSelect.Viewport>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  );
}
