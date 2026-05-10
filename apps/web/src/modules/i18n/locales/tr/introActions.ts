export const introActions = {
  send: "Tanışma isteği gönder",
  accept: "Kabul et",
  reject: "Reddet",
  cancel: "İptal et",
  acceptConfirm:
    "Kabul etmek ilişki iletişimini ve yayıncı için örnek erişimini açar. Devam edilsin mi?",
  rejectNote: "İsteğe bağlı ret notu",
  state: {
    can_request: "Hazır",
    pending_sent: "Gönderildi",
    pending_received: "Gelen istek",
    accepted: "Kabul edildi",
    rejected_cooldown: "Bekleme süresinde",
    cancelled_cooldown: "Bekleme süresinde",
    not_eligible: "Uygun değil",
    trial_required: "Deneme gerekli",
    entitlement_expired: "Abonelik gerekli",
    subscription_required: "Abonelik gerekli",
    quota_exhausted: "Plan limiti doldu",
  },
};
