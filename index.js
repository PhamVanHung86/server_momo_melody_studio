import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import passport from "./config/passport.js";
import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import flashSaleRoutes from "./routes/flashSaleRoutes.js";
import bannerRoutes from "./routes/bannerRoutes.js";
import contactRoutes from "./routes/contactRoutes.js";
import mailClubRoutes from "./routes/mailClubRoutes.js";
import mailClubCollectionRoutes from "./routes/mailClubCollectionRoutes.js";
import cron from "node-cron";
import { autoExpireSubscriptions } from "./controllers/mailClubController.js";

import mailClubSettingsRoutes from "./routes/mailClubSettingsRoutes.js";

dotenv.config();
connectDB();

const app = express();

cron.schedule("1 0 * * *", () => {
  console.log("🕐 Running auto expire subscriptions...");
  autoExpireSubscriptions();
});

app.use(
  cors({
    origin: ["http://localhost:5173", "http://localhost:5174"],
    credentials: true,
  }),
);
app.use(express.json());
app.use(cookieParser());
app.use(passport.initialize());
autoExpireSubscriptions();

app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/users", userRoutes);
app.use("/api/flash-sales", flashSaleRoutes);
app.use("/api/banners", bannerRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/mail-club", mailClubRoutes);
app.use("/api/mail-club-collections", mailClubCollectionRoutes);
app.use("/api/mail-club-settings", mailClubSettingsRoutes);

app.get("/", (req, res) => res.send("momo's melody studio API 🌸"));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
