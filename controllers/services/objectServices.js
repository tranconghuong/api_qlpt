// const { Device } = require("../models/device.model");
const { GroupRoomUser } = require("../../models/group_room_user.model");
const { GroupRoom } = require("../../models/group_room.model");
const { Group } = require("../../models/group.model");
const { Notification } = require("../../models/notification.model");
const {
  HostelNotification,
} = require("../../models/hostel_notification.model");
const { User } = require("../../models/user.model");
const { Pay } = require("../../models/pay.model");

function getObject(object) {
  switch (object) {
    case "groupRoomUser":
      return GroupRoomUser;
    case "groupRoom":
      return GroupRoom;
    case "group":
      return Group;
    case "pay":
      return Pay;
    case "notification":
      return Notification;
    case "hostelNotification":
      return HostelNotification;
    case "user":
      return User;
    default:
      return false;
  }
}

function getAction(object) {
  switch (object) {
    case "groupRoomUser":
      return "push-grouproomuser";
    case "groupRoom":
      return "push-grouproom";
    case "group":
      return "push-group";
    case "pay":
      return "push-pay";
    case "user":
      return "push-user";
    default:
      return "";
  }
}

module.exports = {
  getObject,
  getAction,
};
