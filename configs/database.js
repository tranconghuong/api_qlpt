require("dotenv").config({ path: "../.env" });
module.exports = {
  secret: process.env.SECRET_KEY,
  viewsecret: process.env.VIEW_SECRET_KEY,
  token_time: process.env.TOKEN_TIME,
  refresh_token_time: process.env.REFRESH_TOKEN_TIME,
  exchange_token: process.env.EXCHANGE_TOKEN,
  database:
    "mongodb+srv://hostel:hostel123@cluster0.ilemz.mongodb.net/?retryWrites=true&w=majority",
  debug_user_id: process.env.DEBUG_USER_ID,
};
