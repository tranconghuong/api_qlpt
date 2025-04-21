require("dotenv").config();
const createError = require("http-errors");
const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const logger = require("morgan");
const morgan = require("morgan");
const passport = require("passport");
const swaggerUI = require("swagger-ui-express");
const openapiSpecification = require("./configs/swagger").default;
var cors = require("cors");
const i18n = require("i18n");
const mongoose = require("mongoose");
const configs = require("./configs/database");
const useragent = require("express-useragent");
const admin = require("firebase-admin");
const serviceAccount = require("./ihostel-ty-firebase-adminsdk-63yj9-21b66ded3b.json");

const corsOptions = {
  origin: [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:9999",
  ],
  optionSuccessStatus: 200,
};
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// connection database
mongoose.connect(configs.database, {
  autoIndex: true,
  serverSelectionTimeoutMS: 10000,
});

const app = express();
app.use(cors(corsOptions));
app.use(useragent.express());
app.use("/api-docs", swaggerUI.serve, swaggerUI.setup(openapiSpecification));

app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.header(
    "Access-Control-Allow-Methods",
    "GET,PUT,POST,DELETE,PATCH,OPTIONS"
  );
  next();
});
app.disable("etag");

// view engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));
app.use(express.static(path.join(__dirname, "uploads")));
app.use(morgan("dev"));
app.use(passport.initialize());
app.use(express.json({ limit: "50mb" }));
app.use(i18n.init);
i18n.configure({
  locales: ["en", "vn"],
  directory: __dirname + "/locales",
});

const userRouter = require("./routes/user");
const syncRouter = require("./routes/sync");
const deviceRouter = require("./routes/device");

app.use("/api/device", deviceRouter);
app.use("/api/user", userRouter);
app.use("/api/sync", syncRouter);
//Web management
// app.use('/mgmt/api', manageGroupRouter);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  res.render("404");
});

module.exports = app;
