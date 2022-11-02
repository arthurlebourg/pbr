import { GUI } from 'dat.gui';
import { mat4, vec3, vec4 } from 'gl-matrix';
import { Camera } from './camera';
import { SphereGeometry } from './geometries/sphere';
import { TriangleGeometry } from './geometries/triangle';
import { GLContext } from './gl';
import { PBRShader } from './shader/pbr-shader';
import { Texture, Texture2D } from './textures/texture';
import { UniformType } from './types';

interface GUIProperties {
  albedo: number[];
  info: string;
  ponctual: boolean;
  iron: boolean;
}

/**
 * Class representing the current application with its state.
 *
 * @class Application
 */
class Application {
  /**
   * Context used to draw to the canvas
   *
   * @private
   */
  private _context: GLContext;

  private _shader: PBRShader;
  private _geometry: TriangleGeometry;
  private _uniforms: Record<string, UniformType | Texture>;

  private _textureDiffuse: Texture2D<HTMLElement> | null;
  private _textureSpecular: Texture2D<HTMLElement> | null;
  private _textureBRDF: Texture2D<HTMLElement> | null;

  private _texture_iron_color: Texture2D<HTMLElement> | null;
  private _texture_iron_metallic: Texture2D<HTMLElement> | null;
  private _texture_iron_normal: Texture2D<HTMLElement> | null;
  private _texture_iron_roughness: Texture2D<HTMLElement> | null;
  private fb: WebGLFramebuffer | null;
  private targetTextureWidth : number;
  private targetTextureHeight: number;
  private targetTexture : WebGLTexture | null;






  private _camera: Camera;

  /**
   * Object updated with the properties from the GUI
   *
   * @private
   */
  private _guiProperties: GUIProperties;

  constructor(canvas: HTMLCanvasElement) {
    this._context = new GLContext(canvas);
    this._camera = new Camera();

    this._geometry = new SphereGeometry(0.15, 32, 32);
    this._uniforms = {
      'uMaterial.albedo': vec3.create(),
      'uModel.localToProjection': mat4.create(),
      'model_transform': mat4.create(),
      'cam_pos': vec3.create(),
      '_alpha' : 1.0,
      '_metallic' : 0.0,
      '_ponctual' : false,
      '_iron' : false,
      '_create_texture' : true,
    };

    this._shader = new PBRShader();
    this._textureDiffuse = null;
    this._textureSpecular = null;
    this._textureBRDF = null;

    this._texture_iron_color = null;
    this._texture_iron_metallic = null;
    this._texture_iron_normal = null;
    this._texture_iron_roughness = null;
    this.fb = null;
    this.targetTextureWidth = 256;
    this.targetTextureHeight = 256;
    this.targetTexture = null;


    this._guiProperties = {
      albedo: [255, 255, 255],
      info: "↓ select only one ↓",
      ponctual: false,
      iron: false,
    };

    this._createGUI();
  }

  

