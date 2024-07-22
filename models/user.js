const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const validator = require("validator");

const Schema = mongoose.Schema;

const userSchema = new Schema(
  {
    fullName: {
      type: String,
      required: [true, "Họ tên không được bỏ trống"],
    },
    userName: {
      type: String,
      required: [true, "Tên người dùng được bỏ trống"],
    },
    email: {
      type: String,
      require: [true, "Email không được bỏ trống"],
      unique: true,
      trim: true,
      lowercase: true,
      validate: [validator.isEmail, "Email không hợp lệ"],
    },
    password: {
      type: String,
      require: [true, "Mật khẩu không được bỏ trống"],
      minLength: 8,
      select: false,
    },
    passwordConfirm: {
      type: String,
      required: [true, "Xác nhận mật khẩu không được bỏ trống"],
      validate: {
        //save
        validator: function (val) {
          return val === this.password;
        },
        message: "Mật khẩu không khớp",
      },
    },
    avatar: {
      type: String,
      // default: "./img/default.png",
    },
    isActived: {
      type: Boolean,
      default: true,
    },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },
    savedArticles: [
      {
        type: mongoose.Schema.ObjectId,
        ref: "Article",
      },
    ],
  },
  { timestamps: true }
);

// Mã hóa mật khẩu trước khi lưu
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt();
  this.password = await bcrypt.hash(this.password, salt);
  this.passwordConfirm = undefined;
  next();
});

// Kiểm tra mật khẩu
userSchema.methods.correctPassword = async function (DBpassword, userPassword) {
  return await bcrypt.compare(DBpassword, userPassword);
};

// Thay đổi mật khẩu
userSchema.methods.changedPasswordAfter = function (JWTTime) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(
      this.passwordChangedAt.getTime() / 1000,
      10
    );
    return JWTTime < changedTimestamp;
  }
  return false;
};

const User = mongoose.model("User", userSchema);
module.exports = User;
