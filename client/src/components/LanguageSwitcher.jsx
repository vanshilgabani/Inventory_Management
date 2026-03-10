import { useTranslation } from 'react-i18next';

const LanguageSwitcher = () => {
  const { i18n } = useTranslation();

  const changeLanguage = (lang) => {
    i18n.changeLanguage(lang);
    localStorage.setItem('preferredLanguage', lang);
  };

  return (
    <div className="flex gap-2 items-center">
      <button
        onClick={() => changeLanguage('en')}
        className={`px-2 py-1 rounded text-sm ${i18n.language === 'en' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
      >
        EN
      </button>
      <button
        onClick={() => changeLanguage('hi')}
        className={`px-2 py-1 rounded text-sm ${i18n.language === 'hi' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
      >
        हिंदी
      </button>
      <button
        onClick={() => changeLanguage('gu')}
        className={`px-2 py-1 rounded text-sm ${i18n.language === 'gu' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
      >
        ગુજ
      </button>
    </div>
  );
};

export default LanguageSwitcher;
