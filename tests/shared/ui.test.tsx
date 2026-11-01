import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { formatDate, formatMoney, parseDecimal, parseMoney } from '@/shared/lib/format';
import { DataTable } from '@/shared/ui/DataTable';
import { Dialog } from '@/shared/ui/Dialog';
import { FormField } from '@/shared/ui/FormField';
import { Input } from '@/shared/ui/Input';
import { MoneyField, NumberField } from '@/shared/ui/NumberField';
import { Select } from '@/shared/ui/Select';
import { ToastProvider, useToast } from '@/shared/ui/Toast';

const normalizeSpaces = (text: string) => text.replace(/\s/g, ' ');

describe('formato', () => {
  it('muestra pesos es-CO sin decimales', () => {
    expect(normalizeSpaces(formatMoney(2400000))).toBe('$ 2.400.000');
    expect(normalizeSpaces(formatMoney(2201733.3333))).toBe('$ 2.201.733');
  });

  it('muestra un guion si el dato falta', () => {
    expect(formatMoney(null)).toBe('—');
  });

  it('la fecha no cambia de día por la zona horaria', () => {
    expect(formatDate('2026-01-15')).toBe('15 de enero de 2026');
  });

  it.each([
    ['0,55', 0.55],
    ['0.55', 0.55],
    ['5', 5],
    ['1,', 1],
  ])('interpreta el decimal %s', (text, value) => expect(parseDecimal(text)).toBe(value));

  it.each(['abc', '1,2,3', '-1', ''])('rechaza el decimal %j', (text) =>
    expect(parseDecimal(text)).toBeNull(),
  );

  it.each([
    ['2.400.000', 2400000],
    ['$ 2.400.000', 2400000],
    ['2400000,5', 2400000.5],
  ])('interpreta el dinero %s', (text, value) => expect(parseMoney(text)).toBe(value));
});

function Controlled({ initial, spy }: { initial: number | null; spy: (v: number | null) => void }) {
  const [value, setValue] = useState(initial);
  return (
    <MoneyField
      aria-label="Valor"
      value={value}
      onChange={(next) => {
        setValue(next);
        spy(next);
      }}
    />
  );
}

describe('campos numéricos', () => {
  it('formatea, y al enfocar sin cambiar no altera el valor', async () => {
    const user = userEvent.setup();
    const spy = vi.fn();
    render(<Controlled initial={181818.18181818179} spy={spy} />);
    const input = screen.getByRole<HTMLInputElement>('textbox', { name: 'Valor' });
    expect(normalizeSpaces(input.value)).toBe('$ 181.818');
    await user.click(input);
    expect(input.value).toBe('181818,1818181818');
    await user.tab();
    expect(spy).not.toHaveBeenCalled();
    expect(normalizeSpaces(input.value)).toBe('$ 181.818');
  });

  it('entrega el número al escribir y null al vaciar', async () => {
    const user = userEvent.setup();
    const spy = vi.fn();
    render(<Controlled initial={null} spy={spy} />);
    const input = screen.getByRole('textbox', { name: 'Valor' });
    await user.type(input, '2.400.000');
    expect(spy).toHaveBeenLastCalledWith(2400000);
    await user.clear(input);
    expect(spy).toHaveBeenLastCalledWith(null);
  });

  it('NumberField trata el punto como decimal', async () => {
    const user = userEvent.setup();
    const spy = vi.fn();
    render(<NumberField aria-label="Factor" value={null} onChange={spy} />);
    await user.type(screen.getByRole('textbox', { name: 'Factor' }), '1.125');
    expect(spy).toHaveBeenLastCalledWith(1.125);
  });
});

describe('FormField', () => {
  it('enlaza etiqueta, ayuda y error', () => {
    render(
      <FormField label="Cliente" hint="Ayuda" error="Obligatorio">
        {(control) => <Input {...control} />}
      </FormField>,
    );
    const input = screen.getByRole('textbox', { name: 'Cliente' });
    expect(input).toBeInvalid();
    expect(input).toHaveAccessibleDescription('Ayuda Obligatorio');
  });
});

describe('Select', () => {
  it('permite elegir una opción', async () => {
    const user = userEvent.setup();
    const spy = vi.fn();
    render(
      <Select
        aria-label="Estado"
        value="a"
        onValueChange={spy}
        options={[
          { value: 'a', label: 'Uno' },
          { value: 'b', label: 'Dos' },
        ]}
      />,
    );
    await user.click(screen.getByRole('combobox', { name: 'Estado' }));
    await user.click(await screen.findByRole('option', { name: 'Dos' }));
    expect(spy).toHaveBeenCalledWith('b');
  });
});

describe('Dialog', () => {
  it('muestra título y descripción, y se cierra con Escape', async () => {
    const user = userEvent.setup();
    const spy = vi.fn();
    render(<Dialog open title="Confirmar" description="¿Seguro?" onOpenChange={spy} />);
    expect(screen.getByRole('dialog', { name: 'Confirmar' })).toHaveAccessibleDescription(
      '¿Seguro?',
    );
    await user.keyboard('{Escape}');
    expect(spy).toHaveBeenCalledWith(false);
  });
});

describe('DataTable', () => {
  it('muestra la misma información como tabla y como tarjetas', () => {
    render(
      <DataTable
        caption="Datos"
        rows={[{ id: '1', name: 'Fila' }]}
        rowKey={(row) => row.id}
        columns={[{ key: 'name', header: 'Nombre', cell: (row) => row.name }]}
      />,
    );
    expect(
      within(screen.getByRole('table', { hidden: true })).getByText('Fila'),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('list', { name: 'Datos' })).getByText('Fila'),
    ).toBeInTheDocument();
  });
});

describe('Toast', () => {
  it('anuncia un mensaje', async () => {
    const user = userEvent.setup();
    function Trigger() {
      const toast = useToast();
      return <button onClick={() => toast({ tone: 'success', text: 'Guardado' })}>Lanzar</button>;
    }
    render(
      <ToastProvider closeLabel="Cerrar" regionLabel="Notificaciones">
        <Trigger />
      </ToastProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'Lanzar' }));
    expect(await screen.findAllByText('Guardado')).not.toHaveLength(0);
  });
});
