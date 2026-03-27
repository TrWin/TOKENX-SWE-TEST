const { Router } = require("express");
const { store } = require("../db/store");

const router = Router();

router.get("/", (_req, res) => {
  try {
    const data = store.getAll();
    return res.json({ data });
  } catch (err) {
    return res.status(500).json({ error: { code: "DB_ERROR", message: err.message } });
  }
});

module.exports = router;