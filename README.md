# SION Inventory API — MVP

API REST para gestionar el inventario de la marca de ropa **SION**. Administra productos, variantes por talla y color, stock, movimientos auditables y la última ubicación de un único usuario autorizado.

## Funcionalidades implementadas

- API versionada en `/api/v1`.
- CRUD de productos con desactivación lógica.
- Variantes con SKU globalmente único, talla, color y stock mínimo.
- Entradas, salidas y ajustes transaccionales.
- Prevención de stock negativo.
- Historial inmutable de movimientos con filtros y paginación.
- Consultas de stock bajo y resumen del inventario.
- Última ubicación de un usuario, protegida con `X-API-Key`.
- Eventos Socket.IO `ubicacion:actualizada` y `ubicacion:detenida`.
- Swagger UI y contrato OpenAPI 3.1.
- OpenTelemetry para trazas y métricas OTLP.
- Pruebas Jest y Supertest con umbral global mínimo del 80 %.

## Tecnologías

Node.js, Express, MongoDB Atlas, Mongoose, Zod, Socket.IO, Swagger UI, Jest, Supertest y OpenTelemetry.

## Requisitos

- Node.js 20 o superior.
- Una base de datos MongoDB Atlas disponible.
- npm.
- Postman, opcional para la demostración manual.
- Docker, opcional para Jaeger, Prometheus y OpenTelemetry Collector.

> Los movimientos usan transacciones. MongoDB Atlas ofrece la configuración de replica set necesaria. Una instancia local independiente de MongoDB sin replica set no es suficiente para probar esa operación.

## Instalación

```bash
npm install
cp .env.example .env
```

En Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Complete como mínimo estas variables en `.env`:

```env
PORT=3000
NODE_ENV=development
MONGODB_URI=mongodb+srv://USUARIO:CONTRASENA@CLUSTER.mongodb.net/sion_inventory?retryWrites=true&w=majority
CORS_ORIGIN=http://localhost:3000
TRACKING_USER_ID=usuario-principal
TRACKING_API_KEY=una_clave_larga_y_segura
LOCATION_STALE_SECONDS=120
LOCATION_MIN_INTERVAL_SECONDS=5
OTEL_ENABLED=false
```

En MongoDB Atlas deben existir un usuario de base de datos, permisos para la base `sion_inventory` y acceso de red desde el equipo donde se ejecutará la API. No suba `.env` a Git.

## Ejecución

Desarrollo:

```bash
npm run dev
```

Producción:

```bash
npm start
```

Direcciones principales:

- API: `http://localhost:3000/api/v1`
- Health: `http://localhost:3000/api/v1/health`
- Swagger UI: `http://localhost:3000/api-docs`
- OpenAPI JSON: `http://localhost:3000/api-docs.json`

## Pruebas y estándar del 80 %

```bash
npm test
npm run test:coverage
```

La configuración hace fallar la ejecución si líneas, ramas, funciones o sentencias bajan del 80 %. La última verificación incluida con el proyecto ejecutó **67 pruebas** y obtuvo globalmente:

- Sentencias: 98.06 %.
- Ramas: 84.92 %.
- Funciones: 94.30 %.
- Líneas: 98.70 %.

El reporte HTML se genera en `coverage/lcov-report/index.html`.

## Validación de OpenAPI

```bash
npm run openapi:check
```

El contrato fuente se encuentra en `docs/openapi.yaml`.

## Datos de demostración

```bash
npm run seed
```

El script crea un polerón con dos variantes y registra entradas mediante el mismo servicio transaccional de inventario. Para eliminar primero los datos del proyecto:

```env
SEED_RESET=true
```

Use esa opción únicamente en una base de datos de demostración.

## Endpoints principales

| Método | Ruta | Función |
|---|---|---|
| GET | `/api/v1/health` | Estado del servicio y conexión |
| POST | `/api/v1/productos` | Crear producto |
| GET | `/api/v1/productos` | Listar y filtrar productos |
| GET/PATCH/DELETE | `/api/v1/productos/:productoId` | Consultar, editar o desactivar |
| POST | `/api/v1/productos/:productoId/variantes` | Agregar variante |
| PATCH/DELETE | `/api/v1/productos/:productoId/variantes/:varianteId` | Editar o desactivar variante |
| GET | `/api/v1/productos/:productoId/stock` | Stock por variante |
| POST | `/api/v1/inventario/movimientos` | Entrada, salida o ajuste |
| GET | `/api/v1/inventario/stock-bajo` | Variantes con stock bajo |
| GET | `/api/v1/inventario/resumen` | Estadísticas básicas |
| GET | `/api/v1/movimientos` | Historial con filtros |
| PATCH/GET | `/api/v1/ubicacion` | Actualizar o consultar ubicación |
| POST | `/api/v1/ubicacion/detener` | Detener la compartición |

La documentación completa, cuerpos, parámetros y respuestas están en Swagger.

## Reglas importantes del inventario

- Una variante nueva siempre comienza con stock `0`.
- El stock no se edita desde productos ni variantes.
- Todo cambio de stock se realiza en `/inventario/movimientos`.
- Una salida superior al stock responde `409 INSUFFICIENT_STOCK`.
- Un ajuste establece un stock objetivo y exige motivo.
- Producto y variante deben estar activos.
- Stock y movimiento se guardan en una transacción de MongoDB.

## Ubicación en tiempo real

Los endpoints requieren:

```http
X-API-Key: valor_de_TRACKING_API_KEY
```

La API solo guarda el último punto GeoJSON para `TRACKING_USER_ID`; no almacena recorridos. El cliente debe enviar las coordenadas cada 5 a 15 segundos. El orden interno en MongoDB es `[longitud, latitud]`.

El archivo `examples/socket-client.html` permite escuchar los eventos. Reemplace la clave y ábralo en un navegador mientras la API está iniciada.

## OpenTelemetry

Para ejecutar el entorno de observabilidad incluido:

```bash
cd observability
docker compose up -d
```

Después configure:

```env
OTEL_ENABLED=true
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
OTEL_METRIC_EXPORT_INTERVAL=10000
```

Reinicie la API y realice solicitudes. Interfaces:

- Jaeger: `http://localhost:16686`
- Prometheus: `http://localhost:9090`

Spans de negocio incluidos:

- `sion.inventory.movement`
- `sion.inventory.summary`
- `sion.location.update`
- `sion.location.stop`
- `sion.mongodb.transaction`

Las métricas no utilizan SKU, ObjectId, coordenadas ni otros valores de alta cardinalidad como etiquetas.

## Postman

Importe:

```text
postman/SION_API_MVP.postman_collection.json
```

Ajuste `trackingApiKey`. La solicitud de creación guarda automáticamente `productId` y `variantId` como variables de colección.

## Estructura

```text
sion-inventory-api/
├── docs/openapi.yaml
├── examples/socket-client.html
├── observability/
├── postman/
├── scripts/
├── src/
│   ├── config/
│   ├── controllers/
│   ├── middlewares/
│   ├── models/
│   ├── observability/
│   ├── routes/
│   ├── services/
│   ├── utils/
│   └── validators/
├── tests/
├── .env.example
├── jest.config.js
├── package.json
├── server.js
├── spec.md
└── README.md
```

## Respuestas

Éxito:

```json
{
  "ok": true,
  "data": {},
  "message": "Operación realizada correctamente"
}
```

Error:

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

## Alcance del MVP

No incluye frontend, JWT, roles, pagos, facturación, múltiples bodegas, e-commerce, historial de recorridos ni notificaciones automáticas.
