// Minimal in-memory stub of a Mongoose-like Player model for local testing
let store = [];
let idCounter = 1;

class PlayerModel {
  constructor(data = {}) {
    this._id = (idCounter++).toString();
    this.name = data.name || 'Unknown';
    this.image = data.image || '';
  }

  async save() {
    const existing = store.find(s => s._id === this._id);
    if (!existing) {
      store.push(this);
    }
    return this;
  }

  static async find() {
    return store.slice();
  }

  static async findById(id) {
    return store.find(s => s._id === id) || null;
  }

  static async findByIdAndUpdate(id, update, opts = {}) {
    const idx = store.findIndex(s => s._id === id);
    if (idx === -1) return null;
    store[idx] = { ...store[idx], ...update };
    return store[idx];
  }

  static async findByIdAndDelete(id) {
    const idx = store.findIndex(s => s._id === id);
    if (idx === -1) return null;
    const removed = store.splice(idx, 1)[0];
    return removed;
  }
}

module.exports = PlayerModel;
