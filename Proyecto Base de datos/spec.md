# Especificación técnica — API de Gestión de Inventario SION

**Versión:** 1.1.0  
**Estado:** Especificación para desarrollo del MVP  
**Proyecto:** SION — Gestión de inventario para marca de ropa  
**Autor:** Jean Paul Marchant Lillo  
**Tecnologías obligatorias:** Node.js, Express, MongoDB Atlas, Mongoose, Postman, Swagger/OpenAPI, Jest, Supertest y OpenTelemetry  

---

## 1. Propósito del documento

Este documento define los requisitos funcionales, técnicos y de aceptación para construir una API REST de gestión de inventario para la marca de ropa **SION**.

La API deberá centralizar la administración de productos, variantes, stock y movimientos de inventario. Además, el MVP incorporará un módulo de **ubicación en tiempo real para un único usuario autorizado**, sin implementar un sistema avanzado de cuentas o roles.

La especificación servirá como guía única para el desarrollo, las pruebas y la entrega académica del proyecto.

---

## 2. Objetivo general

Desarrollar una API REST modular y escalable que permita:

- Administrar productos de ropa.
- Administrar variantes por talla y color.
- Mantener stock independiente por variante.
- Registrar entradas, salidas y ajustes de inventario.
- Conservar trazabilidad de todos los cambios de stock.
- Consultar stock bajo y un resumen básico del inventario.
- Consultar y actualizar la ubicación en tiempo real de un solo usuario autorizado.
- Persistir toda la información en MongoDB Atlas.
- Documentar todos los endpoints mediante OpenAPI y Swagger UI.
- Incorporar trazas y métricas con OpenTelemetry.
- Mantener una cobertura automatizada mínima del 80 %.

---

## 3. Alcance del MVP

### 3.1 Funcionalidades incluidas

El MVP debe incluir obligatoriamente:

1. API REST versionada bajo `/api/v1`.
2. Conexión a MongoDB Atlas mediante Mongoose.
3. CRUD de productos.
4. Gestión de variantes por talla y color.
5. SKU único por variante.
6. Stock independiente por variante.
7. Registro de movimientos de tipo:
   - `ENTRADA`
   - `SALIDA`
   - `AJUSTE`
8. Validación para impedir stock negativo.
9. Historial auditable de movimientos.
10. Desactivación lógica de productos y variantes.
11. Filtros y paginación básica.
12. Consulta de variantes con stock bajo.
13. Resumen básico de inventario.
14. Módulo de ubicación en tiempo real para **un único usuario**.
15. Canal WebSocket para emitir cambios de ubicación.
16. Protección mínima del módulo de ubicación mediante una API Key.
17. Manejo uniforme de errores.
18. Pruebas manuales mediante Postman.
19. Pruebas automatizadas con Jest y Supertest.
20. Cobertura mínima global del 80 % en líneas, funciones, ramas y sentencias.
21. Contrato OpenAPI y documentación interactiva con Swagger UI.
22. Observabilidad mediante OpenTelemetry para trazas y métricas.
23. Documentación de instalación y uso.

### 3.2 Funcionalidades fuera del MVP

No se incluyen en esta versión:

- Frontend o panel web.
- Aplicación móvil.
- Registro de usuarios.
- Inicio de sesión con JWT.
- Roles y permisos avanzados.
- Recuperación de contraseña.
- Integración con e-commerce.
- Integración con pagos o facturación.
- Notificaciones automáticas por correo, SMS o WhatsApp.
- Múltiples sucursales o bodegas.
- Reportes BI avanzados.
- Carga física de imágenes.
- Historial de recorridos o rutas del usuario.
- Geocodificación inversa de coordenadas a direcciones.
- Seguimiento de más de un usuario.
- Plataforma comercial de APM obligatoria; el backend de observabilidad será configurable.
- Alertas automáticas basadas en métricas o trazas.
- Exportación de logs mediante OpenTelemetry en el MVP; se mantendrán logs de aplicación con correlación de trazas.

---

## 4. Usuarios del sistema

### 4.1 Administrador o encargado de inventario

Puede utilizar la API mediante Postman o una futura interfaz para:

- Crear y modificar productos.
- Crear y modificar variantes.
- Registrar entradas, salidas y ajustes.
- Consultar stock e historial.
- Desactivar productos y variantes.

### 4.2 Usuario principal de ubicación

El MVP tendrá solo un usuario rastreable, identificado internamente mediante una variable de entorno:

```env
TRACKING_USER_ID=usuario-principal
```

No se permitirá enviar un identificador de usuario diferente desde el cliente. La API siempre asociará la ubicación al usuario configurado.

---

## 5. Reglas de negocio

### 5.1 Productos

1. Todo producto debe tener nombre, categoría y precio.
2. El precio debe ser un número mayor o igual a cero.
3. El nombre debe tener entre 2 y 120 caracteres.
4. La descripción puede ser opcional y tener un máximo de 1.000 caracteres.
5. Un producto nuevo queda activo por defecto.
6. Un producto no se elimina físicamente; se desactiva mediante `activo: false`.
7. Un producto desactivado no acepta nuevos movimientos de stock.
8. La edición del producto no puede modificar directamente el stock.

### 5.2 Variantes

1. Cada variante pertenece a un producto.
2. Cada variante debe tener:
   - SKU.
   - Talla.
   - Color.
   - Stock mínimo.
3. El SKU debe ser único en todo el sistema.
4. No puede repetirse la combinación talla + color dentro del mismo producto.
5. El stock y el stock mínimo deben ser números enteros mayores o iguales a cero.
6. Una variante nueva inicia con stock `0`.
7. El stock inicial debe registrarse posteriormente mediante un movimiento de `ENTRADA`.
8. Una variante no se elimina físicamente; se desactiva.
9. Una variante desactivada no acepta movimientos de stock.
10. El stock no se modifica desde el endpoint de edición de variantes.

### 5.3 Movimientos de inventario

