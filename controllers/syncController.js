const { GroupUser } = require("../models/group_room.model");
const {
  GroupShift,
  GroupRoomUser,
} = require("../models/group_room_user.model");
const { Group } = require("../models/group.model");
const { User } = require("../models/user.model");
const { v4: uuidv4 } = require("uuid");
const FCM = require("../utils/fmc");
const getPagination = (page, size) => {
  const limit = size ? +size : 10;
  const offset = page ? page * limit : 0;
  return { limit, offset };
};
const { debug_user_id } = require("../configs/database");
const { constructConditionForPullv3 } = require("./services/syncV3Services");

const { getObject, getAction } = require("./services/objectServices");

exports.pullv3 = async (req, res) => {
  const object = req.query.object;
  const { page, size, lastSynced } = req.body;

  let groupIds = req.body.groupIds || "";
  let userIds = req.body.userIds || "";

  const userId = req.userId;
  const { limit, offset } = getPagination(page, size);
  const { condition, Objectdb, synce_condition } =
    await constructConditionForPullv3(
      object,
      userId,
      lastSynced,
      groupIds,
      userIds
    );
  if (!condition || !Objectdb) {
    return res
      .status(400)
      .json({ success: false, message: "Object not found!" });
  }

  console.log("LOG_PULLV3_CONDITION", condition);

  Objectdb.paginate(condition, {
    limit,
    offset,
    sort: { syncedTime: "asc", id: "desc" },
  })
    .then((result) =>
      res.json({
        success: !!result.docs,
        data: result.docs,
        totalPages: result.totalPages,
        currentPage: result.page,
      })
    )
    .catch((error) =>
      res.status(400).json({ success: false, message: "Pull Plan error" })
    );
};

exports.checkPullDatav4 = async (req, res) => {
  const {
    userId,
    body: { objects = [] },
  } = req;
  const resultData = [];
  const executionTimes = [];

  if (!objects.length) {
    return res
      .status(400)
      .json({ success: false, message: "Object not found!" });
  }

  try {
    const promises = objects.map(async (object, index) => {
      const { objectName, lastSynced, groupIds = "", userIds = "" } = object;
      if (!objectName) {
        throw new Error("Missing objectName in the object");
      }
      const { condition, Objectdb } = await constructConditionForPullv3(
        objectName,
        userId,
        lastSynced,
        groupIds,
        userIds
      );

      const startTime = Date.now();
      const count = await Objectdb.countDocuments(condition);
      const endTime = Date.now();

      const executionTime = endTime - startTime;
      executionTimes.push({ objectName, executionTime });

      if (count > 0) {
        resultData.push(objectName);
      }
    });

    await Promise.all(promises);

    // Find the query with the longest execution time
    const longestQuery = executionTimes.reduce(
      (max, current) => {
        return current.executionTime > max.executionTime ? current : max;
      },
      { objectName: "", executionTime: 0 }
    );

    console.log("Longest query:", longestQuery);

    if (debug_user_id == userId.toString()) {
      console.log("LOG_CHECK_PULL_DATA_BODY", JSON.stringify(req.body));
      console.log("LOG_CHECK_PULL_DATA_RESULT", JSON.stringify(resultData));
    }

    return res.json({ success: true, data: resultData });
  } catch (error) {
    console.error("checkPullData error:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while processing your request.",
      error: error.message,
    });
  }
};

