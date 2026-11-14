// Types for the vendored liquid-glass-js Container (only the parts Artemis uses).
export interface GlassRefs {
  gl?: WebGLRenderingContext | null;
  blurRadiusLoc?: WebGLUniformLocation | null;
  tintOpacityLoc?: WebGLUniformLocation | null;
  [key: string]: unknown;
}

export declare class Container {
  static instances: Container[];
  static pageSnapshot: HTMLCanvasElement | null;
  static isCapturing: boolean;
  static waitingForSnapshot: Container[];

  constructor(options?: { borderRadius?: number; type?: 'rounded' | 'circle' | 'pill'; tintOpacity?: number });

  element: HTMLDivElement;
  canvas: HTMLCanvasElement;
  gl: WebGLRenderingContext | null;
  gl_refs: GlassRefs;
  webglInitialized: boolean;
  tintOpacity: number;
  render?: () => void;
  updateSizeFromDOM(): void;
}
