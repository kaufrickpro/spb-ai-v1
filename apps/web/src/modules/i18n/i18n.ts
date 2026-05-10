import i18next from "i18next";
import { initReactI18next } from "react-i18next";

import { resources } from "./locales/resources";

export const i18n = i18next.createInstance();

void i18n.use(initReactI18next).init({
  fallbackLng: "tr",
  interpolation: {
    escapeValue: false,
  },
  lng: "tr",
  resources,
});
