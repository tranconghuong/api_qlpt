const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const mongoosePaginate = require("mongoose-paginate-v2");
const groupRoomSchema = new Schema(
  {
    id: {
      type: String,
      unique: true,
    },
    name: {
      type: String,
    },
    status: {
      type: String,
      enum: ["working", "ended"],
      required: true,
      default: "working",
    },
    creatorId: {
      type: String,
    },
    groupId: {
      type: String,
    },
    paymentDate: {
      type: Number,
    },
    price: {
      type: Number,
    },
    maxMember: {
      type: Number,
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

groupRoomSchema.plugin(mongoosePaginate);
groupRoomSchema.index({ id: 1 }, { unique: false });
const GroupRoom = mongoose.model("GroupRoom", groupRoomSchema);

module.exports = { GroupRoom };