1. Toda modificación de stock debe generar un movimiento.
2. Las cantidades deben ser enteros mayores que cero.
3. Una `SALIDA` no puede superar el stock disponible.
4. El stock nunca puede quedar negativo.
5. Una `ENTRADA` aumenta el stock.
6. Una `SALIDA` disminuye el stock.
7. Un `AJUSTE` establece un stock objetivo definido por el usuario.
8. El motivo es obligatorio en los ajustes.
9. El motivo es opcional en entradas y salidas.
10. El movimiento debe registrar:
    - Producto.
    - Variante.
    - SKU.
    - Tipo.
    - Cantidad afectada.
    - Stock anterior.
    - Stock nuevo.
    - Motivo.
    - Fecha.
11. El movimiento no se puede editar ni eliminar después de crearse.
12. La actualización del stock y la creación del movimiento deben ejecutarse dentro de una transacción de MongoDB.

### 5.4 Stock bajo

Una variante se considera con stock bajo cuando:

```text
stock <= stockMinimo
```

Una variante se considera agotada cuando:

```text
stock === 0
```

### 5.5 Ubicación en tiempo real

1. Solo se administrará la ubicación de un usuario configurado.
2. El cliente enviará coordenadas periódicamente a la API.
3. La API almacenará únicamente la última ubicación conocida.
4. No se almacenará historial de recorridos en el MVP.
5. Las coordenadas usarán formato GeoJSON:

```json
{
  "type": "Point",
  "coordinates": [-70.6483, -33.4569]
}
```

6. El orden debe ser `[longitud, latitud]`.
7. La latitud debe estar entre `-90` y `90`.
8. La longitud debe estar entre `-180` y `180`.
9. Cada actualización debe incluir la fecha de captura.
10. La API debe guardar la fecha de recepción en el servidor.
11. La precisión debe ser positiva cuando sea enviada.
12. El endpoint de ubicación debe exigir la cabecera `X-API-Key`.
13. La API Key se compara con `TRACKING_API_KEY` definida en `.env`.
14. Después de guardar una ubicación, el servidor debe emitir el evento WebSocket `ubicacion:actualizada`.
15. Si la última posición tiene más de 2 minutos, debe informarse como `DESACTUALIZADA`.
16. Si el usuario deja de compartir ubicación, el estado será `INACTIVA`.
17. No se publicarán las coordenadas en logs de producción.
18. El servidor podrá rechazar actualizaciones demasiado frecuentes con `429 Too Many Requests`.
19. Frecuencia recomendada del cliente: una actualización cada 5 a 15 segundos.
20. La API no obtiene la ubicación por sí sola; depende de que un dispositivo cliente envíe las coordenadas.

---

## 6. Arquitectura propuesta

La aplicación seguirá una arquitectura modular por capas:

```text
Cliente / Postman / futura aplicación móvil
                |
                v
           Rutas Express
                |
                v
         Controladores HTTP
                |
                v
         Servicios de negocio
                |
                v
     Modelos Mongoose / MongoDB Atlas
```

Para ubicación en tiempo real:

```text
Dispositivo del usuario
        |
        | PATCH /api/v1/ubicacion
        v
Servicio de ubicación
        |
        +--> MongoDB Atlas: última ubicación
        |
        +--> Socket.IO: evento ubicacion:actualizada
```

Para documentación y observabilidad:

```text
OpenAPI YAML ---> Swagger UI ---> /api-docs

API SION ---> OpenTelemetry SDK ---> OTLP/HTTP ---> OpenTelemetry Collector o backend compatible
```

OpenTelemetry debe inicializarse antes de cargar Express, Mongoose y las demás bibliotecas instrumentadas.

### 6.1 Estructura de carpetas

```text
sion-inventory-api/
├── docs/
│   └── openapi.yaml
├── src/
│   ├── config/
│   │   ├── database.js
│   │   ├── socket.js
│   │   └── swagger.js
│   ├── observability/
│   │   ├── telemetry.js
│   │   ├── metrics.js
│   │   └── tracing.js
│   ├── controllers/
│   │   ├── producto.controller.js
│   │   ├── variante.controller.js
│   │   ├── inventario.controller.js
│   │   ├── movimiento.controller.js
│   │   └── ubicacion.controller.js
│   ├── middlewares/
│   │   ├── apiKey.middleware.js
│   │   ├── errorHandler.middleware.js
│   │   ├── notFound.middleware.js
│   │   ├── rateLimit.middleware.js
│   │   └── validarObjectId.middleware.js
│   ├── models/
│   │   ├── Producto.js
│   │   ├── Movimiento.js
│   │   └── Ubicacion.js
│   ├── routes/
│   │   ├── producto.routes.js
│   │   ├── inventario.routes.js
│   │   ├── movimiento.routes.js
│   │   ├── ubicacion.routes.js
│   │   └── index.js
│   ├── services/
│   │   ├── producto.service.js
│   │   ├── inventario.service.js
│   │   ├── movimiento.service.js
│   │   └── ubicacion.service.js
│   ├── validators/
│   │   ├── producto.validator.js
│   │   ├── variante.validator.js
│   │   ├── movimiento.validator.js
│   │   └── ubicacion.validator.js
│   ├── utils/
│   │   ├── ApiError.js
│   │   ├── asyncHandler.js
│   │   └── response.js
│   └── app.js
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── helpers/
│   └── setup.js
├── coverage/
├── .env
├── .env.example
├── .gitignore
├── jest.config.js
├── package.json
├── server.js
├── README.md
└── spec.md
```

---

## 7. Tecnologías y dependencias

### 7.1 Dependencias de producción

```bash
npm install express mongoose dotenv cors morgan helmet express-rate-limit socket.io swagger-ui-express yaml
```

Para validación se utilizará `zod`:

```bash
npm install zod
```

Para instrumentación y exportación de trazas y métricas se instalará:

