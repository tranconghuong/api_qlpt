const admin = require("firebase-admin");
const { Device } = require("../models/device.model");
const { Notification } = require("../models/notification.model");
exports.sendPush = async (
  message,
  options,
  userIds,
  skipped_deviceId,
  req,
  action = ""
) => {
  let registrationTokens = [];
  const devices = await Device.find({
    $and: [
      { userId: { $in: userIds } },
      { deviceId: { $ne: skipped_deviceId } },
      { device_token: { $ne: "" } },
    ],
  }).select("userId deviceId device_token language");

  for (let index = 0; index < devices.length; index++) {
    const element = devices[index];
    if (!element.device_token.trim()) continue;
    registrationTokens.push(element.device_token);

    // Add Notification Log
    try {
      Notification.create({
        sender_id: req.userId ? req.userId : "",
        reciever_id: element.userId,
        deviceId: element.deviceId,
        skipped_device: skipped_deviceId,
        device_token: element.device_token,
        type: message.data.type,
        action: action,
        message: JSON.stringify(message),
      });
    } catch (error) {
      console.log(error);
    }
  }

  console.log(
    `Attempting to send the notification to ${registrationTokens.length} devices.`
  );

  if (registrationTokens.length > 0) {
    admin
      .messaging()
      .sendToDevice([...new Set(registrationTokens)], message, options)
      .then((res) => {
        console.log(
          `Successfully sent the notification to ${res.successCount} devices (${res.failureCount} failed).`
        );
      })
      .catch((err) => console.log(err));
  }
};

exports.sendPushAllDevice = async (
  notificationInVi,
  notificationInEn,
  data,
  tokens
) => {
  try {
    const languageGroup = {
      en: [],
      vi: [],
    };

    let conditions = {
      $or: [
        {
          $gt: [
            {
              $toInt: { $arrayElemAt: [{ $split: ["$app_version", "."] }, 0] },
            },
            2,
          ],
        },
        {
          $and: [
            {
              $eq: [
                {
                  $toInt: {
                    $arrayElemAt: [{ $split: ["$app_version", "."] }, 0],
                  },
                },
                2,
              ],
            },
            {
              $gt: [
                {
                  $toInt: {
                    $arrayElemAt: [{ $split: ["$app_version", "."] }, 1],
                  },
                },
                0,
              ],
            },
          ],
        },
        {
          $and: [
            {
              $eq: [
                {
                  $toInt: {
                    $arrayElemAt: [{ $split: ["$app_version", "."] }, 0],
                  },
                },
                2,
              ],
            },
            {
              $eq: [
                {
                  $toInt: {
                    $arrayElemAt: [{ $split: ["$app_version", "."] }, 1],
                  },
                },
                0,
              ],
            },
            {
              $gte: [
                {
                  $toInt: {
                    $arrayElemAt: [{ $split: ["$app_version", "."] }, 2],
                  },
                },
                0,
              ],
            },
          ],
        },
      ],
    };

    if (tokens) {
      conditions = { $in: ["$device_token", tokens] };
    }

    const devices = await Device.find({
      $expr: conditions,
    }).select("userId deviceId device_token language");

    if (devices && devices.length > 0) {
      devices.forEach((device) => {
        if (!device.device_token) return;

        if (device.language === "vi" || device.language === "vn") {
          languageGroup.vi.push(device.device_token);
        } else {
          languageGroup.en.push(device.device_token);
        }
      });
    }

    if (languageGroup.vi.length > 0) {
      let message = renderMessage(languageGroup.vi, notificationInVi, data);
      onSendPush(message);
    }

    if (languageGroup.en.length > 0) {
      let message = renderMessage(languageGroup.en, notificationInEn, data);
      onSendPush(message);
    }
  } catch (error) {
    console.log("sendPushAllDeviceError", error);
  }
};

const renderMessage = (tokens, notification, data) => {
  const message = {
    tokens,
    notification: {
      title: notification.title,
      body: notification.message,
    },
    webpush: {
      fcmOptions: {
        link: "https://ezwork-dev.shapeecloud.com",
      },
    },
  };

  if (data) {
    message.data = data;
  }
  return message;
};

const onSendPush = (message) => {
  admin
    .messaging()
    .sendEachForMulticast(message)
    .then(function (response) {
      console.log(
        `Successfully sent the notification to ${response.successCount} devices (${response.failureCount} failed).`
      );
    })
    .catch(function (error) {
      console.error("ERROR_SEND_PUSH:", JSON.stringify(error));
    });
};

exports.onSendPush = onSendPush;

exports.sendPushV2 = async (
  message,
  options,
  userIds,
  skipped_deviceId,
  req,
  action = ""
) => {
  try {
    let registrationTokens = [];
    const devices = await Device.find({
      $and: [
        { userId: { $in: userIds } },
        { deviceId: { $ne: skipped_deviceId } },
        { deviceToken: { $ne: "" } },
      ],
    }).select("userId deviceId deviceToken language");

    for (let index = 0; index < devices.length; index++) {
      const element = devices[index];
      if (!element.deviceToken.trim()) continue;
      registrationTokens.push(element.deviceToken);

      // Add Notification Log
      try {
        Notification.create({
          senderId: req.userId ? req.userId : "",
          recieverId: element.userId,
          deviceId: element.deviceId,
          skippedDevice: skipped_deviceId,
          deviceToken: element.deviceToken,
          type: message.data.type,
          action: action,
          message: JSON.stringify(message),
        });
      } catch (error) {
        console.log(error);
      }
    }

    console.log(
      `Attempting to send the notification to ${registrationTokens.length} devices.`
    );

    if (registrationTokens.length > 0) {
      message.tokens = registrationTokens;
      onSendPush(message);
    }
  } catch (error) {
    console.log(error);
  }
};
