const passport = require("passport");
require("../configs/passport")(passport);

passport.serializeUser(function (user, done) {
  done(null, user);
});

passport.deserializeUser(function (user, done) {
  done(null, user);
});

exports.checkAuthorization = function (req, res, next) {
  passport.authenticate("jwt", { session: false }, function (err, user, info) {
    // console.log(user);
    if (err) {
      return res.status(401).send({
        success: false,
        result: null,
        message: "Unauthorized request.",
        code: 401,
      });
    } else {
      if (!user || (user.type != "admin" && user.type != "subadmin")) {
        return res.status(401).send({
          success: false,
          result: null,
          message: "Unauthorized request.",
          code: 401,
        });
      }
      req.userId = user._id;
      next();
    }
  })(req, res, next);
};