  /**
   * Initializes the application.
   */
  async init() {
    this._context.uploadGeometry(this._geometry);
    this._context.compileProgram(this._shader);

    // Example showing how to load a texture and upload it to GPU.
    this._textureDiffuse = await Texture2D.load(
      'assets/env/Alexs_Apt_2k-diffuse-RGBM.png'
    );
    if (this._textureDiffuse !== null) {
      this._context.uploadTexture(this._textureDiffuse);
      // You can then use it directly as a uniform:
      this._uniforms['_texture_diffuse'] = this._textureDiffuse;
    }

    this._textureSpecular = await Texture2D.load(
      'assets/env/Alexs_Apt_2k-specular-RGBM.png'
    );
    if (this._textureSpecular !== null) {
      this._context.uploadTexture(this._textureSpecular);
      // You can then use it directly as a uniform:
      this._uniforms['_texture_specular'] = this._textureSpecular;
    }

    this._textureBRDF = await Texture2D.load(
      'assets/ggx-brdf-integrated.png'
    );
    if (this._textureBRDF !== null) {
      this._context.uploadTexture(this._textureBRDF);
      // You can then use it directly as a uniform:
      this._uniforms['_texture_brdf'] = this._textureBRDF;
    }

    this._texture_iron_color = await Texture2D.load(
      'assets/rustediron1-alt2-bl/rustediron2_basecolor.png'
    );
    if (this._texture_iron_color !== null) {
      this._context.uploadTexture(this._texture_iron_color);
      // You can then use it directly as a uniform:
      this._uniforms['_texture_iron_color'] = this._texture_iron_color;
    }

    this._texture_iron_metallic = await Texture2D.load(
      'assets/rustediron1-alt2-bl/rustediron2_metallic.png'
    );
    if (this._texture_iron_metallic !== null) {
      this._context.uploadTexture(this._texture_iron_metallic);
      // You can then use it directly as a uniform:
      this._uniforms['_texture_iron_metallic'] = this._texture_iron_metallic;
    }

    this._texture_iron_normal = await Texture2D.load(
      'assets/rustediron1-alt2-bl/rustediron2_normal.png'
    );
    if (this._texture_iron_normal !== null) {
      this._context.uploadTexture(this._texture_iron_normal);
      // You can then use it directly as a uniform:
      this._uniforms['_texture_iron_normal'] = this._texture_iron_normal;
    }

    this._texture_iron_roughness = await Texture2D.load(
      'assets/rustediron1-alt2-bl/rustediron2_roughness.png'
    );
    if (this._texture_iron_roughness !== null) {
      this._context.uploadTexture(this._texture_iron_roughness);
      // You can then use it directly as a uniform:
      this._uniforms['_texture_iron_roughness'] = this._texture_iron_roughness;
    }
    // create to render to

    this._context._gl.bindTexture(this._context._gl.TEXTURE_2D, this.targetTexture);
         
      // define size and format of level 0
      this.fb = this._context._gl.createFramebuffer();
      this.targetTexture = this._context._gl.createTexture();
  const level = 0;
  const internalFormat = this._context._gl.RGBA;
  const border = 0;
  const format = this._context._gl.RGBA;
  const type = this._context._gl.UNSIGNED_BYTE;
  const data = null;
  this._context._gl.texImage2D(this._context._gl.TEXTURE_2D, level, internalFormat,
                this.targetTextureWidth, this.targetTextureHeight, border,
                format, type, data);
         
  // set the filtering so we don't need mips
  this._context._gl.texParameteri(this._context._gl.TEXTURE_2D, this._context._gl.TEXTURE_MIN_FILTER, this._context._gl.LINEAR);
  this._context._gl.texParameteri(this._context._gl.TEXTURE_2D, this._context._gl.TEXTURE_WRAP_S, this._context._gl.CLAMP_TO_EDGE);
  this._context._gl.texParameteri(this._context._gl.TEXTURE_2D, this._context._gl.TEXTURE_WRAP_T, this._context._gl.CLAMP_TO_EDGE);

  // Create and bind the framebuffer
  this.fb = this._context._gl.createFramebuffer();
  this._context._gl.bindFramebuffer(this._context._gl.FRAMEBUFFER, this.fb);
        
  // attach the texture as the first color attachment
  const attachmentPoint = this._context._gl.COLOR_ATTACHMENT0;
  this._context._gl.framebufferTexture2D(
    this._context._gl.FRAMEBUFFER, attachmentPoint, this._context._gl.TEXTURE_2D, this.targetTexture, level);
  }

  /**
   * Called at every loop, before the [[Application.render]] method.
   */
  update() {
    /** Empty. */
  }

  /**
   * Called when the canvas size changes.
   */
  resize() {
    this._context.resize();
  }

