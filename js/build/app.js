var raycaster = new THREE.Raycaster()
var mouse = new THREE.Vector2(-1, -1)
var tooltipVisible = false
var tooltip = document.getElementById("tooltip")
var tooltipBody = tooltip.querySelector(".body")
var tooltipAttribution = tooltip.querySelector(".attribution")

document.addEventListener("mousemove", function(e) {
	e.preventDefault()

	mouse.x = (e.pageX / WIDTH) * 2 - 1
	mouse.y = -(e.pageY / HEIGHT) * 2 + 1
})

function loadTooltipData(data) {
	tooltipBody.innerHTML = data.body
	tooltipAttribution.innerHTML = data.attribution
}

function moveTooltip(e) {
	tooltip.style.top = e.pageY + 'px'
	tooltip.style.left = e.pageX + 'px'
}

function openTooltip() {
	tooltip.classList.remove("hidden")
	document.addEventListener("mousemove", moveTooltip)
}

function closeTooltip() {
	tooltip.classList.add("hidden")
	document.removeEventListener("mousemove", moveTooltip)
}

// Neuron ----------------------------------------------------------------

function Neuron( x, y, z ) {

	this.connection = [];
	this.receivedSignal = false;
	this.lastSignalRelease = 0;
	this.releaseDelay = 0;
	this.fired = false;
	this.firedCount = 0;
	this.prevReleaseAxon = null;
	THREE.Vector3.call( this, x, y, z );

}

Neuron.prototype = Object.create( THREE.Vector3.prototype );

Neuron.prototype.connectNeuronTo = function ( neuronB ) {

	var neuronA = this;
	// create axon and establish connection
	var axon = new Axon( neuronA, neuronB );
	neuronA.connection.push( new Connection( axon, 'A' ) );
	neuronB.connection.push( new Connection( axon, 'B' ) );
	return axon;

};

Neuron.prototype.createSignal = function ( particlePool, minSpeed, maxSpeed ) {

	this.firedCount += 1;
	this.receivedSignal = false;

	var signals = [];
	// create signal to all connected axons
	for ( var i = 0; i < this.connection.length; i++ ) {
		if ( this.connection[ i ].axon !== this.prevReleaseAxon ) {
			var c = new Signal( particlePool, minSpeed, maxSpeed );
			c.setConnection( this.connection[ i ] );
			signals.push( c );
		}
	}
	return signals;

};

Neuron.prototype.reset = function () {

	this.receivedSignal = false;
	this.lastSignalRelease = 0;
	this.releaseDelay = 0;
	this.fired = false;
	this.firedCount = 0;

};

// Signal extends THREE.Vector3 ----------------------------------------------------------------

function Signal( particlePool, minSpeed, maxSpeed ) {

	this.minSpeed = minSpeed;
	this.maxSpeed = maxSpeed;
	this.speed = THREE.Math.randFloat( this.minSpeed, this.maxSpeed );
	this.alive = true;
	this.t = null;
	this.startingPoint = null;
	this.axon = null;
	this.particle = particlePool.getParticle();
	THREE.Vector3.call( this );

}

Signal.prototype = Object.create( THREE.Vector3.prototype );

Signal.prototype.setConnection = function ( Connection ) {

	this.startingPoint = Connection.startingPoint;
	this.axon = Connection.axon;
	if ( this.startingPoint === 'A' ) this.t = 0;
	else if ( this.startingPoint === 'B' ) this.t = 1;

};

Signal.prototype.travel = function ( deltaTime ) {

	var pos;
	if ( this.startingPoint === 'A' ) {
		this.t += this.speed * deltaTime;
		if ( this.t >= 1 ) {
			this.t = 1;
			this.alive = false;
			this.axon.neuronB.receivedSignal = true;
			this.axon.neuronB.prevReleaseAxon = this.axon;
		}

	} else if ( this.startingPoint === 'B' ) {
		this.t -= this.speed * deltaTime;
		if ( this.t <= 0 ) {
			this.t = 0;
			this.alive = false;
			this.axon.neuronA.receivedSignal = true;
			this.axon.neuronA.prevReleaseAxon = this.axon;
		}
	}
	// pos = this.axon.getPoint( 0 );

	pos = this.axon.getPoint( this.t );
	//  pos = this.axon.getPointAt(this.t);	// uniform point distribution but slower calculation

	this.particle.set( pos.x, pos.y, pos.z );

};

// Particle Pool ---------------------------------------------------------

