/**
 * Builds a FrameBuffer with a color component and optionally a depth component
 * \param  gl      webGL context to create the framebuffer on and to use for the binding operations
 * \param  width   width of the framebuffer
 * \param  height  height of the framebuffer
 * \param  hasDepthBuffer if set to true a depth texture is created and attached to the framebuffer
 * \param  dataType (optional) openGL type of the color texture. 
 */
function FrameBuffer(gl, width, height, hasDepthBuffer, dataType)
{
	if (typeof(dataType) == "undefined") dataType = gl.UNSIGNED_BYTE;

	this.fb = gl.createFramebuffer();
	gl.bindFramebuffer(gl.FRAMEBUFFER, this.fb);
	this.width = width;
	this.height = height;
	this.dataType = dataType;

	this.fbTexture = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_2D, this.fbTexture);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
	// WebGL needs these settings for non power of two textures
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.width, this.height, 0, gl.RGBA, dataType, null);

	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.fbTexture, 0);

	if (hasDepthBuffer)
	{
		this.depthBuffer = gl.createRenderbuffer();
		gl.bindRenderbuffer(gl.RENDERBUFFER, this.depthBuffer);
		gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, this.width, this.height);
		gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, this.depthBuffer);
	}

	/**
	 * Detaches the current framebuffer and binds the default one
	 */
	this.detach = function()
	{
		gl.bindTexture(gl.TEXTURE_2D, null);
		gl.bindRenderbuffer(gl.RENDERBUFFER, null);
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
	}

	/**
	 * Binds the framebuffer to the webGL context
	 */
	this.attach = function()
	{
		gl.bindFramebuffer(gl.FRAMEBUFFER, this.fb);
	}

	/**
	 * Binds the color component of the framebuffer as texture
	 */
	this.bindAsTexture = function()
	{
		gl.bindTexture(gl.TEXTURE_2D, this.fbTexture);
	}

	// Detach everything
	this.detach();
}

/**
 * Represents a shader program composed of a vertex and fragment shader
 * \param  gl      webGL context to create the program onto and to operate onto
 * \param  vertShaderId  script element id, where the vertex shader source resides
 * \param  fragShaderId  script element id, where the fragment shader source resides
 */
function ShaderProgram(gl, vertShaderId, fragShaderId)
{
	var _createShader = function(shaderId, type)
	{
		var source = document.getElementById(shaderId).innerHTML;
		var shader = gl.createShader(type);

		gl.shaderSource(shader, source);
		gl.compileShader(shader);

		if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
			alert(shaderId + ": " + gl.getShaderInfoLog(shader));
			return null;
		}

		return shader;
	}

	this.vs = _createShader(vertShaderId, gl.VERTEX_SHADER);
	this.fs = _createShader(fragShaderId, gl.FRAGMENT_SHADER);

	this.program = gl.createProgram();
	gl.attachShader(this.program, this.vs);
	gl.attachShader(this.program, this.fs);
	gl.linkProgram(this.program);

	var linked = gl.getProgramParameter(this.program, gl.LINK_STATUS);
	if (!linked) {
		// An error occurred while linking
		var lastError = gl.getProgramInfoLog(this.program);
		alert("Error in program linking:" + lastError);
		gl.deleteProgram(this.program);
	}

	this.attributes = {};
	this.uniforms = {};

	/**
	 * Register the shader program as the current on the webGL context
	 */
	this.use = function()
	{
		gl.useProgram(this.program);
	}

	/**
	 * Informs the ShaderProgram object of an attribute name used in the shader 
	 */
	this.registerAttribute = function(name)
	{
		this.attributes[name] = gl.getAttribLocation(this.program, name);
	}

	/**
	 * Informs the ShaderProgram object of an uniform variable name used in the shader 
	 */
	this.registerUniform = function(name)
	{
		this.uniforms[name] = gl.getUniformLocation(this.program, name);
	}

	/**
	 * Assigns the given matrix (mat) to the given uniform variable (name)
	 */
	this.setUniformMatrix = function(name, mat)
	{
		gl.uniformMatrix4fv(this.uniforms[name], false, mat);
	}

	/**
	 * Assigns the given integer value (val) to the given uniform variable (name) 
	 */
	this.setUniformInt = function(name, val)
	{
		gl.uniform1i(this.uniforms[name], val);
	}

	/**
	 * Assigns the given floating point value (val) to the given uniform variable (name) 
	 */
	this.setUniformFloat = function(name, val)
	{
		gl.uniform1f(this.uniforms[name], val);
	}
}

