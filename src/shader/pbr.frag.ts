export default `
precision highp float;

in vec3 vNormalWS;
in vec3 FragPos;

out vec4 outFragColor;

struct Material
{
  vec3 albedo;
};

uniform Material uMaterial;
uniform vec3 cam_pos;
uniform float _alpha;
uniform float _metallic;
uniform sampler2D _texture_diffuse;
uniform sampler2D _texture_specular;
uniform sampler2D _texture_brdf;
uniform bool _ponctual;
uniform bool _create_texture;

uniform sampler2D _texture_iron_color;
uniform sampler2D _texture_iron_metallic;
uniform sampler2D _texture_iron_normal;
uniform sampler2D _texture_iron_roughness;

uniform samplerCube _texture_cubemap;

const vec3 lights[4]=vec3[4](
	vec3(4.0, 4.0, 2.0),
	vec3(3.0, -3.0, 2.0),
	vec3(-3.0, 3.0, 2.0),
	vec3(-2.0, -2.0, 2.0)
);

int NB_LIGHTS = 4;
float M_PI = 3.14;

// From three.js
vec4 sRGBToLinear( in vec4 value ) {
	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}

// From three.js
vec4 LinearTosRGB( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}

vec3 lambertian_diffuse(in vec3 color)
{
  return color / M_PI;
}

vec3 h(in vec3 light, in vec3 eye)
{
  return normalize(light + eye);
}

vec3 D(in vec3 n, in vec3 h, in float alpha)
{
  float tmp = pow(clamp(dot(n,h), 0.001, 1.0), 2.0) * (alpha*alpha - 1.0) + 1.0;
  return vec3((alpha*alpha) / (M_PI * (tmp*tmp))); 
}

vec3 G(in vec3 n, in vec3 v, in vec3 l, in float k)
{
  float gschlick_v = clamp(dot(n,v), 0.001, 1.0) / (clamp(dot(n,v), 0.001, 1.0) * (1.0 - k) + k);
  float gschlick_l = clamp(dot(n,l), 0.001, 1.0) / (clamp(dot(n,l), 0.001, 1.0) * (1.0 - k) + k);
  return vec3(gschlick_v * gschlick_l);
}

vec3 FresnelShlick(in vec3 f0, in vec3 v, in vec3 h)
{
  return vec3(f0 + (1.0 - f0) * pow(1.0 - clamp(dot(v, h), 0.001, 1.0), 5.0));
}

vec3 f_s(in vec3 lightdir, in vec3 eyedir, in vec3 normal, in float alpha)
{
  vec3 dg = D(normal, h(lightdir, eyedir), alpha) * G(normal, eyedir, lightdir, alpha);
  return dg / (4.0 * clamp(dot(lightdir,normal), 0.001, 1.0) * clamp(dot(eyedir,normal), 0.001, 1.0));
}

const float RECIPROCAL_PI = 0.31830988618;
const float RECIPROCAL_PI2 = 0.15915494;

vec2 cartesianToPolar(vec3 n) {
    vec2 uv;
    uv.x = atan(n.z, n.x) * RECIPROCAL_PI2 + 0.5;
    uv.y = asin(n.y) * RECIPROCAL_PI + 0.5;
    return uv;
}

vec2 polarRoughness(vec2 uv, float level) {
    uv.x = uv.x / pow(2.0, level);
    uv.y = (uv.y / pow(2.0, level + 1.0)) + 1.0 - (1.0 / pow(2.0, level));
    return uv;
}

void ponctual_light()
{
  vec3 albedo = sRGBToLinear(vec4(uMaterial.albedo, 1.0)).rgb;
  vec3 w_o = normalize(cam_pos - FragPos);
  vec3 normal = normalize(vNormalWS);

  float roughness = pow(clamp(_alpha, 0.05, 1.0), 2.0);
  float metallic = clamp(_metallic, 0.05, 1.0);

  vec3 irradiance = vec3(0.0);
  vec3 f0 = mix(vec3(0.04), albedo, metallic);
  for(int i = 0; i < NB_LIGHTS; ++i)
  {
    vec3 w_i = normalize(lights[i] - FragPos);
    vec3 kS = FresnelShlick(f0, w_i, h(w_i, w_o));
    vec3 specularBRDFEval = kS * f_s(w_i, w_o, normal, roughness);
    vec3 diffuseBRDFEval = (1.0 - kS) * lambertian_diffuse(albedo);
    diffuseBRDFEval *= (1.0 - metallic);
    irradiance += (diffuseBRDFEval + specularBRDFEval) * dot(normal, w_i);
  }

  // **DO NOT** forget to apply gamma correction as last step.
  irradiance = irradiance / (irradiance + 1.0); 
  outFragColor.rgba =LinearTosRGB(vec4(irradiance, 1.0));
}

void image_brdf()
{
  vec3 albedo = sRGBToLinear(vec4(uMaterial.albedo, 1.0)).rgb;
  vec3 normal = normalize(vNormalWS);
  vec3 w_o = normalize(cam_pos - FragPos);
  float roughness = pow(clamp(_alpha, 0.005, 1.0), 2.0);
  float metallic = clamp(_metallic, 0.05, 1.0);
  vec3 f0 = mix(vec3(0.04), albedo, metallic);
  vec3 reflected = reflect(-w_o, normal);

  float low_level = floor(roughness * 5.0);
  float high_level = floor(roughness * 5.0) + 1.0;

  float coef_rgbm = 8.0;

  vec4 texture_diff = texture(_texture_diffuse, cartesianToPolar(normal));
  texture_diff.rgb = texture_diff.rgb * texture_diff.a * coef_rgbm;
  texture_diff.a = 1.0;
  //texture_diff = sRGBToLinear(texture_diff);

  vec4 texture_spec_lv1 = texture(_texture_specular, polarRoughness(cartesianToPolar(reflected), low_level ));
  texture_spec_lv1.rgb = texture_spec_lv1.rgb * texture_spec_lv1.a * coef_rgbm;
  texture_spec_lv1.a = 1.0;
  //texture_spec_lv1 = sRGBToLinear(texture_spec_lv1);

  vec4 texture_spec_lv2 = texture(_texture_specular, polarRoughness(cartesianToPolar(normal), high_level));
  texture_spec_lv2.rgb = texture_spec_lv2.rgb * texture_spec_lv2.a * coef_rgbm;
  texture_spec_lv2.a = 1.0;
  //texture_spec_lv2 = sRGBToLinear(texture_spec_lv2);

  vec4 texture_spec = mix(texture_spec_lv1, texture_spec_lv2, roughness * 5.0 - low_level);

  // Environment are convoluted around the normal, that’s our w_i
  vec3 kS = FresnelShlick(f0, normal, h(normal, w_o));
  vec3 kD = (1.0 - kS) * (1.0 - metallic) * albedo;
  vec3 diffuseBRDFEval = kD * texture_diff.rgb;
  // Specular is fetched using reflected direction
  vec3 prefilteredSpec = texture_spec.rgb;
  vec2 brdf = texture(_texture_brdf, vec2(clamp(dot(normal, w_o), 0.001, 1.0), roughness)).rg;
  vec3 specularBRDFEval = prefilteredSpec * (kS * brdf.x + brdf.y);
  vec3 gi = diffuseBRDFEval + specularBRDFEval;

  gi = gi / (gi + 1.0); 
  outFragColor.rgba =LinearTosRGB(vec4(gi, 1.0));
}

void iron_pbr()
{
  vec3 albedo = sRGBToLinear(vec4(uMaterial.albedo, 1.0)).rgb;
  vec3 w_o = normalize(cam_pos - FragPos);
  vec3 normal = normalize(vNormalWS);

  vec2 uv = cartesianToPolar(normal);

  float metallic = (texture(_texture_iron_metallic, uv).x * texture(_texture_iron_metallic, uv).y * texture(_texture_iron_metallic, uv).z) ;

  vec3 f0 = mix(vec3(0.04), albedo, metallic);

  float roughness = (texture(_texture_iron_roughness, uv).x * texture(_texture_iron_roughness, uv).y * texture(_texture_iron_roughness, uv).z);

  vec4 texture_color = texture(_texture_iron_color, uv);

  // Environment are convoluted around the normal, that’s our w_i
  vec3 kS = FresnelShlick(f0, normal, h(normal, w_o));
  vec3 kD = (1.0 - kS) * (1.0 - metallic) * albedo;
  vec3 diffuseBRDFEval = kD * texture_color.rgb;
  // Specular is fetched using reflected direction
  vec3 prefilteredSpec = texture_color.rgb;
  vec2 brdf = texture(_texture_brdf, vec2(clamp(dot(normal, w_o), 0.001, 1.0), roughness)).rg;
  vec3 specularBRDFEval = prefilteredSpec * (kS * brdf.x + brdf.y);
  vec3 gi = diffuseBRDFEval + specularBRDFEval;

  gi = gi / (gi + 1.0); 
  outFragColor.rgba =LinearTosRGB(vec4(gi, 1.0));
}

void create_texture_diffuse()
{
  vec3 normal = normalize(vNormalWS);

  vec3 irradiance = vec3(0.0);  

  vec3 up    = vec3(0.0, 1.0, 0.0);
  vec3 right = normalize(cross(up, normal));
  up         = normalize(cross(normal, right));

  float sampleDelta = 0.025;
  float nrSamples = 0.0; 
  for(float phi = 0.0; phi < 2.0 * M_PI; phi += sampleDelta)
  {
      for(float theta = 0.0; theta < 0.5 * M_PI; theta += sampleDelta)
      {
          // spherical to cartesian (in tangent space)
          vec3 tangentSample = vec3(sin(theta) * cos(phi),  sin(theta) * sin(phi), cos(theta));
          // tangent space to world
          vec3 sampleVec = tangentSample.x * right + tangentSample.y * up + tangentSample.z * normal; 

          irradiance += texture(_texture_cubemap, sampleVec).rgb * cos(theta) * sin(theta);
          nrSamples++;
      }
  }
  irradiance = M_PI * irradiance * (1.0 / float(nrSamples));

  irradiance = irradiance / (irradiance + 1.0); 
  outFragColor.rgba = LinearTosRGB(vec4(irradiance, 1.0));
}


void
main()
{
  if (_create_texture)
  {
    create_texture_diffuse();
    return;
  }

  if (_ponctual)
  {
    ponctual_light();
  }
  else
  {
    image_brdf();
    //iron_pbr();
  }
}
`;