function ParticlePool( poolSize ) {

	this.spriteTextureSignal = TEXTURES.electric;

	this.poolSize = poolSize;
	this.pGeom = new THREE.Geometry();
	this.particles = this.pGeom.vertices;

	this.offScreenPos = new THREE.Vector3( 9999, 9999, 9999 );

	this.pColor = '#ffffff';
	this.pSize = 0.6;

	for ( var ii = 0; ii < this.poolSize; ii++ ) {
		this.particles[ ii ] = new Particle( this );
	}

	this.meshComponents = new THREE.Object3D();

	// inner particle
	this.pMat = new THREE.PointCloudMaterial( {
		map: this.spriteTextureSignal,
		size: this.pSize,
		color: this.pColor,
		blending: THREE.AdditiveBlending,
		depthTest: false,
		transparent: true
	} );

	this.pMesh = new THREE.PointCloud( this.pGeom, this.pMat );
	this.pMesh.frustumCulled = false;

	this.meshComponents.add( this.pMesh );


	// outer particle glow
	this.pMat_outer = this.pMat.clone();
	this.pMat_outer.size = this.pSize * 10;
	this.pMat_outer.opacity = 0.04;

	this.pMesh_outer = new THREE.PointCloud( this.pGeom, this.pMat_outer );
	this.pMesh_outer.frustumCulled = false;

	this.meshComponents.add( this.pMesh_outer );

}

ParticlePool.prototype.getAvgExecutionTime = function () {
	return this.profTime / this.itt;
};

ParticlePool.prototype.getParticle = function () {

	for ( var ii = 0; ii < this.poolSize; ii++ ) {
		var p = this.particles[ ii ];
		if ( p.available ) {
			this.lastAvailableIdx = ii;
			p.available = false;
			return p;
		}
	}

	console.error( "ParticlePool.prototype.getParticle return null" );
	return null;

};

ParticlePool.prototype.update = function () {

	this.pGeom.verticesNeedUpdate = true;

};

ParticlePool.prototype.updateSettings = function () {

	// inner particle
	this.pMat.color.setStyle( this.pColor );
	this.pMat.size = this.pSize;
	// outer particle
	this.pMat_outer.color.setStyle( this.pColor );
	this.pMat_outer.size = this.pSize * 10;

};

// Particle --------------------------------------------------------------
// Private class for particle pool

function Particle( particlePool ) {

	this.particlePool = particlePool;
	this.available = true;
	THREE.Vector3.call( this, this.particlePool.offScreenPos.x, this.particlePool.offScreenPos.y, this.particlePool.offScreenPos.z );

}

Particle.prototype = Object.create( THREE.Vector3.prototype );

Particle.prototype.free = function () {

	this.available = true;
	this.set( this.particlePool.offScreenPos.x, this.particlePool.offScreenPos.y, this.particlePool.offScreenPos.z );

};

// Axon extends THREE.CubicBezierCurve3 ------------------------------------------------------------------
/* exported Axon, Connection */

function Axon( neuronA, neuronB ) {

	this.bezierSubdivision = 1;
	this.neuronA = neuronA;
	this.neuronB = neuronB;
	this.cpLength = neuronA.distanceTo( neuronB ) / THREE.Math.randFloat( 1.5, 4.0 );
	this.controlPointA = this.getControlPoint( neuronA, neuronB );
	this.controlPointB = this.getControlPoint( neuronB, neuronA );
	THREE.CubicBezierCurve3.call( this, this.neuronA, this.controlPointA, this.controlPointB, this.neuronB );

	this.vertices = this.getSubdividedVertices();

}

Axon.prototype = Object.create( THREE.CubicBezierCurve3.prototype );

Axon.prototype.getSubdividedVertices = function () {
	return this.getSpacedPoints( this.bezierSubdivision );
};

// generate uniformly distribute vector within x-theta cone from arbitrary vector v1, v2
Axon.prototype.getControlPoint = function ( v1, v2 ) {

	var dirVec = new THREE.Vector3().copy( v2 ).sub( v1 ).normalize();
	var northPole = new THREE.Vector3( 0, 0, 1 ); // this is original axis where point get sampled
	var axis = new THREE.Vector3().crossVectors( northPole, dirVec ).normalize(); // get axis of rotation from original axis to dirVec
	var axisTheta = dirVec.angleTo( northPole ); // get angle
	var rotMat = new THREE.Matrix4().makeRotationAxis( axis, axisTheta ); // build rotation matrix

	var minz = Math.cos( THREE.Math.degToRad( 45 ) ); // cone spread in degrees
	var z = THREE.Math.randFloat( minz, 1 );
	var theta = THREE.Math.randFloat( 0, Math.PI * 2 );
	var r = Math.sqrt( 1 - z * z );
	var cpPos = new THREE.Vector3( r * Math.cos( theta ), r * Math.sin( theta ), z );
	cpPos.multiplyScalar( this.cpLength ); // length of cpPoint
	cpPos.applyMatrix4( rotMat ); // rotate to dirVec
	cpPos.add( v1 ); // translate to v1
	return cpPos;

};

// Connection ------------------------------------------------------------
function Connection( axon, startingPoint ) {
	this.axon = axon;
	this.startingPoint = startingPoint;
}

// Neural Network --------------------------------------------------------

