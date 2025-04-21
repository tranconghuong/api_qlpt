const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const mongoosePaginate = require("mongoose-paginate-v2");
const groupRoomUserSchema = new Schema(
  {
    id: {
      type: String,
      unique: true,
    },
    firstName: {
      type: String,
    },
    lastName: {
      type: String,
    },
    email: {
      type: String,
    },
    phone: {
      type: String,
    },
    code: {
      type: String,
    },
    linkedUserId: {
      type: String,
    },
    role: {
      type: String,
    },
    creatorId: {
      type: String,
    },
    groupId: {
      type: String,
      required: true,
    },
    groupRoomId: {
      type: String,
      required: true,
    },
    startDate: {
      type: Date,
      default: null,
    },
    endDate: {
      type: Date,
      default: null,
    },
    birthDay: {
      type: Date,
      default: null,
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
    },
    syncedTime: {
      type: Date,
      default: Date.now,
    },
  },
  { versionKey: false }
);
groupRoomUserSchema.plugin(mongoosePaginate);
groupRoomUserSchema.index({ id: 1 }, { unique: false });
const GroupRoomUser = mongoose.model("GroupRoomUser", groupRoomUserSchema);

module.exports = { GroupRoomUser };