```bash
npm install @opentelemetry/api @opentelemetry/sdk-node \
  @opentelemetry/auto-instrumentations-node \
  @opentelemetry/exporter-trace-otlp-http \
  @opentelemetry/exporter-metrics-otlp-http \
  @opentelemetry/resources @opentelemetry/semantic-conventions
```

### 7.2 Dependencias de desarrollo

```bash
npm install --save-dev nodemon jest supertest
```

### 7.3 Tecnologías obligatorias

- Node.js.
- Express.
- MongoDB Atlas.
- Mongoose.
- Socket.IO.
- Postman.
- Swagger UI y OpenAPI 3.1.
- Jest y Supertest.
- OpenTelemetry con exportación OTLP.

---

## 8. Variables de entorno

El archivo `.env` debe contener:

```env
PORT=3000
NODE_ENV=development
MONGODB_URI=mongodb+srv://USUARIO:CONTRASENA@CLUSTER.mongodb.net/sion_inventory
CORS_ORIGIN=http://localhost:3000
TRACKING_USER_ID=usuario-principal
TRACKING_API_KEY=cambiar_por_clave_segura
LOCATION_STALE_SECONDS=120
LOCATION_MIN_INTERVAL_SECONDS=5

# OpenTelemetry
OTEL_ENABLED=true
OTEL_SERVICE_NAME=sion-inventory-api
OTEL_SERVICE_VERSION=1.1.0
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
OTEL_TRACES_SAMPLER=parentbased_traceidratio
OTEL_TRACES_SAMPLER_ARG=1.0
OTEL_METRIC_EXPORT_INTERVAL=60000
# OTEL_EXPORTER_OTLP_HEADERS=api-key=valor_opcional
```

El archivo `.env` no debe subirse al repositorio. La carpeta `coverage/` tampoco debe versionarse.

El archivo `.env.example` debe contener las mismas variables sin credenciales reales.

---

## 9. Modelos de datos

## 9.1 Modelo `Producto`

Colección sugerida: `productos`

```js
{
  nombre: String,
  descripcion: String,
  categoria: String,
  precio: Number,
  activo: Boolean,
  variantes: [
    {
      sku: String,
      talla: String,
      color: String,
      stock: Number,
      stockMinimo: Number,
      activo: Boolean,
      createdAt: Date,
      updatedAt: Date
    }
  ],
  createdAt: Date,
  updatedAt: Date
}
```

### Restricciones

- `nombre`: requerido, trim, 2 a 120 caracteres.
- `descripcion`: opcional, máximo 1.000 caracteres.
- `categoria`: requerida, trim, máximo 80 caracteres.
- `precio`: requerido, número, mínimo 0.
- `activo`: booleano, valor predeterminado `true`.
- `variantes.sku`: requerido, mayúsculas, trim.
- `variantes.talla`: requerida, mayúsculas, trim.
- `variantes.color`: requerido, trim.
- `variantes.stock`: entero, mínimo 0, predeterminado 0.
- `variantes.stockMinimo`: entero, mínimo 0, predeterminado 3.
- `variantes.activo`: booleano, predeterminado `true`.

### Índices recomendados

```js
{ nombre: "text", descripcion: "text", categoria: "text" }
{ "variantes.sku": 1 }
{ activo: 1 }
{ categoria: 1 }
```

La unicidad global del SKU deberá validarse en la capa de servicio antes de guardar.

---

## 9.2 Modelo `Movimiento`

Colección sugerida: `movimientos`

```js
{
  producto: ObjectId,
  variante: ObjectId,
  sku: String,
  tipo: "ENTRADA" | "SALIDA" | "AJUSTE",
  cantidad: Number,
  direccionAjuste: "AUMENTO" | "DISMINUCION" | null,
  stockAnterior: Number,
  stockNuevo: Number,
  motivo: String,
  createdAt: Date,
  updatedAt: Date
}
```

### Restricciones

- `producto`: requerido, referencia a `Producto`.
- `variante`: requerido.
- `sku`: requerido.
- `tipo`: enum obligatorio.
- `cantidad`: entero mayor que cero.
- `stockAnterior`: entero mayor o igual a cero.
- `stockNuevo`: entero mayor o igual a cero.
- `motivo`: obligatorio para `AJUSTE`.
- Los movimientos son inmutables desde la API.

### Índices recomendados

```js
{ producto: 1, createdAt: -1 }
{ sku: 1, createdAt: -1 }
{ tipo: 1, createdAt: -1 }
{ createdAt: -1 }
```

---

## 9.3 Modelo `Ubicacion`

Colección sugerida: `ubicaciones`

Debe existir como máximo un documento para el usuario configurado.

```js
{
  usuarioId: String,
  posicion: {
    type: "Point",
    coordinates: [Number]
  },
  precisionMetros: Number,
  velocidadMps: Number,
  rumboGrados: Number,
  compartiendo: Boolean,
  capturadaEn: Date,
  recibidaEn: Date,
  createdAt: Date,
  updatedAt: Date
}
```

### Restricciones

- `usuarioId`: requerido y único.
- `posicion.type`: valor fijo `Point`.
- `coordinates`: `[longitud, latitud]`.
- `precisionMetros`: opcional, mínimo 0.
- `velocidadMps`: opcional, mínimo 0.
- `rumboGrados`: opcional, entre 0 y 360.
- `compartiendo`: booleano, predeterminado `true`.
- `capturadaEn`: requerida.
- `recibidaEn`: asignada por el servidor.

### Índices recomendados

```js
{ usuarioId: 1 } // unique
{ posicion: "2dsphere" }
{ updatedAt: -1 }
```

---

## 10. Convención de respuestas

### 10.1 Respuesta exitosa

```json
{
  "ok": true,
  "data": {},
  "message": "Operación realizada correctamente"
}
```

### 10.2 Respuesta paginada

```json
{
  "ok": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "totalPages": 3
  }
}
```

### 10.3 Respuesta de error

```json
{
  "ok": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Los datos enviados no son válidos",
    "details": []
  }
}
```

---