function NeuralNetwork() {

	this.initialized = false;

	this.settings = {
		/*default
		 verticesSkipStep       : 2,
		 maxAxonDist            : 10,
		 maxConnectionsPerNeuron: 6,
		 signalMinSpeed         : 1.75,
		 signalMaxSpeed         : 3.25,
		 currentMaxSignals      : 3000,
		 limitSignals           : 10000
		 */

		verticesSkipStep: 1,
		maxAxonDist: 20,
		maxConnectionsPerNeuron: 16,
		signalMinSpeed: 0,
		signalMaxSpeed: 0,
		currentMaxSignals: 0,
		limitSignals: 1500

	};

	this.meshComponents = new THREE.Object3D();
	this.particlePool = new ParticlePool( this.settings.limitSignals );
	this.meshComponents.add( this.particlePool.meshComponents );

	// NN component containers
	this.components = {
		neurons: [],
		allSignals: [],
		allAxons: []
	};

	// axon
	this.axonOpacityMultiplier = 0.1;
	this.axonColor = new THREE.Color('#455C7B');
	this.axonColor_0 = new THREE.Color('#FFBC67');
	this.axonColor_1 = new THREE.Color('#685C79');
	this.axonColor_2 = new THREE.Color('#ff0000');
	this.axonGeom = new THREE.BufferGeometry();
	this.axonPositions = [];
	this.axonIndices = [];
	this.axonNextPositionsIndex = 0;

	this.axonUniforms = {
		color: {
			type: 'c',
			value: new THREE.Color( this.axonColor )
		},
		color_0: {
			type: 'c',
			value: new THREE.Color( this.axonColor_0 )
		},
		color_1: {
			type: 'c',
			value: new THREE.Color( this.axonColor_1 )
		},
		color_2: {
			type: 'c',
			value: new THREE.Color( this.axonColor_2 )
		},
		opacityMultiplier: {
			type: 'f',
			value: this.axonOpacityMultiplier
		}
	};

	this.axonAttributes = {
		opacity: {
			type: 'f',
			value: []
		},
		taint: {
			type: 'c',
			value: []
		},
		topic: {
			type: 'f',
			value: []
		}

	};

	// neuron
	this.neuronSizeMultiplier = 1.0;
	this.spriteTextureNeuron = TEXTURES.electric;
	this.neuronColor_0 = '#ff0000';
	this.neuronColor_1 = '#0000ff';
	this.neuronColor_2 = '#ff00ff';
	this.neuronColor_3 = '#ffffff';
	this.neuronOpacity = 0.75;
	this.neuronsGeom = new THREE.Geometry();

	this.neuronUniforms = {
		sizeMultiplier: {
			type: 'f',
			value: this.neuronSizeMultiplier
		},
		opacity: {
			type: 'f',
			value: this.neuronOpacity
		},
		texture: {
			type: 't',
			value: this.spriteTextureNeuron
		}
	};

	this.neuronAttributes = {
		color: {
			type: 'c',
			value: []
		},
		size: {
			type: 'f',
			value: []
		},
		affinity: {
			type: 'f',
			value: []
		},
		node_id: {
			type: 'f',
			value: []
		},
		handle: {
			type: 's',
			value: []
		},
		pagerank: {
			type: 'f',
			value: []
		}

	};

	this.neuronShaderMaterial = new THREE.ShaderMaterial( {

		uniforms: this.neuronUniforms,
		attributes: this.neuronAttributes,
		vertexShader: null,
		fragmentShader: null,
		blending: THREE.AdditiveBlending,
		transparent: true,
		depthTest: false

	} );

	// info api
	this.numNeurons = 0;
	this.numAxons = 0;
	this.numSignals = 0;

	this.numPassive = 0;

	// initialize NN
	this.initNeuralNetwork();

}

NeuralNetwork.prototype.initNeuralNetwork = function () {
	var that = this;
	$.getJSON('./models/nodeInfo.json', function(data) {
		var nodeInfo = data;
		that.initNeurons( nodeInfo );

		that.neuronShaderMaterial.vertexShader = SHADER_CONTAINER.neuronVert;
		that.neuronShaderMaterial.fragmentShader = SHADER_CONTAINER.neuronFrag;

		$.getJSON('./models/EdgeList_guns_terrorism.json', function(data) {
			that.initAxons(data);
			that.axonShaderMaterial.vertexShader = SHADER_CONTAINER.axonVert;
			that.axonShaderMaterial.fragmentShader = SHADER_CONTAINER.axonFrag;

		});

		that.initialized = true;

	});


};

