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
      callbackURL: `${process.env.SERVER_URL}/api/auth/google/callback`,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const googleEmail = profile.emails[0].value;
        const googleAvatar = profile.photos[0].value;

        // Tìm theo googleId trước
        let user = await User.findOne({ googleId: profile.id });

        if (user) {
          // Đã từng login Google → cập nhật avatar
          user.avatar = googleAvatar;
          await user.save();
          return done(null, user);
        }

        // Tìm theo email — có thể đã đăng ký bằng email/password
        user = await User.findOne({ email: googleEmail });

        if (user) {
          // ✅ TH1: Đã có tài khoản email → merge Google vào
          // Chỉ update googleId + avatar, KHÔNG đụng vào phone/address/name đã có
          user.googleId = profile.id;
          if (!user.avatar) {
            // Chỉ set avatar từ Google nếu chưa có avatar
            user.avatar = googleAvatar;
          }
          await user.save();
          return done(null, user);
        }

        // Chưa có tài khoản → tạo mới
        user = await User.create({
          name: profile.displayName,
          email: googleEmail,
          googleId: profile.id,
          avatar: googleAvatar,
        });

        return done(null, user);
      } catch (error) {
        return done(error, null);
      }
    },
  ),
);

export default passport;