  /**
   * Called at every loop, after the [[Application.update]] method.
   */
  render() {
    
    this._context.clear();
    this._context.setDepthTest(true);
    // this._context.setCulling(WebGL2RenderingContext.BACK);

    const aspect =
      this._context.gl.drawingBufferWidth /
      this._context.gl.drawingBufferHeight;

    const camera = this._camera;
    vec3.set(camera.transform.position, 0.0, 0.0, 2.0);
    camera.setParameters(aspect);
    camera.update();

    const props = this._guiProperties;

    this._uniforms['_ponctual'] = props.ponctual;
    this._uniforms['_iron'] = props.iron;


    // Set the color from the GUI into the uniform list.
    vec3.set(
      this._uniforms['uMaterial.albedo'] as vec3,
      props.albedo[0] / 255,
      props.albedo[1] / 255,
      props.albedo[2] / 255
    );
    vec3.copy(
      this._uniforms['cam_pos'] as vec3,
      camera.transform.position
    );

    if (this._uniforms['_create_texture'] == true)
    {
      this._context._gl.bindFramebuffer(this._context._gl.FRAMEBUFFER, this.fb);
   
      // Tell WebGL how to convert from clip space to pixels
      this._context._gl.viewport(0, 0, this.targetTextureWidth, this.targetTextureHeight);
   
      // Clear the attachment(s).
      this._context._gl.clear(this._context._gl.COLOR_BUFFER_BIT| this._context._gl.DEPTH_BUFFER_BIT);
      this._uniforms['_create_texture'] = false;
    }
    else
    {
      // render to the canvas
      this._context._gl.bindFramebuffer(this._context._gl.FRAMEBUFFER, null);
      
      // render the cube with the texture we just rendered to
      this._context._gl.bindTexture(this._context._gl.TEXTURE_2D, this.targetTexture);

      // Tell WebGL how to convert from clip space to pixels
      this._context._gl.viewport(0, 0, this._context._gl.canvas.width, this._context._gl.canvas.height);

      // Clear the canvas AND the depth buffer.
      this._context._gl.clear(this._context._gl.COLOR_BUFFER_BIT | this._context._gl.DEPTH_BUFFER_BIT);
    }

    // Sets the viewProjection matrix.
    // **Note**: if you want to modify the position of the geometry, you will
    // need to take the matrix of the mesh into account here.
    for (let j = -2; j < 3; j++)
    {
      for (let i = -2; i < 3; i++)
      {
        mat4.copy(this._uniforms['model_transform'] as mat4, mat4.fromTranslation(mat4.create(), vec3.fromValues(0.3*i,0.4*j,0)));
        mat4.multiply(this._uniforms['uModel.localToProjection'] as mat4, this._uniforms['model_transform'] as mat4, this._camera.localToProjection);
        this._uniforms['_alpha'] = 0.25 * (i+2);
        this._uniforms['_metallic'] = 0.25 * (j+2);
        //console.log(this._uniforms['_metallic']);
        // Draws the triangle.
        this._context.draw(this._geometry, this._shader, this._uniforms);
      }
    }
  }

  /**
   * Creates a GUI floating on the upper right side of the page.
   *
   * ## Note
   *
   * You are free to do whatever you want with this GUI. It's useful to have
   * parameters you can dynamically change to see what happens.
   *
   *
   * @private
   */
  private _createGUI(): GUI {
    const gui = new GUI();
    gui.addColor(this._guiProperties, 'albedo');
    gui.add(this._guiProperties, 'info');
    gui.add(this._guiProperties, 'ponctual');
    gui.add(this._guiProperties, 'iron');

    return gui;
  }
}

const canvas = document.getElementById('main-canvas') as HTMLCanvasElement;
const app = new Application(canvas as HTMLCanvasElement);
app.init();

function animate() {
  app.update();
  app.render();
  window.requestAnimationFrame(animate);
}
animate();

/**
 * Handles resize.
 */

const resizeObserver = new ResizeObserver((entries) => {
  if (entries.length > 0) {
    const entry = entries[0];
    canvas.width = window.devicePixelRatio * entry.contentRect.width;
    canvas.height = window.devicePixelRatio * entry.contentRect.height;
    app.resize();
  }
});

resizeObserver.observe(canvas);