NeuralNetwork.prototype.initNeurons = function ( info ) {

	var i;
	// for ( i = 0; i < inputVertices.length; i += this.settings.verticesSkipStep ) {
	// 	var pos = inputVertices[ i ];
	// 	var n = new Neuron( pos.x, pos.y, pos.z );
	// 	this.components.neurons.push( n );
	// 	this.neuronsGeom.vertices.push( n );
	// 	// dont set neuron's property here because its skip vertices
	// }

	// set neuron attributes value
	for ( i = 0; i < info.length; i++ ) {
		// this.neuronAttributes.color.value[ i ] = new THREE.Color( '#ffffff' ); // initial neuron color
		// this.neuronAttributes.size.value[ i ] = THREE.Math.randFloat( 0.75, 3.0 ); // initial neuron size
		var dcol;
		var node = info[i];
		var position = node.embedding_1;
		var n = new Neuron(position[0], position[1], position[2]);
		n.node_id = node.node_id;
		this.components.neurons.push(n);
		this.neuronsGeom.vertices.push(n);
		switch(node.trump_or_hillary){
			case 0:
				dcol="#ff0000";
				break;
			case 1:
				dcol="#0000ff";
				break;
			case 2:
				dcol="#ff00ff";
				break;
			default:
				dcol="#ffffff";
		}
		this.neuronAttributes.color.value[ i ] = new THREE.Color(dcol); // initial neuron color
		this.neuronAttributes.size.value[ i ] = 100.*Math.pow(node.pagerank,0.36); // initial neuron size
		this.neuronAttributes.affinity.value[ i ] = node.trump_or_hillary;
	}

	// neuron mesh
	this.neuronParticles = new THREE.PointCloud( this.neuronsGeom, this.neuronShaderMaterial );
	this.meshComponents.add( this.neuronParticles );

	this.neuronShaderMaterial.needsUpdate = true;

};

NeuralNetwork.prototype.initAxons = function (data) {
	// var that = this;
	// $.getJSON('./models/EdgeList_guns_Immigration.json', function(data) {
	// 	var edges = data["edges"];
	// 	for ( var k = 0; k < edges.length; k++ ) {
	// 		var n1 = that.components.neurons[ edges[k][0] ];
	// 		var n2 = that.components.neurons[ edges[k][1] ];
	// 		var connectedAxon = n1.connectNeuronTo( n2 );
	// 		that.constructAxonArrayBuffer( connectedAxon );}
	// });
	this.edges = data;
	for ( var k = 0; k < this.edges.length; k++ ) {
		var dcol;
		switch(this.edges[k][2]){
			case "guns":
				dcol="#ffff00";
				break;
			case "terrorism":
				dcol="#00ff00";
				break;
			default:
				dcol="#ffffff";
		}
		var source = this.edges[k][0]
		var target = this.edges[k][1]

		if(Math.random()>0.5){
			var n1 = this.components.neurons.find(function(d) { return d.node_id == source })
			var n2 = this.components.neurons.find(function(d) { return d.node_id == target})
		}
		else{
			var n2 = this.components.neurons.find(function(d) { return d.node_id == source })
			var n1 = this.components.neurons.find(function(d) { return d.node_id == target})
		}

		var connectedAxon = n1.connectNeuronTo( n2 );
		connectedAxon.taint = new THREE.Color(dcol);
		connectedAxon.topic= 1.0*this.edges[k][2];
		this.constructAxonArrayBuffer( connectedAxon );
	}

	var allNeuronsLength = this.components.neurons.length;

	// enable WebGL 32 bit index buffer or get an error
	if ( !renderer.getContext().getExtension( "OES_element_index_uint" ) ) {
		console.error( "32bit index buffer not supported!" );
	}

	var axonIndices = new Uint32Array( this.axonIndices );
	var axonPositions = new Float32Array( this.axonPositions );
	var axonOpacities = new Float32Array( this.axonAttributes.opacity.value );
	var axonTopics = new Float32Array( this.axonAttributes.topic.value );
	var axonTaints = new Float32Array( this.axonAttributes.taint.value );

	this.axonGeom.addAttribute( 'index', new THREE.BufferAttribute( axonIndices, 1 ) );
	this.axonGeom.addAttribute( 'position', new THREE.BufferAttribute( axonPositions, 3 ) );
	this.axonGeom.addAttribute( 'opacity', new THREE.BufferAttribute( axonOpacities, 1 ) );
	this.axonGeom.addAttribute( 'topic', new THREE.BufferAttribute( axonTopics, 1 ) );
	this.axonGeom.addAttribute( 'taint', new THREE.BufferAttribute( axonTaints, 3 ) );
	this.axonGeom.computeBoundingSphere();

	this.axonShaderMaterial = new THREE.ShaderMaterial( {
		uniforms: this.axonUniforms,
		attributes: this.axonAttributes,
		vertexShader: null,
		fragmentShader: null,
		blending: THREE.AdditiveBlending,
		// blending: THREE.MultiplyBlending,
		depthTest: false,
		transparent: true
	} );

	this.axonMesh = new THREE.Line( this.axonGeom, this.axonShaderMaterial, THREE.LinePieces );
	this.meshComponents.add( this.axonMesh );


	var numNotConnected = 0;
	for ( i = 0; i < allNeuronsLength; i++ ) {
		if ( !this.components.neurons[ i ].connection[ 0 ] ) {
			numNotConnected += 1;
		}
	}
	console.log( 'numNotConnected =', numNotConnected );

};

