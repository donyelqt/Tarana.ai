
export type MapStyle = 'main' | 'satellite';

export interface TomTomMapConfig {
  apiKey: string;
  center: [number, number];
  zoom: number;
  style?: MapStyle;
  container: HTMLElement;
  enableTraffic?: boolean;
  enableControls?: boolean;
  enable3D?: boolean;
  enableTerrain?: boolean;
  worldView?: boolean;
  minZoom?: number;
  maxZoom?: number;
}

export const BAGUIO_CITY_COORDINATES: [number, number] = [120.5937, 16.4023];

export const ZOOM_LEVELS = {
  WORLD: 2,
  COUNTRY: 6,
  REGION: 9,
  CITY: 12,
  STREET: 15,
  BUILDING: 18
} as const;

export const DEFAULT_MAP_PITCH = 55;

export const MAP_STYLES: Record<MapStyle, { name: string; description: string; tomtomStyle: string; requiresApiKey: boolean }> = {
  main: {
    name: 'Standard',
    description: 'Clean world map with roads and labels',
    tomtomStyle: 'https://api.tomtom.com/style/1/style/*?map=basic_main&poi=poi_main',
    requiresApiKey: true
  },
  satellite: {
    name: 'Satellite',
    description: 'High-resolution satellite imagery with roads',
    tomtomStyle: 'https://api.tomtom.com/style/1/style/*?map=2/basic_street-satellite&poi=2/poi_dynamic-satellite',
    requiresApiKey: true
  }
};

export interface TomTomSDKStatus {
  isLoaded: boolean;
  isInitializing: boolean;
  error: string | null;
  retryCount: number;
}

class TomTomMapService {
  private static instance: TomTomMapService;
  private sdkLoadPromise: Promise<void> | null = null;
  private isSDKLoaded = false;
  private loadingError: string | null = null;
  private retryCount = 0;
  private readonly maxRetries = 3;
  private readonly retryDelay = 1000;
  private readonly sdkVersion = '6.25.0';
  private readonly baseUrl = 'https://api.tomtom.com/maps-sdk-for-web/cdn/6.x';

  private constructor() {}

  public static getInstance(): TomTomMapService {
    if (!TomTomMapService.instance) {
      TomTomMapService.instance = new TomTomMapService();
    }
    return TomTomMapService.instance;
  }

  public getStatus(): TomTomSDKStatus {
    return {
      isLoaded: this.isSDKLoaded,
      isInitializing: !!this.sdkLoadPromise,
      error: this.loadingError,
      retryCount: this.retryCount
    };
  }

  public async loadSDK(): Promise<void> {
    if (this.sdkLoadPromise) {
      return this.sdkLoadPromise;
    }

    if (this.isSDKLoaded && this.isSDKAvailable()) {
      return Promise.resolve();
    }

    this.sdkLoadPromise = this.loadSDKInternal();
    
    try {
      await this.sdkLoadPromise;
    } finally {
      this.sdkLoadPromise = null;
    }
  }

  private async loadSDKInternal(): Promise<void> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        this.retryCount = attempt - 1;
        await this.attemptSDKLoad();
        this.isSDKLoaded = true;
        this.loadingError = null;
        this.retryCount = 0;
        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        console.warn(`TomTom SDK load attempt ${attempt} failed:`, lastError.message);
        
