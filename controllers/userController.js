const jwt = require("jsonwebtoken");
const config = require("../configs/database");
const bcrypt = require("bcrypt-nodejs");
const { User } = require("../models/user.model");
const { Device } = require("../models/device.model");
const { GroupRoom } = require("../models/group_room.model");
const { Group } = require("../models/group.model");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");
const clientIDGG = process.env.clientIDGG;
const { OAuth2Client } = require("google-auth-library");
const client = new OAuth2Client(clientIDGG);
const FCM = require("../utils/fmc");
const { GroupRoomUser } = require("../models/group_room_user.model");

exports.demo = async (req, res) => {
  try {
    // Xóa tất cả các bản ghi trong MongoDB
    await User.deleteMany({});
    await Group.deleteMany({});
    await GroupRoom.deleteMany({});
    await GroupRoomUser.deleteMany({});
    await Device.deleteMany({});
    return res.json({
      success: true,
      data: null,
      message: "Login successfully.",
      code: 200,
      errorCode: 0,
    });
  } catch (err) {
    console.log(err);
    return res.json({
      success: false,
      data: null,
      message: "Login Fail.",
      code: 400,
      errorCode: 400,
    });
  }
};

exports.getUser = async (req, res) => {
  try {
    // Tìm tất cả người dùng trong MongoDB
    const users = await User.find({});

    if (users.length > 0) {
      // Trả về thông tin người dùng nếu tìm thấy
      return res.status(200).json({
        success: true,
        data: users,
        message: "User found successfully.",
        code: 200,
        errorCode: null,
      });
    } else {
      // Trường hợp không tìm thấy người dùng
      return res.status(404).json({
        success: false,
        data: null,
        message: "User not found.",
        code: 404,
        errorCode: "USER_NOT_FOUND",
      });
    }
  } catch (err) {
    // Xử lý lỗi không mong muốn từ cơ sở dữ liệu hoặc các lỗi khác
    console.error("Error fetching user:", err);

    return res.status(500).json({
      success: false,
      data: null,
      message: "Error fetching user. Please try again later.",
      code: 500,
      errorCode: "INTERNAL_SERVER_ERROR",
    });
  }
};

exports.signinSocial = async (req, res) => {
  try {
    const {
      firstName = "No Name",
      lastName = "",
      socialId,
      authType,
      socialToken,
    } = req.body;
    let { email } = req.body;
    email = email?.toLowerCase() || "";

    if (!["google"].includes(authType))
      return res.status(400).json(jsonAuthTypeNotValid());

    let sub = "",
      emailFromSocial = email;
    try {
      const googlePayload = await googleVerifyTokenId(socialToken);
      if (!googlePayload) return res.status(400).json(jsonAuthTypeNotValid());
      sub = googlePayload.sub || socialId;
      emailFromSocial = googlePayload.email?.toLowerCase() || email;
    } catch {
      return res.status(400).json(jsonAuthTypeNotValid());
    }

    let user;
    user = await User.findOne({
      $and: [{ email: emailFromSocial }, { email: { $ne: "" } }],
    });

    if (!user) {
      user = await User.findOne({
        $and: [{ authType: authType }, { socialId: sub }],
      });
    }

    if (!user) {
      user = await User.create({
        firstName,
        lastName,
        email: emailFromSocial,
        tmpEmail: emailFromSocial,
        emailVerified: !!emailFromSocial,
        socialId: sub,
        authType,
        pointCode: await generateUID(),
      });
    }

    if (user.status === "deactivate") {
      return res.status(200).json({
        success: false,
        message: "Account deactivated. Please contact support!",
        code: 405,
      });
    }

    // Update thông tin nếu có thay đổi
    if (
      user.email !== emailFromSocial ||
      user.socialId !== sub ||
      user.authType !== authType
    ) {
      await User.updateOne(
        { _id: user._id },
        { email: emailFromSocial || user.email, socialId: sub, authType }
      );
    }

    // Cập nhật point_code nếu chưa có
    if (!user.pointCode) {
      await User.updateOne(
        { _id: user._id },
        { pointCode: await generateUID() }
      );
    }
    const payload = {
      _id: user._id,
      first_name: firstName,
      last_name: lastName,
      email: email,
      social_id: socialId,
      auth_type: authType,
    };

    let token;
    if (email == "pkhung.dev3@gmail.com") {
      token = jwt.sign(payload, config.secret, {
        expiresIn: +120,
      });
    } else {
      token = jwt.sign(payload, config.secret, {
        expiresIn: +config.token_time,
      });
    }

    const refreshToken = jwt.sign(payload, config.secret, {
      expiresIn: +config.refresh_token_time,
    });
    const { _id, ...convert } = user.toObject();
    convert.id = _id;
    return res.json({
      success: true,
      token,
      refreshToken,
      data: convert,
      message: "Login successfully.",
      code: 200,
    });
  } catch (error) {
    console.error(error);
    return res.status(400).json(jsonAuthTypeNotValid());
  }
};

