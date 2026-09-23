'use strict';

// Ошибка с HTTP-статусом: бросаем в обработчике, errorMiddleware превращает её
// в ответ. Так обработчики не размазывают res.status(...) по всем веткам.
class HttpError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// Express 4 не ловит отказы async-обработчиков сам — без обёртки исключение
// повесило бы запрос до таймаута вместо понятного ответа.
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Коды PostgreSQL, которые означают ошибку во входных данных, а не поломку
// сервиса: пользователь должен увидеть 400 с человеческим текстом, а не 500.
const PG_INPUT_ERRORS = {
  '23514': [400, 'Недопустимое значение поля'],   // check_violation
  '23502': [400, 'Не заполнено обязательное поле'], // not_null_violation
  '23503': [400, 'Связанная запись не найдена'],   // foreign_key_violation
  '23505': [409, 'Такая запись уже есть'],          // unique_violation
  '22P02': [400, 'Неверный формат данных'],        // invalid_text_representation
  '22007': [400, 'Неверный формат даты'],          // invalid_datetime_format
  '22008': [400, 'Дата вне допустимого диапазона'], // datetime_field_overflow
  '22003': [400, 'Число вне допустимого диапазона'], // numeric_value_out_of_range
};

// eslint-disable-next-line no-unused-vars
function errorMiddleware(err, req, res, next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json(err.code ? { error: err.message, code: err.code } : { error: err.message });
  }
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Тело запроса — не корректный JSON' });
  }
  const mapped = err && PG_INPUT_ERRORS[err.code];
  if (mapped) return res.status(mapped[0]).json({ error: mapped[1] });
  console.error('events-api: внутренняя ошибка', err && (err.stack || err.message || err));
  res.status(500).json({ error: 'Внутренняя ошибка сервиса мероприятий' });
}

module.exports = { HttpError, asyncHandler, errorMiddleware };
