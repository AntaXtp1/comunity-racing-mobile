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

  // Teks UI dalam 2 bahasa
  i18n: {
    id: {
      navHome:        "Home",
      navCommunity:   "Community",
      navTeam:        "Team",
      navDownload:    "Download",
      heroTagline:    "Komunitas balapan mobile terdepan di Indonesia",
      aboutTitle:     "Tentang Komunitas",
      aboutDesc:      "Komunitas bagi para pecinta sim racing di platform mobile. Bergabunglah untuk berbagi setup, tips, dan adu kecepatan dengan racer terbaik.",
      statMembers:    "Anggota",
      statGames:      "Game Aktif",
      teamTitle:      "Tim Kami",
      teamSub:        "Kenali orang-orang di balik komunitas ini",
      downloadTitle:  "Download APK",
      downloadSub:    "File terbaru langsung dari server kami",
      apkOurs:        "📦 APK Komunitas Kami",
      apkPartner:     "📦 APK Partner - Gran Emozion",
      partnerDesc:    "Download game dari komunitas partner kami",
      partnerBtn:     "Ke Discord",
      downloadBtn:    "Download",
      loadingApk:     "Memuat daftar APK...",
      emptyApk:       "Belum ada APK tersedia.",
      errorApk:       "Gagal memuat daftar APK. Coba lagi nanti.",
      discordTitle:   "Pilih Komunitas Discord",
      discordMain:    "Gran Velocita",
      discordPartner: "Gran Emozion Community",
      heroDownload:   "Download APK",
      heroJoin:       "Join Discord",
    },
    en: {
      navHome:        "Home",
      navCommunity:   "Community",
      navTeam:        "Team",
      navDownload:    "Download",
      heroTagline:    "Indonesia's leading mobile sim racing community",
      aboutTitle:     "About Us",
      aboutDesc:      "A community for mobile sim racing enthusiasts. Join us to share setups, tips, and race against the best drivers.",
      statMembers:    "Members",
      statGames:      "Active Games",
      teamTitle:      "Our Team",
      teamSub:        "Meet the people behind the community",
      downloadTitle:  "Download APK",
      downloadSub:    "Latest files directly from our server",
      apkOurs:        "📦 Our Community APKs",
      apkPartner:     "📦 Partner APK - Gran Emozion",
      partnerDesc:    "Download games from our partner community",
      partnerBtn:     "Go to Discord",
      downloadBtn:    "Download",
      loadingApk:     "Loading APK list...",
      emptyApk:       "No APKs available yet.",
      errorApk:       "Failed to load APK list. Try again later.",
      discordTitle:   "Choose a Discord Community",
      discordMain:    "Gran Velocita",
      discordPartner: "Gran Emozion Community",
      heroDownload:   "Download APK",
      heroJoin:       "Join Discord",
    }
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
