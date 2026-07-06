jest.mock('../../src/models/Movimiento', () => ({
  find: jest.fn(),
  countDocuments: jest.fn(),
  findById: jest.fn()
}));

const Movimiento = require('../../src/models/Movimiento');
const service = require('../../src/services/movimiento.service');

const PRODUCT_ID = '64f000000000000000000001';
const MOVEMENT_ID = '64f000000000000000000002';

const queryChain = (value) => ({
  sort: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  populate: jest.fn().mockReturnThis(),
  lean: jest.fn().mockResolvedValue(value)
});

describe('movimiento.service', () => {
  beforeEach(() => jest.clearAllMocks());

  test('construye filtros completos y vacíos', () => {
    expect(service.buildMovementFilter({})).toEqual({});
    const filter = service.buildMovementFilter({
      tipo: 'SALIDA',
      productoId: PRODUCT_ID,
      sku: 'SKU',
      desde: '2026-01-01T00:00:00.000Z',
      hasta: '2026-01-02T00:00:00.000Z'
    });
    expect(filter.tipo).toBe('SALIDA');
    expect(filter.producto).toBe(PRODUCT_ID);
    expect(filter.createdAt.$gte).toBeInstanceOf(Date);
    expect(filter.createdAt.$lte).toBeInstanceOf(Date);
  });

  test('lista movimientos paginados, con producto forzado', async () => {
    const chain = queryChain([{ _id: MOVEMENT_ID }]);
    Movimiento.find.mockReturnValue(chain);
    Movimiento.countDocuments.mockResolvedValue(12);

    const result = await service.listMovements({
      page: 2,
      limit: 5,
      tipo: 'ENTRADA',
      order: 'asc'
    }, PRODUCT_ID);

    expect(Movimiento.find).toHaveBeenCalledWith({ tipo: 'ENTRADA', producto: PRODUCT_ID });
    expect(chain.sort).toHaveBeenCalledWith({ createdAt: 1 });
    expect(chain.skip).toHaveBeenCalledWith(5);
    expect(result.meta.totalPages).toBe(3);
  });

  test('usa orden descendente y producto de query', async () => {
    Movimiento.find.mockReturnValue(queryChain([]));
    Movimiento.countDocuments.mockResolvedValue(0);
    const result = await service.listMovements({ page: 1, limit: 10, productoId: PRODUCT_ID, order: 'desc' });
    expect(Movimiento.find).toHaveBeenCalledWith({ producto: PRODUCT_ID });
    expect(result.meta.totalPages).toBe(0);
  });

  test('obtiene movimiento o informa que no existe', async () => {
    Movimiento.findById.mockReturnValueOnce({
      populate: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue({ _id: MOVEMENT_ID })
    });
    await expect(service.getMovementById(MOVEMENT_ID)).resolves.toEqual({ _id: MOVEMENT_ID });

    Movimiento.findById.mockReturnValueOnce({
      populate: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(null)
    });
    await expect(service.getMovementById(MOVEMENT_ID)).rejects.toMatchObject({ code: 'MOVEMENT_NOT_FOUND' });
  });
});
