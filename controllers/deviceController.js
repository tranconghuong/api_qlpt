const { Device } = require("../models/device.model");
const admin = require("firebase-admin");
const util = require("util");
const fcm = require("../utils/fmc");

// Create a new Device
exports.createDevice = async (req, res) => {
  try {
    const { userId } = req;
    const deviceId = req.headers["x-device"];
    const { deviceToken, osVersion, osType, appVersion, language, currency } =
      req.body;

    if (!deviceId || !deviceToken) {
      return res.status(400).json({
        success: false,
        message: "Device ID and Device Token required",
      });
    }

    // Xóa thiết bị trùng
    await Device.deleteMany({ $or: [{ deviceId }, { deviceToken }] });

    // Tạo thiết bị mới
    const device = await Device.create({
      deviceId,
      userId,
      deviceToken,
      osVersion,
      osType,
      appVersion,
      language,
      currency,
      created: new Date(),
      updated: new Date(),
    });
    const { _id, ...convert } = device.toObject();
    convert.id = _id;
    return res.status(200).json({
      success: true,
      message: "Add create device successfully",
      data: convert,
    });
  } catch (error) {
    console.error("Error creating device:", error);
    return res.status(500).json({
      success: false,
      message: "Error server, not add device failed",
    });
  }
};

// Remove Device
exports.removeDevice = async (req, res) => {
  const deviceId = req.headers["x-device"];
  const userId = req.userId;

  // Update if existed and Insert if not
  const device = await Device.findOneAndUpdate(
    { deviceId: deviceId },
    {
      userId: userId,
      deviceToken: "",
      modified_date: new Date(),
    },
    {
      new: true,
    }
  );
  const { _id, ...convert } = device.toObject();
  convert.id = _id;
  return res.status(200).json({
    success: !!device,
    message: "Updated a device successfully",
    data: convert,
  });
};

// Get Device
exports.getDevice = async (req, res) => {
  const deviceId = req.headers["x-device"];
  const userId = req.userId;
  let device = await Device.findOne({ deviceId: deviceId, userId: userId });

  return res.status(200).json({
    success: !!device,
    message: "Get device successfully",
    data: device,
  });
};

// Get Device
exports.getAllDevicesByUser = async (req, res) => {
  const userId = req.userId;
  let devices = await Device.find({ userId: userId });

  return res.status(200).json({
    success: !!devices,
    message: `Get all devices of ${userId}`,
    data: devices,
  });
};

// Update Language
exports.updateLanguage = async (req, res) => {
  const userId = req.userId;
  const deviceId = req.headers["x-device"];
  const { language } = req.body;

  // Update if existed
  const device = await Device.findOneAndUpdate(
    { userId: userId, deviceId: deviceId },
    {
      language: language,
      modified_date: new Date(),
    },
    {
      new: true,
    }
  );

  return res.status(200).json({
    success: !!device,
    message: "Update device language successfully",
    data: device,
  });
};

// Update Currency
exports.updateCurrency = async (req, res) => {
  const userId = req.userId;
  const deviceId = req.headers["x-device"];
  const { currency } = req.body;

  // Update if existed
  const device = await Device.findOneAndUpdate(
    { userId: userId, deviceId: deviceId },
    {
      currency: currency,
      modified_date: new Date(),
    },
    {
      new: true,
    }
  );

  return res.status(200).json({
    success: !!device,
    message: "Update device currency successfully",
    data: device,
  });
};

// Send a test push
exports.sendpushTest = async (req, res) => {
  const user_id = req.user_id;
  const { device_token } = req.body;
  const device_id = req.headers["x-device"];

  const message = {
    notification: {
      title: "Push notifications are great!",
      body: "They could be better if you used SendMan :-)",
    },
    data: {
      type: "push-test",
    },
  };

  let registrationTokens = [];
  if (device_token) {
    registrationTokens.push(device_token);
    sendPush(message, registrationTokens);
    return res.status(200).json({
      success: true,
      message: `Successfully sent the notification to devices.`,
    });
  }

  Device.find(
    {
      $and: [{ user_id: user_id }, { device_id: { $ne: device_id } }],
    },
    function (err, results) {
      results.forEach(function (element) {
        registrationTokens.push(element.device_token);
      });
    }
  )
    .select("device_token")
    .then(async (result) => {
      console.log(
        `Attempting to send the notification to ${registrationTokens.length} devices.`
      );
      sendPush(message, registrationTokens);
    });

  return res.status(200).json({
    success: true,
    message: `Successfully sent the notification to devices.`,
  });
};

function sendPush(message, registrationTokens) {
  if (registrationTokens.length) {
    message.tokens = registrationTokens;
    fcm.onSendPush(message);
  }
}

exports.sendPushToOldApp = async (req, res) => {
  try {
    const { notificationInVi, notificationInEn, data, tokens } = req.body;

    fcm.sendPushAllDevice(notificationInVi, notificationInEn, data, tokens);

    return res.status(200).json({
      success: true,
      message: "Send push to devices successfully",
      data: null,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: "Send push to devices failed",
      data: null,
    });
  }
};
