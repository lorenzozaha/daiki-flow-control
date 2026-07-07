## Objetivo

Dar al **autorizador** (y admin) visibilidad de todas las órdenes de la empresa desde el Dashboard, en una vista navegable y optimizada para móvil — sin necesidad de exportar el CSV.

## Alcance

Cambio **solo de frontend**, en `src/pages/Dashboard.tsx`. No se tocan RLS, edge functions ni esquema: el autorizador ya puede leer todas las órdenes de su empresa por RLS, y el Dashboard ya las carga en `ordenes` para el periodo seleccionado.

## Cambios

### 1. Nueva pestaña "Órdenes" en el `Tabs` del Dashboard

- Añadir un cuarto `TabsTrigger` llamado **"Órdenes"** (solo visible para `autorizador` o `admin`; para verificador/contador se oculta porque ya tienen su propia bandeja y su vista de dashboard es más limitada).
- `TabsList` pasa a `grid-cols-4` cuando el rol lo permite; `grid-cols-3` en caso contrario.

### 2. Contenido de la pestaña

Reutiliza el array `ordenes` ya cargado por el rango de fechas del Dashboard. Añade:

- **Barra de filtros** (sticky en móvil):
  - Buscador de texto (folio, concepto, proveedor).
  - Select de estatus (Todos / Borrador / En revisión / En autorización / Aprobada / Rechazada / Devuelta / Revocada / Pagada).
  - Select de departamento (poblado desde los departamentos presentes en `ordenes`).
  - Botón "Exportar CSV" reutilizando `exportarOrdenesCSV()` aplicado al set filtrado (pequeña refactorización: la función recibe el arreglo a exportar).
- **Contador**: "N órdenes · Total $X · Aprobado $Y".
- **Vista desktop (`md:`)**: tabla con columnas Folio, Fecha, Concepto, Depto, Categoría, Monto, Estatus, Capturista. Cada fila enlaza a `/ordenes/:id`.
- **Vista móvil**: lista de tarjetas (patrón idéntico al de `MisOrdenes.tsx`) con folio + concepto + depto + fecha + monto + `StatusBadge`, tap → `/ordenes/:id`.
- Ordenamiento por fecha descendente (por defecto).

### 3. Aviso de periodo

Nota corta arriba de la lista: "Mostrando órdenes de {desde} – {hasta}. Ajusta el rango de fechas arriba para ampliar." — así el autorizador entiende que el filtro de fecha global también aplica aquí.

## Notas técnicas

- No hay refetch adicional: se filtra en memoria el `ordenes` ya cargado.
- Se reutilizan `StatusBadge`, `fmtMXN`, `fmtFechaCorta` y el `Input`/`Select` de shadcn.
- La visibilidad de la pestaña se resuelve con `hasRole("autorizador") || hasRole("admin")` (del `useAuth` ya presente).
- El acceso RLS ya está permitido; no requiere migración.

## Fuera de alcance

- No se toca la bandeja de autorización ni el flujo de aprobación.
- No se añade paginación (el volumen del periodo es acotado); se puede añadir después si crece.
