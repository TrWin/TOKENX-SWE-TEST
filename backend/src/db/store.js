const Database = require("better-sqlite3");
const path = require("path");

const db = new Database(path.join(__dirname, "redemptions.db"));

db.exec(`
  CREATE TABLE IF NOT EXISTS redemptions (
    requestId   INTEGER PRIMARY KEY,
    wallet      TEXT    NOT NULL,
    shares      TEXT    NOT NULL,
    nav         TEXT    NOT NULL,
    amount      TEXT    NOT NULL,
    unlockDate  TEXT    NOT NULL,
    status      TEXT    NOT NULL DEFAULT 'pending'
  )
`);

const store = {
  insert(req) {
    db.prepare(`
      INSERT OR IGNORE INTO redemptions
        (requestId, wallet, shares, nav, amount, unlockDate, status)
      VALUES
        (@requestId, @wallet, @shares, @nav, @amount, @unlockDate, @status)
    `).run(req);
  },

  markFulfilled(requestId) {
    db.prepare(`
      UPDATE redemptions SET status = 'fulfilled' WHERE requestId = ?
    `).run(requestId);
  },

  getAll() {
    const rows = db.prepare("SELECT * FROM redemptions ORDER BY requestId ASC").all();
    const now = new Date();
    return rows.map(row => {
      let status = row.status;
      if (status === "pending" && new Date(row.unlockDate) <= now) {
        status = "ready";
      }
      return { ...row, status };
    });
  },

  getById(requestId) {
    const row = db.prepare(
      "SELECT * FROM redemptions WHERE requestId = ?"
    ).get(requestId);
    if (!row) return null;
    const now = new Date();
    let status = row.status;
    if (status === "pending" && new Date(row.unlockDate) <= now) {
      status = "ready";
    }
    return { ...row, status };
  },
};

module.exports = { store };