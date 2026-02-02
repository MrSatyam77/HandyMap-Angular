export const environment = {
  production: false,
  websocketUrl: 'http://localhost:3000',
  driverUpdateInterval: 2000, // 2 seconds
  mapConfig: {
    defaultZoom: 14,
    minZoom: 10,
    maxZoom: 20,
    defaultCenter: { lat: 21.1702, lng: 72.8311 } // Surat, Gujarat, India
  }
};