/**
 * Represents a unit cube (1 units per side) centered at the origin. Furthermore it contains information
 * about the resolution and number of slices contained in the 3d data. Note that the resolution of the
 * volume is assumed to be isotropic in x,y and z.
 */
function VolumeCubeDomain(gl, sliceWidth, sliceHeight, slices, slicesPerRow)
{
	this.sliceWidth = sliceWidth;
	this.sliceHeight = sliceHeight;
	this.slices = slices;
	this.slicesPerRow = slicesPerRow;

	// Create vertex buffer for the cube (note that this assumes isotropic resolution)
	var cubeWidth = 1.0;
	var cubeHeight = sliceHeight / sliceWidth;
	var cubeDepth = slices / sliceWidth;
	this.cubeDimensions = {w:cubeWidth, h:cubeHeight, d:cubeDepth};

	this.cubeVertexBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, this.cubeVertexBuffer);
	vertices = [
		// Front face
		-0.5, -0.5,  0.5,
		 0.5, -0.5,  0.5,
		 0.5,  0.5,  0.5,
		-0.5,  0.5,  0.5,
		// Back face
		-0.5, -0.5, -0.5,
		-0.5,  0.5, -0.5,
		 0.5,  0.5, -0.5,
		 0.5, -0.5, -0.5,
		// Top face
		-0.5,  0.5, -0.5,
		-0.5,  0.5,  0.5,
		 0.5,  0.5,  0.5,
		 0.5,  0.5, -0.5,
		// Bottom face
		-0.5, -0.5, -0.5,
		 0.5, -0.5, -0.5,
		 0.5, -0.5,  0.5,
		-0.5, -0.5,  0.5,
		// Right face
		 0.5, -0.5, -0.5,
		 0.5,  0.5, -0.5,
		 0.5,  0.5,  0.5,
		 0.5, -0.5,  0.5,
		// Left face
		-0.5, -0.5, -0.5,
		-0.5, -0.5,  0.5,
		-0.5,  0.5,  0.5,
		-0.5,  0.5, -0.5,
	];
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);		
	this.cubeVertexBuffer.itemSize = 3;
	this.cubeVertexBuffer.numItems = 24;

	this.cubeIndexBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.cubeIndexBuffer);
	var cubeVertexIndices = [
		0, 1, 2,      0, 2, 3,    // Front face
		4, 5, 6,      4, 6, 7,    // Back face
		8, 9, 10,     8, 10, 11,  // Top face
		12, 13, 14,   12, 14, 15, // Bottom face
		16, 17, 18,   16, 18, 19, // Right face
		20, 21, 22,   20, 22, 23  // Left face
	];
	gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(cubeVertexIndices), gl.STATIC_DRAW);
	this.cubeIndexBuffer.itemSize = 1;
	this.cubeIndexBuffer.numItems = 36;

	/**
	 * Draws the unit cube using the currently bound shader
	 */
	this.render = function(vertexPositionAttribute)
	{
		gl.bindBuffer(gl.ARRAY_BUFFER, this.cubeVertexBuffer, this.cubeVertexBuffer.itemSize, gl.FLOAT, false, 0, 0);
		gl.vertexAttribPointer(vertexPositionAttribute, this.cubeVertexBuffer.itemSize, gl.FLOAT, false, 0, 0);
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.cubeIndexBuffer);
		gl.drawElements(gl.TRIANGLES, this.cubeIndexBuffer.numItems, gl.UNSIGNED_SHORT, 0);
	}
}

/**
 * Represents a fullscreen quad (when MVP matrix is set to identity) which spans from -1 to 1 on the
 * xy-plane and has the z-component equal to 0
 */
