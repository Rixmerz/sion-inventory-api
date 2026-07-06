const { loadOpenApiDocument } = require('../src/config/swagger');

try {
  const document = loadOpenApiDocument();
  if (document.openapi !== '3.1.0') throw new Error('Se esperaba OpenAPI 3.1.0');
  if (!document.info?.title || !document.info?.version) throw new Error('Falta información general');
  if (!document.paths || Object.keys(document.paths).length === 0) throw new Error('No existen paths');
  console.log(`OpenAPI válido: ${document.info.title} v${document.info.version}`);
} catch (error) {
  console.error(`OpenAPI inválido: ${error.message}`);
  process.exit(1);
}
