const express = require("express");
const router = express.Router();
const passport = require("passport");

require("../configs/passport")(passport);

const { checkAuthorization } = require("../middlewares/authorization");
const {
  refreshToken,
  me,
  demo,
  getUser,
  linkUser,
  unlinkUser,
  signinSocial,
  loginByEmail,
  grantAccess,
  expireToken,
} = require("../controllers/userController");

router.post("/demo", demo);
router.get("/getUser", getUser);

router.post("/linkUser", checkAuthorization, linkUser);
router.post("/unlinkUser", checkAuthorization, unlinkUser);

/* GET users listing. */
router.post("/sign-in-social", signinSocial);
/**
 * @openapi
 * /api/users/refresh-token:
 *   post:
 *      description: Refresh token
 *      requestBody:
 *          required: true
 *          content:
 *              application/json:
 *                   schema:
 *                      type: object
 *                      properties:
 *                          refreshToken:
 *                              type: string
 *                              description: Refresh token
 *                              example: xxx
 *      responses:
 *          200:
 *              description: Refresh token
 *      tags:
 *          - Users Functions
 */
router.post("/refresh-token", refreshToken);

/**
 * @openapi
 * /api/users/me:
 *   get:
 *      description: Get current user
 *      responses:
 *          200:
 *              description: Get current user
 *      tags:
 *          - Users Functions
 */
router.get("/me", checkAuthorization, me);

/**
 * @openapi
 * /api/users/sign-in-social:
 *   post:
 *      description: Sign in social
 *      parameters:
 *        - in: header
 *          name: x-device
 *          description: Device ID
 *          required: true
 *          schema:
 *              type: string
 *      requestBody:
 *          required: true
 *          content:
 *              application/json:
 *                   schema:
 *                      type: object
 *                      properties:
 *                          first_name:
 *                              type: string
 *                              description: first_name
 *                              example: first Name
 *                          last_name:
 *                              type: string
 *                              description: last_name
 *                              example: last Name
 *                          social_id:
 *                              type: string
 *                              description: social_id
 *                              example: social_id
 *                          auth_type:
 *                              type: string
 *                              description: auth_type
 *                              example: "google"
 *                          social_token:
 *                              type: string
 *                              description: social_token
 *                              example: "xxxx"
 *                          email:
 *                              type: string
 *                              description: email
 *                              example: "baoquoc1134@gmail.com"
 *      responses:
 *          200:
 *              description: Sign in social
 *      tags:
 *          - Users Functions
 */
router.post("/login-by-email", loginByEmail);

// grantAccess
router.post("/grant-access", checkAuthorization, grantAccess);

// expireToken
router.post("/expire-token", checkAuthorization, expireToken);

module.exports = router;
