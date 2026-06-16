import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  zh: {
    translation: {
      app: {
        name: '文件编辑器',
        newFile: '新建文件',
        openFile: '打开文件',
        save: '保存',
        saveAs: '另存为',
      },
      menu: {
        file: '文件',
        edit: '编辑',
        view: '视图',
        window: '窗口',
        help: '帮助',
      },
    },
  },
  en: {
    translation: {
      app: {
        name: 'File Editor',
        newFile: 'New File',
        openFile: 'Open File',
        save: 'Save',
        saveAs: 'Save As',
      },
      menu: {
        file: 'File',
        edit: 'Edit',
        view: 'View',
        window: 'Window',
        help: 'Help',
      },
    },
  },
};

i18n.use(initReactI18next).init({
  resources,
  lng: 'zh',
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
