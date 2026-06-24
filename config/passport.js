import dotenv from "dotenv";
dotenv.config();
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import User from "../models/User.js";

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "/api/auth/google/callback",
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        let user = await User.findOne({ googleId: profile.id });

        if (!user) {
          // Kiểm tra email đã tồn tại chưa
          user = await User.findOne({ email: profile.emails[0].value });
          if (user) {
            // Liên kết Google vào tài khoản cũ
            user.googleId = profile.id;
            user.avatar = profile.photos[0].value;
            await user.save();
          } else {
            // Tạo user mới
            user = await User.create({
              name: profile.displayName,
              email: profile.emails[0].value,
              googleId: profile.id,
              avatar: profile.photos[0].value,
            });
          }
        }

        done(null, user);
      } catch (error) {
        done(error, null);
      }
    },
  ),
);

export default passport;
