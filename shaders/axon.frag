varying float vOpacity;
varying vec3 vTaint;

void main() {
    vec3 comb;
	gl_FragColor = vec4(vTaint, vOpacity);
}