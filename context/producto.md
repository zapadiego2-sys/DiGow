# Producto

PWA para crear, costear y presentar cotizaciones de productos fabricados a medida (carritos, estructuras y piezas de punto de venta). Reemplaza el proceso actual en Excel. La usan gestoras de proyectos.

El MVP es solo frontend, con todos los datos simulados.

## Alcance del MVP

1. **Listado de cotizaciones:** buscar, filtrar por estado (borrador, enviada, aprobada, rechazada), crear y duplicar. Duplicar sirve para armar varias opciones de un mismo proyecto.
2. **Editor de cotización:** cliente, contacto, fecha, proyecto, ítems (producto, descripción, foto, ancho, alto, profundidad, cantidad, valor unitario), condiciones comerciales, forma de pago, validez y tiempo de entrega.
3. **Hoja de costos interna por ítem:** líneas de costo, costo total, precio de venta y utilidad.
4. **Vista para el cliente:** réplica limpia de la cotización, imprimible a PDF con `window.print()` y CSS de impresión.
5. **Catálogo de materiales:** crear y editar materiales y sus precios.
6. **Importar cotización desde `.xlsx`:** elegir un archivo con la estructura de `context/dominio.md`, revisar una vista previa con avisos, corregir y guardar como borrador. El archivo se procesa en el navegador y nunca se guarda completo.
7. **Logo configurable:** una imagen en `public/brand/logo.png` o una URL.
8. **Sugerencia de costos:** a partir de la descripción del ítem, el sistema propone líneas con materiales del catálogo. La gestora acepta o quita cada una; nada entra a la hoja de costos sin su aceptación.

## Fuera del MVP

Backend, autenticación, roles, exportar Excel, importar archivos `.xls` o con otra estructura, sincronización entre dispositivos y envío de correos.

## Por confirmar

- [ ] Nombre de la empresa y rojo oficial. Mientras tanto se usan "Cotizador" y el rojo de `DESIGN.md`.
- [ ] Si otros archivos de cotización tienen la misma estructura que el de referencia. Solo se ha revisado uno.
