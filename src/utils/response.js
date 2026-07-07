const success = (res, data, message = 'Operación realizada correctamente', statusCode = 200) =>
  res.status(statusCode).json({ ok: true, data, message });

const paginated = (res, data, meta, statusCode = 200) =>
  res.status(statusCode).json({ ok: true, data, meta });

module.exports = { success, paginated };