NeuralNetwork.prototype.update = function ( deltaTime ) {

	if ( !this.initialized ) return;

	var n, ii;
	var currentTime = Date.now();

	// update neurons state and release signal
	for ( ii = 0; ii < this.components.neurons.length; ii++ ) {

		n = this.components.neurons[ ii ];

		if ( this.components.allSignals.length < this.settings.currentMaxSignals - this.settings.maxConnectionsPerNeuron ) { // limit total signals currentMaxSignals - maxConnectionsPerNeuron because allSignals can not bigger than particlePool size

			if ( n.receivedSignal && n.firedCount < 8 ) { // Traversal mode
				// if (n.receivedSignal && (currentTime - n.lastSignalRelease > n.releaseDelay) && n.firedCount < 8)  {	// Random mode
				// if (n.receivedSignal && !n.fired )  {	// Single propagation mode
				n.fired = true;
				n.lastSignalRelease = currentTime;
				n.releaseDelay = THREE.Math.randInt( 100, 1000 );
				this.releaseSignalAt( n );
			}

		}

		n.receivedSignal = false; // if neuron recieved signal but still in delay reset it
	}

	// reset all neurons and when there is no signal and trigger release signal at random neuron
	if ( this.components.allSignals.length === 0 ) {

		this.resetAllNeurons();
		this.releaseSignalAt( this.components.neurons[ THREE.Math.randInt( 0, this.components.neurons.length ) ] );

	}

	// update and remove dead signals
	for ( var j = this.components.allSignals.length - 1; j >= 0; j-- ) {
		var s = this.components.allSignals[ j ];
		s.travel( deltaTime );

		if ( !s.alive ) {
			s.particle.free();
			for ( var k = this.components.allSignals.length - 1; k >= 0; k-- ) {
				if ( s === this.components.allSignals[ k ] ) {
					this.components.allSignals.splice( k, 1 );
					break;
				}
			}
		}

	}

	// update particle pool vertices
	this.particlePool.update();

	// update info for GUI
	this.updateInfo();

};

NeuralNetwork.prototype.constructAxonArrayBuffer = function ( axon ) {
	this.components.allAxons.push( axon );
	var vertices = axon.vertices;

	for ( var i = 0; i < vertices.length; i++ ) {

		this.axonPositions.push( vertices[ i ].x, vertices[ i ].y, vertices[ i ].z );
		this.axonAttributes.taint.value.push( axon.taint.r,axon.taint.g,axon.taint.b,axon.taint.r,axon.taint.g,axon.taint.b);

		if ( i < vertices.length - 1 ) {
			var idx = this.axonNextPositionsIndex;
			this.axonIndices.push( idx, idx + 1 );

			var opacity = THREE.Math.randFloat( 0.005, 0.2 );
			this.axonAttributes.opacity.value.push( opacity, opacity );
			this.axonAttributes.topic.value.push( 1.0*(axon.topic),1.0*(axon.topic));


		}

		this.axonNextPositionsIndex += 1;
	}
};

NeuralNetwork.prototype.releaseSignalAt = function ( neuron ) {
	var signals = neuron.createSignal( this.particlePool, this.settings.signalMinSpeed, this.settings.signalMaxSpeed );
	for ( var ii = 0; ii < signals.length; ii++ ) {
		var s = signals[ ii ];
		this.components.allSignals.push( s );
	}
};

NeuralNetwork.prototype.resetAllNeurons = function () {

	this.numPassive = 0;
	for ( var ii = 0; ii < this.components.neurons.length; ii++ ) { // reset all neuron state
		n = this.components.neurons[ ii ];

		if ( !n.fired ) {
			this.numPassive += 1;
		}

		n.reset();

	}
	// console.log( 'numPassive =', this.numPassive );

};

NeuralNetwork.prototype.updateInfo = function () {
	this.numNeurons = this.components.neurons.length;
	this.numAxons = this.components.allAxons.length;
	this.numSignals = this.components.allSignals.length;
};

