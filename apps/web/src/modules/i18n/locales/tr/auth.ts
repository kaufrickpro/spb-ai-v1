export const auth = {
  login: {
    title: "Hesabınıza giriş yapın",
    subtitle:
      "E-posta ve şifreyle giriş yapın veya geçen sefer kullandığınız sağlayıcıyı seçin.",
    email: "E-posta adresi",
    password: "Şifre",
    submit: "Giriş yap",
    noAccount: "Hesabınız yok mu?",
    signupLink: "Kayıt ol",
    lastUsedPassword: "Son kullanılan: e-posta ve şifre",
    forgotPassword: "Şifrenizi mi unuttunuz?",
  },
  adminLogin: {
    title: "Yönetici konsolu girişi",
    subtitle:
      "Yönetici konsolu için tanımlanan personel e-postası ve şifresini kullanın.",
    submit: "Yönetici girişi yap",
    staffRedirect:
      "Bu bir personel hesabı. Lütfen yönetici konsolu girişini kullanın.",
    noAccess: "Bu hesabın yönetici konsoluna erişim izni yok.",
    revoked: "Bu personel hesabı artık yönetici konsolunu kullanamaz.",
    signOut: "Çıkış yap",
    returnHome: "Ana sayfaya dön",
    backToAdminLogin: "Yönetici girişine dön",
  },
  adminMfa: {
    title: "Yönetici güvenlik adımını tamamlayın",
    enrollDescription:
      "Kodu bir doğrulama uygulamasıyla tarayın, ardından yönetici erişimini etkinleştirmek için altı haneli kodu girin.",
    verifyDescription:
      "Yönetici konsoluna devam etmek için doğrulama uygulamanızdaki altı haneli kodu girin.",
    qrAlt: "Doğrulama uygulaması QR kodu",
    code: "Doğrulama kodu",
    submit: "Doğrula ve devam et",
  },
  forgotPassword: {
    title: "Şifrenizi sıfırlayın",
    description:
      "E-posta adresinizi girin; hesap uygunsa şifre sıfırlama bağlantısı göndereceğiz.",
    submit: "Sıfırlama bağlantısı gönder",
    sent: "Bu adres uygunsa şifre sıfırlama bağlantısı gönderildi.",
  },
  resetPassword: {
    title: "Yeni şifre belirleyin",
    description:
      "Bu hesap için yeni şifreyi girin, ardından uygulamaya devam edin.",
    newPassword: "Yeni şifre",
    confirmPassword: "Yeni şifreyi doğrula",
    submit: "Şifreyi güncelle",
    missingSession:
      "Bu sıfırlama bağlantısı eksik veya süresi dolmuş. Yeni bir şifre sıfırlama bağlantısı isteyip tekrar deneyin.",
  },
  signup: {
    title: "Hesabınızı oluşturun",
    subtitle:
      "Önce hesabınızı oluşturun, sonra pazaryerinde nasıl görüneceğinizi belirleyin.",
    email: "E-posta adresi",
    password: "Şifre",
    confirmPassword: "Şifreyi doğrula",
    back: "Geri",
    finish: "Kurulumu tamamla",
    hasAccount: "Zaten hesabınız var mı?",
    loginLink: "Giriş yap",
    stepCounter: "Adım {{current}} / {{total}}",
    errors: {
      accountRequired:
        "Devam etmek için e-posta adresinizi ve şifrenizi girin.",
      passwordTooShort: "Şifre en az 6 karakter olmalıdır.",
      passwordMismatch: "Şifreler eşleşmiyor.",
    },
    accountStep: {
      signedInTitle: "Hesap zaten doğrulandı",
      signedInDescription:
        "{{email}} olarak giriş yaptınız. Pazaryeri profilinizi oluşturmak için kalan kurulum adımlarını tamamlayın.",
    },
    roles: {
      author: {
        title: "Yazar",
        description:
          "Manuskriptler, türler ve başvurular için profil oluşturun.",
      },
      publisher: {
        title: "Yayıncı",
        description: "Editöryal odak ve keşif için profil oluşturun.",
      },
    },
    profileStep: {
      title: "Bize kendinizden bahsedin",
      description:
        "Pazaryeri rolünüzü seçin ve insanların ilk göreceği kimlik bilgilerini ekleyin.",
      displayName: "Görünen ad",
      displayNamePlaceholder: "Keşifte görünecek ad",
      photoAlt: "Profil önizlemesi",
      photoHint:
        "Herkese açık bir profil fotoğrafı bağlantısı yapıştırın ya da şimdilik boş bırakın.",
      photoInput: "Profil fotoğrafı URL",
      photoLabel: "Profil fotoğrafı",
      photoPlaceholder: "https://example.com/foto.png",
    },
    intentStep: {
      title: "Bu uygulamayı neden kullanmayı planlıyorsunuz?",
      description: {
        author: "İlk kullanım amacınızı en iyi anlatan seçeneği işaretleyin.",
        publisher:
          "Ekibinizin ilk kullanım amacını en iyi anlatan seçeneği işaretleyin.",
      },
      question: {
        author: "Bu uygulamayı neden kullanmayı planlıyorsunuz?",
        publisher: "Ekibiniz bu uygulamayı neden kullanmayı planlıyor?",
      },
      help: {
        author:
          "Bunu sonraki profil alanlarını ve ürün yönlendirmelerini şekillendirmek için kullanacağız.",
        publisher:
          "Bunu sonraki profil alanlarını ve ürün yönlendirmelerini şekillendirmek için kullanacağız.",
      },
    },
    intentOptions: {
      find_publisher: "Eserim için yayınevi bulmak istiyorum",
      compare_publishers:
        "Yayınevlerini ve editöryal uyumu karşılaştırmak istiyorum",
      prepare_submission: "Başvurularımı daha düzenli hazırlamak istiyorum",
      discover_manuscripts:
        "İncelenmeye değer manuskriptleri keşfetmek istiyoruz",
      source_authors: "Listemiz için yazar keşfetmek istiyoruz",
      manage_submissions: "Gelen başvuru akışımızı daha iyi yönetmek istiyoruz",
    },
    aside: {
      kicker: "Profil odaklı kayıt",
      title: "İleride büyüyecek profilinizin temel hesabını şimdi kurun.",
      description:
        "İlk dikey dilimi dar tutuyoruz: şimdi hesap oluşturma, sonraki adımda daha zengin profil düzenleme.",
      cardTitle: "Hemen elde edeceğiniz şeyler",
      cardBody:
        "Kaydedilmiş pazaryeri kimliği, net bir rol ve kayıt sonrası döneceğiniz bir profil ana sayfası.",
      footer: {
        one: "Kimlik",
        two: "Profil",
        three: "Keşif",
      },
    },
  },
  social: {
    google: "Google ile devam et",
    facebook: "Facebook ile devam et",
    lastUsed: "Son kullanılan",
    orEmail: "Veya e-posta ile devam et",
    unavailable: "{{provider}} şu anda kullanılamıyor.",
  },
  checkEmail: {
    title: "E-postanızı kontrol edin",
    fromSignup:
      "Hesabınız oluşturuldu. E-posta adresinize bir doğrulama bağlantısı gönderdik. Bağlantıyı açıp hesabınızı doğrulayın, sonra geri dönüp giriş yapın.",
    fromLogin:
      "Bu hesap mevcut ancak e-posta adresi henüz doğrulanmamış. Önce e-postanızı doğrulayın, ardından tekrar giriş yapın.",
    emailLabel: "E-posta adresi",
    emailPlaceholder: "ornek@eposta.com",
    resendButton: "Doğrulama e-postasını yeniden gönder",
    resentSuccess: "Bu adres uygunsa yeni bir doğrulama e-postası gönderildi.",
    backToLogin: "Girişe dön",
    useDifferentEmail: "Farklı bir e-posta mı kullanacaksınız?",
    createAnotherAccount: "Yeni hesap oluştur",
    emailRequired:
      "Doğrulama e-postasını yeniden göndermek için e-posta adresinizi girin.",
  },
  signOut: "Çıkış yap",
  callback: {
    title: "Giriş tamamlanıyor",
    description:
      "Oturumunuz hazırlanıyor ve sizi yönlendireceğimiz sayfa belirleniyor.",
    genericError: "Sosyal giriş akışını tamamlayamadık. Lütfen tekrar deneyin.",
    backToLogin: "Girişe dön",
  },
  errors: {
    invalidCredentials: "Geçersiz e-posta veya şifre",
    emailNotConfirmed:
      "Giriş yapmadan önce e-posta adresinizi doğrulamanız gerekiyor.",
    emailRateLimited:
      "Henüz yeni bir doğrulama e-postası gönderemiyoruz. Lütfen birkaç dakika bekleyip tekrar deneyin.",
    emailDeliveryFailed:
      "E-postayı gönderemedik. Kimlik e-postası gönderim ayarlarını ve gönderen alan adı doğrulamasını kontrol edin.",
    generic: "Bir şeyler ters gitti. Lütfen tekrar deneyin.",
  },
};
