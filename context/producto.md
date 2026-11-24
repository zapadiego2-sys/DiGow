# Producto

PWA para crear, costear y presentar cotizaciones de productos fabricados a medida (carritos, estructuras y piezas de punto de venta). Reemplaza el proceso actual en Excel.

La usan tres roles iniciales: el **cotizador (asesor)** registra la cotización básica; el **analista de cotizaciones** la recibe, arma la hoja de costos y mantiene el inventario de materiales; el **super admin** administra usuarios, roles, flujos y plantillas.

Sigue siendo solo frontend, con todos los datos simulados en el navegador. El inicio de sesión y los roles se pueden probar en un dispositivo, pero no protegen datos ni se comparten entre equipos hasta que exista un backend.

## Alcance del MVP

1. **Listado de cotizaciones:** buscar, filtrar por estado (borrador, enviada, aprobada, rechazada), crear y duplicar. Duplicar sirve para armar varias opciones de un mismo proyecto.
2. **Editor de cotización:** cliente, contacto, fecha, proyecto, ítems (producto, descripción, foto, ancho, alto, profundidad, cantidad, valor unitario), condiciones comerciales, forma de pago, validez y tiempo de entrega.
3. **Hoja de costos interna por ítem:** líneas de costo, costo total, precio de venta y utilidad.
4. **Vista para el cliente:** réplica limpia de la cotización, imprimible a PDF con `window.print()` y CSS de impresión.
5. **Catálogo de materiales:** crear y editar materiales y sus precios.
6. **Importar cotización desde `.xlsx`:** elegir un archivo con la estructura de `context/dominio.md`, revisar una vista previa con avisos, corregir y guardar como borrador. El archivo se procesa en el navegador y nunca se guarda completo.
7. **Logo configurable:** una imagen en `public/brand/logo.png` o una URL.
8. **Sugerencia de costos:** busca ítems parecidos en cotizaciones anteriores (por descripción y medidas, en la misma unidad), muestra su costo de entonces y con los precios de hoy, y propone sus líneas recalculadas con las medidas del ítem. Completa con los materiales del catálogo que nombra la descripción. Si el parecido tenía sub-ítems, o el catálogo liga sub-ítems al producto, los muestra en un apartado especial. Solo usa y sugiere ítems marcados para el modelo predictivo. Nada entra a la hoja de costos sin aceptarlo.
9. **Inicio de sesión simulado** con usuarios de prueba, y cierre de sesión.
10. **Roles y permisos configurables:** el super admin crea roles y elige sus permisos. El rol de super admin tiene todos y no se puede editar; siempre queda al menos un super admin activo.
11. **Usuarios:** crear, editar, cambiar contraseña, cambiar rol y desactivar.
12. **Flujos y pasos:** cada cotización recorre los pasos de un flujo (por defecto: Solicitud → Costeo → Revisión y envío). Solo el responsable del paso edita; puede enviarla al siguiente paso o devolverla al anterior con un motivo. El historial queda registrado. Al terminar el flujo, la cotización pasa sola a "Enviada".
13. **Asignación automática:** cada paso se asigna a quien creó la cotización o, según se configure, a la persona activa del rol con menos tareas abiertas. Quien gestiona flujos puede reasignar y ve la carga de trabajo.
14. **Configuración de flujos:** el super admin crea flujos, ordena sus pasos, elige rol y forma de asignación, y marca uno por defecto.
15. **Plantillas de cotización:** el super admin define por plantilla los campos propios del proyecto (texto, número, fecha, lista, sí o no; obligatorios o no; visibles o no para el cliente), las medidas de cada ítem, las condiciones por defecto y el flujo. Al crear una cotización se elige la plantilla y el formulario se arma con ella.
16. **Carga masiva de materiales:** el analista descarga una plantilla de Excel, la llena y revisa una vista previa por fila antes de cargar. Un material con el mismo nombre se actualiza.
17. **Mis tareas:** la pantalla de inicio muestra las cotizaciones asignadas, la más antigua primero.
18. **Separación de roles:** el cotizador registra la solicitud sin valores monetarios: no ve la hoja de costos, el valor unitario ni el IVA, y la pantalla recibe la cotización sin costos ni notas internas. Ve en solo lectura el precio aprobado.
19. **Asesor autocompletado:** al crear una cotización, el asesor y su cargo son el usuario en sesión. Solo el permiso "Cambiar el asesor" permite editarlos.
20. **Medidas homogéneas:** todas las medidas de una cotización usan una unidad (mm, cm o m), que viene de la plantilla y se puede cambiar convirtiendo los valores. La plantilla trae medidas estándar que se copian al ítem y se pueden editar.
21. **Unidades del material:** cada material indica la unidad de su costo (unidad, cm², m², cm lineal o metro lineal) y la regla para desprender la cantidad de las medidas del ítem (ancho × alto, superficie de la caja, perímetro, un lado o manual).
22. **Fórmulas de costo:** el super admin crea fórmulas con variables de medidas, cantidad, costo del material y parámetros propios. El analista las aplica como líneas de costo; la línea guarda la versión aplicada y la fórmula se ve en la hoja de costos y en el panel del flujo.
23. **Catálogo de productos:** productos internos, externos o híbridos, y sub-ítems ligados a un producto o desligados, cada uno con la marca "aplica para el modelo predictivo".
24. **Sub-ítems:** cada ítem puede tener sub-ítems con su propia hoja de costos. Son internos.
25. **Condiciones comerciales con versiones:** plantillas administrables; editar publica una versión nueva y cada cotización conserva la suya, con aviso si hay una más reciente.
26. **Flujo del analista en dos pasos:** Aprobar medidas (producto, tipo, cantidad y medidas completas) y Aprobar costos (además, hoja de costos y precio). El sistema no deja avanzar con datos faltantes y calcula las cantidades desde las medidas para que el analista solo las apruebe.

## Fuera del MVP

Backend, autenticación real, sincronización entre dispositivos, exportar Excel, importar archivos `.xls` o con otra estructura, existencias de inventario (cantidades y movimientos), costos por defecto en el catálogo de productos, notificaciones y envío de correos.

## Por confirmar

- [ ] Nombre de la empresa y rojo oficial. Mientras tanto se usan "Cotizador" y el rojo de `DESIGN.md`.
- [ ] Si otros archivos de cotización tienen la misma estructura que el de referencia. Solo se ha revisado uno.
- [ ] Backend para el inicio de sesión real y para compartir cotizaciones entre asesores y analistas. Mientras tanto todo se simula en el navegador.
