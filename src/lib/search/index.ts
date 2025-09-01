// Search & Discovery Engine Module
export * from './intelligentSearch';
export * from './searchIndex';
export * from './searchOptimizer';
export * from './vectorSearch';

// Intelligent Search Integration (explicit exports to avoid conflicts)
export { 
  IntelligentSearchOrchestrator,
  type IntelligentSearchConfig as IntegrationConfig 
} from './intelligentSearchIntegration';
