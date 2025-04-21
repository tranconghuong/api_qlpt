const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const Schema = mongoose.Schema;

const HostelNotificationSchema = new Schema(
  {
    id: {
      type: String,
      unique: true,
    },
    userId: {
      type: String,
      required: true,
    },
    senderId: {
      type: String,
    },
    groupUserId: {
      type: String,
    },
    title: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      required: true,
      enum: [
        "addSalaries",
        "subtractSalaries",
        "paidLeaveHistory",
        "timesheet",
        "leaveapp",
        "other",
      ],
      default: "other",
    },
    groupId: {
      type: String,
    },
    content: {
      type: String,
      required: true,
    },
    reason: {
      type: String,
    },
    isWatched: {
      type: Boolean,
      default: false,
    },
    recordDate: {
      type: Date,
      required: true,
    },
    notification: {
      type: Date,
      default: Date.now,
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
  { versionKey: false }
);

HostelNotificationSchema.plugin(mongoosePaginate);
HostelNotificationSchema.index({ id: 1, userId: 1 }, { unique: true });
HostelNotificationSchema.index({ groupUserId: 1 });
const HostelNotification = mongoose.model(
  "HostelNotification",
  HostelNotificationSchema
);
module.exports = { HostelNotification };
