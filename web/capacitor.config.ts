import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.misprestamos.app',
  appName: 'QuickCash',
  webDir: 'out',
  server: {
    url: 'http://149.130.165.146:3000', // Conectamos el APK directo a tu servidor web (PWA Wrapper)
    cleartext: true // Permite http provisoriamente si no tienes certificado https inicial
  }
};

export default config;
