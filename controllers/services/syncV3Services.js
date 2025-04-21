const { GroupRoomUser } = require("../../models/group_room_user.model");
const { Group } = require("../../models/group.model");
const { getObject } = require("./objectServices");

async function constructConditionForPullv3(
  objectName,
  userId,
  lastSynced = 0,
  groupIds = "",
  userIds = ""
) {
  const Objectdb = getObject(objectName);
  if (!Objectdb) return null;

  const synce_condition = await getSyncCondition(
    objectName,
    userId,
    lastSynced
  );

  let condition = {
    $and: [{ userId }, { syncedTime: { $gt: synce_condition } }],
  };

  if (objectName === "group") {
    condition = await getGroupCondition(userId, synce_condition, lastSynced);
  } else if (objectName === "groupRoomUser") {
    const conditionGet = await getGroupUserCondition(
      userId,
      groupIds,
      synce_condition,
      lastSynced
    );
    if (Object.keys(conditionGet).length) {
      condition = conditionGet;
    }
  } else if (objectName === "notification") {
    condition = getNotificationCondition(userId, synce_condition);
  } else if (groupIds) {
    condition = getGroupIdsCondition(groupIds, synce_condition);
  }

  if (isSpecialObject(objectName)) {
    const conditionGet = await getSpecialObjectCondition(userId, groupIds);
    if (Object.keys(conditionGet).length) {
      condition.$expr = conditionGet;
    }
  }

  return { condition, Objectdb, synce_condition };
}

async function getSyncCondition(objectName, userId, lastSynced) {
  return lastSynced;
}

async function getSpecialObjectCondition(userId, groupIds) {
  // Get all groupUser belong to current logged in user.
  const groupUsers = await GroupRoomUser.find(
    {
      linkedUserId: userId,
      groupId: { $in: groupIds.split(",") },
      isDeleted: false,
    },
    "id role groupId"
  );

  const { groupUserIdsArrayOfCurrentUser, groupIdsCurentUserIsAdminOrManager } =
    extractAdminOrManagerData(groupUsers);

  const groupUsersArrayOfOther = await GroupUser.find(
    // Get other groupUsers if current user is admin or manager
    {
      groupId: { $in: groupIdsCurentUserIsAdminOrManager },
      groupUserId: { $nin: groupUserIdsArrayOfCurrentUser },
      isDeleted: false,
    },
    "id"
  );

  const groupUserIdsArrayOfOther = groupUsersArrayOfOther.map(
    (groupUser) => groupUser.id
  );

  return {
    $or: [
      { $in: ["$groupUserId", groupUserIdsArrayOfCurrentUser] }, // Get all data for current user first
      {
        $and: [
          { $in: ["$groupId", groupIds.split(",")] },
          { $in: ["$groupUserId", ["", null]] },
          { $eq: ["$isDeleted", false] },
        ],
      },
      { $in: ["$groupUserId", groupUserIdsArrayOfOther] }, // Get more data for other groupUser if current user is admin or manage
    ],
  };
}

function extractAdminOrManagerData(groupUsers) {
  const groupUserIdsArrayOfCurrentUser = [];
  const groupIdsCurentUserIsAdminOrManager = [];

  groupUsers.forEach((groupUser) => {
    if (groupUser.role === "admin" || groupUser.role === "manage") {
      groupIdsCurentUserIsAdminOrManager.push(groupUser.groupId); // Get all groupIds which current logged in user has role "admin" or "manage"
    }
    groupUserIdsArrayOfCurrentUser.push(groupUser.id); // These are groupUserIds belong to current user, don't worry about role.
  });

  return { groupUserIdsArrayOfCurrentUser, groupIdsCurentUserIsAdminOrManager };
}

function isSpecialObject(objectName) {
  const specialObjects = [
    "addition",
    "deduction",
    "allowance",
    "groupuserplan",
    "groupusershift",
    "salary",
    "timesheet",
    "inouthistory",
    "leaveapp",
  ];
  return specialObjects.includes(objectName);
}

function extractGroupData(groupUsers) {
  const groupIds = [];
  const groupUserIds = [];
  const groupIdToIsDeleted = [];
  groupUsers.forEach(({ groupId, id, isDeleted }) => {
    groupIds.push(groupId);
    groupUserIds.push(id);
    if (isDeleted) {
      groupIdToIsDeleted.push(groupId);
    }
  });
  return { groupIds, groupUserIds, groupIdToIsDeleted };
}

async function getGroupCondition(userId, synce_condition, lastSynced) {
  const groupUsers = await GroupRoomUser.find(
    { linkedUserId: userId },
    "groupId id isDeleted"
  );

  const { groupIds, groupUserIds, groupIdToIsDeleted } =
    extractGroupData(groupUsers);

  console.log("groupUserIds", groupUserIds);
  console.log("groupIdToIsDeleted", groupIdToIsDeleted);

  const commonSyncedTimeCondition = {
    $cond: {
      if: { $in: ["$creator", groupUserIds] },
      then: {
        $gt: [
          "$syncedTime",
          synce_condition ? new Date(synce_condition) : new Date(0),
        ],
      },
      else: {
        $gt: ["$syncedTime", lastSynced ? new Date(lastSynced) : new Date(0)],
      },
    },
  };

  const isDeleteCondition = {
    $or: [
      {
        $and: [
          { $in: ["$id", groupIdToIsDeleted] },
          { $in: ["$creator", groupUserIds] },
        ],
      },
      {
        $and: [
          { $not: { $in: ["$id", groupIdToIsDeleted] } },
          { isDeleted: false },
        ],
      },
    ],
  };
  return {
    id: { $in: groupIds },
    $expr: {
      $and: [commonSyncedTimeCondition, isDeleteCondition],
    },
  };
}

async function getGroupUserCondition(
  userId,
  groupIds,
  synce_condition,
  lastSynced
) {
  if (!groupIds) return {};

  const groupUsers = await GroupRoomUser.find(
    { linkedUserId: userId, groupId: { $in: groupIds.split(",") } },
    "creator groupId"
  );

  const groupUsersCreator = groupUsers.map((group) => group.creatorId);
  const validGroupIds = groupUsers.map((group) => group.groupId);

  const groupsOfCreator = await Group.find(
    { creator: { $in: groupUsersCreator } },
    "id"
  );
  const groupIdsOfCreator = groupsOfCreator.map((group) => group.id);

  const commonSyncedTimeCondition = {
    $cond: {
      if: { $in: ["$groupId", groupIdsOfCreator] },
      then: {
        $gt: ["$syncedTime", synce_condition ? new Date(synce_condition) : 0],
      },
      else: { $gt: ["$syncedTime", lastSynced ? new Date(lastSynced) : 0] },
    },
  };

  return {
    groupId: { $in: validGroupIds },
    $expr: commonSyncedTimeCondition,
  };
}

function getNotificationCondition(userId, synce_condition) {
  return {
    $and: [
      { $or: [{ sender_id: userId }, { reciever_id: userId }] },
      { synced_time: { $gt: synce_condition } },
    ],
  };
}

function getGroupIdsCondition(groupIds, synce_condition) {
  return {
    groupId: { $in: groupIds.split(",") },
    syncedTime: { $gt: synce_condition },
  };
}
module.exports = {
  constructConditionForPullv3,
};
