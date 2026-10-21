import { vertex, shaders } from './shaders.js';

/** A GPU stable-fluid solver. Dye is black ink; the V is the final output mask. */
export class Fluid {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = canvas.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' });
    const gl = this.gl;
    if (!gl || !gl.getExtension('EXT_color_buffer_float')) throw new Error('Floating-point WebGL2 is unavailable.');
    this.programs = {};
    this.resources = [];
    this.textures = [];
    this.framebuffers = [];
    for (const [name, fragment] of Object.entries(shaders)) this.programs[name] = this.compile(fragment);
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    this.size = matchMedia('(pointer: coarse)').matches ? 192 : 256;
    this.velocity = this.double(this.size);
    this.dye = this.double(matchMedia('(pointer: coarse)').matches ? 768 : 1536);
    this.pressure = this.double(this.size);
    this.curl = this.target(this.size);
    this.divergence = this.target(this.size);
    this.mask = gl.createTexture();
    this.textures.push(this.mask);
    gl.bindTexture(gl.TEXTURE_2D, this.mask);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.resize();
  }

  compile(fragment) {
    const gl = this.gl;
    const make = (type, source) => {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const message = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        throw new Error(message);
      }
      return shader;
    };
    const program = gl.createProgram();
    const vs = make(gl.VERTEX_SHADER, vertex);
    const fs = make(gl.FRAGMENT_SHADER, fragment);
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    this.resources.push(program);
    const uniforms = {};
    for (let i = 0; i < gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS); i++) {
      const info = gl.getActiveUniform(program, i);
      uniforms[info.name] = { location: gl.getUniformLocation(program, info.name), type: info.type };
    }
    return { program, uniforms };
  }

  target(size) {
    const gl = this.gl;
    const texture = gl.createTexture();
    const framebuffer = gl.createFramebuffer();
    this.textures.push(texture);
    this.framebuffers.push(framebuffer);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, size, size, 0, gl.RGBA, gl.HALF_FLOAT, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('Fluid framebuffer is unsupported.');
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    return { texture, framebuffer, size };
  }

  double(size) {
    return { read: this.target(size), write: this.target(size), swap() { [this.read, this.write] = [this.write, this.read]; } };
  }

  pass(name, target, values) {
    const gl = this.gl;
    const { program, uniforms } = this.programs[name];
    gl.useProgram(program);
    let unit = 0;
    for (const [name, value] of Object.entries(values)) {
      const uniform = uniforms[name];
      if (!uniform) continue;
      if (uniform.type === gl.SAMPLER_2D) {
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, value.texture || value);
        gl.uniform1i(uniform.location, unit++);
      } else if (uniform.type === gl.FLOAT_VEC2) gl.uniform2fv(uniform.location, value);
      else if (uniform.type === gl.FLOAT_VEC3) gl.uniform3fv(uniform.location, value);
      else gl.uniform1f(uniform.location, value);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.framebuffer : null);
    gl.viewport(0, 0, target ? target.size : this.canvas.width, target ? target.size : this.canvas.height);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  resize() {
    // Supersample even on 1x displays; CSS downsamples the final image.
    const scale = Math.max(2, Math.min(devicePixelRatio || 1, 3));
    const size = Math.max(1, Math.round(this.canvas.getBoundingClientRect().width * scale));
    this.canvas.width = this.canvas.height = size;
    const mask = document.createElement('canvas');
    mask.width = mask.height = size;
    const ctx = mask.getContext('2d');
    const fontSize = size * 0.88;
    ctx.font = `bold ${fontSize}px Georgia, "Times New Roman", serif`;
    const metrics = ctx.measureText('V');
    const width = metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight;
    const height = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
    ctx.fillStyle = '#fff';
    ctx.fillText('V', (size - width) / 2 + metrics.actualBoundingBoxLeft, (size - height) / 2 + metrics.actualBoundingBoxAscent);
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.mask);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, mask);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  }

  splat(x, y, dx, dy, amount = 0.65, radius = 0.0009) {
    this.pass('splat', this.velocity.write, { source: this.velocity.read, point: [x, y], value: [dx, dy, 0], radius });
    this.velocity.swap();
    this.pass('splat', this.dye.write, { source: this.dye.read, point: [x, y], value: [amount, 0, 0], radius: radius * 1.3 });
    this.dye.swap();
  }

  step(dt) {
    const texel = [1 / this.size, 1 / this.size];
    this.pass('curl', this.curl, { source: this.velocity.read, texel });
    this.pass('vorticity', this.velocity.write, { source: this.velocity.read, curl: this.curl, texel, dt });
    this.velocity.swap();
    this.pass('divergence', this.divergence, { source: this.velocity.read, texel });
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.pressure.read.framebuffer);
    gl.clear(gl.COLOR_BUFFER_BIT);
    for (let i = 0; i < 16; i++) {
      this.pass('pressure', this.pressure.write, { source: this.pressure.read, divergence: this.divergence, texel });
      this.pressure.swap();
    }
    this.pass('gradient', this.velocity.write, { source: this.velocity.read, pressure: this.pressure.read, texel });
    this.velocity.swap();
    this.pass('advect', this.velocity.write, { source: this.velocity.read, velocity: this.velocity.read, texel, sourceTexel: texel, dt, decay: 0.7 });
    this.velocity.swap();
    this.pass('advect', this.dye.write, { source: this.dye.read, velocity: this.velocity.read, texel, sourceTexel: [1 / this.dye.read.size, 1 / this.dye.read.size], dt, decay: 0.14 });
    this.dye.swap();
  }

  render(time) { this.pass('display', null, { source: this.dye.read, mask: this.mask, texel: [1 / this.dye.read.size, 1 / this.dye.read.size], time }); }

  destroy() {
    const gl = this.gl;
    for (const p of this.resources) gl.deleteProgram(p);
    for (const t of this.textures) gl.deleteTexture(t);
    for (const f of this.framebuffers) gl.deleteFramebuffer(f);
    gl.deleteVertexArray(this.vao);
  }
}
