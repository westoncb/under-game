const EventQueue = require('./eventQueue.js');
const Simulation = require('./simulation.js');
const GameStateTransformer = require('./gameStateTransformer.js');

window.onload = () => {
	const simulation = new Simulation();

	EventQueue.push({name: 'change_transformer', transformer: new GameStateTransformer()});

	class MainLoop {
		static update(time) {
			requestAnimationFrame( MainLoop.update );

			simulation.update(time, time - MainLoop.lastTime);
			simulation.render();

			MainLoop.lastTime = time;
		}
	}

	MainLoop.lastTime = 0;
	MainLoop.update();
};