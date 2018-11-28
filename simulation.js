const StateTransformer = require('./StateTransformer.js');
const Events = require('./events.js');

/*
	This Simulation StateTransformer is always running and just
	manages other StateTransformers. It's responsible for swapping
	StateTransformers in response to 'change_transformer' events
	and calling the framework methods (e.g. update(...)/handleEvent(...))
	on the current StateTransformer.
*/

class Simulation extends StateTransformer {
	constructor() {
		super();

		this.subTransformer = new EmptyStateTransformer();
	}

	update(time, deltaTime) {
		while(!Events.empty()) {
			this.handleEvent(Events.dequeue());
		}

		this.subTransformer.update(time, deltaTime);
	}

	handleEvent(event) {
		if (event.name === 'change_transformer') {
			this.swapSubTransformer(event.data.transformer);
		} else {
			this.subTransformer.handleEvent(event);
		}
	}

	render() {
		this.subTransformer.render();
	}

	swapSubTransformer(newTransformer) {
		this.subTransformer.tearDown();

		newTransformer.setUp();

		this.subTransformer = newTransformer;
	}

	setUp() {}
	tearDown() {}
}

class EmptyStateTransformer extends StateTransformer {}

module.exports = Simulation;