const mongoose = require("mongoose");
const mongooseAggregatePaginate = require("mongoose-aggregate-paginate");
const Schema = mongoose.Schema;

const deviceSchema = new Schema(
  {
    userId: {
      type: String,
    },
    deviceId: {
      type: String,
      required: true,
      unique: true,
    },
    deviceToken: {
      type: String,
      unique: true,
    },
    osVersion: {
      type: String,
    },
    osType: {
      type: String,
      enum: ["ios", "android", "other"],
      default: "other",
      required: true,
    },
    language: {
      type: String,
      default: "vi",
    },
    currency: {
      type: String,
      default: "VND",
    },
    appVersion: {
      type: String,
    },
    created: {
      type: Date,
      default: Date.now,
    },
    updated: {
      type: Date,
      default: Date.now,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      required: true,
    },
    syncedTime: {
      type: Date,
      default: Date.now,
    },
  },
  { versionKey: false }
);
deviceSchema.plugin(mongooseAggregatePaginate);
const Device = mongoose.model("Device", deviceSchema);

module.exports = { Device };
