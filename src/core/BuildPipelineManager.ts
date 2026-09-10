import { evolis } from './EVOLIS';

export type BuildType = 'pwa' | 'apk';
export type BuildStatus = 'idle' | 'running' | 'success' | 'failed';

export interface BuildConfig {
  type: BuildType;
  optimizeForLowEnd: boolean;
  minify: boolean;
  treeshake: boolean;
  sourcemap: boolean;
  target: string;
  flutterBuildMode: 'debug' | 'release';
}

export interface BuildResult {
  id: string;
  type: BuildType;
  status: BuildStatus;
  startedAt: number;
  endedAt: number | null;
  duration: number | null;
  output: string;
  error: string | null;
}

type BuildListener = (result: BuildResult) => void;

const DEFAULT_PWA_CONFIG: BuildConfig = {
  type: 'pwa',
  optimizeForLowEnd: true,
  minify: true,
  treeshake: true,
  sourcemap: false,
  target: 'es2020',
  flutterBuildMode: 'release',
};

const DEFAULT_APK_CONFIG: BuildConfig = {
  type: 'apk',
  optimizeForLowEnd: true,
  minify: true,
  treeshake: true,
  sourcemap: false,
  target: 'es2020',
  flutterBuildMode: 'release',
};

class BuildPipelineManager {
  private currentBuild: BuildResult | null = null;
  private history: BuildResult[] = [];
  private listeners = new Set<BuildListener>();
  private configPWA: BuildConfig = { ...DEFAULT_PWA_CONFIG };
  private configAPK: BuildConfig = { ...DEFAULT_APK_CONFIG };

  getBuildStatus(): BuildStatus {
    return this.currentBuild?.status ?? 'idle';
  }

  getCurrentBuild(): BuildResult | null {
    return this.currentBuild ? { ...this.currentBuild } : null;
  }

  getHistory(): BuildResult[] {
    return [...this.history];
  }

  getConfig(type: BuildType): BuildConfig {
    return type === 'pwa' ? { ...this.configPWA } : { ...this.configAPK };
  }

  setConfig(type: BuildType, config: Partial<BuildConfig>): void {
    if (type === 'pwa') this.configPWA = { ...this.configPWA, ...config };
    else this.configAPK = { ...this.configAPK, ...config };
  }

  optimizeForLowEnd(): void {
    this.configPWA = {
      ...DEFAULT_PWA_CONFIG,
      optimizeForLowEnd: true,
      minify: true,
      treeshake: true,
      sourcemap: false,
      target: 'es2018',
    };
    this.configAPK = {
      ...DEFAULT_APK_CONFIG,
      optimizeForLowEnd: true,
      minify: true,
      treeshake: true,
      sourcemap: false,
      flutterBuildMode: 'release',
    };
  }

  async triggerBuild(type: BuildType): Promise<BuildResult> {
    if (this.currentBuild && this.currentBuild.status === 'running') {
      throw new Error('Ya hay una compilacion en curso');
    }

    const config = this.getConfig(type);
    const build: BuildResult = {
      id: this.generateId(),
      type,
      status: 'running',
      startedAt: Date.now(),
      endedAt: null,
      duration: null,
      output: '',
      error: null,
    };
    this.currentBuild = build;
    this.notify(build);

    try {
      const steps = this.getBuildSteps(type, config);
      for (const step of steps) {
        build.output += `${step}\n`;
        this.notify(build);
      }
      build.status = 'success';
      build.endedAt = Date.now();
      build.duration = build.endedAt - build.startedAt;
      build.output += `Build ${type} completado en ${build.duration}ms`;
    } catch (err) {
      build.status = 'failed';
      build.endedAt = Date.now();
      build.duration = build.endedAt - build.startedAt;
      build.error = err instanceof Error ? err.message : 'Error desconocido';
      build.output += `\nError: ${build.error}`;
    }

    this.history.unshift({ ...build });
    if (this.history.length > 50) this.history.pop();
    this.currentBuild = null;
    this.notify(build);
    await evolis.record('pipeline', type, build.status);
    return build;
  }

  exportBuildConfig(): BuildConfig {
    return {
      ...this.configPWA,
      ...this.configAPK,
    } as BuildConfig;
  }

  subscribe(listener: BuildListener): () => void {
    this.listeners.add(listener);
    if (this.currentBuild) listener(this.currentBuild);
    return () => this.listeners.delete(listener);
  }

  private getBuildSteps(type: BuildType, config: BuildConfig): string[] {
    if (type === 'pwa') {
      return [
        'Iniciando build PWA...',
        `Target: ${config.target}`,
        `Minify: ${config.minify ? 'ON' : 'OFF'}`,
        `Treeshake: ${config.treeshake ? 'ON' : 'OFF'}`,
        `Sourcemap: ${config.sourcemap ? 'ON' : 'OFF'}`,
        config.optimizeForLowEnd ? 'Optimizando para hardware modesto...' : 'Configuracion estandar',
        'Compilando TypeScript...',
        'Generando bundle Vite...',
        'Copiando manifest.json y service worker...',
        'Build PWA listo',
      ];
    }
    return [
      'Iniciando build APK...',
      `Flutter mode: ${config.flutterBuildMode}`,
      config.optimizeForLowEnd ? 'Optimizando para hardware modesto...' : 'Configuracion estandar',
      'flutter pub get...',
      `flutter build apk --${config.flutterBuildMode}...`,
      'Compilando Dart...',
      'Generando APK...',
      'Build APK listo',
    ];
  }

  private notify(result: BuildResult): void {
    for (const listener of this.listeners) listener({ ...result });
  }

  private generateId(): string {
    return crypto.randomUUID?.() ?? Math.random().toString(36).slice(2);
  }
}

export const buildPipelineManager = new BuildPipelineManager();
