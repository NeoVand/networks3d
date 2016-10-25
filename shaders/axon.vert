uniform float opacityMultiplier;

attribute float opacity;
attribute float topic;
attribute vec3 taint;

varying float vOpacity;
varying vec3 vTaint;

void main() {

	vTaint = taint;

	vOpacity = opacity * opacityMultiplier;

	gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0 );

}