## 11. Códigos HTTP

- `200 OK`: consulta o actualización exitosa.
- `201 Created`: recurso creado.
- `204 No Content`: operación exitosa sin cuerpo, cuando corresponda.
- `400 Bad Request`: formato o validación inválida.
- `401 Unauthorized`: API Key ausente o incorrecta.
- `404 Not Found`: recurso inexistente.
- `409 Conflict`: SKU duplicado, variante repetida o stock insuficiente.
- `422 Unprocessable Entity`: regla de negocio no cumplida.
- `429 Too Many Requests`: exceso de actualizaciones.
- `500 Internal Server Error`: error inesperado.
- `503 Service Unavailable`: base de datos no disponible.

---

## 12. Endpoints de salud

### `GET /api/v1/health`

Comprueba que la API esté funcionando.

#### Respuesta esperada

```json
{
  "ok": true,
  "data": {
    "service": "sion-inventory-api",
    "status": "UP",
    "database": "CONNECTED",
    "timestamp": "2026-07-05T20:00:00.000Z"
  }
}
```

---

## 13. Endpoints de productos

### `POST /api/v1/productos`

Crea un producto. Puede incluir variantes, pero todas deben iniciar con stock 0.

#### Cuerpo

```json
{
  "nombre": "Polerón SION Gracia",
  "descripcion": "Polerón oversize de algodón",
  "categoria": "Polerones",
  "precio": 34990,
  "variantes": [
    {
      "sku": "SION-POL-GRACIA-NEG-M",
      "talla": "M",
      "color": "Negro",
      "stockMinimo": 3
    }
  ]
}
```

#### Reglas

- Ignorar o rechazar cualquier campo `stock` distinto de 0.
- Validar SKU globalmente.
- Validar talla + color dentro del producto.

---

### `GET /api/v1/productos`

Lista productos con filtros.

#### Parámetros opcionales

- `page`: predeterminado 1.
- `limit`: predeterminado 10, máximo 100.
- `buscar`: texto en nombre, descripción o categoría.
- `categoria`.
- `activo`: `true` o `false`.
- `sort`: `nombre`, `precio`, `createdAt`.
- `order`: `asc` o `desc`.

#### Ejemplo

```text
GET /api/v1/productos?categoria=Polerones&activo=true&page=1&limit=10
```

---

### `GET /api/v1/productos/:productoId`

Obtiene un producto por ID.

---

### `PATCH /api/v1/productos/:productoId`

Actualiza campos generales del producto.

#### Campos permitidos

- `nombre`.
- `descripcion`.
- `categoria`.
- `precio`.
- `activo`.

No acepta `variantes` ni cambios de stock.

---

### `DELETE /api/v1/productos/:productoId`

Realiza eliminación lógica:

```json
{
  "activo": false
}
```

No elimina movimientos históricos.

---

## 14. Endpoints de variantes

### `POST /api/v1/productos/:productoId/variantes`

Agrega una variante con stock inicial 0.

#### Cuerpo

```json
{
  "sku": "SION-POL-GRACIA-BLA-L",
  "talla": "L",
  "color": "Blanco",
  "stockMinimo": 4
}
```

---

### `PATCH /api/v1/productos/:productoId/variantes/:varianteId`

#### Campos permitidos

- `sku`.
- `talla`.
- `color`.
- `stockMinimo`.
- `activo`.

No permite editar `stock`.

---

### `DELETE /api/v1/productos/:productoId/variantes/:varianteId`

Desactiva la variante mediante `activo: false`.

---

### `GET /api/v1/productos/:productoId/stock`

Devuelve el stock de todas las variantes del producto.

#### Respuesta de ejemplo

```json
{
  "ok": true,
  "data": {
    "productoId": "...",
    "nombre": "Polerón SION Gracia",
    "stockTotal": 17,
    "variantes": [
      {
        "varianteId": "...",
        "sku": "SION-POL-GRACIA-NEG-M",
        "talla": "M",
        "color": "Negro",
        "stock": 10,
        "stockMinimo": 3,
        "estadoStock": "DISPONIBLE"
      }
    ]
  }
}
```

---

## 15. Endpoints de inventario

### `POST /api/v1/inventario/movimientos`

Registra una entrada, salida o ajuste.

### 15.1 Entrada

```json
{
  "productoId": "PRODUCTO_ID",
  "varianteId": "VARIANTE_ID",
  "tipo": "ENTRADA",
  "cantidad": 10,
  "motivo": "Reposición de proveedor"
}
```

### 15.2 Salida

```json
{
  "productoId": "PRODUCTO_ID",
  "varianteId": "VARIANTE_ID",
  "tipo": "SALIDA",
  "cantidad": 2,
  "motivo": "Venta presencial"
}
```

### 15.3 Ajuste

```json
{
  "productoId": "PRODUCTO_ID",
  "varianteId": "VARIANTE_ID",
  "tipo": "AJUSTE",
  "stockObjetivo": 8,
  "motivo": "Corrección después de conteo físico"
}
```

### Proceso obligatorio

1. Validar IDs y cuerpo.
2. Iniciar sesión/transacción de MongoDB.
3. Buscar producto y variante.
4. Validar que estén activos.
5. Leer stock actual.
6. Calcular stock nuevo.
7. Validar que no sea negativo.
8. Actualizar stock.
9. Crear movimiento.
10. Confirmar transacción.
11. Responder con stock anterior y nuevo.
12. Si ocurre un error, cancelar la transacción.

---

### `GET /api/v1/inventario/stock-bajo`

Lista variantes activas cuyo stock sea menor o igual al stock mínimo.

#### Parámetros opcionales

- `page`.
- `limit`.
- `categoria`.
- `incluirAgotados`: `true` o `false`.

---

### `GET /api/v1/inventario/resumen`

Devuelve estadísticas simples.

#### Respuesta esperada