exports.push = async (req, res) => {
  const data = req.body.data;
  const object = req.query.objectName;

  const { userId } = req;
  const Objectdb = getObject(object);
  if (!Objectdb) {
    return res.status(400).json({
      success: false,
      message: "Object not found!",
    });
  }

  let currentTime = new Date();
  let groupIdsArray = new Set(); // Use Set for unique groupIds
  let saveDataResponse = [];
  let successSaveIds = [];
  console.log("data", data);
  for (let item of data) {
    // Reset time to now if user change device time to future and save data.
    item.updated =
      new Date(item.updated) > currentTime ? currentTime : item.updated;
    item.created =
      new Date(item.created) > currentTime ? currentTime : item.created;

    groupIdsArray.add(item.groupId);
    try {
      let checkExisted;

      if (object === "notification") {
        checkExisted = await Objectdb.findOne({
          $or: [{ senderId: item.senderId }, { recieverId: item.recieverId }],
        });
      } else if (object === "user") {
        checkExisted = await Objectdb.findOne({ _id: item.id });
      } else {
        checkExisted = await Objectdb.findOne({ id: item.id });
      }

      if (!checkExisted) {
        console.log("create", item);
        await Objectdb.create(item);
        // Send push for specific objects
        if (
          ["timesheet", "addition", "deduction", "leaveapp"].includes(object)
        ) {
          sendPushTimeSheetAndAdminAddOffSallary(
            req,
            getAction(object),
            item,
            object
          );
        }
      } else {
        // If user saved updated data in future, we must cast it to now fisrt.
        if (new Date(checkExisted.updated) > currentTime) {
          checkExisted = await Objectdb.findOneAndUpdate(
            { _id: checkExisted._id },
            {
              updated: currentTime,
              syncedTime: currentTime,
            },
            {
              new: true,
            }
          );
        }

        if (new Date(item.updated) > new Date(checkExisted.updated)) {
          let dataUpdate = { syncedTime: currentTime, ...item };
          dataUpdate.syncedTime = currentTime;
          console.log("currentTime", currentTime);
          if (["groupRoomUser", "user"].includes(object)) {
            // if groupuser, check if creator of group is not linkedUserId -> ignore linkedUserId
            if (object === "groupRoomUser") {
              const senderMember = await GroupRoomUser.findOne({
                groupId: item.groupId,
                linkedUserId: userId,
                isDeleted: false,
              });
              delete dataUpdate.linkedUserId; // don't allow to update linkedUserId, must call link or unlink api

              if (senderMember && senderMember.role === "employee") {
                // employee can only update fname, lname, email, phone, dob, note
                dataUpdate = {
                  firstName: item.firstName,
                  lastName: item.lastName,
                  email: item.email,
                  phone: item.phone,
                  birthDay: item.birthDay,
                  updated: item.updated,
                  syncedTime: currentTime,
                };
              }
            } else if (object === "user") {
              // employee can only update fname, lname, email, phone, dob, note
              dataUpdate = {
                firstName: item.firstName,
                lastName: item.lastName,
                phone: item.phone,
                dob: item.dob,
                appColor: item.appColor,
                paidColor: item.paidColor,
                unpaidColor: item.unpaidColor,
                updated: item.updated,
                syncedTime: currentTime,
              };
            }
          }
          console.log("update", dataUpdate);
          await Objectdb.findOneAndUpdate(
            { _id: checkExisted._id },
            dataUpdate
          );
        }
      }
      saveDataResponse.push({ id: item.id, status: "Success" });
      successSaveIds.push(item.id);
    } catch (error) {
      saveDataResponse.push({ id: item.id, status: "Failed " + error.message });
    }
  }

  // Convert Set back to Array for sending push
  if (successSaveIds.length > 0) {
    sendPushSync(req, getAction(object), [...groupIdsArray]);
  }

  if (debug_user_id == userId.toString()) {
    console.log("LOG_PUSH_DATA_BODY", object, JSON.stringify(req.body));
    console.log(
      "LOG_PUSH_DATA_RESULT",
      object,
      JSON.stringify(saveDataResponse)
    );
  }

  return res.json({
    success: true,
    message: "Push data success",
    last_synced: currentTime,
    checkData: saveDataResponse,
    successSaveIds: successSaveIds,
  });
};

async function sendPushSync(req, action, groupIdsArray) {
  if (!action) {
    return;
  }
  const { userId } = req;
  const deviceId = req.headers["x-device"];

  const message = {
    data: {
      type: "sync-data",
      requested_user: userId.toString(),
    },
  };
  const options = { priority: "normal", contentAvailable: true };
  const userIds = await getUsersByGroupIds(groupIdsArray);
  if (userIds && userIds.length > 0)
    FCM.sendPushV2(message, options, userIds, deviceId, req, action);
}

async function getUsersByGroupIds(groupIds) {
  try {
    // Convert the groupIds to an array if it's not already one
    if (!Array.isArray(groupIds)) {
      groupIds = [groupIds];
    }

    // Query the groupUser collection
    const userIds = GroupRoomUser.find({
      groupId: { $in: groupIds },
      isDeleted: false,
    }).distinct("linkedUserId");

    return userIds;
  } catch (err) {
    // Handle any errors here
    // console.error('Error while fetching users by group IDs:', err);
    throw err;
  }
}

