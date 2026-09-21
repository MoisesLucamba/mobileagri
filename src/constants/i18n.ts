import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

const resources = {
  pt: {
    translation: {
      profile: {
        title: 'Meu Perfil',
        edit: 'Editar perfil',
        save: 'Guardar',
        cancel: 'Cancelar',
        name: 'Nome completo',
        email: 'E-mail',
        phone: 'Telefone',
        language: 'Idioma',
        logout: 'Terminar sessão',
      },
    },
  },

  en: {
    translation: {
      profile: {
        title: 'My Profile',
        edit: 'Edit profile',
        save: 'Save',
        cancel: 'Cancel',
        name: 'Full name',
        email: 'Email',
        phone: 'Phone',
        language: 'Language',
        logout: 'Log out',
      },
    },
  },
}

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'pt',
    fallbackLng: 'pt',

    interpolation: {
      escapeValue: false,
    },

    compatibilityJSON: 'v4',
  })

export default i18n