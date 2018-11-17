const Util = require('./util.js');
const Events = require('./events.js');

class EvolveAid {
	constructor(state, contingentEvolvers = []) {
		this.transientStatePaths = [];
		this.lastTime = 0;
	}

	update(time, deltaTime) {
		const state = this.state;

		this.contingentEvolvers.filter(evolver => evolver.condition(state)).
						     	forEach(evolver => evolver.evolve(state, deltaTime));

		const pathsToRemove = [];
		this.transientStatePaths.forEach(path => {
			const prop = Util.getPropAtPath(state, path);
			if (prop.transient) {
				const transState = prop;
				const timeSoFar = time - transState.startTime;
				transState.completion = timeSoFar / transState.duration;

				if (transState.completion >= 1) {
					delete state[path];
					pathsToRemove.push(path);
					Events.enqueue(path + "_finished", transState);
				}
			}
		});

		pathsToRemove.forEach(path => {
			const index = this.transientStatePaths.
							   findIndex(currentPath => currentPath === path);
			this.transientStatePaths.splice(index, 1);
		});

		this.lastTime = time;
	}

	runTransientState(propertyPath, subState, duration) {
		const state = this.state;
		
		const transState = {startTime: this.lastTime, duration, completion: 0, transient: true};
		Util.objSpreadInto(subState, transState);
		Util.setPropAtPath(state, propertyPath, transState);

		this.transientStatePaths.push(propertyPath);
	}
}

module.exports = EvolveAid;