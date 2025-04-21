const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const mongooseAggregatePaginate = require("mongoose-aggregate-paginate");

const userSchema = new Schema(
  {
    firstName: {
      type: String,
      required: true,
      default: "No",
    },
    lastName: {
      type: String,
      required: true,
      default: "Name",
    },
    authType: {
      type: String,
      enum: ["google", "facebook", "apple"],
    },
    socialId: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      unique: true,
      sparse: true, // Tránh lỗi unique với null
      match: /\S+@\S+\.\S+/, // Validate email
    },
    tmpEmail: {
      type: String,
    },
    phone: {
      type: String,
    },
    dob: {
      type: String,
    },
    gender: {
      type: String,
      enum: ["male", "female", "other"],
      default: "male",
    },
    forgotPassToken: {
      type: String,
    },
    passCode: {
      type: String,
    },
    avatar: {
      type: String,
      default: null,
    },
    emailVerified: {
      type: Boolean,
      default: true,
    },
    verifiedToken: {
      type: String,
    },
    status: {
      type: String,
      enum: ["pending", "active", "deactivate"],
      default: "active",
    },
    pointCode: {
      type: String,
      unique: true,
      default: "",
    },
    language: {
      type: String,
      default: "vi",
    },
    appColor: {
      type: String,
      default: "",
    },
    paidColor: {
      type: String,
      default: "",
    },
    unpaidColor: {
      type: String,
      default: "",
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

userSchema.plugin(mongooseAggregatePaginate);
const User = mongoose.model("User", userSchema);

module.exports = { User };
