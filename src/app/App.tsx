import { useState } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { createServices } from './createServices';
import { Providers } from './Providers';
import { PwaUpdatePrompt } from './PwaUpdatePrompt';
import { routes } from './routes';

const router = createBrowserRouter(routes, { basename: import.meta.env.BASE_URL });

export function App() {
  const [services] = useState(createServices);
  return (
    <Providers services={services}>
      <RouterProvider router={router} />
      <PwaUpdatePrompt />
    </Providers>
  );
}
