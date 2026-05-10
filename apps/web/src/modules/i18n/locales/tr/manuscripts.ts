export const manuscripts = {
  nav: "Manuskriptler",
  pageTitle: "Manuskriptlerim",
  pageSubtitle:
    "Manuskript meta verilerini ve örnek dosya yüklemelerini yönetin.",
  forbidden: {
    title: "Yazar erişimi gerekli",
    description:
      "Bu çalışma alanı Step 8 içinde yalnızca yazar hesaplarına açıktır.",
  },
  createCta: "Yeni manuskript",
  openCta: "Aç",
  empty: "Henüz manuskriptiniz yok. İlkini oluşturun.",
  sections: {
    overview: "Özet",
    list: "Manuskript listesi",
  },
  summary: {
    total: "Toplam manuskript",
    withSample: "Örnek eklenen",
    eligible: "Uygun",
  },
  sampleStatus: {
    added: "Örnek eklendi",
    missing: "Örnek yok",
  },
  table: {
    title: "Başlık",
    genre: "Tür",
    language: "Dil",
    status: "Durum",
    sample: "Örnek",
    eligibility: "Uygunluk",
    words: "Kelimeler",
    actions: "İşlemler",
  },
  status: {
    draft: "Taslak",
    submitted: "Gönderildi",
    under_review: "İnceleniyor",
    approved: "Onaylandı",
    rejected: "Reddedildi",
    archived: "Arşivlendi",
  },
  eligibilityStatus: {
    eligible: "Uygun",
    limited: "Sınırlı",
    blocked: "Engelli",
    quarantined: "Karantinada",
  },
  form: {
    title: "Başlık",
    titlePlaceholder: "Manuskript başlığı",
    genre: "Tür",
    genrePlaceholder: "Örn. Edebi roman, Fantastik, Polisiye",
    language: "Dil",
    wordCount: "Kelime sayısı",
    synopsis: "Özet",
    synopsisPlaceholder: "Kısa açıklama (en fazla 2000 karakter)",
    targetAgeMin: "Min hedef yaş",
    targetAgeMax: "Maks hedef yaş",
    logline: "Tek cümle tanıtım",
    subgenres: "Alt türler",
    audienceCategories: "Okur kategorileri",
    manuscriptForm: "Manuskript formu",
    compTitles: "Benzer eserler",
    declaredThemes: "Temalar",
    declaredContentWarnings: "İçerik uyarıları",
    arcSummary: "Hikaye akışı özeti",
    shortTeaser: "Talep ön izlemesi",
    requestable: "Yayıncılar yazar profilimden erişim talep edebilir",
    save: "Kaydet",
    saving: "Kaydediliyor…",
    cancel: "İptal",
    createTitle: "Yeni manuskript",
    editTitle: "Manuskripti düzenle",
  },
  detail: {
    backToList: "← Manuskriptler",
    eligibility: "Uygunluk",
    sampleDocument: "Örnek belge",
    noDocument: "Henüz örnek yüklenmedi.",
    sampleLoading: "Örnek ayrıntıları yükleniyor...",
    sampleLoadError: "Bu örneği yükleyemedik. Lütfen tekrar deneyin.",
    uploadCta: "Örnek yükle",
    replaceCta: "Örneği değiştir",
    downloadCta: "Örneği indir",
    downloadingCta: "İndirme hazırlanıyor…",
    downloadError: "İndirme başarısız. Lütfen tekrar deneyin.",
    storageStatus: {
      pending_upload: "Yükleme bekleniyor",
      uploaded: "Yüklendi",
      attached: "Eklendi",
      pending_delete: "Silinme bekliyor",
      deleted: "Silindi",
    },
  },
  documentCheck: {
    title: {
      checking: "Örneğiniz kontrol ediliyor",
      ready: "Örnek hazır",
      unreadable: "Bu dosyayı okuyamadık",
    },
    description: {
      checking:
        "Biz örneği kontrol ederken manuskript bilgilerinizi düzenlemeye devam edebilirsiniz.",
      ready: "Örneğiniz sonraki manuskript adımlarında kullanılmaya hazır.",
      unreadable:
        "Bu örnek şimdilik kullanılamaz. Hazır olduğunuzda farklı bir dosya yükleyin.",
    },
    failure: {
      generic: "Farklı bir örnek yükleyin.",
      empty: "Bu dosya boş görünüyor. Farklı bir örnek yükleyin.",
      unsupportedType:
        "Bu dosya türü henüz desteklenmiyor. Düz metin örneği yükleyin.",
      mismatch: "Bu dosya seçilen türle eşleşmiyor. Farklı bir örnek yükleyin.",
      tooLarge:
        "Bu dosya kontrol için çok büyük. Daha kısa bir örnek yükleyin.",
      unreadable:
        "Bu dosyayı açamadık. Tekrar yükleyin veya farklı bir örnek seçin.",
      temporary:
        "Bu örneği kontrol etmeyi tamamlayamadık. Daha sonra tekrar deneyin veya farklı bir örnek yükleyin.",
      safety:
        "Bu dosyanın kullanılmadan önce ek güvenlik kontrolünden geçmesi gerekiyor.",
    },
  },
  upload: {
    dropzone:
      "PDF, DOCX, EPUB veya düz metin dosyasını buraya bırakın ya da tıklayarak gözatın.",
    maxSize: "Maksimum dosya boyutu: 25 MB",
    uploading: "Yükleniyor…",
    success: "Yükleme tamamlandı. Örneğiniz şimdi kontrol ediliyor.",
    errorSize: "Dosya 25 MB sınırını aşıyor.",
    errorType:
      "Desteklenmeyen dosya türü. Kabul edilenler: PDF, DOCX, EPUB, düz metin.",
    errorGeneric: "Yükleme başarısız. Lütfen tekrar deneyin.",
  },
};
