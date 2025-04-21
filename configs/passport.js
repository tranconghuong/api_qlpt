const JwtStrategy = require("passport-jwt").Strategy,
  ExtractJwt = require("passport-jwt").ExtractJwt;

// load up the user model
const { User } = require("../models/user.model");
const config = require("../configs/database"); // get db config file

module.exports = function (passport) {
  let opts = {};
  opts.jwtFromRequest = ExtractJwt.fromAuthHeaderAsBearerToken();
  opts.secretOrKey = config.secret;
  passport.use(
    new JwtStrategy(opts, async function (jwt_payload, done) {
      var user;
      user = await User.findOne({
        _id: jwt_payload._id,
      });
      if (user) {
        done(null, user);
      } else {
        done(null, false);
      }
    })
  );
};