NeuralNetwork.prototype.updateSettings = function () {

	this.neuronUniforms.opacity.value = this.neuronOpacity;

	for ( i = 0; i < this.components.neurons.length; i++ ) {
		var dcol;
		var af = this.neuronAttributes.affinity.value[ i ];
		switch(af){
			case 0:
				dcol=this.neuronColor_0;
				break;
			case 1:
				dcol=this.neuronColor_1;
				break;
			case 2:
				dcol=this.neuronColor_2;
				break;
			default:
				dcol=this.neuronColor_3;
		}
		// this.neuronAttributes.color.value[ i ] = new THREE.Color(dcol); // initial neuron color
		this.neuronAttributes.color.value[ i ].setStyle( dcol ); // initial neuron color
	}
	this.neuronAttributes.color.needsUpdate = true;

	this.neuronUniforms.sizeMultiplier.value = this.neuronSizeMultiplier;

	this.axonUniforms.color.value.set( this.axonColor );

	this.axonUniforms.color_0.value.set( this.axonColor_0 );
	this.axonUniforms.color_1.value.set( this.axonColor_1 );
	this.axonUniforms.color_2.value.set( this.axonColor_2 );

	this.axonUniforms.opacityMultiplier.value = this.axonOpacityMultiplier;


	for(var i=0; i<this.edges.length; i++) {
		var dcol;
		switch(this.edges[i][2]) {
			case "0":
				dcol=this.axonColor_0;
				break;
			case "1":
				dcol=this.axonColor_1;
				break;
			default:
				dcol=this.axonColor_2;
		}

		var connectedAxon = this.components.allAxons[i]
		var verticesLength = connectedAxon.vertices.length
		var divider = 255

		if(dcol instanceof THREE.Color) {
			divider = 1
		}
		for(var j=0; j<verticesLength; j++) {
			this.axonGeom.attributes.taint.array[i * verticesLength * 6 + j * 6] = dcol.r / divider
			this.axonGeom.attributes.taint.array[i * verticesLength * 6 + j * 6 + 1] = dcol.g / divider
			this.axonGeom.attributes.taint.array[i * verticesLength * 6 + j * 6 + 2] = dcol.b / divider
			this.axonGeom.attributes.taint.array[i * verticesLength * 6 + j * 6 + 3] = dcol.r / divider
			this.axonGeom.attributes.taint.array[i * verticesLength * 6 + j * 6 + 4] = dcol.g / divider
			this.axonGeom.attributes.taint.array[i * verticesLength * 6 + j * 6 + 5] = dcol.b / divider
		}
	}

	this.axonGeom.attributes.taint.needsUpdate = true
	this.particlePool.updateSettings();
};

NeuralNetwork.prototype.testChangOpcAttr = function () {

	var opcArr = this.axonGeom.attributes.opacity.array;
	for ( var i = 0; i < opcArr.length; i++ ) {
		opcArr[ i ] = THREE.Math.randFloat( 0, 0.5 );
	}
	this.axonGeom.attributes.opacity.needsUpdate = true;
};

// Assets & Loaders --------------------------------------------------------

var loadingManager = new THREE.LoadingManager();
loadingManager.onLoad = function () {

	document.getElementById( 'loading' ).style.display = 'none'; // hide loading animation when finished
	console.log( 'Done.' );

	main();

};


loadingManager.onProgress = function ( item, loaded, total ) {

	console.log( loaded + '/' + total, item );

};


var shaderLoader = new THREE.XHRLoader( loadingManager );
shaderLoader.setResponseType( 'text' );

shaderLoader.loadMultiple = function ( SHADER_CONTAINER, urlObj ) {

	_.each( urlObj, function ( value, key ) {

		shaderLoader.load( value, function ( shader ) {

			SHADER_CONTAINER[ key ] = shader;

		} );

	} );

};

var SHADER_CONTAINER = {};
shaderLoader.loadMultiple( SHADER_CONTAINER, {

	neuronVert: 'shaders/neuron.vert',
	neuronFrag: 'shaders/neuron.frag',

	axonVert: 'shaders/axon.vert',
	axonFrag: 'shaders/axon.frag'

} );


var TEXTURES = {};
var textureLoader = new THREE.TextureLoader( loadingManager );
textureLoader.load( 'sprites/electric.png', function ( tex ) {

	TEXTURES.electric = tex;

} );

// Scene --------------------------------------------------------
/* exported updateHelpers */

if ( !Detector.webgl ) {
	Detector.addGetWebGLMessage();
}

var container, stats;
var scene, light, camera, cameraCtrl, renderer;
var WIDTH = window.innerWidth;
var HEIGHT = window.innerHeight;
var pixelRatio = window.devicePixelRatio || 1;
var screenRatio = WIDTH / HEIGHT;
var clock = new THREE.Clock();
var FRAME_COUNT = 0;

// ---- Settings
var sceneSettings = {

	pause: false,
	bgColor: 0x000000,
	enableGridHelper: false,
	enableAxisHelper: false

};

// ---- Scene
container = document.getElementById( 'canvas-container' );
scene = new THREE.Scene();
// scene.fog = new THREE.Fog( "#000000", 1, 15000 );
// scene.fog.color.setHSL( 0.51, 0.4, 0.3 );

// ---- Camera
camera = new THREE.PerspectiveCamera( 75, screenRatio, 1, 5000 );
// camera orbit control
cameraCtrl = new THREE.OrbitControls( camera, container );
cameraCtrl.object.position.y = 150;
cameraCtrl.update();

// ---- Renderer
renderer = new THREE.WebGLRenderer( {
	antialias: true,
	alpha: true
} );
renderer.setSize( WIDTH, HEIGHT );
renderer.setPixelRatio( pixelRatio );
renderer.setClearColor( sceneSettings.bgColor, 1 );
renderer.autoClear = false;
container.appendChild( renderer.domElement );

// ---- Stats
stats = new Stats();
container.appendChild( stats.domElement );

