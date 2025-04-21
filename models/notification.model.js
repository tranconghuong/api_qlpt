const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const Schema = mongoose.Schema;

const NotificationSchema = new Schema(
  {
    senderId: {
      type: String,
    },
    recieverId: {
      type: String,
    },
    deviceId: {
      type: String,
    },
    skippedDevice: {
      type: String,
    },
    deviceToken: {
      type: String,
    },
    type: {
      type: String,
    },
    action: {
      type: String,
    },
    message: {
      type: String,
    },
    isViewed: {
      type: Boolean,
      default: false,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    created: {
      type: Date,
      default: Date.now,
    },
    updated: {
      type: Date,
      default: Date.now,
    },
    syncedTime: {
      type: Date,
      default: Date.now,
    },
  },
  {
    versionKey: false,
  }
);

NotificationSchema.plugin(mongoosePaginate);
const Notification = mongoose.model("Notification", NotificationSchema);
module.exports = { Notification };