```json
{
  "ok": true,
  "data": {
    "totalProductosActivos": 15,
    "totalVariantesActivas": 42,
    "unidadesDisponibles": 250,
    "variantesConStockBajo": 5,
    "variantesAgotadas": 2,
    "valorEstimadoInventario": 7450000
  }
}
```

`valorEstimadoInventario` se calcula como la suma de `precio * stock` de todas las variantes activas de productos activos.

---

## 16. Endpoints de movimientos

### `GET /api/v1/movimientos`

Lista movimientos con paginación y filtros.

#### Parámetros opcionales

- `page`.
- `limit`.
- `tipo`.
- `productoId`.
- `sku`.
- `desde`: fecha ISO 8601.
- `hasta`: fecha ISO 8601.
- `sort`: predeterminado `createdAt`.
- `order`: predeterminado `desc`.

---

### `GET /api/v1/movimientos/:movimientoId`

Obtiene un movimiento específico.

---

### `GET /api/v1/movimientos/producto/:productoId`

Obtiene el historial del producto y sus variantes.

No existirán endpoints `PATCH` ni `DELETE` para movimientos.

---

## 17. Endpoints de ubicación en tiempo real

Todos los endpoints de esta sección requieren:

```http
X-API-Key: valor_configurado_en_TRACKING_API_KEY
```

### `PATCH /api/v1/ubicacion`

Crea o actualiza la última ubicación del único usuario.

#### Cuerpo

```json
{
  "latitud": -33.4569,
  "longitud": -70.6483,
  "precisionMetros": 12.5,
  "velocidadMps": 0,
  "rumboGrados": 180,
  "capturadaEn": "2026-07-05T20:00:00.000Z"
}
```

#### Comportamiento

- El servidor obtiene `usuarioId` desde `TRACKING_USER_ID`.
- No se acepta `usuarioId` en el cuerpo.
- Se realiza `upsert` para mantener un solo documento.
- Se guarda `recibidaEn` con la hora del servidor.
- Se establece `compartiendo: true`.
- Se emite `ubicacion:actualizada` por Socket.IO.

#### Respuesta

```json
{
  "ok": true,
  "data": {
    "usuarioId": "usuario-principal",
    "latitud": -33.4569,
    "longitud": -70.6483,
    "precisionMetros": 12.5,
    "estado": "ACTIVA",
    "capturadaEn": "2026-07-05T20:00:00.000Z",
    "recibidaEn": "2026-07-05T20:00:01.000Z"
  },
  "message": "Ubicación actualizada"
}
```

---

### `GET /api/v1/ubicacion`

Obtiene la última ubicación conocida.

#### Estados posibles

- `ACTIVA`: compartiendo y actualizada hace menos de 2 minutos.
- `DESACTUALIZADA`: compartiendo, pero la última actualización supera 2 minutos.
- `INACTIVA`: el usuario detuvo el envío.
- `SIN_DATOS`: nunca se registró una ubicación.

#### Respuesta

```json
{
  "ok": true,
  "data": {
    "usuarioId": "usuario-principal",
    "latitud": -33.4569,
    "longitud": -70.6483,
    "precisionMetros": 12.5,
    "estado": "ACTIVA",
    "capturadaEn": "2026-07-05T20:00:00.000Z",
    "recibidaEn": "2026-07-05T20:00:01.000Z",
    "antiguedadSegundos": 1
  }
}
```

---

### `POST /api/v1/ubicacion/detener`

Marca la ubicación como inactiva sin borrar la última posición.

#### Respuesta

```json
{
  "ok": true,
  "data": {
    "usuarioId": "usuario-principal",
    "estado": "INACTIVA"
  },
  "message": "Compartición de ubicación detenida"
}
```

Después de la actualización se emite el evento `ubicacion:detenida`.

---

## 18. Eventos WebSocket

Se utilizará Socket.IO sobre el mismo servidor HTTP.

### 18.1 Conexión

El cliente debe conectarse enviando la API Key en el handshake:

```js
const socket = io("http://localhost:3000", {
  auth: {
    apiKey: "CLAVE_CONFIGURADA"
  }
});
```

### 18.2 Evento `ubicacion:actualizada`

Emitido después de cada actualización válida.

```json
{
  "usuarioId": "usuario-principal",
  "latitud": -33.4569,
  "longitud": -70.6483,
  "precisionMetros": 12.5,
  "estado": "ACTIVA",
  "capturadaEn": "2026-07-05T20:00:00.000Z",
  "recibidaEn": "2026-07-05T20:00:01.000Z"
}
```

### 18.3 Evento `ubicacion:detenida`

```json
{
  "usuarioId": "usuario-principal",
  "estado": "INACTIVA",
  "fecha": "2026-07-05T20:05:00.000Z"
}
```

### 18.4 Seguridad WebSocket

- Rechazar conexión sin API Key válida.
- No aceptar identificadores de usuarios desde el cliente.
- No emitir ubicación a clientes no autorizados.
- No incluir la API Key en logs.

---

## 19. Validaciones principales

### 19.1 Producto

- Nombre requerido.
- Categoría requerida.
- Precio numérico y no negativo.
- Campos desconocidos rechazados o ignorados de forma explícita.

### 19.2 Variante

- SKU requerido y único.
- Talla requerida.
- Color requerido.
- Stock mínimo entero y no negativo.
- Combinación talla + color no repetida.

### 19.3 Movimiento

- IDs MongoDB válidos.
- Tipo permitido.
- Cantidad positiva para entrada y salida.
- Stock objetivo no negativo para ajuste.
- Motivo obligatorio para ajuste.
- Producto y variante activos.
- Stock suficiente para salida.

### 19.4 Ubicación

- Latitud y longitud requeridas.
- Latitud entre -90 y 90.
- Longitud entre -180 y 180.
- Fecha válida en ISO 8601.
- `capturadaEn` no puede estar excesivamente en el futuro.
- Precisión y velocidad no negativas.
- Rumbo entre 0 y 360.
- API Key válida.
- Intervalo mínimo entre actualizaciones respetado.

