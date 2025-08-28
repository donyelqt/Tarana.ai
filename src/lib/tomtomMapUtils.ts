/**
 * TomTom Maps SDK Utility Service
 * Provides centralized SDK management, initialization, and error handling
 */

export type MapStyle = 'main' | 'satellite' | 'hybrid' | 'terrain' | 'night' | 'grayscale';

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

// Precise Baguio City coordinates (City Hall area)
export const BAGUIO_CITY_COORDINATES: [number, number] = [120.5937, 16.4023];

// Optimal zoom levels for different views
export const ZOOM_LEVELS = {
  WORLD: 2,
  COUNTRY: 6,
  REGION: 9,
  CITY: 12,
  STREET: 15,
  BUILDING: 18
} as const;

export const MAP_STYLES: Record<MapStyle, { name: string; description: string; tomtomStyle: string }> = {
  main: {
    name: 'World Map',
    description: 'Clean world map with country labels and boundaries',
    tomtomStyle: 'main'
  },
  satellite: {
    name: 'Satellite',
    description: 'High-resolution satellite imagery',
    tomtomStyle: 'https://api.tomtom.com/style/1/style/*?map=2/basic_street-satellite&poi=2/poi_dynamic-satellite'
  },
  hybrid: {
    name: 'Hybrid',
    description: 'Satellite imagery with place labels',
    tomtomStyle: 'hybrid'
  },
  terrain: {
    name: 'Terrain',
    description: 'Physical terrain with elevation',
    tomtomStyle: 'terrain'
  },
  night: {
    name: 'Dark',
    description: 'Dark theme world map',
    tomtomStyle: 'night'
  },
  grayscale: {
    name: 'Minimal',
    description: 'Clean minimal world map',
    tomtomStyle: 'grayscale_light'
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

  /**
   * Get current SDK status
   */
  public getStatus(): TomTomSDKStatus {
    return {
      isLoaded: this.isSDKLoaded,
      isInitializing: !!this.sdkLoadPromise,
      error: this.loadingError,
      retryCount: this.retryCount
    };
  }

  /**
   * Load TomTom SDK with proper error handling and retries
   */
  public async loadSDK(): Promise<void> {
    // Return existing promise if already loading
    if (this.sdkLoadPromise) {
      return this.sdkLoadPromise;
    }

    // Return immediately if already loaded
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

  /**
   * Internal SDK loading implementation
   */
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

  /**
   * Single attempt to load the SDK
   */
  private async attemptSDKLoad(): Promise<void> {
    // Check if SDK is already available
    if (this.isSDKAvailable()) {
      return;
    }

    // Remove existing resources
    this.removeExistingResources();

    // Load CSS first
    await this.loadCSS();

    // Load JavaScript SDK
    await this.loadJavaScript();

    // Wait for SDK to be fully available
    await this.waitForSDKReady();
  }

  /**
   * Check if TomTom SDK is available and functional
   */
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

  /**
   * Remove existing TomTom resources
   */
  private removeExistingResources(): void {
    // Remove existing script
    const existingScript = document.querySelector('script[src*="maps-web.min.js"]');
    if (existingScript) {
      existingScript.remove();
    }

    // Remove existing CSS
    const existingCSS = document.querySelector('link[href*="maps.css"]');
    if (existingCSS) {
      existingCSS.remove();
    }
  }

  /**
   * Load TomTom CSS
   */
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

  /**
   * Load TomTom JavaScript SDK
   */
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

  /**
   * Wait for SDK to be fully ready
   */
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

  /**
   * Create a TomTom map instance with proper error handling
   */
  public async createMap(config: TomTomMapConfig): Promise<any> {
    // Ensure SDK is loaded
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
      // Get the TomTom style string
      const styleConfig = MAP_STYLES[config.style || 'main'];
      let tomtomStyle = styleConfig?.tomtomStyle || 'main';
      
      // For satellite style, append the API key to the URL
      if (config.style === 'satellite' && tomtomStyle.startsWith('https://')) {
        tomtomStyle = `${tomtomStyle}&key=${config.apiKey}`;
      }
      
      console.log(`Initializing TomTom map with style: ${tomtomStyle}, center: ${config.center}, zoom: ${config.zoom}`);
      console.log('API Key available:', !!config.apiKey);
      console.log('Container element:', config.container);

      // Create map with verified working configuration
      const mapOptions = {
        key: config.apiKey,
        container: config.container,
        center: config.center,
        zoom: config.zoom,
        style: tomtomStyle, // Use the requested style (satellite by default)
        dragPan: true,
        scrollZoom: true,
        boxZoom: true,
        doubleClickZoom: true,
        keyboard: true,
        pitch: 0,
        bearing: 0
      };
      
      console.log('Map options:', mapOptions);

      // Verify TomTom SDK is available
      if (!window.tt || !window.tt.map) {
        throw new Error('TomTom SDK not loaded');
      }
      
      console.log('Creating TomTom map instance...');
      const map = window.tt.map(mapOptions);
      
      if (!map) {
        throw new Error('Failed to create map instance');
      }
      
      console.log('Map instance created, waiting for ready state...');
      // Wait for map to be ready (simplified)
      await this.waitForMapReady(map);

      // Enable 3D terrain if requested
      if (config.enableTerrain && tomtomStyle === 'terrain') {
        this.enable3DTerrain(map).catch(error => {
          console.warn('Failed to enable 3D terrain:', error);
        });
      }

      // Traffic layer disabled for clean world map view
      console.log('Traffic layer disabled - clean map display');

      // Add navigation controls if enabled (with delay)
      if (config.enableControls) {
        // Don't await - add asynchronously to avoid blocking
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

  /**
   * Wait for map to be ready (simplified)
   */
  private async waitForMapReady(map: any): Promise<void> {
    // Simple delay approach that works reliably
    await this.delay(1000);
    
    // Basic validation
    if (!map || typeof map.getContainer !== 'function') {
      throw new Error('Map instance is not functional');
    }
    
    console.log('Map ready');
    return Promise.resolve();
  }

  /**
   * Add traffic layer to map with delay
   */
  private async addTrafficLayer(map: any, apiKey: string): Promise<void> {
    try {
      // Add a small delay before adding traffic layer
      await this.delay(200);
      
      // Check if map is still valid
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
      // Don't throw - traffic layer is optional
    }
  }

  /**
   * Add navigation controls to map with delay
   */
  private async addNavigationControls(map: any): Promise<void> {
    try {
      // Add a small delay before adding controls
      await this.delay(100);
      
      // Check if map is still valid
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
      
      // Add pitch control for 3D viewing
      if (window.tt && window.tt.PitchControl) {
        map.addControl(new window.tt.PitchControl(), 'top-right');
      }
    } catch (error) {
      console.warn('Failed to add navigation controls:', error);
    }
  }

  /**
   * Enable 3D terrain visualization
   */
  private async enable3DTerrain(map: any): Promise<void> {
    try {
      await this.delay(300);
      
      if (!map || typeof map.addSource !== 'function') {
        console.warn('Map is not ready for 3D terrain');
        return;
      }

      // Add terrain source
      map.addSource('terrain-source', {
        type: 'raster-dem',
        url: 'mapbox://mapbox.terrain-rgb',
        tileSize: 512,
        maxzoom: 14
      });

      // Set terrain
      map.setTerrain({
        source: 'terrain-source',
        exaggeration: 1.2
      });

      // Add sky layer for better 3D effect
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

  /**
   * Change map style dynamically
   */
  public async changeMapStyle(map: any, newStyle: MapStyle, apiKey?: string): Promise<void> {
    try {
      if (!map || typeof map.setStyle !== 'function') {
        throw new Error('Invalid map instance');
      }

      const styleConfig = MAP_STYLES[newStyle];
      if (!styleConfig) {
        throw new Error(`Unknown map style: ${newStyle}`);
      }

      let tomtomStyle = styleConfig.tomtomStyle;
      
      // For satellite style, append the API key to the URL
      if (newStyle === 'satellite' && tomtomStyle.startsWith('https://') && apiKey) {
        tomtomStyle = `${tomtomStyle}&key=${apiKey}`;
      }

      map.setStyle(tomtomStyle);
      
      // Wait for style to load
      await this.delay(1000);
    } catch (error) {
      console.error('Failed to change map style:', error);
      throw error;
    }
  }

  /**
   * Reset the service state (useful for testing or recovery)
   */
  public reset(): void {
    this.sdkLoadPromise = null;
    this.isSDKLoaded = false;
    this.loadingError = null;
    this.retryCount = 0;
  }

  /**
   * Utility method to create a delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const tomtomMapService = TomTomMapService.getInstance();

/**
 * Calculate optimal map bounds and center for given locations
 */
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

  // Calculate bounds
  const lats = locations.map(loc => loc.lat);
  const lngs = locations.map(loc => loc.lng);
  
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  // Calculate center
  const centerLat = (minLat + maxLat) / 2;
  const centerLng = (minLng + maxLng) / 2;

  // Calculate distance to determine zoom level
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

/**
 * Get optimized map configuration for world map display
 */
export function getWorldMapConfig(apiKey: string, container: HTMLElement, style: MapStyle = 'satellite'): TomTomMapConfig {
  return {
    apiKey,
    container,
    center: BAGUIO_CITY_COORDINATES,
    zoom: ZOOM_LEVELS.CITY,
    style,
    enableTraffic: true,
    enableControls: true,
    enable3D: style === 'terrain',
    enableTerrain: style === 'terrain',
    worldView: true,
    minZoom: ZOOM_LEVELS.WORLD,
    maxZoom: ZOOM_LEVELS.BUILDING
  };
}

// Export utility functions
export const createTomTomMap = (config: TomTomMapConfig) => tomtomMapService.createMap(config);
export const loadTomTomSDK = () => tomtomMapService.loadSDK();
export const getTomTomSDKStatus = () => tomtomMapService.getStatus();
export const resetTomTomService = () => tomtomMapService.reset();
export const changeMapStyle = (map: any, style: MapStyle, apiKey?: string) => tomtomMapService.changeMapStyle(map, style, apiKey);
