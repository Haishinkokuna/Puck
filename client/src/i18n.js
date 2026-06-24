// src/i18n.js
// i18next setup — loads both language files and detects user language.
// Why a separate file? So we import it ONCE in main.jsx and
// every component just uses the useTranslation() hook — no config repeated.
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en/translation.json';
import es from './locales/es/translation.json';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      es: { translation: es },
    },
    lng: localStorage.getItem('lang') || 'en', // remember user's preference
    fallbackLng: 'en',                          // if a key is missing in 'es', use 'en'
    interpolation: { escapeValue: false },       // React already escapes values
  });

export default i18n;
