const THREE = require('three');
const EventQueue = require('./eventQueue.js');
const Simulation = require('./simulation.js');
const GameStateTransformer = require('./gameStateTransformer.js');

window.onload = () => {
	const simulation = new Simulation();

	EventQueue.enqueue('change_transformer', {transformer: new GameStateTransformer()});

	const clock = new THREE.Clock();

	class MainLoop {
		static update(time) {
			requestAnimationFrame( MainLoop.update );

			simulation.update(time, clock.getDelta());
			simulation.render();

		}
	}

	MainLoop.update(0);
};