// Minimal in-memory stub of a Mongoose-like Game model for local testing
let games = [];
let gameId = 1;

class GameModel {
  constructor(data = {}) {
    this._id = (gameId++).toString();
    this.name = data.name || 'Game';
    this.date = data.date || new Date();
    this.status = data.status || 'active';
    this.image = data.image || '';
    this.notes = data.notes || '';
    this.players = data.players || [];
    this.loans = data.loans || [];
  }

  async save() {
    games.push(this);
    return this;
  }

  static async find() {
    return games.slice();
  }

  static async findById(id) {
    return games.find(g => g._id === id) || null;
  }

  static async findByIdAndUpdate(id, update, opts = {}) {
    const idx = games.findIndex(g => g._id === id);
    if (idx === -1) return null;
    games[idx] = { ...games[idx], ...update };
    return games[idx];
  }

  static async findByIdAndDelete(id) {
    const idx = games.findIndex(g => g._id === id);
    if (idx === -1) return null;
    const removed = games.splice(idx, 1)[0];
    return removed;
  }
}

module.exports = GameModel;
