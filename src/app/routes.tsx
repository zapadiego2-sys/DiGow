import type { RouteObject } from 'react-router';
import { ImportScreen } from '@/features/import/ImportScreen';
import { MaterialsScreen } from '@/features/materials/MaterialsScreen';
import { ClientQuoteScreen } from '@/features/quotes/ClientQuoteScreen';
import { NewQuoteScreen } from '@/features/quotes/NewQuoteScreen';
import { QuoteEditorScreen } from '@/features/quotes/QuoteEditorScreen';
import { QuoteListScreen } from '@/features/quotes/QuoteListScreen';
import { SettingsScreen } from '@/features/settings/SettingsScreen';
import { Shell } from './Shell';

export const routes: RouteObject[] = [
  {
    element: <Shell />,
    children: [
      { path: '/', element: <QuoteListScreen /> },
      { path: '/cotizaciones/nueva', element: <NewQuoteScreen /> },
      { path: '/cotizaciones/importar', element: <ImportScreen /> },
      { path: '/cotizaciones/:id', element: <QuoteEditorScreen /> },
      { path: '/materiales', element: <MaterialsScreen /> },
      { path: '/ajustes', element: <SettingsScreen /> },
    ],
  },
  // Sin navegación: es lo que se imprime para el cliente.
  { path: '/cotizaciones/:id/cliente', element: <ClientQuoteScreen /> },
];
