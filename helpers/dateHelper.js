/** Date utilities centralisées */

const nowISO = () =>
  new Date().toISOString().replace('T', ' ').split('.')[0]; // '2025-01-15 14:30:00'

const todayDate = () =>
  new Date().toISOString().split('T')[0]; // '2025-01-15'

const toDate = (val) => (val ? val.split('T')[0] : null);

module.exports = { nowISO, todayDate, toDate };
