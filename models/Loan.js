// Minimal in-memory stub of a Mongoose-like Loan model for local testing
let loans = [];
let loanId = 1;

class LoanModel {
  constructor(data = {}) {
    this._id = (loanId++).toString();
    this.game = data.game || null;
    this.lender = data.lender || null;
    this.borrower = data.borrower || null;
    this.amount = data.amount || 0;
    this.date = data.date || new Date();
    this.notes = data.notes || '';
    this.repaidAmount = data.repaidAmount || 0;
    this.status = data.status || 'open';
  }

  async save() {
    loans.push(this);
    return this;
  }

  static async find(filter = {}) {
    // naive filter: if filter.game provided, filter by it
    if (filter.game) return loans.filter(l => l.game === filter.game);
    return loans.slice();
  }

  static async findById(id) {
    return loans.find(l => l._id === id) || null;
  }

  static async findByIdAndUpdate(id, update, opts = {}) {
    const idx = loans.findIndex(l => l._id === id);
    if (idx === -1) return null;
    loans[idx] = { ...loans[idx], ...update };
    return loans[idx];
  }

  static async findByIdAndDelete(id) {
    const idx = loans.findIndex(l => l._id === id);
    if (idx === -1) return null;
    const removed = loans.splice(idx, 1)[0];
    return removed;
  }

  static async deleteMany(filter = {}) {
    if (filter.game) {
      const before = loans.length;
      loans = loans.filter(l => l.game !== filter.game);
      return { deletedCount: before - loans.length };
    }
    const removed = loans.length;
    loans = [];
    return { deletedCount: removed };
  }
}

module.exports = LoanModel;
