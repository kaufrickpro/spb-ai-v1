export const adminPages = {
  reviews: {
    description:
      "Tam inceleme kuyruğu görünümü; filtre, atama ve gelişmiş moderasyon kontrolleriyle bu alanda genişletilecek.",
  },
  users: {
    description:
      "Kullanıcı yönetimi, onay süreçleri ve yetki geçmişi bu bölümden yürütülecek.",
  },
  manuscripts: {
    description:
      "Manuskript moderasyonu ve uyumluluk kontrolleri operasyon ekipleri için bu sayfada toplanacak.",
  },
  publishers: {
    description:
      "Yayınevi profili denetimi ve değişiklik talebi iş akışları bu sayfada yönetilecek.",
  },
  jobs: {
    description:
      "Arka plan iş durumu, yeniden deneme ve hata takibi bu bölümden izlenecek.",
  },
  payments: {
    description:
      "Ödeme callback olayları, hata incelemeleri ve mutabakat araçları bu sayfada yer alacak.",
  },
  auditLogs: {
    description:
      "Güvenlik ve operasyon denetim kayıtları bu alanda aranabilir ve filtrelenebilir olacak.",
  },
  settings: {
    description:
      "Personel erişim duruşunu, MFA hazırlığını ve yönetim çalışma alanı kurallarını gözden geçirin.",
    identity: {
      title: "Yönetici kimliği",
      email: "Giriş yapan e-posta",
      access: "Erişim durumu",
      mfa: "Çok faktörlü doğrulama",
      mfaVerified: "Bu oturum için MFA doğrulandı",
      mfaRequired: "Hassas yönetim işlemleri öncesi MFA gerekli",
    },
    policy: {
      title: "Çalışma kuralları",
      separateAccounts:
        "Yönetici erişimi, pazaryeri kullanıcı profilleri yerine ayrı personel hesaplarına ayrılmıştır.",
      mfa: "Korunan rotalar kullanılmadan önce her yönetici oturumu MFA gerekliliğini karşılamalıdır.",
      audit:
        "Tüm moderasyon ve operasyon değişiklikleri denetim geçmişi üretmelidir.",
      notes:
        "Hassas işlemler için açık not zorunludur; böylece incelemeler ve incident’lar açıklanabilir kalır.",
    },
    session: {
      title: "Oturum",
      description:
        "Bu cihazdaki yönetim çalışma alanı oturumunu kapatmak için bu kontrolü kullanın.",
    },
  },
};