async function googleVerifyTokenId(token) {
  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
      requiredAudience: clientIDGG,
    });
    const payload = ticket.getPayload();
    return payload;
  } catch (error) {
    console.log(error);
    return 0;
  }
}
async function getAllGroupsAndUsersForUser(userId) {
  try {
    const groupsAndUsers = await GroupUser.aggregate([
      {
        $match: { linkedUserId: userId.toString(), isDeleted: false },
      },
      {
        $lookup: {
          from: "groups",
          localField: "groupId",
          foreignField: "id",
          as: "group",
        },
      },
      {
        $unwind: "$group",
      },
      {
        $replaceRoot: { newRoot: "$group" },
      },
      {
        $lookup: {
          from: "groupusers",
          localField: "id",
          foreignField: "groupId",
          as: "groupUsers",
        },
      },
    ]).exec();

    return groupsAndUsers;
  } catch (err) {
    // Handle any errors here
    console.error("Error while fetching groups and users for the user:", err);
    throw err;
  }
}

exports.loginByEmail = async (req, res) => {
  const { email } = req.body;

  const user = await User.findOne({
    $and: [{ email: email }, { email: { $ne: "" } }],
  }).select(
    "_id avatar first_name last_name email auth_type status current_plan plan_expired_time point_code social_id social_token language"
  );

  if (!user) {
    return res.json({
      success: false,
      message: "Login failed.",
      code: 200,
      errorCode: 0,
    });
  }

  //Update point_code
  if (user.pointCode == "") {
    user = await User.findOneAndUpdate(
      { _id: user._id },
      {
        pointCode: await generateUID(),
      },
      {
        new: true,
      }
    );
  }

  if (user.plan_expired_time) {
    const plan_expired_time_convert = new Date(user.plan_expired_time);
    plan_expired_time_convert.setUTCHours(23, 59, 59, 0);
    const plan_expired_time_convert_formattedTime =
      plan_expired_time_convert.toISOString();
    user.plan_expired_time = plan_expired_time_convert_formattedTime;
  }

  const groups = await getAllGroupsAndUsersForUser(user._id);

  let payload = {
    _id: user._id,
    first_name: user.first_name,
    last_name: user.last_name,
    email: user.email,
    social_id: user.social_id,
    auth_type: user.auth_type,
  };

  const token = jwt.sign(payload, config.secret, {
    expiresIn: +config.token_time,
  });

  const refreshToken = jwt.sign(payload, config.secret, {
    expiresIn: +config.refresh_token_time,
  });

  let settings = await Setting.find({ user_id: user._id }).select("key value");

  // let device = await Device.findOneAndUpdate(
  //   { device_id: device_id },
  //   {
  //     user_id: user._id,
  //     modified_date: new Date()
  //   },
  //   {
  //     new: true
  //   }
  // );

  return res.json({
    success: true,
    token: token,
    refreshToken,
    data: user,
    groups: groups,
    settings: settings,
    message: "Login successfully.",
    code: 200,
    errorCode: 0,
  });
};

