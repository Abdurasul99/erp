const COMPANY_DISABLED = Object.freeze({
  status: 403,
  code: 'COMPANY_DISABLED',
  error: 'Доступ компании приостановлен. Обратитесь к администратору.',
});

function companyAccessError(user, company) {
  if (!user?.company_id || user.act_as) return null;
  if (!company || company.is_enabled === false) return { ...COMPANY_DISABLED };
  return null;
}

function parseCompanyEnabled(value) {
  if (typeof value !== 'boolean') {
    throw new TypeError('enabled must be a boolean');
  }
  return value;
}

module.exports = { COMPANY_DISABLED, companyAccessError, parseCompanyEnabled };
