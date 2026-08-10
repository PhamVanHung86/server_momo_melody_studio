import express from "express";
import Product from "../models/Product.js";

const router = express.Router();

// Sitemap.xml động — tự động thêm/bỏ sản phẩm mà không cần deploy lại,
// giúp Google index nhanh hơn khi có sản phẩm mới. Đặt ở route gốc "/"
// (không prefix /api) vì Google/công cụ tìm kiếm tìm sitemap theo chuẩn
// tại domain-gốc/sitemap.xml.
router.get("/sitemap.xml", async (req, res) => {
  try {
    const siteUrl = process.env.CLIENT_URL || "https://momomelody.vn";
    const products = await Product.find().select("_id updatedAt").lean();

    const staticPages = [
      { url: "/", priority: "1.0" },
      { url: "/collection", priority: "0.9" },
      { url: "/postcards", priority: "0.7" },
      { url: "/mail-club", priority: "0.7" },
      { url: "/about", priority: "0.5" },
      { url: "/contact", priority: "0.5" },
    ];

    const urls = [
      ...staticPages.map(
        (p) =>
          `  <url><loc>${siteUrl}${p.url}</loc><priority>${p.priority}</priority></url>`,
      ),
      ...products.map(
        (p) =>
          `  <url><loc>${siteUrl}/product/${p._id}</loc><lastmod>${new Date(
            p.updatedAt,
          ).toISOString()}</lastmod><priority>0.8</priority></url>`,
      ),
    ];

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>`;

    res.header("Content-Type", "application/xml");
    res.send(xml);
  } catch (error) {
    res.status(500).send("Không thể tạo sitemap");
  }
});

export default router;