function jsonAuthTypeNotValid() {
  return {
    success: false,
    data: null,
    message: "Auth type is not valid",
    code: 400,
    errorCode: "LOGIN_FAILED",
  };
}

exports.refreshToken = async (req, res) => {
  const { refreshToken } = req.body;
  try {
    const user = await verifyRefreshToken(refreshToken, config.secret);
    delete user.iat;
    delete user.exp;

    let token;
    if (user.email == "yeuthibaoyeu@gmail.com") {
      token = jwt.sign(user, config.secret, {
        expiresIn: +120,
      });
    } else {
      token = jwt.sign(user, config.secret, {
        expiresIn: +config.token_time,
      });
    }

    // const token = jwt.sign(user, config.secret, {
    //     expiresIn: +config.token_time,
    // });
    const newRefreshToken = jwt.sign(user, config.secret, {
      expiresIn: +config.refresh_token_time,
    });
    return res.json({
      success: true,
      token,
      refreshToken: newRefreshToken,
    });
  } catch (error) {
    res.status(403).send({
      success: false,
      result: null,
      message: "Invalid Refresh Token.",
      code: 403,
    });
  }
};

exports.expireToken = async (req, res) => {
  try {
    let { token } = req.body;
    const user = await verifyRefreshToken(token, config.secret);
    delete user.iat;
    delete user.exp;
    token = jwt.sign(user, config.secret, {
      expiresIn: 0,
    });
    return res.json({
      success: true,
      token,
    });
  } catch (error) {
    res.status(403).send({
      success: false,
      result: null,
      message: "Invalid Refresh Token.",
      code: 403,
    });
  }
};

exports.me = async (req, res) => {
  const userId = req.userId;
  const user = await User.findOne({ _id: userId });

  return res.json({
    success: true,
    result: user,
    message: "Get successfully.",
    code: 200,
    errorCode: "GET_ME_SUCCESSFULLY",
  });
};

async function verifyRefreshToken(token, secretKey) {
  return new Promise((resolve, reject) => {
    jwt.verify(token, secretKey, (err, decoded) => {
      if (err) {
        return reject(err);
      }
      resolve(decoded);
    });
  });
}

function generateRandomString() {
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let randomString = "";
  const stringLength = 6;

  for (let i = 0; i < stringLength; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    randomString += characters.charAt(randomIndex);
  }

  return randomString.toUpperCase();
}

async function generateUID() {
  const uidString = generateRandomString();
  const user = await User.findOne({ where: { pointCode: uidString } });
  if (user) {
    return generateUID();
  } else {
    return uidString;
  }
}

exports.grantAccess = async (req, res) => {
  try {
    const { code, email, groupId } = req.params;

    if (!code || !email || !groupId) {
      return res.status(400).json({
        success: false,
        message: "Code, email and groupId are required!",
      });
    }

    // get user by email and code
    const user = await User.findOne({ email, pointCode: code });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "USER NOT FOUND!",
        error_code: "USER_NOT_FOUND",
      });
    }

    // send push to this userId and all admin in group
    const deviceId = req.headers["x-device"];

    const message = {
      data: {
        type: "grant-access",
        requested_user: user._id.toString(),
        requested_group: groupId.toString(),
      },
    };
    const options = { priority: "normal", contentAvailable: true };

    const userIds = GroupUser.find({
      groupId: groupId,
      $or: [{ role: "admin" }, { linkedUserId: user._id.toString() }],
      isDeleted: false,
    }).distinct("linkedUserId");

    if (userIds && userIds.length > 0)
      FCM.sendPushV2(message, options, userIds, deviceId, req, "");

    return res.status(200).json({
      success: true,
      message: "Grant access successfully!",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Grant access failed!",
    });
  }
};