---

## 20. Manejo de errores

Se implementará un middleware global de errores.

### Ejemplos de códigos internos

- `VALIDATION_ERROR`.
- `INVALID_OBJECT_ID`.
- `PRODUCT_NOT_FOUND`.
- `VARIANT_NOT_FOUND`.
- `DUPLICATE_SKU`.
- `DUPLICATE_VARIANT`.
- `INACTIVE_PRODUCT`.
- `INACTIVE_VARIANT`.
- `INSUFFICIENT_STOCK`.
- `INVALID_ADJUSTMENT`.
- `INVALID_API_KEY`.
- `LOCATION_NOT_FOUND`.
- `LOCATION_RATE_LIMIT`.
- `DATABASE_ERROR`.
- `INTERNAL_ERROR`.

En producción no se expondrán stack traces.

---

## 21. Requisitos no funcionales

### 21.1 Rendimiento

- Las consultas comunes deberían responder en menos de 500 ms bajo carga académica normal.
- Las actualizaciones de ubicación deberían emitirse por WebSocket en menos de 2 segundos después de guardarse, dependiendo de la red.
- La paginación será obligatoria en listados grandes.

### 21.2 Seguridad

- Uso de `helmet`.
- CORS configurado por variable de entorno.
- Límite de tamaño JSON, por ejemplo 100 KB.
- API Key obligatoria para ubicación.
- Credenciales en `.env`.
- No guardar secretos en Git.
- Validar y sanitizar entradas.
- Rate limit general y específico para ubicación.
- No registrar coordenadas exactas en logs de producción.

### 21.3 Disponibilidad y resiliencia

- Manejar desconexiones de MongoDB.
- Cerrar el servidor de forma ordenada ante `SIGINT` y `SIGTERM`.
- Cancelar transacciones ante errores.
- Retornar `503` cuando la base de datos no esté disponible.

### 21.4 Mantenibilidad

- Separación entre rutas, controladores, servicios, modelos y validadores.
- Nombres de variables y archivos en español o inglés, pero consistentes.
- No incluir lógica de negocio compleja en las rutas.
- Reutilizar funciones de respuesta y manejo de errores.

---

## 22. Estándar de documentación Swagger/OpenAPI

### 22.1 Contrato de la API

La API deberá mantener un archivo fuente de verdad en:

```text
docs/openapi.yaml
```

El documento utilizará **OpenAPI 3.1.0** y describirá el contrato HTTP completo del MVP. Swagger UI se utilizará para presentar ese contrato como documentación interactiva.

### 22.2 Endpoints de documentación

- `GET /api-docs`: interfaz Swagger UI.
- `GET /api-docs.json`: documento OpenAPI en JSON.

La documentación deberá poder abrirse sin depender de Postman.

### 22.3 Contenido obligatorio

El archivo OpenAPI deberá documentar el 100 % de los endpoints REST e incluir:

1. Información general, versión y descripción del servicio.
2. Servidores de desarrollo y producción mediante `servers`.
3. Etiquetas: `Health`, `Productos`, `Variantes`, `Inventario`, `Movimientos` y `Ubicación`.
4. Parámetros de ruta y consulta.
5. Cuerpos de solicitud.
6. Códigos de respuesta exitosos y de error.
7. Ejemplos de solicitudes y respuestas.
8. Esquemas reutilizables en `components/schemas`.
9. Respuestas reutilizables en `components/responses`.
10. Esquema de seguridad API Key para ubicación.

El esquema de seguridad se definirá de forma equivalente a:

```yaml
components:
  securitySchemes:
    TrackingApiKey:
      type: apiKey
      in: header
      name: X-API-Key
```

Los endpoints de ubicación declararán:

```yaml
security:
  - TrackingApiKey: []
```

### 22.4 Reglas de sincronización

- Todo endpoint nuevo o modificado exige actualizar `docs/openapi.yaml` en el mismo cambio.
- La documentación no puede anunciar campos o códigos HTTP que la implementación no soporte.
- Los ejemplos no deben contener credenciales, coordenadas reales ni URI de MongoDB.
- El documento OpenAPI debe validarse antes de la entrega mediante Swagger Editor o una herramienta compatible.
- Socket.IO se describirá en una sección textual complementaria del README, ya que OpenAPI documenta el contrato HTTP y no reemplaza la documentación de eventos WebSocket.

### 22.5 Criterios Swagger

Swagger se considerará completo cuando:

- `/api-docs` cargue sin errores.
- `/api-docs.json` entregue un documento válido.
- El 100 % de los endpoints REST aparezca en la interfaz.
- Sea posible probar desde Swagger UI al menos los endpoints públicos y enviar `X-API-Key` en los endpoints protegidos.

---

## 23. Estándar de observabilidad con OpenTelemetry

### 23.1 Objetivo

La API incorporará OpenTelemetry para generar y exportar **trazas distribuidas y métricas** de forma independiente del proveedor de observabilidad.

Los logs continuarán utilizando la herramienta de logging de la aplicación durante el MVP, pero deberán incluir, cuando exista un span activo, los campos `trace_id` y `span_id` para correlación.

### 23.2 Inicialización

- El SDK debe iniciarse antes de importar Express, Mongoose y Socket.IO.
- La instrumentación debe poder activarse o desactivarse con `OTEL_ENABLED`.
- Un fallo temporal del exportador no debe impedir que la API atienda solicitudes.
- En desarrollo se podrá usar un exportador de consola.
- Para integración o producción se utilizará OTLP/HTTP hacia un OpenTelemetry Collector o backend compatible.
- El servidor deberá ejecutar `shutdown()` del SDK durante el cierre ordenado.

### 23.3 Instrumentación automática

Se habilitará auto-instrumentación para, como mínimo:

- Solicitudes y respuestas HTTP de Node.js.
- Rutas Express.
- Operaciones del controlador MongoDB utilizado por Mongoose.

Las trazas deberán conservar el contexto entre middleware, controlador, servicio y acceso a base de datos.

