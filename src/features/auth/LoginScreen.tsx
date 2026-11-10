import { zodResolver } from '@hookform/resolvers/zod';
import { FormProvider, useForm } from 'react-hook-form';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { z } from 'zod';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Notice } from '@/shared/ui/Notice';
import { BrandLogo } from '../brand/BrandLogo';
import { TextField } from '../forms/fields';
import { errorMessage } from '../services/errorMessages';
import type { SignInState } from './RequireAuth';
import { useSessionQuery, useSignIn } from './useSession';

const schema = z.object({
  email: z.string().trim().min(1, 'Escribe tu correo.'),
  password: z.string().min(1, 'Escribe tu contraseña.'),
});

type SignInForm = z.infer<typeof schema>;

export interface DemoAccount {
  email: string;
  name: string;
  role: string;
}

interface LoginScreenProps {
  /** Cuentas de prueba que se ofrecen mientras la app use datos simulados. */
  demoAccounts?: readonly DemoAccount[];
  demoPassword?: string;
}

export function LoginScreen({ demoAccounts = [], demoPassword }: LoginScreenProps) {
  const session = useSessionQuery();
  const signIn = useSignIn();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as SignInState | null)?.from ?? '/';
  const form = useForm<SignInForm>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  if (session.data) return <Navigate to={from} replace />;

  const submit = form.handleSubmit(async (values) => {
    try {
      await signIn.mutateAsync(values);
      await navigate(from, { replace: true });
    } catch {
      form.setFocus('password');
    }
  });

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background p-md">
      <title>Ingresar · Cotizador</title>
      <div className="flex w-full max-w-dialog flex-col gap-lg">
        <div className="flex flex-col items-center gap-sm text-center">
          <BrandLogo />
          <p className="text-body-sm text-text-muted">
            Cotizaciones a medida, del pedido del asesor al costeo del analista.
          </p>
        </div>
        <Card className="flex flex-col gap-md p-lg">
          <h1 className="text-title">Ingresar</h1>
          {signIn.isError ? (
            <Notice tone="danger" title="No pudimos ingresar">
              <p>{errorMessage(signIn.error)}</p>
            </Notice>
          ) : null}
          <FormProvider {...form}>
            <form onSubmit={submit} noValidate className="flex flex-col gap-md">
              <TextField name="email" label="Correo" type="email" autoComplete="username" />
              <TextField
                name="password"
                label="Contraseña"
                type="password"
                autoComplete="current-password"
              />
              <Button type="submit" variant="primary" disabled={signIn.isPending}>
                {signIn.isPending ? 'Ingresando…' : 'Ingresar'}
              </Button>
            </form>
          </FormProvider>
        </Card>
        {demoAccounts.length > 0 ? (
          <Card className="flex flex-col gap-sm" aria-labelledby="demo-heading">
            <h2 id="demo-heading" className="text-subtitle">
              Usuarios de prueba
            </h2>
            <p className="text-body-sm text-text-muted">
              Son ficticios y la contraseña de todos es <strong>{demoPassword}</strong>. Elige uno
              para llenar el formulario.
            </p>
            <ul className="flex flex-col">
              {demoAccounts.map((account) => (
                <li key={account.email}>
                  <button
                    type="button"
                    className="flex min-h-control w-full flex-col items-start rounded-md px-sm py-xs text-left hover:bg-primary-subtle"
                    onClick={() => {
                      form.setValue('email', account.email);
                      if (demoPassword) form.setValue('password', demoPassword);
                      form.clearErrors();
                    }}
                  >
                    <span className="text-label text-primary">
                      {account.name} · {account.role}
                    </span>
                    <span className="text-caption text-text-muted">{account.email}</span>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
      </div>
    </main>
  );
}
