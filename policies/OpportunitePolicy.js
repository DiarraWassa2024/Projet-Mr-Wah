const Policy = require('./Policy');

class OpportunitePolicy extends Policy {
  canCreate(user) { return this.isStaff(user); }
  canUpdate(user) { return this.isStaff(user); }
  canDelete(user) { return this.isAdmin(user); }
}

module.exports = new OpportunitePolicy();
