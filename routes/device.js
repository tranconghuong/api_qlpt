const express = require("express");
const router = express.Router();
const { checkAuthorization } = require("../middlewares/authorization");
const {
  createDevice,
  removeDevice,
  getDevice,
  getAllDevicesByUser,
  sendpushTest,
  sendPushToOldApp,
} = require("../controllers/deviceController");

router.post("/createDevice", checkAuthorization, createDevice);
router.post("/removeDevice", checkAuthorization, removeDevice);
router.get("/getDevice", checkAuthorization, getDevice);
router.get("/getAllDevicesByUser", checkAuthorization, getAllDevicesByUser);
router.post("/sendpushTest", sendpushTest);
router.post("/sendPush", checkAuthorization, sendPushToOldApp);

module.exports = router;
