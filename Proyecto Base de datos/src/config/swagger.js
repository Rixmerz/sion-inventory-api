const fs = require('fs');
const path = require('path');
const YAML = require('yaml');

const openApiPath = path.join(__dirname, '../../docs/openapi.yaml');

const loadOpenApiDocument = () => {
  const source = fs.readFileSync(openApiPath, 'utf8');
  return YAML.parse(source);
};

module.exports = { loadOpenApiDocument, openApiPath };
