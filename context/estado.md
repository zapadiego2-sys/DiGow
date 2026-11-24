# Estado

**Fase actual:** tercera etapa construida: costeo administrable (unidades, fórmulas, catálogo de productos y sub-ítems), condiciones con versiones, separación estricta de roles y flujo del analista en dos pasos. `typecheck`, `lint`, `test` (610 pruebas) y `build` pasan. Falta la revisión visual en un navegador.

## Fases

- [x] 1. **Base:** proyecto, herramientas, reglas de arquitectura, tokens, layout y PWA mínima.
- [x] 2. **Dominio:** entidades, calculadoras y pruebas con los valores de `context/dominio.md`.
- [x] 3. **Infraestructura:** contratos, repositorios mock y datos semilla.
- [x] 4. **Componentes:** `shared/ui`.
- [x] 5. **Pantallas:** catálogo, listado, editor, hoja de costos y vista para el cliente.
- [x] 6. **Importación:** lector de `.xlsx`, vista previa y pruebas con `tests/fixtures/cotizacion-ejemplo.xlsx`.
- [x] 7. **Cierre:** sin conexión, instalación, impresión, accesibilidad, revisión con `better-interface` y `README.md` con la guía para reemplazar los mocks por una API.

- [x] 8. **Accesos:** inicio de sesión simulado, usuarios, roles y permisos configurables, super admin.
- [x] 9. **Flujos:** pasos, asignación automática por carga, devolver con motivo, reasignar, historial, "Mis tareas" y carga de trabajo.
- [x] 10. **Configuración:** flujos y plantillas de cotización desde administración; formulario dinámico por plantilla.
- [x] 11. **Inventario:** carga masiva de materiales desde Excel con vista previa y plantilla descargable; búsqueda en el catálogo.
- [x] 12. **Predicción:** sugerencia de costos por ítems parecidos del historial.
- [x] 13. **Roles estrictos:** el cotizador no ve ni escribe valores monetarios y recibe las cotizaciones sin costos; el asesor se autocompleta.
- [x] 14. **Medidas:** unidad por cotización con conversión, medidas estándar por plantilla, unidad y regla de cantidad por material.
- [x] 15. **Fórmulas:** motor propio sin `eval`, catálogo con versiones en administración, línea de costo por fórmula visible en la hoja y en el flujo.
- [x] 16. **Catálogo de productos:** tipos interno, externo e híbrido; sub-ítems ligados o desligados; marca del modelo predictivo.
- [x] 17. **Sub-ítems:** costos propios por sub-ítem y apartado de sub-ítems sugeridos.
- [x] 18. **Condiciones con versiones:** plantillas de condiciones comerciales; la cotización conserva la versión aplicada.
- [x] 19. **Flujo del analista:** Aprobar medidas y Aprobar costos, con validación por paso y cantidades calculadas desde las medidas.

## Pendientes

- Revisar en un navegador las pantallas nuevas (ingreso, mis tareas, panel del flujo, administración, carga de materiales) en móvil y escritorio, y pasarlas por `better-interface`. No se pudo abrir Chrome contra el servidor local en esta sesión.
- Backend: hoy cada navegador tiene sus propios usuarios y cotizaciones, así que el flujo asesor → analista solo se puede probar en un mismo equipo, cambiando de usuario.

- Probar en dispositivos reales: instalación en Android e iOS, y lectores de pantalla. Solo se verificó en Chrome de escritorio sin interfaz, con viewports móviles.
- `npm audit` reporta vulnerabilidades moderadas en dependencias transitivas de `exceljs`, sin versión corregida. Reevaluar la librería si se procesan archivos de terceros no confiables.
- Las preguntas abiertas están en `context/producto.md`.
