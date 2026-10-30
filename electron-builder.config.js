/** @type {import('electron-builder').Configuration} */
module.exports = {
  appId: 'com.sakai.hub',
  productName: 'SaKAi Hub',
  directories: {
    output: 'release'
  },
  files: [
    'dist-electron/**/*',
    'dist/**/*'
  ],
  mac: {
    target: 'dmg',
    category: 'public.app-category.developer-tools'
  },
  win: {
    target: 'nsis'
  },
  linux: {
    target: 'AppImage'
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true
  },
  npmRebuild: true
}
