jest.mock('../../src/models/Producto', () => ({
  findOne: jest.fn(),
  create: jest.fn(),
  find: jest.fn(),
  countDocuments: jest.fn(),
  findById: jest.fn(),
  findByIdAndUpdate: jest.fn()
}));

const Producto = require('../../src/models/Producto');
const service = require('../../src/services/producto.service');

const PRODUCT_ID = '64f000000000000000000001';
const VARIANT_ID = '64f000000000000000000002';
const OTHER_ID = '64f000000000000000000003';

const leanResult = (value) => ({ lean: jest.fn().mockResolvedValue(value) });

const makeVariants = (items) => {
  const variants = [...items];
  variants.id = jest.fn((id) => variants.find((variant) => String(variant._id) === String(id)) || null);
  return variants;
};

const makeDocument = ({ active = true, variants = [] } = {}) => ({
  _id: PRODUCT_ID,
  nombre: 'Polerón',
  activo: active,
  variantes: makeVariants(variants),
  save: jest.fn().mockResolvedValue()
});

describe('producto.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Producto.findOne.mockReturnValue(leanResult(null));
  });

  test('crea clave de combinación estable', () => {
    expect(service.comboKey(' m ', 'Negro')).toBe('M::negro');
  });

  test('detecta SKU y combinación repetidos en payload', () => {
    expect(() => service.assertUniqueVariantsInPayload([
      { sku: 'A', talla: 'S', color: 'Negro' },
      { sku: 'A', talla: 'M', color: 'Negro' }
    ])).toThrow(expect.objectContaining({ code: 'DUPLICATE_SKU' }));

    expect(() => service.assertUniqueVariantsInPayload([
      { sku: 'A', talla: 'S', color: 'Negro' },
      { sku: 'B', talla: 's', color: 'NEGRO' }
    ])).toThrow(expect.objectContaining({ code: 'DUPLICATE_VARIANT' }));

    expect(() => service.assertUniqueVariantsInPayload([])).not.toThrow();
  });

  test('valida disponibilidad global de SKU', async () => {
    await expect(service.ensureSkuAvailable([])).resolves.toBeUndefined();
    await expect(service.ensureSkuAvailable('SKU')).resolves.toBeUndefined();
    expect(Producto.findOne).toHaveBeenCalledWith({ variantes: { $elemMatch: { sku: { $in: ['SKU'] } } } });

    Producto.findOne.mockReturnValueOnce(leanResult({ _id: PRODUCT_ID }));
    await expect(service.ensureSkuAvailable('SKU', VARIANT_ID)).rejects.toMatchObject({ code: 'DUPLICATE_SKU' });
  });

  test('crea producto con stock inicial cero', async () => {
    const created = { _id: PRODUCT_ID };
    Producto.create.mockResolvedValue(created);
    const payload = {
      nombre: 'Polerón',
      categoria: 'Ropa',
      precio: 10,
      variantes: [{ sku: 'SKU', talla: 'M', color: 'Negro', stockMinimo: 2 }]
    };
    await expect(service.createProduct(payload)).resolves.toBe(created);
    expect(Producto.create.mock.calls[0][0].variantes[0].stock).toBe(0);
  });

  test('lista productos con filtros, orden y paginación', async () => {
    const chain = {
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([{ _id: PRODUCT_ID }])
    };
    Producto.find.mockReturnValue(chain);
    Producto.countDocuments.mockResolvedValue(11);

    const result = await service.listProducts({
      page: 2,
      limit: 5,
      buscar: 'gracia',
      categoria: 'Polerones',
      activo: false,
      sort: 'precio',
      order: 'asc'
    });
    expect(Producto.find).toHaveBeenCalledWith({
      $text: { $search: 'gracia' },
      categoria: 'Polerones',
      activo: false
    });
    expect(chain.skip).toHaveBeenCalledWith(5);
    expect(result.meta).toEqual({ page: 2, limit: 5, total: 11, totalPages: 3 });
  });

  test('obtiene, actualiza y desactiva producto', async () => {
    Producto.findById.mockReturnValueOnce(leanResult({ _id: PRODUCT_ID }));
    await expect(service.getProductById(PRODUCT_ID)).resolves.toEqual({ _id: PRODUCT_ID });

    Producto.findById.mockReturnValueOnce(leanResult(null));
    await expect(service.getProductById(PRODUCT_ID)).rejects.toMatchObject({ code: 'PRODUCT_NOT_FOUND' });

    Producto.findByIdAndUpdate.mockResolvedValueOnce({ _id: PRODUCT_ID, precio: 20 });
    await expect(service.updateProduct(PRODUCT_ID, { precio: 20 })).resolves.toMatchObject({ precio: 20 });

    Producto.findByIdAndUpdate.mockResolvedValueOnce(null);
    await expect(service.updateProduct(PRODUCT_ID, { precio: 20 })).rejects.toMatchObject({ code: 'PRODUCT_NOT_FOUND' });

    Producto.findByIdAndUpdate.mockResolvedValueOnce({ _id: PRODUCT_ID, activo: false });
    await expect(service.deactivateProduct(PRODUCT_ID)).resolves.toMatchObject({ activo: false });
    expect(Producto.findByIdAndUpdate).toHaveBeenLastCalledWith(PRODUCT_ID, { activo: false }, expect.any(Object));
  });

  test('agrega variante y valida producto activo y duplicados', async () => {
    const doc = makeDocument();
    Producto.findById.mockResolvedValue(doc);
    const result = await service.addVariant(PRODUCT_ID, { sku: 'SKU', talla: 'M', color: 'Negro', stockMinimo: 3 });
    expect(result.stock).toBe(0);
    expect(doc.save).toHaveBeenCalled();

    Producto.findById.mockResolvedValueOnce(makeDocument({ active: false }));
    await expect(service.addVariant(PRODUCT_ID, { sku: 'X', talla: 'S', color: 'Azul' })).rejects.toMatchObject({ code: 'INACTIVE_PRODUCT' });

    const duplicateDoc = makeDocument({ variants: [{ _id: OTHER_ID, sku: 'A', talla: 'M', color: 'Negro' }] });
    Producto.findById.mockResolvedValueOnce(duplicateDoc);
    await expect(service.addVariant(PRODUCT_ID, { sku: 'B', talla: 'm', color: 'NEGRO' })).rejects.toMatchObject({ code: 'DUPLICATE_VARIANT' });
  });

  test('actualiza y desactiva variante', async () => {
    const variant = { _id: VARIANT_ID, sku: 'OLD', talla: 'M', color: 'Negro', stockMinimo: 3, activo: true };
    const doc = makeDocument({ variants: [variant, { _id: OTHER_ID, sku: 'OTHER', talla: 'L', color: 'Azul' }] });
    Producto.findById.mockResolvedValue(doc);

    const result = await service.updateVariant(PRODUCT_ID, VARIANT_ID, { sku: 'NEW', stockMinimo: 5 });
    expect(result.sku).toBe('NEW');
    expect(result.stockMinimo).toBe(5);
    expect(doc.save).toHaveBeenCalled();

    Producto.findById.mockResolvedValueOnce(makeDocument({ variants: [] }));
    await expect(service.updateVariant(PRODUCT_ID, VARIANT_ID, { activo: false })).rejects.toMatchObject({ code: 'VARIANT_NOT_FOUND' });

    const duplicated = makeDocument({ variants: [
      { _id: VARIANT_ID, sku: 'A', talla: 'S', color: 'Negro', activo: true },
      { _id: OTHER_ID, sku: 'B', talla: 'M', color: 'Azul', activo: true }
    ] });
    Producto.findById.mockResolvedValueOnce(duplicated);
    await expect(service.updateVariant(PRODUCT_ID, VARIANT_ID, { talla: 'm', color: 'AZUL' })).rejects.toMatchObject({ code: 'DUPLICATE_VARIANT' });

    const deactivateDoc = makeDocument({ variants: [{ _id: VARIANT_ID, sku: 'A', talla: 'S', color: 'Negro', activo: true }] });
    Producto.findById.mockResolvedValueOnce(deactivateDoc);
    const deactivated = await service.deactivateVariant(PRODUCT_ID, VARIANT_ID);
    expect(deactivated.activo).toBe(false);
  });

  test('calcula stock total y estados', async () => {
    Producto.findById.mockReturnValue(leanResult({
      _id: PRODUCT_ID,
      nombre: 'Polerón',
      variantes: [
        { _id: '1', sku: 'A', talla: 'S', color: 'N', stock: 0, stockMinimo: 2, activo: true },
        { _id: '2', sku: 'B', talla: 'M', color: 'N', stock: 2, stockMinimo: 2, activo: true },
        { _id: '3', sku: 'C', talla: 'L', color: 'N', stock: 5, stockMinimo: 2, activo: true }
      ]
    }));
    const result = await service.getProductStock(PRODUCT_ID);
    expect(result.stockTotal).toBe(7);
    expect(result.variantes.map((v) => v.estadoStock)).toEqual(['AGOTADO', 'BAJO', 'DISPONIBLE']);
  });
});
