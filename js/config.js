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
    games: ["Gran Velocita", "Gran Emozion", "Grid Autosport", "CPM 2", "CPM 1", "dll."],
    stats: [
      { label: "Anggota", value: "400+" },
      { label: "Game Aktif", value: "6+" }
    ]
  },

  // Hirarki grup — 7 profil
  // Untuk ganti foto: ubah `avatar` ke path gambar, misal "assets/members/owner.jpg"
  // Avatar kosong "" = pakai placeholder silhouette
  members: [
    { name: "Xiaofan",  role: "Owner",       avatar: "assets/members/Xiaofan.jpg" },
    { name: "Anta",     role: "Admin",       avatar: "assets/members/Anta.jpg" },
    { name: "Chennn",   role: "Admin",       avatar: "assets/members/Chenn.jpg" },
    { name: "Dayat",    role: "Admin",       avatar: "", initial: "D" },
    { name: "Anta",     role: "Modder",      avatar: "assets/members/Anta.jpg" },
    { name: "Hayzen",   role: "Contributor", avatar: "assets/members/Hayzen.jpg" },
    { name: "Wa Min",   role: "Contributor", avatar: "assets/members/Wa Min.jpg" }
  ],

  // Warna badge per role
  roleColors: {
    "Owner":       "#d4af37",  // gold
    "Admin":       "#8b0000",  // dark red
    "Modder":      "#4a4a4a",  // chrome gray
    "Contributor": "#1e3a5f"   // dark blue
  },

  // Link sosial media (kosongkan "" untuk sembunyikan)
  social: {
    discordMain:    "https://discord.gg/vQszJdfvZ",
    discordPartner: "https://discord.gg/gran-emozione-community-1348404725732872272",
    whatsapp:       "https://chat.whatsapp.com/G9XcVZZelwf7hrtXj58uqS",
    youtube:        "https://www.youtube.com/@SimRaceMobile"
  },

  // Partner APK (redirect ke Discord partner)
  partnerApk: {
    name: "Gran Emozion Community",
    discord: "https://discord.gg/gran-emozione-community-1348404725732872272",
    description: "Download game dari komunitas partner kami"
  },

  // URL Worker API
  apiBaseUrl: "https://srmc-worker.antarahimmuhammad.workers.dev"
};