### 23.4 Spans personalizados

Se crearán spans de negocio para operaciones críticas, por ejemplo:

- `sion.inventory.movement`.
- `sion.inventory.summary`.
- `sion.location.update`.
- `sion.location.stop`.
- `sion.mongodb.transaction`.

Los spans podrán registrar atributos de baja cardinalidad como:

- `sion.movement.type`.
- `sion.operation.result`.
- `http.route`.
- `http.response.status_code`.

No se registrarán en trazas:

- API Keys.
- Contraseñas o URI de MongoDB.
- Cuerpos completos de solicitudes.
- Coordenadas exactas.
- Identificadores personales.

### 23.5 Métricas mínimas

Se deberán generar, como mínimo, las siguientes métricas de aplicación:

- `sion_inventory_movements_total`: contador por tipo y resultado.
- `sion_inventory_movement_failures_total`: contador de movimientos rechazados.
- `sion_inventory_low_stock_variants`: indicador del número de variantes con stock bajo.
- `sion_location_updates_total`: contador de actualizaciones válidas y rechazadas.
- `sion_location_last_update_age_seconds`: antigüedad de la última actualización.
- `sion_api_errors_total`: contador por código interno y familia HTTP.

Las etiquetas de métricas deben ser de baja cardinalidad. No se usarán SKU, ObjectId, coordenadas, nombres de usuario ni mensajes de error como etiquetas.

### 23.6 Propagación y correlación

- Se utilizará propagación W3C Trace Context.
- Cuando exista una traza activa, los logs incluirán `trace_id` y `span_id`.
- Las respuestas de error podrán incluir un `requestId` o `traceId` no secreto para facilitar la búsqueda, sin revelar stack traces.

### 23.7 Exportación OTLP

La configuración debe realizarse principalmente por variables de entorno. Como base se utilizará:

```env
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
```

El endpoint puede corresponder a un OpenTelemetry Collector o a un backend compatible. No se exigirá un proveedor comercial específico.

### 23.8 Pruebas de observabilidad

Se deberá comprobar que:

1. La aplicación funciona con `OTEL_ENABLED=false`.
2. La aplicación inicia con `OTEL_ENABLED=true` aunque el Collector esté temporalmente ausente.
3. Una solicitud HTTP genera una traza.
4. Una operación de inventario contiene un span de negocio.
5. Las consultas MongoDB aparecen dentro de la traza.
6. Las métricas mínimas se actualizan.
7. No se exportan API Keys ni coordenadas exactas.
8. El SDK se cierra correctamente con `SIGINT` y `SIGTERM`.

---

## 24. Pruebas mínimas del MVP

### 24.0 Estándar mínimo de cobertura del 80 %

Las pruebas automatizadas se ejecutarán con Jest y Supertest. La entrega debe alcanzar, como mínimo, **80 % global** en cada indicador:

- Sentencias (`statements`).
- Ramas (`branches`).
- Funciones (`functions`).
- Líneas (`lines`).

Configuración mínima esperada en `jest.config.js`:

```js
module.exports = {
  testEnvironment: 'node',
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/observability/telemetry.js',
    '!src/config/swagger.js'
  ],
  coverageThreshold: {
    global: {
      statements: 80,
      branches: 80,
      functions: 80,
      lines: 80
    }
  }
};
```

No se aceptará aumentar artificialmente la cobertura excluyendo controladores, servicios, modelos, validadores o middlewares principales. Postman se mantiene como evidencia manual, pero no reemplaza las pruebas automatizadas.

Scripts mínimos de `package.json`:

```json
{
  "scripts": {
    "test": "jest --runInBand",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage --runInBand"
  }
}
```

## 24.1 Productos

1. Crear producto válido.
2. Rechazar producto sin nombre.
3. Rechazar precio negativo.
4. Listar productos.
5. Buscar por texto.
6. Filtrar por categoría.
7. Obtener producto por ID.
8. Actualizar producto.
9. Desactivar producto.
10. Confirmar que no se elimina el historial.

## 24.2 Variantes

1. Crear variante válida.
2. Rechazar SKU duplicado.
3. Rechazar talla + color duplicados.
4. Rechazar stock enviado directamente.
5. Editar stock mínimo.
6. Desactivar variante.
7. Rechazar movimiento sobre variante inactiva.

## 24.3 Inventario

1. Registrar entrada.
2. Confirmar aumento de stock.
3. Registrar salida.
4. Confirmar disminución de stock.
5. Rechazar salida mayor al stock.
6. Registrar ajuste con motivo.
7. Rechazar ajuste sin motivo.
8. Confirmar que stock y movimiento se guardan juntos.
9. Consultar stock bajo.
10. Consultar resumen.

## 24.4 Movimientos

1. Listar movimientos.
2. Filtrar por tipo.
3. Filtrar por SKU.
4. Filtrar por fechas.
5. Consultar historial de producto.
6. Confirmar que no existe edición ni eliminación.

## 24.5 Ubicación

1. Rechazar actualización sin API Key.
2. Rechazar API Key incorrecta.
3. Guardar primera ubicación.
4. Actualizar la misma ubicación mediante upsert.
5. Confirmar que existe un solo documento por usuario.
6. Consultar última ubicación.
7. Rechazar latitud inválida.
8. Rechazar longitud inválida.
9. Rechazar actualizaciones demasiado frecuentes.
10. Emitir `ubicacion:actualizada` por WebSocket.
11. Marcar ubicación como inactiva.
12. Emitir `ubicacion:detenida`.
13. Informar estado desactualizado después del umbral.
14. Confirmar que no se guarda historial de recorridos.

## 24.6 Swagger y contrato OpenAPI

1. Validar que `/api-docs` responda correctamente.
2. Validar que `/api-docs.json` sea un documento OpenAPI válido.
3. Confirmar que todos los endpoints REST estén documentados.
4. Confirmar que la seguridad `X-API-Key` esté declarada en ubicación.
5. Verificar que los ejemplos no contengan secretos.

