const constantText = require("../controllers/api/constant");
const { GroupUser } = require("../models/groupuser.model");

const checkMangeAuthorization = async (req, res, next) => {
  const { userId } = req;
  const { groupId } = req.params;

  const groupUser = await GroupUser.findOne({
    groupId,
    isDeleted: false,
    role: { $ne: constantText.groupUserRole.employee },
    linkedUserId: userId.toString(),
  });

  if (!groupUser) {
    return res.status(403).send({
      success: false,
      message: "Forbidden",
    });
  }

  next();
};

const checkUserInGroup = async (req, res, next) => {
  const { staffId, groupId } = req.params;
  const { userId } = req;

  const groupUser = await GroupUser.findOne({
    groupId,
    isDeleted: false,
    linkedUserId: userId.toString(),
  });

  if (
    (staffId &&
      groupUser.id !== staffId &&
      constantText.groupUserRole.employee === groupUser.role) ||
    !groupUser
  ) {
    return res.status(403).send({
      success: false,
      message: "Forbidden",
    });
  }

  next();
};

module.exports = {
  checkMangeAuthorization,
  checkUserInGroup,
};