function FullscreenQuad(gl)
{
	this.vertexBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
	vertices = [
		// Front face
		-1.0, -1.0,  0.0,
		 1.0, -1.0,  0.0,
		 1.0,  1.0,  0.0,
		-1.0,  1.0,  0.0,
	];
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);		
	this.vertexBuffer.itemSize = 3;
	this.vertexBuffer.numItems = 4;

	/**
	 * Draws the fullscreen quad using the currently bound shader
	 */
	this.render = function(vertexPositionAttribute)
	{
		gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer, this.vertexBuffer.itemSize, gl.FLOAT, false, 0, 0);
		gl.vertexAttribPointer(vertexPositionAttribute, this.vertexBuffer.itemSize, gl.FLOAT, false, 0, 0);
		gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
	}
}

/**
 * Represents a full direct volume renderer.
 */
function VolumeRenderer() {
	this.gl = null;
	this.canvas = null;
	this.gldata = null;
	this.anim = null;

	this.framebuffers = {};
	this.textures = {};
	this.shaders = {};
	this.domainCube = null;
	this.viewportQuad = null;

	/**
	 * The renderer needs first to be bound to a canvas and obtain a webGL context.
	 * This function will also try to enable the extensions that are needed for it to function.
	 * The function returns true if the initialization was successful, otherwise false
	 */
	this.initGL = function(canvas)
	{
		try {
			this.canvas = canvas;
			this.gl = canvas.getContext("webgl");
			if (this.gl === null)
				throw "Couldn't get a WebGL context"

			this.gl.viewportWidth = canvas.width;
			this.gl.viewportHeight = canvas.height;
			this.anim = {angle: 0.0};
			// Enable additional extensions
			if (this.gl.getExtension("OES_texture_float") === null)
				throw "Your device does not support float textres!";

			this._initShaders();
			this._initFramebuffers();
			this.viewportQuad = new FullscreenQuad(this.gl);
		} catch (e) {
			this.canvas = null;
			this.gl = null;
			console.error(e);
		}

		return this.gl !== null;
	}

	this._initShaders = function()
	{
		if (this.gl == null) return;
		var gl = this.gl;
		
		var p = new ShaderProgram(gl, "entry-exitpoints-vs", "entry-exitpoints-fs");
		p.registerAttribute("aVertexPosition");
		p.registerUniform("uModelViewMatrix");
		p.registerUniform("uProjectionMatrix");
		this.shaders.entryExitPoints = p;

		var p = new ShaderProgram(gl, "volume-vs", "volume-fs");
		p.registerAttribute("aVertexPosition");
		p.registerUniform("uEntryPointsSampler");
		p.registerUniform("uExitPointsSampler");
		p.registerUniform("uVolumeTexture");
		p.registerUniform("uNumSlices");
		p.registerUniform("uSlicesPerRow");
		p.registerUniform("uSliceWidth");
		p.registerUniform("uSliceHeight");
		this.shaders.volume = p;
	}

	/* ================================
	 * Data initialization
	 * ================================ */

	this._initFramebuffers = function()
	{
		var gl = this.gl;
		this.framebuffers.exitpoints = new FrameBuffer(gl, gl.viewportWidth, gl.viewportHeight, true, gl.FLOAT);
		this.framebuffers.entrypoints = new FrameBuffer(gl, gl.viewportWidth, gl.viewportHeight, true, gl.FLOAT);
	}

	/**
	 * Allows to set the currently displayed volumetric image
	 */
	this.initVolumeGeometry = function(volumeTexture, sliceWidth, sliceHeight, slices, slicesPerRow)
	{
		if (this.gl == null) return;
		var gl = this.gl;
		var shaders = this.shaders;

		this.domainCube = new VolumeCubeDomain(gl, sliceWidth, sliceHeight, slices, slicesPerRow);

		texture = gl.createTexture();
		texture.image = new Image();
		texture.isLoaded = false;
		texture.image.onload = function()
		{
			gl.bindTexture(gl.TEXTURE_2D, texture);
			gl.pixelStorei(gl.PACK_ALIGNMENT, true);
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, gl.LUMINANCE, gl.UNSIGNED_BYTE, texture.image);
			// WebGL needs these settings for non power of two textures
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
			gl.bindTexture(gl.TEXTURE_2D, null);
			texture.isLoaded = true;

			// Set volume shader properties
			shaders.volume.setUniformInt("uNumSlices", slices);
			shaders.volume.setUniformInt("uSlicesPerRow", slicesPerRow);
			shaders.volume.setUniformFloat("uSliceWidth", sliceWidth / texture.image.width);
			shaders.volume.setUniformFloat("uSliceHeight", sliceHeight / texture.image.height);

			console.log(slices, slicesPerRow, sliceWidth / texture.image.width, sliceHeight / texture.image.height)
		}
		texture.image.src = volumeTexture;
		this.textures.volume = texture;
	}

	this._setMatrices = function(program)
	{
		var modelView = mat4.create();
		var projection = mat4.create();

		var x = Math.cos(this.anim.angle);
		var y = Math.sin(this.anim.angle);
		var z = 0.5 + 0.5 * Math.cos(this.anim.angle * 0.2);
		pos = vec3.fromValues(x, y, z);
		vec3.normalize(pos, pos);
		vec3.scale(pos, pos, 2);

		var viewM = mat4.create(); mat4.lookAt(viewM, pos, vec3.fromValues(0,0,0), vec3.fromValues(0, 0, 1));
		var modelM = mat4.create();
		var cd = this.domainCube.cubeDimensions;
		mat4.scale(modelM, mat4.create(), vec3.fromValues(cd.w, cd.h, cd.d));
		mat4.mul(modelView, viewM, modelM);
		mat4.perspective(projection, 45/180*3.14, this.gl.viewportWidth / this.gl.viewportHeight, 0.1, 100.0);

		program.setUniformMatrix("uProjectionMatrix", projection);
		program.setUniformMatrix("uModelViewMatrix", modelView);
	}

	/**
	 * This function updates the camera position based on the elapsed time
	 */
	this.update = function(elapsed)
	{
		this.anim.angle += elapsed/1000;
	}

	/**
	 * This function displays the current volume
	 */
	this.draw = function()
	{
		// Draws the volume. The technique works as follows:
		// 1) Calculate the exit points by using the entryExitPoints shader program
		//    Store this information into a framebuffer
		// 1) Calculate the entry points by using the entryExitPoints shader program
		//    Store this information into a framebuffer
		if (this.gl == null) return;
		var gl = this.gl;

		// 0) Prepare shader for entry and exit points calculation as well as shared opengl state
		var program = this.shaders.entryExitPoints;
		program.use();
		this._setMatrices(program);
		gl.clearColor(0.0, 0.0, 0.0, 0.0);
		gl.enableVertexAttribArray(0);
		gl.enable(gl.DEPTH_TEST);
		
		// 1) EntryPoints to FRAMEBUFFER
		this.framebuffers.exitpoints.attach();
		gl.depthFunc(gl.GREATER);
		gl.clearDepth(-1);
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

		this.domainCube.render(program.attributes.aVertexPosition);
		this.framebuffers.exitpoints.detach();

		// 2) ExitPoints of 
		gl.depthFunc(gl.LESS);
		gl.clearDepth(+1);
		this.framebuffers.entrypoints.attach();
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

		this.domainCube.render(program.attributes.aVertexPosition);
		this.framebuffers.entrypoints.detach();

		// 3) Use the volume shader to do the integration
		program = this.shaders.volume;
		program.use();
		gl.depthFunc(gl.GREATER);
		gl.clearDepth(-1);
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

		// bind previous renderbuffer texture
		gl.activeTexture(gl.TEXTURE0);
		this.framebuffers.entrypoints.bindAsTexture()
		gl.activeTexture(gl.TEXTURE1);
		this.framebuffers.exitpoints.bindAsTexture();

		program.setUniformInt("uEntryPointsSampler", 0);
		program.setUniformInt("uExitPointsSampler", 1);
		if (this.textures.volume.isLoaded) {
			gl.activeTexture(gl.TEXTURE2);
			gl.bindTexture(gl.TEXTURE_2D, this.textures.volume);
			program.setUniformInt("uVolumeTexture", 2);
		}
		this.viewportQuad.render();
	}
}