module.exports = {
  input: ['src/**/*.{js,jsx}'],
  output: './',
  options: {
    debug: false,
    removeUnusedKeys: false,
    func: {
      list: ['t', 'i18next.t'],
      extensions: ['.js', '.jsx'],
    },
    lngs: ['en', 'hi', 'gu'],
    defaultLng: 'en',
    defaultValue: '__STRING_NOT_TRANSLATED__',
    resource: {
      loadPath: 'src/locales/{{lng}}/translation.json',
      savePath: 'src/locales/{{lng}}/translation.json',
    },
    nsSeparator: false,
    keySeparator: '.',
  },
};
