const admin = require("firebase-admin");
const { Device } = require("../models/device.model");
const { Notification } = require("../models/notification.model");
const i18n = require("i18n");
const { onSendPush } = require("./fmc");

const action_enum = {
  join: 'group-join',
  create: 'group-create',
  accept: 'group-accept',
  reject: 'group-reject',
  leave: 'group-leave',
  cancel: 'group-cancel',
  update: 'group-update'
}

/**
 * Sends push notifications to specified user devices.
 * 
 * @param {Object} message - The message payload to send.
 * @param {Array} userIds - The IDs of the target users.
 * @param {string} skipped_deviceId - The ID of the device to skip.
 * @param {string} userId - The ID of the sender user (optional).
 * @param {string} action - The action associated with the notification (optional).
 * @param {Object} options - The options for sending push notifications.
 */
exports.sendPush = async (message, userIds, skipped_deviceId, options = { priority: "normal", contentAvailable: true }) => {

  let registrationTokens = [];
  const devices = await Device.find({
    $and: [
      { userId: { $in: userIds } },
      { deviceId: { $ne: skipped_deviceId } },
      { device_token: { $ne: "" } }
    ]
  });

  // Check if there are devices to send notifications
  if (devices.length > 0) {
    devices.forEach(function (element) {
      if (!element.device_token.trim()) { return };

      // Check device language
      let lang = element.language;
      if (!lang || lang == "" || lang == "vi") { lang = "vn"; }

      const action = message.data.type;
      message.notification = {};
      // Check data type => push notification
      if (Object.values(action_enum).includes(action) && message.data.type_ == "receive" ) {
        switch (action) {
          case action_enum.join:
            message.notification.title = i18n.__({ phrase: 'group-title', locale: lang });
            message.notification.body = i18n.__({ phrase: 'group-join', locale: lang },  message.data.user_name,  message.data.name)
            break;
          // case action_enum.create:
          //   message.notification.title = i18n.__({ phrase: 'group-title', locale: lang });
          //   message.notification.body = i18n.__({ phrase: 'group-join', locale: lang },  message.data.user_name,  message.data.name)
          //   break;
          case action_enum.accept:
            message.notification.title = i18n.__({ phrase: 'group-title', locale: lang });
            message.notification.body = i18n.__({ phrase: 'group-accept', locale: lang },  message.data.name)
            break;
          case action_enum.reject:
            message.notification.title = i18n.__({ phrase: 'group-title', locale: lang });
            message.notification.body = i18n.__({ phrase: 'group-reject', locale: lang },  message.data.name)
            break;
          case action_enum.leave:
            message.notification.title = i18n.__({ phrase: 'group-title', locale: lang });
            message.notification.body = i18n.__({ phrase: 'group-leave', locale: lang },  message.data.member_name,  message.data.name);
            break;
          case action_enum.cancel:
            message.notification.title = i18n.__({ phrase: 'group-title', locale: lang });
            message.notification.body = i18n.__({ phrase: 'group-cancel', locale: lang },  message.data.member_name,  message.data.name);
            break;
          case action_enum.remove:
            message.notification.title = i18n.__({ phrase: 'group-title', locale: lang });
            message.notification.body = i18n.__({ phrase: 'group-remove', locale: lang },  message.data.name);
            break;
          default:
            break;
        }
      }
      
      Notification.create({
        sender_id:  message.data.requested_user ? message.data.requested_user  : "",
        reciever_id: element.userId,
        deviceId: element.deviceId,
        skipped_device: skipped_deviceId,
        device_token: element.device_token,
        type: message.data.type,
        action: action,
        message : JSON.stringify(message)
      });

      registrationTokens.push(element.device_token);
    });

    // Send push notifications to registered devices
    if (registrationTokens.length > 0) {
      message.tokens = registrationTokens;
      onSendPush(message);
    }
  }
}