exports.getDuplicateIdAndDeleteByObject = async (req, res) => {
  const { object } = req.query;
  const Objectdb = getObject(object);
  if (!Objectdb) {
    return res.status(400).json({
      success: false,
      message: "Object not found!",
    });
  }

  try {
    // get list object group by id and u > 1 and sort date desc
    const listDuplicate = await Objectdb.aggregate([
      {
        $group: {
          _id: "$id",
          count: { $sum: 1 },
        },
      },
      {
        $match: {
          count: { $gt: 1 },
        },
      },
      {
        $sort: { count: -1 },
      },
    ]);

    // Loop and delete duplicate and keep the first one
    for (let item of listDuplicate) {
      const listObject = await Objectdb.find({ id: item._id }).sort({
        synced_time: -1,
      });
      if (listObject.length > 1) {
        for (let i = 1; i < listObject.length; i++) {
          await Objectdb.deleteOne({ _id: listObject[i]._id });
        }
      }
    }

    return res.json({
      success: true,
      message: `Delete duplicate success`,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: "Get Duplicate Id error",
    });
  }
};

async function sendPushTimeSheetAndAdminAddOffSallary(req, action, item, type) {
  try {
    // console.log('sendPushTimeSheetAndAdminAddOffSallary', item);
    // console.log('sendPushTimeSheetAndAdminAddOffSallary', action);
    // console.log('sendPushTimeSheetAndAdminAddOffSallary', type);
    if (!action) {
      return;
    }
    if (!item) {
      return;
    }
    if (!item.groupId) {
      return;
    }
    if (!item.groupUserId) {
      return;
    }
    // if ( !item.userId ) { return; }
    // if ( !item.shiftId ) { return; }

    const { userId } = req;
    const deviceId = req.headers["x-device"];

    // Check if sender is a member in group?
    const group_id = item.groupId;
    const senderMember = await GroupUser.findOne({
      groupId: group_id,
      linkedUserId: userId,
      isDeleted: false,
    });
    if (!senderMember) return;

    // Get linkedUserId of groupUser
    const groupUser = await GroupUser.findOne({ id: item.groupUserId });
    if (!groupUser) return;

    const memberId = groupUser.linkedUserId;
    if (!memberId) return;

    const linkedUser = await User.findOne({ _id: memberId });
    if (!linkedUser) return; // No need to send push if member is not linked to an User
    const lang = linkedUser.language;

    // get shift of item
    const shift_id = item.shiftId;
    const groupShift = await GroupShift.findOne({
      id: shift_id,
      isDeleted: false,
    });

    // get group name and type
    const group = await Group.findOne({ id: group_id });
    if (!group) return;
    const groupType = group.type;
    const groupName = group.name;

    let body_text = "";
    let body_text_en = "";
    const userIdByLanguage = {
      vi: [],
      en: [],
    };
    let typeNoti = "other";
    let reason = "";

    // Sender is employee will send push to multi admins or managers
    if (senderMember.role === "employee") {
      // Get group admins and managers
      const groupUserAdminsViPromise = GroupUser.aggregate(
        getStringQueryGroupUsers(group_id, ["vi", "vn"])
      );
      const groupUserAdminsEnPromise = GroupUser.aggregate(
        getStringQueryGroupUsers(group_id, ["en"])
      );

      const [groupUserAdminsVi, groupUserAdminsEn] = await Promise.all([
        groupUserAdminsViPromise,
        groupUserAdminsEnPromise,
      ]);

      if (
        (!groupUserAdminsVi || groupUserAdminsVi.length === 0) &&
        (!groupUserAdminsEn || groupUserAdminsEn.length === 0)
      )
        return;

      let fullName = groupUser.fname + " " + groupUser.lname;
      fullName = fullName.replace(/\s+/g, " ").trim();

      if (type === "timesheet") {
        // Employee create/update timesheet
        typeNoti = "timesheet";

        // Checkin when create/update a new timesheet and byAdmin = false and isCheckedOut = false
        if (!item.byAdmin && !item.isCheckedOut) {
          reason = "memberCheckIn";
          body_text = `${fullName} đã vào ca ${
            groupShift.name
          } lúc ${convertTimeFormat(item.timeIn)}.`;
          body_text_en = `${fullName} clocked in the shift ${
            groupShift.name
          } at ${convertTimeFormat(item.timeIn)}.`;
          // Checkout when update a new timesheet and byAdmin = false and isCheckedOut = true
        } else if (!item.byAdmin && item.isCheckedOut) {
          reason = "memberCheckOut";
          body_text = `${fullName} đã ra ca ${
            groupShift.name
          } lúc ${convertTimeFormat(item.timeOut)}.`;
          body_text_en = `${fullName} clocked out the shift ${
            groupShift.name
          } at ${convertTimeFormat(item.timeOut)}.`;
        }
      } else if (type === "leaveapp" && item.applicationStatus === "pending") {
        // Employee sends leave application
        typeNoti = "leaveapp";
        reason = "memberSentRequest";
        body_text = `${fullName} đã gửi đơn xin nghỉ cho ca ${groupShift.name}.`;
        body_text_en = `${fullName} sent leave request to shift ${groupShift.name}.`;
      }

      if (groupUserAdminsVi && groupUserAdminsVi.length > 0) {
        userIdByLanguage.vi = groupUserAdminsVi.map(
          (groupUserAdmin) => groupUserAdmin.linkedUserId
        );

        addWonotification({
          groupUsers: groupUserAdminsVi,
          userId: userId.toString(),
          groupName,
          typeNoti,
          reason,
          groupId: group_id,
          groupUserId: senderMember.id,
          recordDate: item.recordDate,
          content: body_text,
        });
      }

      if (groupUserAdminsEn && groupUserAdminsEn.length > 0) {
        userIdByLanguage.en = groupUserAdminsEn.map(
          (groupUserAdmin) => groupUserAdmin.linkedUserId
        );

        addWonotification({
          groupUsers: groupUserAdminsEn,
          userId: userId.toString(),
          groupName,
          typeNoti,
          reason,
          groupId: group_id,
          groupUserId: senderMember.id,
          recordDate: item.recordDate,
          content: body_text_en,
        });
      }
      // Sender is not employee. Receiver will be one person, send push to 1 linkedUserId
    } else if (
      senderMember.role === "admin" ||
      senderMember.role === "manage"
    ) {
      if (type === "timesheet") {
        // Admin/Manager create timesheet for employee
        typeNoti = "timesheet";
        // Admin/Manager add paid leave
        if (item.type === "offsalary") {
          if (!groupShift) return;
          reason = "adminAddPaidLeave";
          body_text =
            groupType === "work"
              ? `Bạn được duyệt nghỉ có lương cho ca ${groupShift.name}.`
              : `Bạn nhận thông báo nghỉ học có học phí cho ca ${groupShift.name}.`;
          body_text_en =
            groupType === "work"
              ? `You are approved for paid leave for the shift ${groupShift.name}.`
              : `You receive notice of absence with tuition fee for the shift ${groupShift.name}.`;
        } else if (item.type === "off") {
          // Admin/Manager add unpaid leave
          if (!groupShift) return;
          reason = "adminAddUnpaidLeave";
          body_text =
            groupType === "work"
              ? `Bạn được tính nghỉ không lương cho ca ${groupShift.name}.`
              : `Bạn nhận thông báo nghỉ học không tính học phí cho ca ${groupShift.name}.`;
          body_text_en =
            groupType === "work"
              ? `You are notified of unpaid leave for the shift ${groupShift.name}.`
              : `You receive notice of absence without tuition fee for the shift ${groupShift.name}.`;
        } else {
          // Admin/Manager add timehsheet
          reason = "adminAddTimesheet";
          body_text =
            groupType === "work"
              ? `Bạn đã được chấm công cho ca ${
                  groupShift.name
                }, giờ vào ${convertTimeFormat(
                  item.timeIn
                )}, giờ ra ${convertTimeFormat(item.timeOut)}.`
              : `Bạn đã được điểm danh cho ca ${
                  groupShift.name
                }, giờ vào ${convertTimeFormat(
                  item.timeIn
                )}, giờ ra ${convertTimeFormat(item.timeOut)}.`;
          body_text_en =
            groupType === "work"
              ? `You have been clocked for the shift ${
                  groupShift.name
                }, time in ${convertTimeFormat(
                  item.timeIn
                )}, time out ${convertTimeFormat(item.timeOut)}.`
              : `You have been clocked for the shift ${
                  groupShift.name
                }, time in ${convertTimeFormat(
                  item.timeIn
                )}, time out ${convertTimeFormat(item.timeOut)}.`;
        }
      } else if (type === "addition") {
        // Admin/Manager add salary for employee
        typeNoti = "addSalaries";
        category = item.category;
        const additionCat = await AdditionCategory.findOne({ id: category });
        if (!additionCat) return;

        reason = additionCat.type;
        const reasonString = getReason(reason, lang, groupType);
        body_text =
          groupType === "work"
            ? `Bạn nhận được một khoản cộng lương, lý do ${reasonString}.`
            : `Bạn có một khoản tăng học phí, lý do ${reasonString}.`;
        body_text_en =
          groupType === "work"
            ? `You have received an addition to your salary, reason ${reasonString}.`
            : `You have a tuition increase, reason ${reasonString}.`;
      } else if (type === "deduction") {
        // Admin/Manager subtract salary for employee
        typeNoti = "subtractSalaries";
        category = item.category;
        const deductionCat = await DeductionCategory.findOne({ id: category });
        if (!deductionCat) return;

        reason = deductionCat.type;
        const reasonString = getReason(reason, lang, groupType);
        body_text =
          groupType === "work"
            ? `Bạn bị một khoản trừ lương, lý do ${reasonString}.`
            : `Bạn nhận được một khoản giảm học phí, lý do ${reasonString}.`;
        body_text_en =
          groupType === "work"
            ? `You have been deducted from your salary, reason ${reasonString}.`
            : `You receive a tuition discount, reason ${reasonString}.`;
      } else if (type === "leaveapp") {
        // Admin updates leave application
        typeNoti = "leaveapp";
        if (item.applicationStatus === "approved") {
          reason = "adminApprovedRequest";
          body_text = `Đơn xin nghỉ cho ca ${groupShift.name} đã được duyệt.`;
          body_text_en = `The leave request for shift ${groupShift.name} has been approved.`;
        } else if (item.applicationStatus === "rejected") {
          reason = "adminRejectedRequest";
          body_text = `Đơn xin nghỉ cho ca ${groupShift.name} đã bị từ chối.`;
          body_text_en = `The leave request for shift ${groupShift.name} has been rejected.`;
        }
      } else {
        return;
      }

      // Add to mywonotification
      if (groupUser.linkedUserId) {
        if (lang === "en") {
          userIdByLanguage.en.push(groupUser.linkedUserId);
          addWonotification({
            groupUsers: [groupUser],
            userId,
            groupName,
            typeNoti,
            reason,
            groupId: group_id,
            groupUserId: senderMember.id,
            recordDate: item.recordDate,
            content: body_text_en,
          });
        } else {
          userIdByLanguage.vi.push(groupUser.linkedUserId);
          addWonotification({
            groupUsers: [groupUser],
            userId,
            groupName,
            typeNoti,
            reason,
            groupId: group_id,
            groupUserId: senderMember.id,
            recordDate: item.recordDate,
            content: body_text,
          });
        }
      }
    } else {
      return;
    }

    if (!reason) return; // Only send push if has data above

    const message = {
      notification: {
        title: groupName,
        body: "", // lang == 'en' ? body_text_en : body_text,
      },
      data: {
        type: `add-${type}`,
        requested_user: userId.toString(),
        member_user: groupUser.linkedUserId,
        admin_user: "",
        groupId: group_id,
        groupUserId: senderMember.id,
        reason: reason,
        recordDate: item.recordDate.toString(),
        id: item.id,
      },
    };

    // console.log('userIds', JSON.stringify(userIdByLanguage));

    const options = { priority: "high" };

    if (userIdByLanguage.en?.length > 0) {
      FCM.sendPushV2(
        replaceBodyMessageByLanguage(message, body_text_en),
        options,
        userIdByLanguage.en,
        deviceId,
        req,
        action
      );
    }

    if (userIdByLanguage.vi?.length > 0) {
      FCM.sendPushV2(
        replaceBodyMessageByLanguage(message, body_text),
        options,
        userIdByLanguage.vi,
        deviceId,
        req,
        action
      );
    }

    return;
  } catch (error) {
    console.log("LOG_PUSH_EN_VN", error);
  }
}
