// Live parameters for the vendored liquid-glass panels.
export interface GlassParams {
  blurRadius: number;
  tintOpacity: number;
}

declare global {
  interface Window {
    glassControls?: Partial<GlassParams> & Record<string, number>;
  }
}

/** Defaults tuned for ink text over the KARHUTLA thermal field. */
export const DEFAULT_GLASS: GlassParams = { blurRadius: 7, tintOpacity: 0.32 };

/** Update blur and tint on every live glass panel (used by the tuning panel). */
export async function setGlassParams(params: Partial<GlassParams>): Promise<void> {
  const { Container } = await import('@/vendor/liquid-glass/container');
  window.glassControls = { ...(window.glassControls ?? {}), ...params };
  for (const inst of Container.instances) {
    const gl = inst.gl_refs.gl;
    if (!gl) continue;
    if (params.blurRadius !== undefined && inst.gl_refs.blurRadiusLoc) gl.uniform1f(inst.gl_refs.blurRadiusLoc, params.blurRadius);
    if (params.tintOpacity !== undefined && inst.gl_refs.tintOpacityLoc) gl.uniform1f(inst.gl_refs.tintOpacityLoc, params.tintOpacity);
    inst.render?.();
  }
}
