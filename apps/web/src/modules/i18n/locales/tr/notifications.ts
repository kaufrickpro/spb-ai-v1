export const notifications = {
  kicker: "Bildirim merkezi",
  title: "Bildirimler",
  preview: "Son bildirimler",
  viewAll: "Tümünü gör",
  loading: "Bildirimler yükleniyor",
  error: "Bildirimler yüklenemedi",
  empty: "Henüz bildirim yok",
  markRead: "Okundu yap",
  markAllRead: "Tümünü okundu yap",
  nextPage: "Sonraki sayfa",
  systemActor: "Smart Publishing Bridge",
  genericTarget: "çalışma alanın",
  filters: {
    all: "Tümü",
    unread: "Okunmamış",
  },
  types: {
    intro_request_created: {
      title: "Yeni tanışma isteği",
      body: "{{actor}}, {{target}} için tanışma isteği gönderdi.",
    },
    intro_request_accepted: {
      title: "Tanışma isteği kabul edildi",
      body: "{{actor}}, {{target}} için tanışma isteğini kabul etti.",
    },
    intro_request_rejected: {
      title: "Tanışma isteği güncellendi",
      body: "{{target}} için tanışma isteği güncellendi.",
    },
    intro_request_cancelled: {
      title: "Tanışma isteği iptal edildi",
      body: "{{target}} için tanışma isteği iptal edildi.",
    },
    profile_approved: {
      title: "Profil onaylandı",
      body: "Profil kararın güncellendi.",
    },
    profile_rejected: {
      title: "Profil için işlem gerekiyor",
      body: "Profil kararın güncellendi.",
    },
    profile_quarantined: {
      title: "Profil incelemede",
      body: "Profil kararın güncellendi.",
    },
    manuscript_approved: {
      title: "Eser onaylandı",
      body: "{{target}} hazır.",
    },
    manuscript_rejected: {
      title: "Eser için işlem gerekiyor",
      body: "{{target}} için işlem gerekiyor.",
    },
    manuscript_quarantined: {
      title: "Eser incelemede",
      body: "{{target}} incelemede.",
    },
  },
};
