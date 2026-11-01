# Estado

**Fase actual:** MVP terminado. Todas las fases están completas y verificadas.

## Fases

- [x] 1. **Base:** proyecto, herramientas, reglas de arquitectura, tokens, layout y PWA mínima.
- [x] 2. **Dominio:** entidades, calculadoras y pruebas con los valores de `context/dominio.md`.
- [x] 3. **Infraestructura:** contratos, repositorios mock y datos semilla.
- [x] 4. **Componentes:** `shared/ui`.
- [x] 5. **Pantallas:** catálogo, listado, editor, hoja de costos y vista para el cliente.
- [x] 6. **Importación:** lector de `.xlsx`, vista previa y pruebas con `tests/fixtures/cotizacion-ejemplo.xlsx`.
- [x] 7. **Cierre:** sin conexión, instalación, impresión, accesibilidad, revisión con `better-interface` y `README.md` con la guía para reemplazar los mocks por una API.

## Pendientes

- Probar en dispositivos reales: instalación en Android e iOS, y lectores de pantalla. Solo se verificó en Chrome de escritorio sin interfaz, con viewports móviles.
- `npm audit` reporta vulnerabilidades moderadas en dependencias transitivas de `exceljs`, sin versión corregida. Reevaluar la librería si se procesan archivos de terceros no confiables.
- Las preguntas abiertas están en `context/producto.md`.
