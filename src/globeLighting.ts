import { Vector3, type MeshStandardMaterial } from "three";

export function createGlobeLighting() {
  const enabled = { value: 0 };
  const sun = { value: new Vector3(1, 0, 0) };

  function applyTo(material: MeshStandardMaterial) {
    material.onBeforeCompile = (shader) => {
      shader.uniforms.solarEnabled = enabled;
      shader.uniforms.solarDirection = sun;
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vSolarSurface;")
        // The sphere, tiles and polar cap all use the same body-centered coordinates.
        .replace("#include <begin_vertex>", "#include <begin_vertex>\nvSolarSurface = position;");
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", /* glsl */ `
          #include <common>
          varying vec3 vSolarSurface;
          uniform float solarEnabled;
          uniform vec3 solarDirection;
        `)
        .replace("#include <opaque_fragment>", /* glsl */ `
          if (solarEnabled > 0.5) {
            float incidence = dot(normalize(vSolarSurface), solarDirection);
            float edge = max(0.65 * fwidth(incidence), 0.00001);
            float daylight = smoothstep(-edge, edge, incidence);
            // Exaggerate the contrast at the horizon and leave enough fill to read the night-side map.
            vec3 shadow = vec3(0.055, 0.064, 0.086);
            vec3 light = vec3(0.24, 0.23, 0.21) + vec3(1.10, 1.08, 1.05) * pow(max(0.0, incidence), 0.62);
            outgoingLight = diffuseColor.rgb * mix(shadow, light, daylight);
          }
          #include <opaque_fragment>
        `);
    };
  }

  function setSun(direction: Vector3 | null) {
    enabled.value = direction ? 1 : 0;
    if (direction) sun.value.copy(direction);
  }

  return { applyTo, setSun };
}