// ---- grid & axis helper
var gridHelper = new THREE.GridHelper( 600, 50 );
gridHelper.setColors( 0x00bbff, 0xffffff );
gridHelper.material.opacity = 0.1;
gridHelper.material.transparent = true;
gridHelper.position.y = -300;
scene.add( gridHelper );

var axisHelper = new THREE.AxisHelper( 50 );
scene.add( axisHelper );

function updateHelpers() {
	axisHelper.visible = sceneSettings.enableAxisHelper;
	gridHelper.visible = sceneSettings.enableGridHelper;
}

/*
 // ---- Lights
 // back light
 light = new THREE.DirectionalLight( 0xffffff, 0.8 );
 light.position.set( 100, 230, -100 );
 scene.add( light );

 // hemi
 light = new THREE.HemisphereLight( 0x00ffff, 0x29295e, 1 );
 light.position.set( 370, 200, 20 );
 scene.add( light );

 // ambient
 light = new THREE.AmbientLight( 0x111111 );
 scene.add( light );
 */

// Main --------------------------------------------------------
/* exported main, updateGuiInfo */

var gui, gui_info, gui_settings;

function main() {

	var neuralNet = window.neuralNet = new NeuralNetwork();
	scene.add( neuralNet.meshComponents );

	initGui();

	run();

}

// GUI --------------------------------------------------------
/* exported iniGui, updateGuiInfo */

function initGui() {

	gui = new dat.GUI();
	gui.width = 270;

	gui_info = gui.addFolder( 'Info' );
	gui_info.add( neuralNet, 'numNeurons' ).name( 'Nodes' );
	gui_info.add( neuralNet, 'numAxons' ).name( 'Links' );
	gui_info.add( neuralNet, 'numSignals', 0, neuralNet.settings.limitSignals ).name( 'Signals' );
	gui_info.autoListen = false;

	gui_settings = gui.addFolder( 'Settings' );
	gui_settings.add( neuralNet.settings, 'currentMaxSignals', 0, neuralNet.settings.limitSignals ).name( 'Max Signals' );
	gui_settings.add( neuralNet.particlePool, 'pSize', 0.2, 2 ).name( 'Signal Size' );
	gui_settings.add( neuralNet.settings, 'signalMinSpeed', 0.0, 8.0, 0.01 ).name( 'Signal Min Speed' );
	gui_settings.add( neuralNet.settings, 'signalMaxSpeed', 0.0, 8.0, 0.01 ).name( 'Signal Max Speed' );
	gui_settings.add( neuralNet, 'neuronSizeMultiplier', 0, 2 ).name( 'Node Size Mult' );
	gui_settings.add( neuralNet, 'neuronOpacity', 0, 1.0 ).name( 'Node Opacity' );
	gui_settings.add( neuralNet, 'axonOpacityMultiplier', 0.0, 0.5,0.001 ).name( 'Link Opacity Mult' );
	gui_settings.addColor( neuralNet.particlePool, 'pColor' ).name( 'Signal Color' );

	gui_settings.addColor( neuralNet, 'neuronColor_0' ).name( 'Trump-Node' );
	gui_settings.addColor( neuralNet, 'neuronColor_1' ).name( 'Clinton-Node' );
	gui_settings.addColor( neuralNet, 'neuronColor_2' ).name( 'Both-Node' );
	gui_settings.addColor( neuralNet, 'neuronColor_3' ).name( 'None-Node' );

	gui_settings.addColor( neuralNet, 'axonColor' ).name( 'Link Color' );
	gui_settings.addColor( neuralNet, 'axonColor_0' ).name( 'Guns-Link' );
	gui_settings.addColor( neuralNet, 'axonColor_1' ).name( 'Terrorism-Link' );
	gui_settings.addColor( neuralNet, 'axonColor_2' ).name( 'Both-Link' );
	gui_settings.addColor( sceneSettings, 'bgColor' ).name( 'Background' );

	gui_info.open();
	gui_settings.open();

	for ( var i = 0; i < gui_settings.__controllers.length; i++ ) {
		gui_settings.__controllers[ i ].onChange( updateNeuralNetworkSettings );
	}

}

function updateNeuralNetworkSettings() {
	neuralNet.updateSettings();
	if ( neuralNet.settings.signalMinSpeed > neuralNet.settings.signalMaxSpeed ) {
		neuralNet.settings.signalMaxSpeed = neuralNet.settings.signalMinSpeed;
		gui_settings.__controllers[ 3 ].updateDisplay();
	}
}

function updateGuiInfo() {
	for ( var i = 0; i < gui_info.__controllers.length; i++ ) {
		gui_info.__controllers[ i ].updateDisplay();
	}
}

// Run --------------------------------------------------------

function update() {

	updateHelpers();

	if ( !sceneSettings.pause ) {

		var deltaTime = clock.getDelta();
		neuralNet.update( deltaTime );
		updateGuiInfo();

	}

}

