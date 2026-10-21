export const vertex = `#version 300 es
precision highp float;
out vec2 uv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  uv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const common = `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 uv;
out vec4 color;
uniform vec2 texel;
uniform sampler2D source;
`;

export const shaders = {
  splat: common + `
    uniform vec2 point;
    uniform vec3 value;
    uniform float radius;
    void main() {
      vec2 p = uv - point;
      float weight = exp(-dot(p, p) / radius);
      color = vec4(texture(source, uv).xyz + weight * value, 1.0);
    }
  `,
  advect: common + `
    uniform sampler2D velocity;
    uniform float dt;
    uniform float decay;
    uniform vec2 sourceTexel;
    vec4 bilerp(sampler2D field, vec2 p, vec2 size) {
      vec2 st = p / size - 0.5;
      vec2 i = floor(st);
      vec2 f = fract(st);
      vec2 a = (i + 0.5) * size;
      return mix(mix(texture(field, a), texture(field, a + vec2(size.x, 0.0)), f.x),
                 mix(texture(field, a + vec2(0.0, size.y)), texture(field, a + size), f.x), f.y);
    }
    void main() {
      vec2 v = bilerp(velocity, uv, texel).xy;
      vec2 p = clamp(uv - dt * v * texel, sourceTexel * 0.5, 1.0 - sourceTexel * 0.5);
      color = bilerp(source, p, sourceTexel) / (1.0 + decay * dt);
    }
  `,
  curl: common + `
    void main() {
      float l = texture(source, uv - vec2(texel.x, 0)).y;
      float r = texture(source, uv + vec2(texel.x, 0)).y;
      float b = texture(source, uv - vec2(0, texel.y)).x;
      float t = texture(source, uv + vec2(0, texel.y)).x;
      color = vec4(0.5 * (r - l - t + b), 0, 0, 1);
    }
  `,
  vorticity: common + `
    uniform sampler2D curl;
    uniform float dt;
    void main() {
      float l = texture(curl, uv - vec2(texel.x, 0)).x;
      float r = texture(curl, uv + vec2(texel.x, 0)).x;
      float b = texture(curl, uv - vec2(0, texel.y)).x;
      float t = texture(curl, uv + vec2(0, texel.y)).x;
      float c = texture(curl, uv).x;
      vec2 force = 0.5 * vec2(abs(t) - abs(b), abs(r) - abs(l));
      force /= length(force) + 0.0001;
      force *= 18.0 * c;
      force.y *= -1.0;
      color = vec4(clamp(texture(source, uv).xy + force * dt, -800.0, 800.0), 0, 1);
    }
  `,
  divergence: common + `
    void main() {
      vec2 c = texture(source, uv).xy;
      float l = uv.x <= texel.x ? -c.x : texture(source, uv - vec2(texel.x, 0)).x;
      float r = uv.x >= 1.0 - texel.x ? -c.x : texture(source, uv + vec2(texel.x, 0)).x;
      float b = uv.y <= texel.y ? -c.y : texture(source, uv - vec2(0, texel.y)).y;
      float t = uv.y >= 1.0 - texel.y ? -c.y : texture(source, uv + vec2(0, texel.y)).y;
      color = vec4(0.5 * (r - l + t - b), 0, 0, 1);
    }
  `,
  pressure: common + `
    uniform sampler2D divergence;
    void main() {
      float l = texture(source, uv - vec2(texel.x, 0)).x;
      float r = texture(source, uv + vec2(texel.x, 0)).x;
      float b = texture(source, uv - vec2(0, texel.y)).x;
      float t = texture(source, uv + vec2(0, texel.y)).x;
      float d = texture(divergence, uv).x;
      color = vec4((l + r + b + t - d) * 0.25, 0, 0, 1);
    }
  `,
  gradient: common + `
    uniform sampler2D pressure;
    void main() {
      float l = texture(pressure, uv - vec2(texel.x, 0)).x;
      float r = texture(pressure, uv + vec2(texel.x, 0)).x;
      float b = texture(pressure, uv - vec2(0, texel.y)).x;
      float t = texture(pressure, uv + vec2(0, texel.y)).x;
      color = vec4(texture(source, uv).xy - vec2(r - l, t - b), 0, 1);
    }
  `,
  display: common + `
    uniform sampler2D mask;
    uniform float time;
    float sampleInk(vec2 p) {
      vec2 st = p / texel - 0.5;
      vec2 i = floor(st);
      vec2 f = fract(st);
      vec2 a = (i + 0.5) * texel;
      return mix(mix(texture(source, a).x, texture(source, a + vec2(texel.x, 0)).x, f.x),
                 mix(texture(source, a + vec2(0, texel.y)).x, texture(source, a + texel).x, f.x), f.y);
    }
    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float noise(vec2 p) {
      vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
    }
    float fbm(vec2 p) {
      float n = 0.0; float a = 0.5;
      for (int i = 0; i < 5; i++) { n += a * noise(p); p = mat2(1.6, -1.2, 1.2, 1.6) * p; a *= 0.5; }
      return n;
    }
    void main() {
      float m = texture(mask, uv).r;
      vec3 bg = vec3(5.0 / 255.0);
      if (m < 0.001) { color = vec4(bg, 1); return; }
      float ink = sampleInk(uv);
      vec2 warp = vec2(fbm(uv * 5.0 + time * 0.014), fbm(uv * 5.0 + 8.3 - time * 0.011));
      float cloud = fbm(uv * 7.0 + warp * 3.5);
      float base = smoothstep(0.47, 0.73, cloud) * 0.22;
      float darkness = (1.0 - exp(-max(0.0, ink) * 0.85)) * 0.62;
      float brightness = clamp(1.0 - darkness - base * (1.0 - darkness), 0.32, 1.0);
      float grain = (hash(gl_FragCoord.xy + floor(time * 8.0)) - 0.5) * 0.005;
      vec3 paper = vec3(0.95, 0.943, 0.924) * brightness + grain;
      color = vec4(mix(bg, paper, m), 1);
    }
  `,
};
