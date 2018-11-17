const StateTransformer = require('./StateTransformer.js');
const EventQueue = require('./eventQueue.js');

class Simulation extends StateTransformer {
	constructor() {
		super();

		this.subTransformer = new EmptyStateTransformer();
	}

	update(time, deltaTime) {
		while(!EventQueue.empty()) {
			this.handleEvent(EventQueue.dequeue());
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