// ----  draw loop
function run() {

	raycaster.setFromCamera(mouse, camera)
	if(typeof neuralNet.meshComponents.children[1] !== 'undefined') {
		var intersections = raycaster.intersectObject(neuralNet.meshComponents.children[1])
		if(intersections.length) {
			if(!tooltipVisible) {
				openTooltip()
			}
			loadTooltipData({
				body: Math.random(),
				attribution: Math.random()
			})
		} else {
			tooltipVisible = false
			closeTooltip()
		}
	}

	var gamepad;
	if(navigator.getGamepads()[0]){
		var gamepads = navigator.getGamepads();
		gamepad = gamepads[0];
//            console.log(gamepad);
	}
	if(gamepad){
		var ax0 = gamepad.axes[0];
		var ax1 = gamepad.axes[1];
		var ax2 = gamepad.axes[2];
		var ax3 = gamepad.axes[3];
		var b0  = gamepad.buttons[0].pressed;
		var b1  = gamepad.buttons[1].pressed;
		var b2  = gamepad.buttons[2].pressed;

		var b4  = gamepad.buttons[4].pressed;
		var b4r  = gamepad.buttons[4].released;

		var b5  = gamepad.buttons[5].pressed;
		var b6  = gamepad.buttons[6].value;
		var b7  = gamepad.buttons[7].value;
		var b8  = gamepad.buttons[8].value;
		var b12  = gamepad.buttons[12].value;
		var b13  = gamepad.buttons[13].value;
	}
	if (Math.abs(ax3)>0.1&& b7==0){
		var dir=camera.getWorldDirection();
		neuralNet.meshComponents.position.x-=(ax3/3)*dir.x;
		neuralNet.meshComponents.position.z-=(ax3/3)*dir.z;
		neuralNet.meshComponents.position.y-=(ax3/3)*dir.y;

//            camera.translateZ( (ax3/50) );

	}
	else if(Math.abs(ax3)>0.1&& b7>0){
		neuralNet.meshComponents.scale.x-=b7*(ax3/30);
		neuralNet.meshComponents.scale.y-=b7*(ax3/30);
		neuralNet.meshComponents.scale.z-=b7*(ax3/30);
	}

	if (Math.abs(ax0)+Math.abs(ax1)>0.1){
		var dir=camera.getWorldDirection().normalize();

//            pivot.translate( neuralNet.meshComponents.position.x-camera.position.x, neuralNet.meshComponents.position.y-camera.position.y, neuralNet.meshComponents.position.z-camera.position.z );

//            neuralNet.meshComponents.rotation.y+=((Math.abs(ax1) <= 0.1 ? 0 : ax1)/30);

		neuralNet.meshComponents.rotation.x-=(Math.sign(dir.z)*b6*(Math.abs(ax1)<= 0.1 ? 0 : ax1)/90);
		neuralNet.meshComponents.rotation.y+=(b6*(Math.abs(ax0)<= 0.1 ? 0 : ax0)/90);

//            neuralNet.meshComponents.position.z-=(dir.x*(Math.abs(ax1)<= 0.05 ? 0 : ax0)/30);
//            neuralNet.meshComponents.position.x+=(-dir.y*(Math.abs(ax0)<= 0.05 ? 0 : ax1)/30);



//            neuralNet.meshComponents.rotation.z-=(ax0/30)*dir.x;
	}

	if (Math.abs(ax1)>0.1&&b6!=1.){
		neuralNet.meshComponents.position.z+=(ax1/5);
	}
	if (Math.abs(ax0)>0.1&&b6!=1.){
		neuralNet.meshComponents.position.y+=(ax0/5)*dir.x;
		neuralNet.meshComponents.position.x-=(ax0/5)*dir.y;
	}

	requestAnimationFrame( run );
	renderer.setClearColor( sceneSettings.bgColor, 1 );
	renderer.clear();
	update();
	renderer.render( scene, camera );
	stats.update();
	FRAME_COUNT ++;

}

// Events --------------------------------------------------------

window.addEventListener( 'keypress', function ( event ) {

	var key = event.keyCode;

	switch ( key ) {

		case 32:/*space bar*/ sceneSettings.pause = !sceneSettings.pause;
			break;

		case 65:/*A*/
		case 97:/*a*/ sceneSettings.enableGridHelper = !sceneSettings.enableGridHelper;
			break;

		case 83 :/*S*/
		case 115:/*s*/ sceneSettings.enableAxisHelper = !sceneSettings.enableAxisHelper;
			break;

	}

} );


$( function () {
	var timerID;
	$( window ).resize( function () {
		clearTimeout( timerID );
		timerID = setTimeout( function () {
			onWindowResize();
		}, 250 );
	} );
} );


function onWindowResize() {

	WIDTH = window.innerWidth;
	HEIGHT = window.innerHeight;

	pixelRatio = window.devicePixelRatio || 1;
	screenRatio = WIDTH / HEIGHT;

	camera.aspect = screenRatio;
	camera.updateProjectionMatrix();

	renderer.setSize( WIDTH, HEIGHT );
	renderer.setPixelRatio( pixelRatio );

}
