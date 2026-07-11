/**
 * Registre déclaratif des langues disponibles.
 * Ajouter une langue = ajouter une entrée ici + un fichier /locales/<code>.json,
 * aucune autre modification n'est nécessaire (app.js et login.js bouclent dessus).
 */
const I18N_LANGUAGES = [
  { code: 'fr', label: 'Français', flag: '🇫🇷', rtl: false },
  { code: 'en', label: 'English',  flag: '🇬🇧', rtl: false },
  { code: 'ar', label: 'العربية',   flag: '🇸🇦', rtl: true  },
  { code: 'es', label: 'Español',  flag: '🇪🇸', rtl: false },
  { code: 'mg', label: 'Malagasy', flag: '🇲🇬', rtl: false },
];
