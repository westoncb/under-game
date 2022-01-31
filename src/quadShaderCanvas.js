const THREE = require("three")
const Stats = require("stats-js")
const AppState = require("./appState.js")

/*
	This takes care of all the essentially boilerplate to draw on a full-canvas
	quad with a fragment shader. Does the three.js mesh/material and camera setup,
	places the three.js canvas into some designated element, handles resizing.
*/

class QuadShaderCanvas {
    /*
		containerElementId: id of a dom element which the three.js canvas should be fit to.
		fragmentShader: string containing the text of a fragment shader.
	*/
    constructor(containerElementId, fragmentShader, options = {}) {
        this.containerElementId = containerElementId
        const containerElement = document.getElementById(
            this.containerElementId
        )

        this.width = containerElement.offsetWidth
        this.height = containerElement.offsetHeight

        this.resizeCallback = options.resizeHandler

        this.initThreeJS(options.showStats)
        this.initScene(fragmentShader)

        this.updateCanvasSize()
    }

    initThreeJS(showStats) {
        this.renderer = new THREE.WebGLRenderer({ antialias: false })
        this.renderer.setPixelRatio(1) // this was using window.devicePixelRatio
        this.renderer.setSize(this.width, this.height)
        document
            .getElementById(this.containerElementId)
            .appendChild(this.renderer.domElement)

        if (showStats) {
            this.stats = new Stats()
            this.stats.setMode(0)
            this.stats.domElement.style.position = "absolute"
            this.stats.domElement.style.left = "0px"
            this.stats.domElement.style.top = "0px"
            document.body.appendChild(this.stats.domElement)
        }

        this.scene = new THREE.Scene()
        this.camera = new THREE.OrthographicCamera(
            this.width / -2,
            this.width / 2,
            this.height / 2,
            this.height / -2,
            1,
            2
        )
        this.scene.add(this.camera)

        window.addEventListener(
            "resize",
            this.updateCanvasSize.bind(this),
            false
        )
    }

    initScene(fragmentShader) {
        const uniforms = {
            time: { value: 1.0 },
            resolution: { value: new THREE.Vector2(this.width, this.height) },
            aspectRatio: { value: this.width / this.height },
        }

        const geometry = new THREE.PlaneBufferGeometry(this.width, this.height)
        const material = new THREE.RawShaderMaterial({
            uniforms,
            vertexShader: this.getVertexShader(),
            fragmentShader,
        })
        this.mesh = new THREE.Mesh(geometry, material)
        this.scene.add(this.mesh)
        this.uniforms = material.uniforms
    }

    getVertexShader() {
        const vs = `
			attribute vec3 position;

			void main(void) {
			  gl_Position = vec4(position, 1.0);
			}
		`

        return vs
    }

    render() {
        if (this.stats) this.stats.begin()

        this.renderer.render(this.scene, this.camera)

        if (this.stats) this.stats.end()
    }

    updateCanvasSize() {
        const containerElement = document.getElementById(
            this.containerElementId
        )
        this.width = containerElement.offsetWidth
        this.height = containerElement.offsetHeight
        this.renderer.setSize(this.width, this.height)
        this.camera.updateProjectionMatrix()

        AppState.canvasWidth = this.width * 1 // these were using window.devicePixelRatio
        AppState.canvasHeight = this.height * 1

        this.uniforms.resolution.value.x = AppState.canvasWidth
        this.uniforms.resolution.value.y = AppState.canvasHeight

        this.uniforms.aspectRatio.value = this.width / this.height

        if (this.resizeCallback) {
            this.resizeCallback(AppState.canvasWidth, AppState.canvasHeight)
        }
    }
}

module.exports = QuadShaderCanvas
