# Dominio

Los datos de este documento son **ficticios**, porque el sitio y el repositorio pueden ser públicos. La estructura proviene de un archivo real de cotización que no se versiona. No agregues al repositorio nombres, costos, fotos ni archivos reales; `tests/privacy` lo vigila.

`npm run fixtures` genera con `scripts/generate-fixture.mjs`:

- `public/seed/carrito-ejemplo.png`: la foto de los datos semilla.
- `tests/fixtures/cotizacion-ejemplo.xlsx`: el archivo de las pruebas de importación, con la misma estructura y dificultades del real.

## Modelo de costos

Cada línea de costo tiene un `kind`, y el costo del ítem es la suma de todas las líneas:

| `kind` | Cálculo |
|---|---|
| `unit` | cantidad × costo unitario |
| `area` | suma de áreas en cm² × costo por cm² |
| `labor` | días × personas × tarifa diaria |
| `fixed` | valor directo |

El costo unitario de un material se deriva de `precio de compra / factor`. El factor es un número decimal configurable por material (en los datos semilla, 0.5 o 0.75). El costo por cm² de una lámina se calcula dividiendo además por el área de la lámina. Un material también puede tener su costo ingresado directamente, sin factor: es el caso del vinilo (6) y de la lona (4, que en el Excel es 5 × 0.8). El IVA es configurable, por defecto 19 %.

Las áreas son datos ingresados. Se pueden escribir directamente, como los 30.000 cm² del vinilo, o como una suma de medidas, como en el poliestireno.

## Importación del Excel

Estructura del archivo de referencia (hoja `OPCION 3`):

| Dato | Cómo se localiza |
|---|---|
| Cliente, contacto, fecha, proyecto | Etiquetas `Cliente:`, `Contacto:`, `Fecha`, `Proyecto` |
| Ítems | Filas bajo los encabezados `/ PRODUCTO /`, `/ DESCRIPCIÓN /`, `/ ANCHO /`, `/ ALTO /`, `/ PROFUND /`, `/ CANTIDAD /`, `/ VALOR UNIDAD /` |
| Foto | Imagen anclada a la fila del ítem, bajo `FOTO REFERENTE` |
| Líneas de costo | Columnas entre el encabezado `MDF 9MM` y `TOTAL`, con el valor en la fila del ítem |
| Condiciones | Bloque bajo `Condiciones Comerciales:` |
| Pago, validez, entrega | Etiquetas `Forma de pago /`, `Validez de la oferta /`, `Tiempo de entrega /` |

Reglas de conversión:

- Cada línea de costo se importa como `fixed`, con el valor calculado del archivo y su fórmula original como nota. El Excel no indica el `kind`, y la gestora puede cambiarlo después.
- La columna `W` es el precio de venta interno, y `TOTAL` es el costo. El archivo no le pone encabezado a `W`, así que se usa como respaldo el `/ VALOR UNIDAD /` del ítem.
- El alto `80+110` se suma y queda en 190. Una expresión que no se pueda sumar genera un aviso.
- Las celdas fuera de esta tabla se conservan como notas internas (`Revisar "riel"` y la cotización de referencia), con el texto tal como viene en el archivo.
- La nota de cada línea incluye también los valores auxiliares de su columna (fila 12) y los comentarios de sus celdas.
- La gestora se lee bajo `Cordialmente,`.
- Solo sirve como foto una imagen anclada a la fila del ítem y antes de las columnas de costos. El archivo de referencia trae además un logo y una captura de otra cotización, que se ignoran.
- En el archivo de referencia las condiciones están en la misma celda que su etiqueta, como viñetas.
- Importar el archivo de referencia debe reproducir los resultados de la tabla de abajo, excepto la composición de los costos por `kind`.

## Datos semilla

**Cotización:** cliente EMPRESA DEMO, contacto Ana Ejemplo, fecha 2026-01-15, proyecto "Carrito Demo", gestora Laura Prueba (Gestora de proyectos).

**Ítem:** "Carrito de ejemplo", ancho 120, alto 190 (80 + 110), profundidad 70, cantidad 1, foto de ejemplo.

**Descripción:** "Medida: 120 x 80 x 70 profund Alto: 1,9 mt aprox / Mdf 9mm + mdf 12mm + imagen en poliestireno cal 100 + parales en tubo redondo acero inox + lona roja + vinilo + ruedas con freno + bisagras y pasadores"

| Línea | `kind` | Cálculo del Excel | Costo |
|---|---|---|---|
| MDF 9 mm | `unit` | 2 × (90000 / 0.5) | 360,000.00 |
| Poliestireno cal 100 | `area` | (120×80 + 2×80×70) × ((120000 / 0.75) / (100×300)) | 110,933.33 |
| MDF 12 mm (superficie, base y techo) | `unit` | 1 × (120000 / 0.5) | 240,000.00 |
| Tubo acero inox 1" red cal 18 (proveedor Aceros Demo) | `unit` | 1.5 × (60000 / 0.75) | 120,000.00 |
| Lona roja | `area` | 180×140 × (5 × 0.8) | 100,800.00 |
| Vinilo | `area` | 30000 × 6 | 180,000.00 |
| Mano de obra | `labor` | 2 días × 2 personas × 200000 | 800,000.00 |
| Ruedas con freno | `unit` | 4 × (15000 / 0.75) | 80,000.00 |
| Bisagra cápsula con aleta | `unit` | 6 × (3000 / 0.75) | 24,000.00 |
| Pasadores | `unit` | 6 × (4500 / 0.75) | 36,000.00 |
| Otros | `fixed` | 150000 | 150,000.00 |

**Resultados que las pruebas deben reproducir:**

| Concepto | Valor |
|---|---|
| Costo total | 2,201,733.33 |
| Precio de venta unitario | 2,400,000 |
| Utilidad | 198,266.67 |
| Subtotal | 2,400,000 |
| IVA 19 % | 456,000 |
| Total | 2,856,000 |

**Notas internas del ítem:** "Revisar riel"; "Cotización de referencia: para 3 und $1.900.000 / para una unidad $2.000.000".

**Condiciones comerciales por defecto:**
- Los precios incluyen transporte local.
- El tiempo de producción contará a partir de la aprobación por parte del cliente y entrega de artes finales.
- Este trabajo se cotiza para producirse en horarios de producción que no sean festivos. En caso de requerirse, los valores pueden variar.
- Los precios no incluyen el diseño gráfico, en caso de que por un acuerdo de nivel de servicio se solicite, éstos tendrán un costo adicional.
- Si las especificaciones de la producción final cambian con respecto a la cotización previa, se procederá a recotizar según las características del trabajo entregado.
- Luego de 5 días de recibido el trabajo no se aceptarán reclamos.
- Esta cotización está basada en la información suministrada por el cliente, cualquier cambio afectará el valor de la misma.

Forma de pago: "A convenir". Validez: 30 días. Tiempo de entrega: "A convenir".
