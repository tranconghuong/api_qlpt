const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const mongoosePaginate = require("mongoose-paginate-v2");
const groupSchema = new Schema(
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
    currency: {
      type: String,
    },
    paymentDate: {
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

groupSchema.plugin(mongoosePaginate);
groupSchema.index({ id: 1 }, { unique: false });
const Group = mongoose.model("Group", groupSchema);

module.exports = { Group };