## 24.7 OpenTelemetry

1. Iniciar la API con telemetría desactivada.
2. Iniciar la API con telemetría activada.
3. Confirmar generación de trazas HTTP y MongoDB.
4. Confirmar spans de inventario y ubicación.
5. Confirmar métricas mínimas.
6. Confirmar ausencia de secretos y coordenadas en atributos.
7. Confirmar cierre ordenado del SDK.

## 24.8 Cobertura

1. Ejecutar `npm run test:coverage`.
2. Confirmar al menos 80 % en sentencias, ramas, funciones y líneas.
3. Hacer fallar el pipeline o la entrega si alguno de los cuatro umbrales baja de 80 %.

---

## 25. Criterios de aceptación del MVP

El MVP se considerará terminado cuando:

1. La aplicación se inicie con `npm run dev`.
2. La API se conecte correctamente a MongoDB Atlas.
3. `GET /api/v1/health` responda correctamente.
4. Sea posible crear, consultar, editar y desactivar productos.
5. Sea posible administrar variantes sin modificar stock directamente.
6. Cada SKU sea único.
7. Las entradas, salidas y ajustes actualicen el stock correctamente.
8. Ninguna operación permita stock negativo.
9. Todo cambio de stock cree un movimiento auditable.
10. Las operaciones de stock utilicen transacciones.
11. La consulta de stock bajo funcione.
12. El resumen de inventario funcione.
13. Los movimientos puedan filtrarse y paginarse.
14. La ubicación del único usuario pueda actualizarse y consultarse.
15. La ubicación se emita por WebSocket.
16. El módulo de ubicación esté protegido por API Key.
17. Solo exista un documento activo de ubicación para el usuario configurado.
18. Los errores utilicen una estructura uniforme.
19. Todos los endpoints principales estén probados en Postman.
20. Exista un README con instrucciones completas.
21. `/api-docs` publique la documentación Swagger UI.
22. El contrato OpenAPI documente el 100 % de los endpoints REST.
23. `npm run test:coverage` alcance al menos 80 % en líneas, ramas, funciones y sentencias.
24. OpenTelemetry genere trazas HTTP, Express y MongoDB.
25. OpenTelemetry exporte métricas por OTLP o mediante un exportador de desarrollo.
26. Ninguna traza o métrica incluya API Keys, credenciales o coordenadas exactas.

---

## 26. Flujo de demostración final

La presentación del proyecto deberá demostrar, en este orden:

1. Iniciar la API.
2. Confirmar conexión con MongoDB Atlas.
3. Consultar `/api/v1/health`.
4. Crear un producto.
5. Agregar dos variantes.
6. Registrar una entrada de stock.
7. Registrar una salida válida.
8. Intentar una salida superior al stock.
9. Registrar un ajuste.
10. Consultar stock por producto.
11. Consultar stock bajo.
12. Consultar el historial de movimientos.
13. Consultar el resumen de inventario.
14. Enviar ubicación del usuario principal.
15. Consultar la última ubicación.
16. Mostrar la recepción del evento WebSocket.
17. Detener la compartición de ubicación.
18. Confirmar que productos y movimientos permanecen almacenados en Atlas.
19. Abrir `/api-docs` y ejecutar una solicitud desde Swagger UI.
20. Mostrar el documento `/api-docs.json`.
21. Ejecutar `npm run test:coverage` y mostrar los cuatro indicadores en 80 % o más.
22. Ejecutar una operación y mostrar su traza y métricas en el Collector o backend configurado.

---

## 27. Orden recomendado de implementación

1. Inicializar proyecto Node.js.
2. Instalar dependencias.
3. Crear estructura de carpetas.
4. Configurar variables de entorno.
5. Configurar Jest, Supertest y el umbral de cobertura del 80 %.
6. Conectar MongoDB Atlas.
7. Configurar OpenTelemetry antes de cargar Express y Mongoose.
8. Configurar Express y health check.
9. Crear manejo global de errores.
10. Crear el contrato inicial `docs/openapi.yaml`.
11. Publicar Swagger UI en `/api-docs` y el JSON en `/api-docs.json`.
12. Crear modelo Producto.
13. Crear CRUD de productos y sus pruebas automatizadas.
14. Crear gestión de variantes y sus pruebas.
15. Crear modelo Movimiento.
16. Implementar servicio transaccional de inventario y sus pruebas.
17. Añadir spans y métricas de inventario.
18. Crear consultas de stock bajo y resumen.
19. Crear historial y filtros.
20. Crear modelo Ubicación.
21. Crear middleware de API Key.
22. Crear endpoints de ubicación.
23. Configurar Socket.IO.
24. Añadir spans y métricas de ubicación.
25. Implementar rate limiting.
26. Mantener Swagger sincronizado con cada endpoint.
27. Probar cada módulo en Postman.
28. Ejecutar `npm run test:coverage` y corregir hasta superar los cuatro umbrales.
29. Verificar exportación OTLP con Collector o backend compatible.
30. Crear datos de demostración.
31. Documentar en README.
32. Validar el archivo OpenAPI.
33. Ejecutar prueba final completa.

---

## 28. Definición final del producto

La entrega corresponde a una **API REST de inventario para SION**, desarrollada con Node.js, Express, Mongoose y MongoDB Atlas. El sistema administra productos de ropa, variantes, stock y movimientos, y añade un módulo controlado de ubicación en tiempo real para un único usuario.

El contrato HTTP estará documentado con OpenAPI 3.1 y Swagger UI. La calidad se verificará mediante Jest y Supertest, con un estándar mínimo del 80 % en líneas, ramas, funciones y sentencias. La observabilidad se implementará con OpenTelemetry para trazas y métricas exportables mediante OTLP.

La solución prioriza un MVP funcional, trazable, observable y demostrable. No incluye frontend ni autenticación avanzada, pero deja una base modular para futuras ampliaciones.
