const express = require("express");
const router = express.Router();
const passport = require("passport");

require("../configs/passport")(passport);

const { checkAuthorization } = require("../middlewares/authorization");
const {
  push,
  checkPullDatav4,
  pullv3,
} = require("../controllers/syncController");

router.post("/pull", checkAuthorization, pullv3);
router.post("/check-pull-data", checkAuthorization, checkPullDatav4);
router.post("/push", checkAuthorization, push);

module.exports = router;