exports.linkUser = async (req, res) => {
  const { groupId, email, code, groupRoomUserId, groupRoomId, force } =
    req.body;
  const deviceId = req.headers["x-device"];

  // Check email
  const user = await User.findOne({ email });
  if (!user) {
    return res.status(200).json({
      success: false,
      message: "USER NOT FOUND!",
      error_code: "USER_NOT_FOUND",
    });
  }

  // Check code
  if (user.pointCode != code) {
    return res.status(200).json({
      success: false,
      message: "CODE WRONG!",
      error_code: "CODE_WRONG",
    });
  }

  // Check user already link
  let groupUser = await GroupRoomUser.findOne({
    groupId,
    email,
    linkedUserId: user._id.toString(),
    // isDeleted: 0
  });

  if (groupUser) {
    return res.status(200).json({
      success: false,
      message: "USER ALREADY EXISTS",
      error_code: "USER_ALREADY_EXISTS",
    });
  }

  // Check mail link is admin ???
  groupUser = await GroupRoomUser.findOne({
    groupId,
    linkedUserId: user._id.toString(),
    role: "admin",
  });

  if (groupUser) {
    return res.status(200).json({
      success: false,
      message: "IS_ADMIN",
      error_code: "IS_ADMIN",
    });
  }

  // if force, clear and only link this user
  if (force) {
    const query = {
      $or: [
        {
          groupId,
          groupRoomId,
          email,
        },
        { id: groupRoomUserId },
      ],
    };

    await GroupRoomUser.updateMany(
      query,
      {
        linkedUserId: "",
        code: "",
        syncedTime: new Date(),
        updated: new Date(),
      },
      { multi: true }
    );
  }

  groupUser = await GroupRoomUser.findOneAndUpdate(
    {
      $or: [
        {
          groupId,
          groupRoomId,
          email,
          isDeleted: 0,
        },
        { id: groupRoomUserId, isDeleted: 0 },
      ],
    },
    {
      linkedUserId: user._id.toString(),
      code: user.pointCode,
      syncedTime: new Date(),
      updated: new Date(),
    },
    {
      sort: { created: -1 },
      new: true,
    }
  );

  // Push all liked member in group
  const message = {
    data: {
      type: "linked-new-member",
      groupId: groupId,
      requestedUser: user._id.toString(),
    },
  };

  const options = { priority: "normal", contentAvailable: true };
  let userIds = await GroupRoomUser.find(
    {
      groupId: groupId,
      isDeleted: false,
    },
    "linkedUserId"
  );
  userIds = userIds.map((obj) => obj.linkedUserId);

  if (userIds.length > 0)
    FCM.sendPushV2(message, options, userIds, deviceId, req, "linkUser");

  return res.status(200).json({
    success: true,
    data: groupUser,
    message: "Link user success!",
  });
};

exports.unlinkUser = async (req, res) => {
  const { groupId, groupRoomUserId } = req.body;
  const deviceId = req.headers["x-device"];

  // console.log(groupId);
  // console.log(groupUserId);
  // Check user already link
  let groupUser = await GroupRoomUser.findOne({
    groupId,
    id: groupRoomUserId,
  });

  if (!groupUser) {
    return res.status(200).json({
      success: false,
      message: "GROUP USER NOT FOUND!!!",
      error_code: "GROUP_USER_NOT_FOUND",
    });
  }

  let linkedUserId = groupUser.linkedUserId.toString();
  // Push all linked member in group
  const message = {
    data: {
      type: "unlinked-member",
      groupId: groupId,
      requestedUser: linkedUserId,
    },
  };

  groupUser = await GroupRoomUser.findOneAndUpdate(
    {
      groupId,
      id: groupRoomUserId,
    },
    {
      linkedUserId: "",
      code: "",
      syncedTime: new Date(),
      updated: new Date(),
    },
    {
      new: true,
    }
  );

  const options = { priority: "normal", contentAvailable: true };
  let userIds = await GroupRoomUser.find(
    {
      groupId: groupId,
      isDeleted: false,
    },
    "linkedUserId"
  );

  // console.log(userIds);
  userIds = userIds.map((obj) => obj.linkedUserId);
  userIds.push(linkedUserId);
  // console.log(userIds);
  if (userIds.length > 0)
    FCM.sendPushV2(message, options, userIds, deviceId, req, "unLinkUser");

  return res.status(200).json({
    success: true,
    data: groupUser,
    message: "Unlink user success!",
  });
};
