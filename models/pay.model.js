const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const mongoosePaginate = require("mongoose-paginate-v2");
const paySchema = new Schema(
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
    price: {
      type: Number,
    },
    digitsOld: {
      type: Number,
    },
    digitsNew: {
      type: Number,
    },
    mOld: {
      type: Number,
    },
    mNew: {
      type: Number,
    },
    linkedUserId: {
      type: String,
    },
    payType: {
      type: String,
      enum: ["pending", "cancel", "done"],
      required: true,
      default: "pending",
    },
    groupId: {
      type: String,
    },
    groupRoomId: {
      type: String,
    },
    payDate: {
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
      required: true,
    },
    syncedTime: {
      type: Date,
      default: Date.now,
    },
  },
  { versionKey: false }
);

paySchema.plugin(mongoosePaginate);
paySchema.index({ id: 1 }, { unique: false });
const Pay = mongoose.model("Pay", paySchema);

module.exports = { Pay };
