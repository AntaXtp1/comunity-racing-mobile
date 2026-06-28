// ============================================================
// KONFIGURASI WEBSITE — Edit bagian ini untuk mengubah konten
// ============================================================

const SITE_CONFIG = {
  // Nama komunitas (ganti sesuai keinginan)
  communityName: "Sim Racing Community",
  tagline: "Komunitas balapan mobile terdepan di Indonesia",

  // Info komunitas
  about: {
    description: "Komunitas bagi para pecinta sim racing di platform mobile. Bergabunglah untuk berbagi setup, tips, dan adu kecepatan dengan racer terbaik.",
    platforms: ["Android", "iOS"],
    games: ["Real Racing 3", "Grid Autosport", "Asphalt 9"],
    stats: [
      { label: "Anggota", value: "500+" },
      { label: "Game Aktif", value: "5" },
      { label: "Event/Bulan", value: "4" }
    ]
  },

  // Hirarki grup — 5 profil contoh
  // Untuk ganti foto: ubah `avatar` ke path gambar, misal "assets/members/owner.jpg"
  // Avatar kosong "" = pakai placeholder silhouette
  members: [
    { name: "[Owner Name]",  role: "Owner",     avatar: "" },
    { name: "[Admin Name]",  role: "Admin",     avatar: "" },
    { name: "[Mod Name]",    role: "Moderator", avatar: "" },
    { name: "[Tester 1]",    role: "Tester",    avatar: "" },
    { name: "[Tester 2]",    role: "Tester",    avatar: "" }
  ],

  // Warna badge per role
  roleColors: {
    "Owner":     "#d4af37",  // gold
    "Admin":     "#8b0000",  // dark red
    "Moderator": "#4a4a4a",  // chrome gray
    "Tester":    "#1e3a5f"   // dark blue
  },

  // Link sosial media (kosongkan "" untuk sembunyikan)
  social: {
    youtube:  "https://youtube.com/@your-channel",
    whatsapp: "https://chat.whatsapp.com/your-invite",
    discord:  "https://discord.gg/your-invite"
  },

  // URL Worker API — isi dengan URL Worker setelah deploy
  // Contoh: "https://srmc-worker.your-username.workers.dev"
  apiBaseUrl: "http://localhost:8787"
};