        if (attempt < this.maxRetries) {
          await this.delay(this.retryDelay * attempt);
        }
      }
    }

    this.loadingError = lastError?.message || 'Failed to load TomTom SDK';
    throw new Error(this.loadingError);
  }

  private async attemptSDKLoad(): Promise<void> {
    if (this.isSDKAvailable()) {
      return;
    }

    this.removeExistingResources();

    await this.loadCSS();

    await this.loadJavaScript();

    await this.waitForSDKReady();
  }

  private isSDKAvailable(): boolean {
    return !!(
      typeof window !== 'undefined' &&
      window.tt &&
      typeof window.tt.map === 'function' &&
      window.tt.LngLatBounds &&
      window.tt.Marker &&
      window.tt.Popup
    );
  }

  private removeExistingResources(): void {
    const existingScript = document.querySelector('script[src*="maps-web.min.js"]');
    if (existingScript) {
      existingScript.remove();
    }

    const existingCSS = document.querySelector('link[href*="maps.css"]');
    if (existingCSS) {
      existingCSS.remove();
    }
  }

  private async loadCSS(): Promise<void> {
    return new Promise((resolve, reject) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.type = 'text/css';
      link.href = `${this.baseUrl}/${this.sdkVersion}/maps/maps.css`;
      
      link.onload = () => resolve();
      link.onerror = () => reject(new Error('Failed to load TomTom CSS'));
      
      document.head.appendChild(link);
    });
  }

  private async loadJavaScript(): Promise<void> {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.type = 'text/javascript';
      script.async = true;
      script.src = `${this.baseUrl}/${this.sdkVersion}/maps/maps-web.min.js`;
      
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load TomTom JavaScript SDK'));
      
      document.head.appendChild(script);
    });
  }

  private async waitForSDKReady(timeout: number = 10000): Promise<void> {
    const startTime = Date.now();
    
    return new Promise((resolve, reject) => {
      const checkReady = () => {
        if (this.isSDKAvailable()) {
          resolve();
        } else if (Date.now() - startTime > timeout) {
          reject(new Error('Timeout waiting for TomTom SDK to be ready'));
        } else {
          setTimeout(checkReady, 100);
        }
      };
      
      checkReady();
    });
  }

  public async createMap(config: TomTomMapConfig): Promise<any> {
    await this.loadSDK();

    if (!this.isSDKAvailable()) {
      throw new Error('TomTom SDK is not available');
    }

    if (!config.apiKey) {
      throw new Error('TomTom API key is required');
    }

    if (!config.container) {
      throw new Error('Map container element is required');
    }

    try {
      const styleConfig = MAP_STYLES[config.style || 'main'];
      if (!styleConfig) {
        throw new Error(`Invalid map style: ${config.style}`);
      }
      
      let tomtomStyle = styleConfig.tomtomStyle;
      
      if (styleConfig.requiresApiKey && tomtomStyle.startsWith('https://')) {
        tomtomStyle = `${tomtomStyle}&key=${config.apiKey}`;
      }
      
      console.log(`🗺️ Initializing TomTom map with style: ${config.style}`);
      console.log(`📍 Style URL: ${tomtomStyle}`);
      console.log(`📍 Center: [${config.center[0]}, ${config.center[1]}], Zoom: ${config.zoom}`);
      console.log('API Key available:', !!config.apiKey);
      console.log('Container element:', config.container);

      const mapOptions = {
        key: config.apiKey,
        container: config.container,
        center: config.center,
        zoom: config.zoom,
        style: tomtomStyle,
        dragPan: true,
        scrollZoom: true,
        boxZoom: true,
        doubleClickZoom: true,
        keyboard: true,
        pitch: DEFAULT_MAP_PITCH,
        bearing: 0
      };
      
      console.log('Map options:', mapOptions);

      if (!window.tt || !window.tt.map) {
        throw new Error('TomTom SDK not loaded');
      }
      
      console.log('🚀 Creating TomTom map instance...');
      const map = window.tt.map(mapOptions);
      
      if (!map) {
        throw new Error('Failed to create map instance - tt.map() returned null');
      }
      
      console.log('✅ Map instance created successfully');
      
      console.log('⏳ Waiting for map to be ready...');
      await this.waitForMapReady(map);
      console.log('✅ Map is ready for use');


      if (config.enableTraffic) {
        console.log('🚦 Traffic layer will be enabled');
      } else {
        console.log('🚫 Traffic layer disabled - clean map display');
      }

      if (config.enableControls) {
        this.addNavigationControls(map).catch(error => {
          console.warn('Navigation controls initialization failed:', error);
        });
      }

      return map;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error creating map';
      throw new Error(`Failed to create TomTom map: ${errorMessage}`);
    }
  }

  private async waitForMapReady(map: any): Promise<void> {
    await this.delay(1000);
    
    if (!map || typeof map.getContainer !== 'function') {
      throw new Error('Map instance is not functional');
    }
    
    console.log('Map ready');
    return Promise.resolve();
  }

  private async addTrafficLayer(map: any, apiKey: string): Promise<void> {
    try {
      await this.delay(200);
      
      if (!map || typeof map.addSource !== 'function') {
        console.warn('Map is not ready for traffic layer');
        return;
      }

      map.addSource('traffic-source', {
        type: 'raster',
        tiles: [`https://api.tomtom.com/traffic/map/4/tile/flow/absolute/{z}/{x}/{y}.png?key=${apiKey}`],
        tileSize: 256,
        maxzoom: 18
      });

      map.addLayer({
        id: 'traffic-layer',
        type: 'raster',
        source: 'traffic-source',
        paint: {
          'raster-opacity': 0.7
        }
      });
    } catch (error) {
      console.warn('Failed to add traffic layer:', error);
    }
  }

  private async addNavigationControls(map: any): Promise<void> {
    try {
      await this.delay(100);
      
      if (!map || typeof map.addControl !== 'function') {
        console.warn('Map is not ready for navigation controls');
        return;
      }

      if (window.tt && window.tt.NavigationControl) {
        map.addControl(new window.tt.NavigationControl(), 'top-right');
      }
      if (window.tt && window.tt.FullscreenControl) {
        map.addControl(new window.tt.FullscreenControl(), 'top-right');
      }
      
      if (window.tt && window.tt.PitchControl) {
        map.addControl(new window.tt.PitchControl(), 'top-right');
      }
    } catch (error) {
      console.warn('Failed to add navigation controls:', error);
    }
  }

  private async enable3DTerrain(map: any): Promise<void> {
    try {
      await this.delay(300);
      
      if (!map || typeof map.addSource !== 'function') {
        console.warn('Map is not ready for 3D terrain');
        return;
      }

      map.addSource('terrain-source', {
        type: 'raster-dem',
        url: 'mapbox://mapbox.terrain-rgb',
        tileSize: 512,
        maxzoom: 14
      });

      map.setTerrain({
        source: 'terrain-source',
        exaggeration: 1.2
      });

      map.addLayer({
        id: 'sky',
        type: 'sky',
        paint: {
          'sky-type': 'atmosphere',
          'sky-atmosphere-sun-intensity': 5
        }
      });
    } catch (error) {
      console.warn('Failed to enable 3D terrain:', error);
    }
  }

  private async testStyleUrl(styleUrl: string): Promise<boolean> {
    try {
      const response = await fetch(styleUrl, { method: 'HEAD' });
      return response.ok;
    } catch (error) {
      console.warn('Style URL test failed:', error);
      return false;
    }
  }

  public async changeMapStyle(map: any, newStyle: MapStyle, apiKey?: string, container?: HTMLElement): Promise<any> {
    try {
      if (!map) {
        throw new Error('Invalid map instance');
      }

      if (!apiKey) {
        throw new Error('API key is required for style changes');
      }

      console.log(`🎨 Attempting to change map style to: ${newStyle}`);
      
      const currentCenter = map.getCenter ? map.getCenter() : { lng: BAGUIO_CITY_COORDINATES[0], lat: BAGUIO_CITY_COORDINATES[1] };
      const currentZoom = map.getZoom ? map.getZoom() : ZOOM_LEVELS.CITY;
      const mapContainer = container || map.getContainer();
      
      if (!mapContainer) {
        throw new Error('Map container not found');
      }

      const mapState = {
        center: [currentCenter.lng || currentCenter.lon || BAGUIO_CITY_COORDINATES[0], 
                currentCenter.lat || BAGUIO_CITY_COORDINATES[1]],
        zoom: currentZoom || ZOOM_LEVELS.CITY,
        bearing: map.getBearing ? map.getBearing() : 0,
        pitch: map.getPitch ? map.getPitch() : 0
      };

      console.log('📍 Current map state:', mapState);

      let tomtomStyle: string;
      
      switch (newStyle) {
        case 'satellite':
          tomtomStyle = `https://api.tomtom.com/style/1/style/*?map=2/basic_street-satellite&poi=2/poi_dynamic-satellite&key=${apiKey}`;
          break;
          
        case 'main':
        default:
          tomtomStyle = `https://api.tomtom.com/style/1/style/*?map=basic_main&poi=poi_main&key=${apiKey}`;
          break;
      }

      console.log('🔗 Style URL:', tomtomStyle);

      const isValidStyle = await this.testStyleUrl(tomtomStyle);
      if (!isValidStyle) {
        console.warn(`⚠️ Style URL may be invalid, proceeding anyway: ${tomtomStyle}`);
      }

      try {
        if (map.remove) {
          map.remove();
        }
      } catch (error) {
        console.warn('Error removing old map:', error);
      }

      mapContainer.innerHTML = '';

      const newMapConfig: TomTomMapConfig = {
        apiKey: apiKey,
        container: mapContainer,
        center: mapState.center as [number, number],
        zoom: mapState.zoom,
        style: newStyle,
        enableTraffic: false, 
        enableControls: true,
        enable3D: false,
        enableTerrain: false,
        worldView: true,
        minZoom: ZOOM_LEVELS.WORLD,
        maxZoom: ZOOM_LEVELS.BUILDING
      };

      const originalCreateMap = this.createMap.bind(this);
      const self = this;
      
      this.createMap = async function(config: TomTomMapConfig) {
        const mapOptions = {
          key: config.apiKey,
          container: config.container,
          center: config.center,
          zoom: config.zoom,
          style: tomtomStyle, 
          dragPan: true,
          scrollZoom: true,
          boxZoom: true,
          doubleClickZoom: true,
          keyboard: true,
          pitch: DEFAULT_MAP_PITCH,
          bearing: 0
        };

        console.log('🚀 Creating map with custom style:', mapOptions);
        
        if (!window.tt || !window.tt.map) {
          throw new Error('TomTom SDK not loaded');
        }
        
        const map = window.tt.map(mapOptions);
        
        if (!map) {
          throw new Error('Failed to create map instance - tt.map() returned null');
        }
        
        await self.waitForMapReady(map);
        
        if (config.enableControls) {
          self.addNavigationControls(map).catch(error => {
            console.warn('Navigation controls initialization failed:', error);
          });
        }
        
        return map;
      };

      try {
        const newMap = await this.createMap(newMapConfig);
        
        this.createMap = originalCreateMap;
        
        if (newMap.setBearing && mapState.bearing !== 0) {
          newMap.setBearing(mapState.bearing);
        }
        if (newMap.setPitch && mapState.pitch !== 0) {
          newMap.setPitch(mapState.pitch);
        }

        console.log(`✅ Successfully changed map style to: ${newStyle}`);
        return newMap;
      } catch (error) {
        this.createMap = originalCreateMap;
        throw error;
      }
      
    } catch (error) {
      console.error(`❌ Failed to change map style to ${newStyle}:`, error);
      
      if (error instanceof Error) {
        console.error('Error details:', {
          message: error.message,
          stack: error.stack,
          name: error.name
        });
      } else {
        console.error('Non-Error object thrown:', error);
      }
      
      throw new Error(`Map style change failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  public reset(): void {
    this.sdkLoadPromise = null;
    this.isSDKLoaded = false;
    this.loadingError = null;
    this.retryCount = 0;
  }

  private async waitForStyleChange(map: any, timeout: number = 5000): Promise<void> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      let styleChangeHandler: () => void;
      let timeoutId: NodeJS.Timeout;

      const cleanup = () => {
        if (styleChangeHandler && map.off) {
          map.off('styledata', styleChangeHandler);
        }
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      };

      timeoutId = setTimeout(() => {
        cleanup();
        console.warn('Style change timeout - proceeding anyway');
        resolve(); 
      }, timeout);

      if (map.on && typeof map.on === 'function') {
        styleChangeHandler = () => {
          cleanup();
          resolve();
        };
        map.on('styledata', styleChangeHandler);
      } else {
        setTimeout(() => {
          cleanup();
          resolve();
        }, 1500);
      }
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const tomtomMapService = TomTomMapService.getInstance();

export function calculateOptimalMapView(locations: Array<{ lat: number; lng: number }>) {
  if (locations.length === 0) {
    return {
      center: BAGUIO_CITY_COORDINATES,
      zoom: ZOOM_LEVELS.CITY
    };
  }

  if (locations.length === 1) {
    return {
      center: [locations[0].lng, locations[0].lat] as [number, number],
      zoom: ZOOM_LEVELS.CITY
    };
  }

  const lats = locations.map(loc => loc.lat);
  const lngs = locations.map(loc => loc.lng);
  
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  const centerLat = (minLat + maxLat) / 2;
  const centerLng = (minLng + maxLng) / 2;

  const latDiff = maxLat - minLat;
  const lngDiff = maxLng - minLng;
  const maxDiff = Math.max(latDiff, lngDiff);

  let zoom: number;
  if (maxDiff > 10) zoom = ZOOM_LEVELS.COUNTRY;
  else if (maxDiff > 2) zoom = ZOOM_LEVELS.REGION;
  else if (maxDiff > 0.5) zoom = ZOOM_LEVELS.CITY;
  else zoom = ZOOM_LEVELS.STREET;

  return {
    center: [centerLng, centerLat] as [number, number],
    zoom
  };
}

export function getWorldMapConfig(apiKey: string, container: HTMLElement, style: MapStyle = 'main'): TomTomMapConfig {
  return {
    apiKey,
    container,
    center: BAGUIO_CITY_COORDINATES,
    zoom: ZOOM_LEVELS.CITY,
    style,
    enableTraffic: true,
    enableControls: true,
    enable3D: false,
    enableTerrain: false,
    worldView: true,
    minZoom: ZOOM_LEVELS.WORLD,
    maxZoom: ZOOM_LEVELS.BUILDING
  };
}

export const createTomTomMap = (config: TomTomMapConfig) => tomtomMapService.createMap(config);
export const loadTomTomSDK = () => tomtomMapService.loadSDK();
export const getTomTomSDKStatus = () => tomtomMapService.getStatus();
export const resetTomTomService = () => tomtomMapService.reset();
export const changeMapStyle = (map: any, style: MapStyle, apiKey?: string, container?: HTMLElement) => 
  tomtomMapService.changeMapStyle(map, style, apiKey, container);
